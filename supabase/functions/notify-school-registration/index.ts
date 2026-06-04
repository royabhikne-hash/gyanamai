import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotifySchoolRequest {
  studentId: string;
  studentName: string;
  studentClass: string;
  schoolId: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("notify-school-registration function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: require a valid JWT from the registering student and verify
    // the schoolId matches the student's own school_id. Prevents attackers
    // from spoofing fake registrations to arbitrary schools.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const jwt = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(jwt);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the caller's student row and use its trusted school_id, name,
    // and class — ignore body claims for those fields.
    const { data: student } = await supabase
      .from("students")
      .select("id, full_name, class, school_id")
      .eq("user_id", claimsData.claims.sub)
      .maybeSingle();
    if (!student?.id || !student.school_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Student or school not found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const studentId = student.id;
    const studentName = student.full_name;
    const studentClass = student.class;
    const schoolId = student.school_id;
    console.log("Processing notification for student:", studentName, "school:", schoolId);

    // Get school details
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("name, email, contact_whatsapp")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      console.error("School not found:", schoolError);
      return new Response(
        JSON.stringify({ success: false, error: "School not found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("School found:", school.name);

    const notifications: { type: string; success: boolean; message: string }[] = [];

    // Send WhatsApp notification if school has WhatsApp
    if (school.contact_whatsapp) {
      try {
        const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioWhatsappFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");

        if (twilioSid && twilioAuthToken && twilioWhatsappFrom) {
          const message = `🎓 *New Student Registration*\n\nA new student has registered and is awaiting approval:\n\n👤 Name: ${studentName}\n📚 Class: ${studentClass}\n\nPlease login to your school dashboard to review and approve this registration.`;

          const formattedPhone = school.contact_whatsapp.startsWith("+") 
            ? school.contact_whatsapp 
            : `+91${school.contact_whatsapp.replace(/\D/g, "").slice(-10)}`;

          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
          const formData = new URLSearchParams();
          formData.append("To", `whatsapp:${formattedPhone}`);
          formData.append("From", twilioWhatsappFrom);
          formData.append("Body", message);

          const twilioResponse = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData.toString(),
          });

          if (twilioResponse.ok) {
            console.log("WhatsApp notification sent successfully");
            notifications.push({ type: "whatsapp", success: true, message: "WhatsApp sent" });
          } else {
            const errorText = await twilioResponse.text();
            console.error("Twilio error:", errorText);
            notifications.push({ type: "whatsapp", success: false, message: errorText });
          }
        } else {
          console.log("Twilio credentials not configured");
          notifications.push({ type: "whatsapp", success: false, message: "Twilio not configured" });
        }
      } catch (twilioError) {
        console.error("WhatsApp error:", twilioError);
        notifications.push({ type: "whatsapp", success: false, message: String(twilioError) });
      }
    }

    // Log notification (for email, would need Resend setup)
    if (school.email) {
      console.log("Email notification would be sent to:", school.email);
      notifications.push({ type: "email", success: false, message: "Email service not configured" });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Notification processed",
        notifications 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in notify-school-registration:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
