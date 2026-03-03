import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const bcryptAny: any = bcrypt;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate secure credentials
function generateSecureCredentials(prefix: string): { id: string; password: string } {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const idLength = 8;
  const passLength = 12;
  
  let id = prefix;
  let password = '';
  
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

// Validate admin session
async function validateAdminSession(supabase: any, sessionToken: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('session_tokens')
    .select('user_id, user_type, expires_at, is_revoked')
    .eq('token', sessionToken)
    .maybeSingle();
  
  if (error || !data) return false;
  if (data.is_revoked || new Date(data.expires_at) < new Date()) return false;
  if (data.user_type !== 'admin') return false;
  
  return true;
}

// Default schools to seed
const DEFAULT_SCHOOLS = [
  { name: "Demo Public School", district: "Kishanganj", state: "Bihar" },
  { name: "Test High School", district: "Patna", state: "Bihar" },
  { name: "Sample Academy", district: "Gaya", state: "Bihar" },
  { name: "Example Senior Secondary", district: "Muzaffarpur", state: "Bihar" },
  { name: "Model School", district: "Bhagalpur", state: "Bihar" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, sessionToken, schools } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate admin session
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "Admin authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isValidAdmin = await validateAdminSession(supabase, sessionToken);
    if (!isValidAdmin) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired admin session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "seed_default") {
      // Seed default schools
      const createdSchools: { name: string; schoolId: string; password: string }[] = [];
      const errors: string[] = [];

      for (const school of DEFAULT_SCHOOLS) {
        // Check if school already exists
        const { data: existing } = await supabase
          .from("schools")
          .select("id")
          .eq("name", school.name)
          .maybeSingle();

        if (existing) {
          errors.push(`${school.name} already exists`);
          continue;
        }

        const credentials = generateSecureCredentials("SCH_");
        const hashedPassword = await hashPassword(credentials.password);

        const { error: insertError } = await supabase.from("schools").insert({
          school_id: credentials.id,
          password_hash: hashedPassword,
          name: school.name,
          district: school.district,
          state: school.state,
          fee_paid: true,
          is_banned: false,
          password_reset_required: true,
        });

        if (insertError) {
          console.error("Insert school error:", insertError);
          errors.push(`Failed to create ${school.name}`);
        } else {
          createdSchools.push({
            name: school.name,
            schoolId: credentials.id,
            password: credentials.password,
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          created: createdSchools,
          errors: errors.length > 0 ? errors : undefined,
          message: `Created ${createdSchools.length} schools`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "seed_custom") {
      // Seed custom schools
      if (!schools || !Array.isArray(schools) || schools.length === 0) {
        return new Response(
          JSON.stringify({ error: "Schools array required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const createdSchools: { name: string; schoolId: string; password: string }[] = [];
      const errors: string[] = [];

      for (const school of schools) {
        if (!school.name) {
          errors.push("School name is required");
          continue;
        }

        // Check if school already exists
        const { data: existing } = await supabase
          .from("schools")
          .select("id")
          .eq("name", school.name)
          .maybeSingle();

        if (existing) {
          errors.push(`${school.name} already exists`);
          continue;
        }

        const credentials = generateSecureCredentials("SCH_");
        const hashedPassword = await hashPassword(credentials.password);

        const { error: insertError } = await supabase.from("schools").insert({
          school_id: credentials.id,
          password_hash: hashedPassword,
          name: school.name,
          district: school.district || null,
          state: school.state || null,
          fee_paid: true,
          is_banned: false,
          password_reset_required: true,
        });

        if (insertError) {
          console.error("Insert school error:", insertError);
          errors.push(`Failed to create ${school.name}`);
        } else {
          createdSchools.push({
            name: school.name,
            schoolId: credentials.id,
            password: credentials.password,
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          created: createdSchools,
          errors: errors.length > 0 ? errors : undefined,
          message: `Created ${createdSchools.length} schools`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Seed schools error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
