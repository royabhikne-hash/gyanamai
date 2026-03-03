import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const bcryptAny: any = bcrypt;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Validate session token
async function validateSessionToken(
  supabase: any,
  token: string,
  expectedUserType?: string,
  expectedUserId?: string
): Promise<{ valid: boolean; userId?: string; userType?: string }> {
  const { data, error } = await supabase
    .from("session_tokens")
    .select("user_id, user_type, expires_at, is_revoked")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return { valid: false };
  if (data.is_revoked || new Date(data.expires_at) < new Date()) return { valid: false };
  if (expectedUserType && data.user_type !== expectedUserType) return { valid: false };
  if (expectedUserId && data.user_id !== expectedUserId) return { valid: false };

  return { valid: true, userId: data.user_id, userType: data.user_type };
}

function generateSecureCredentials(): { id: string; password: string } {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const idLength = 12;
  const passLength = 16;

  let id = "CC_";
  let password = "";

  const randomBytes = crypto.getRandomValues(new Uint8Array(idLength + passLength));

  for (let i = 0; i < idLength; i++) {
    id += chars[randomBytes[i] % chars.length];
  }

  for (let i = 0; i < passLength; i++) {
    password += chars[randomBytes[idLength + i] % chars.length];
  }

  return { id, password };
}

async function hashPassword(password: string): Promise<string> {
  const salt = bcryptAny.genSaltSync(12);
  return bcryptAny.hashSync(password, salt);
}

const SESSION_EXPIRY_HOURS = 60 * 24; // 60 days

async function createSessionToken(
  supabase: any,
  userId: string,
  userType: string,
  clientIp: string,
  userAgent: string
): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

  await supabase.from("session_tokens").insert({
    token,
    user_id: userId,
    user_type: userType,
    expires_at: expiresAt.toISOString(),
    ip_address: clientIp,
    user_agent: userAgent,
  });

  return token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, adminCredentials, coachingData, sessionToken, identifier, password, newPassword } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // ============ ADMIN: Create Coaching Center ============
    if (action === "create_coaching_center") {
      if (!adminCredentials?.sessionToken) {
        return new Response(
          JSON.stringify({ error: "Admin authentication required" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validation = await validateSessionToken(supabase, adminCredentials.sessionToken, "admin");
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired admin session" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const credentials = generateSecureCredentials();
      const hashedPassword = await hashPassword(credentials.password);

      const { data: newCC, error } = await supabase
        .from("coaching_centers")
        .insert({
          coaching_id: credentials.id,
          password_hash: hashedPassword,
          name: coachingData.name,
          district: coachingData.district || null,
          state: coachingData.state || null,
          email: coachingData.email || null,
          contact_whatsapp: coachingData.contact_whatsapp || null,
          password_updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Create coaching center error:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          coachingCenter: newCC,
          credentials: { id: credentials.id, password: credentials.password },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ADMIN: Update Coaching Center ============
    if (action === "update_coaching_center") {
      if (!adminCredentials?.sessionToken) {
        return new Response(
          JSON.stringify({ error: "Admin authentication required" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validation = await validateSessionToken(supabase, adminCredentials.sessionToken, "admin");
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired admin session" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { coachingId, updates } = coachingData;
      const { error } = await supabase
        .from("coaching_centers")
        .update(updates)
        .eq("id", coachingId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ADMIN: Delete Coaching Center ============
    if (action === "delete_coaching_center") {
      if (!adminCredentials?.sessionToken) {
        return new Response(
          JSON.stringify({ error: "Admin authentication required" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validation = await validateSessionToken(supabase, adminCredentials.sessionToken, "admin");
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired admin session" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("coaching_centers")
        .delete()
        .eq("id", coachingData.coachingId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ADMIN: Force Password Reset for Coaching ============
    if (action === "force_password_reset_coaching") {
      if (!adminCredentials?.sessionToken) {
        return new Response(
          JSON.stringify({ error: "Admin authentication required" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validation = await validateSessionToken(supabase, adminCredentials.sessionToken, "admin");
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired admin session" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newPw = generateSecureCredentials().password;
      const hashedPw = await hashPassword(newPw);

      await supabase
        .from("coaching_centers")
        .update({
          password_hash: hashedPw,
          password_reset_required: true,
          password_updated_at: new Date().toISOString(),
        })
        .eq("id", coachingData.coachingId);

      // Revoke all sessions
      await supabase
        .from("session_tokens")
        .update({ is_revoked: true })
        .eq("user_id", coachingData.coachingId)
        .eq("user_type", "coaching");

      return new Response(
        JSON.stringify({ success: true, newPassword: newPw }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ COACHING: Login ============
    if (action === "coaching_login") {
      if (!identifier || !password) {
        return new Response(
          JSON.stringify({ error: "Coaching ID and password required" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: cc, error } = await supabase
        .from("coaching_centers")
        .select("*")
        .eq("coaching_id", identifier)
        .maybeSingle();

      if (error || !cc) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (cc.is_banned) {
        return new Response(
          JSON.stringify({ error: "This coaching center account has been suspended" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const valid = !!bcryptAny.compareSync(password, cc.password_hash);
      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = await createSessionToken(supabase, cc.id, "coaching", clientIp, userAgent);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: cc.id,
            coachingId: cc.coaching_id,
            name: cc.name,
            feePaid: cc.fee_paid,
          },
          sessionToken: token,
          requiresPasswordReset: cc.password_reset_required,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ COACHING: Password Reset ============
    if (action === "coaching_reset_password") {
      if (!sessionToken || !newPassword) {
        return new Response(
          JSON.stringify({ error: "Session token and new password required" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (newPassword.length < 8) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 8 characters" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validation = await validateSessionToken(supabase, sessionToken, "coaching");
      if (!validation.valid || !validation.userId) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired session" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newHash = await hashPassword(newPassword);
      await supabase
        .from("coaching_centers")
        .update({
          password_hash: newHash,
          password_reset_required: false,
          password_updated_at: new Date().toISOString(),
        })
        .eq("id", validation.userId);

      // Revoke old sessions and create new
      await supabase
        .from("session_tokens")
        .update({ is_revoked: true })
        .eq("user_id", validation.userId)
        .eq("user_type", "coaching");

      const newToken = await createSessionToken(supabase, validation.userId, "coaching", clientIp, userAgent);

      return new Response(
        JSON.stringify({ success: true, sessionToken: newToken }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ COACHING: Get Students ============
    if (action === "get_coaching_students") {
      if (!sessionToken || !coachingData?.coachingUuid) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validation = await validateSessionToken(supabase, sessionToken, "coaching", coachingData.coachingUuid);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired session" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("*")
        .eq("coaching_center_id", coachingData.coachingUuid)
        .or("is_banned.eq.false,is_banned.is.null")
        .order("created_at", { ascending: false });

      if (studentsError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch students" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, students: students || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ADMIN: List All Coaching Centers ============
    if (action === "list_coaching_centers") {
      if (!adminCredentials?.sessionToken) {
        return new Response(
          JSON.stringify({ error: "Admin authentication required" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validation = await validateSessionToken(supabase, adminCredentials.sessionToken, "admin");
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired admin session" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: centers, error } = await supabase
        .from("coaching_centers")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch coaching centers" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get student counts
      const centersWithCounts = await Promise.all(
        (centers || []).map(async (cc: any) => {
          const { count } = await supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("coaching_center_id", cc.id);

          return { ...cc, studentCount: count || 0 };
        })
      );

      return new Response(
        JSON.stringify({ success: true, coachingCenters: centersWithCounts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("manage-coaching error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
