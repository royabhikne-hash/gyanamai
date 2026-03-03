import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SchoolStudentApprovalRequest {
  action: "approve" | "reject" | "bulk_approve" | "bulk_reject";
  schoolId: string;
  schoolUuid: string;
  sessionToken: string; // Required session token for validation
  studentId?: string;
  studentIds?: string[];
  rejectionReason?: string;
}

// Validate session token from database
async function validateSessionToken(
  supabase: any,
  token: string,
  expectedUserType: 'admin' | 'school',
  expectedUserId?: string
): Promise<{ valid: boolean; userId?: string; userType?: string }> {
  const { data, error } = await supabase
    .from('session_tokens')
    .select('user_id, user_type, expires_at, is_revoked')
    .eq('token', token)
    .maybeSingle();
  
  if (error || !data) {
    return { valid: false };
  }
  
  if (data.is_revoked || new Date(data.expires_at) < new Date()) {
    return { valid: false };
  }
  
  if (data.user_type !== expectedUserType) {
    return { valid: false };
  }
  
  if (expectedUserId && data.user_id !== expectedUserId) {
    return { valid: false };
  }
  
  return { valid: true, userId: data.user_id, userType: data.user_type };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SchoolStudentApprovalRequest;

    // Validate required fields
    if (!body?.action || !body?.schoolId || !body?.schoolUuid || !body?.sessionToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields including session token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isBulk = body.action === "bulk_approve" || body.action === "bulk_reject";
    if (!isBulk && !body.studentId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing student ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (isBulk && (!body.studentIds || body.studentIds.length === 0)) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing student IDs for bulk operation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing backend env vars");
      return new Response(
        JSON.stringify({ success: false, error: "Backend configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate session token against database (support both school and coaching)
    let validation = await validateSessionToken(admin, body.sessionToken, 'school', body.schoolUuid);
    if (!validation.valid) {
      validation = await validateSessionToken(admin, body.sessionToken, 'coaching', body.schoolUuid);
    }
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify institution exists and is not banned (school or coaching)
    let institutionName = "";
    const isCoaching = validation.userType === 'coaching';
    
    if (isCoaching) {
      const { data: cc, error: ccError } = await admin
        .from("coaching_centers")
        .select("id, name, coaching_id, is_banned, fee_paid")
        .eq("id", body.schoolUuid)
        .maybeSingle();

      if (ccError || !cc) {
        return new Response(
          JSON.stringify({ success: false, error: "Coaching center validation failed" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (cc.is_banned) {
        return new Response(
          JSON.stringify({ success: false, error: "Coaching center is banned" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (cc.fee_paid === false) {
        return new Response(
          JSON.stringify({ success: false, error: "Access suspended due to unpaid fees" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      institutionName = cc.name;
    } else {
      const { data: school, error: schoolError } = await admin
        .from("schools")
        .select("id, name, school_id, is_banned, fee_paid")
        .eq("id", body.schoolUuid)
        .eq("school_id", body.schoolId)
        .maybeSingle();

      if (schoolError || !school) {
        return new Response(
          JSON.stringify({ success: false, error: "School validation failed" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (school.is_banned) {
        return new Response(
          JSON.stringify({ success: false, error: "School is banned" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (school.fee_paid === false) {
        return new Response(
          JSON.stringify({ success: false, error: "School access suspended due to unpaid fees" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      institutionName = school.name;
    }

    // Handle bulk operations
    if (isBulk) {
      const studentIds = body.studentIds!;
      
      const { data: students, error: studentsError } = await admin
        .from("students")
        .select("id, school_id, coaching_center_id")
        .in("id", studentIds);

      if (studentsError) {
        console.error("Students lookup error:", studentsError);
        return new Response(
          JSON.stringify({ success: false, error: "Students lookup failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const invalidStudents = students?.filter(s => 
        isCoaching ? s.coaching_center_id !== body.schoolUuid : s.school_id !== body.schoolUuid
      ) || [];
      if (invalidStudents.length > 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Some students do not belong to this institution" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (body.action === "bulk_approve") {
        const { error: updateError } = await admin
          .from("students")
          .update({
            is_approved: true,
            approved_at: new Date().toISOString(),
            rejection_reason: null,
          })
          .in("id", studentIds);

        if (updateError) {
          console.error("Bulk approve error:", updateError);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to approve students" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, status: "approved", count: studentIds.length }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const reason = (body.rejectionReason || "No reason provided").trim();
      const { error: rejectError } = await admin
        .from("students")
        .update({
          is_approved: false,
          rejection_reason: reason,
        })
        .in("id", studentIds);

      if (rejectError) {
        console.error("Bulk reject error:", rejectError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to reject students" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, status: "rejected", count: studentIds.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single student operations
    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, school_id, coaching_center_id")
      .eq("id", body.studentId)
      .maybeSingle();

    const belongsToInstitution = isCoaching 
      ? student?.coaching_center_id === body.schoolUuid
      : student?.school_id === body.schoolUuid;

    if (studentError || !student || !belongsToInstitution) {
      return new Response(
        JSON.stringify({ success: false, error: "Student not found for this institution" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.action === "approve") {
      const { error: updateError } = await admin
        .from("students")
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq("id", body.studentId);

      if (updateError) {
        console.error("Approve update error:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to approve student" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, status: "approved" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reason = (body.rejectionReason || "No reason provided").trim();

    const { error: rejectError } = await admin
      .from("students")
      .update({
        is_approved: false,
        rejection_reason: reason,
      })
      .eq("id", body.studentId);

    if (rejectError) {
      console.error("Reject update error:", rejectError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to reject student" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, status: "rejected" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("school-student-approval error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

Deno.serve(handler);
