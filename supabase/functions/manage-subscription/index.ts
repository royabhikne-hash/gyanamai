import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Plan limits configuration
const PLAN_LIMITS: Record<string, { chatsPerDay: number; imagesPerDay: number; premiumTTS: boolean; monthlyPrice: number }> = {
  basic: { chatsPerDay: 40, imagesPerDay: 6, premiumTTS: false, monthlyPrice: 149 },
  pro: { chatsPerDay: 70, imagesPerDay: 12, premiumTTS: true, monthlyPrice: 299 },
};

type SubscriptionAction =
  | "get_requests" | "approve_request" | "reject_request"
  | "block_student" | "cancel_pro" | "request_upgrade"
  | "get_subscription" | "get_school_stats" | "increment_tts"
  | "check_expiry" | "check_daily_usage" | "get_daily_usage";

interface SubscriptionRequest {
  action: SubscriptionAction;
  sessionToken?: string;
  schoolId?: string;
  schoolUuid?: string;
  studentId?: string;
  requestId?: string;
  rejectionReason?: string;
  adminSessionToken?: string;
  ttsCharacters?: number;
  usageType?: "chat" | "image";
  requestedPlan?: string;
  coachingSessionToken?: string;
  coachingUuid?: string;
}

// Validate institution session (school or coaching)
async function validateInstitutionSession(
  supabase: any, token: string, expectedType: 'school' | 'coaching', expectedId?: string
): Promise<{ valid: boolean; institutionUuid?: string }> {
  const { data, error } = await supabase
    .from('session_tokens')
    .select('user_id, user_type, expires_at, is_revoked')
    .eq('token', token).maybeSingle();
  if (error || !data) return { valid: false };
  if (data.is_revoked || new Date(data.expires_at) < new Date()) return { valid: false };
  if (data.user_type !== expectedType) return { valid: false };
  if (expectedId && data.user_id !== expectedId) return { valid: false };
  return { valid: true, institutionUuid: data.user_id };
}

// Validate admin session
async function validateAdminSession(
  supabase: any, token: string
): Promise<{ valid: boolean; adminId?: string; role?: string }> {
  const { data, error } = await supabase
    .from('session_tokens')
    .select('user_id, user_type, expires_at, is_revoked')
    .eq('token', token).maybeSingle();
  if (error || !data) return { valid: false };
  if (data.is_revoked || new Date(data.expires_at) < new Date()) return { valid: false };
  if (data.user_type !== 'admin') return { valid: false };
  const { data: admin } = await supabase.from('admins').select('role').eq('id', data.user_id).maybeSingle();
  return { valid: true, adminId: data.user_id, role: admin?.role };
}

// Get IST date string for daily usage tracking
function getISTDateString(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().split('T')[0];
}

// Verify student belongs to institution
async function verifyStudentInstitution(
  supabase: any, studentId: string, institutionId: string, institutionType: 'school' | 'coaching'
): Promise<boolean> {
  const field = institutionType === 'school' ? 'school_id' : 'coaching_center_id';
  const { data } = await supabase.from('students').select(field).eq('id', studentId).maybeSingle();
  return data?.[field] === institutionId;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SubscriptionRequest;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Backend configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    switch (body.action) {
      // =============== STUDENT ACTIONS ===============
      case "request_upgrade": {
        if (!body.studentId) {
          return new Response(
            JSON.stringify({ success: false, error: "Student ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existing } = await admin
          .from('upgrade_requests').select('id, status')
          .eq('student_id', body.studentId).eq('status', 'pending').maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ success: false, error: "You already have a pending upgrade request" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get student info and current subscription
        const { data: studentInfo } = await admin
          .from('students').select('student_type')
          .eq('id', body.studentId).maybeSingle();

        const { data: sub } = await admin
          .from('subscriptions').select('plan')
          .eq('student_id', body.studentId).maybeSingle();

        if (sub?.plan === 'pro') {
          return new Response(
            JSON.stringify({ success: false, error: "You already have a Pro plan" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Determine requested plan based on student type and upgrade rules
        let requestedPlan = body.requestedPlan || 'pro';
        
        // School students can only upgrade to Pro
        if (studentInfo?.student_type === 'school_student' && requestedPlan !== 'pro') {
          return new Response(
            JSON.stringify({ success: false, error: "School students can only upgrade to Pro" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Coaching students can upgrade to Basic or Pro
        if (studentInfo?.student_type === 'coaching_student') {
          if (!['basic', 'pro'].includes(requestedPlan)) {
            return new Response(
              JSON.stringify({ success: false, error: "Invalid plan requested" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          // Can't downgrade
          if (sub?.plan === 'basic' && requestedPlan === 'basic') {
            return new Response(
              JSON.stringify({ success: false, error: "You already have a Basic plan" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        const { error: insertError } = await admin
          .from('upgrade_requests')
          .insert({ student_id: body.studentId, requested_plan: requestedPlan as any, status: 'pending' });

        if (insertError) {
          console.error("Insert error:", insertError);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to submit request" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Upgrade request submitted" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_subscription": {
        if (!body.studentId) {
          return new Response(
            JSON.stringify({ success: false, error: "Student ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: subscription } = await admin
          .from('subscriptions').select('*')
          .eq('student_id', body.studentId).maybeSingle();

        const { data: pendingRequest } = await admin
          .from('upgrade_requests').select('*')
          .eq('student_id', body.studentId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();

        // Get student type for plan visibility
        const { data: studentInfo } = await admin
          .from('students').select('student_type')
          .eq('id', body.studentId).maybeSingle();

        // Get daily usage
        const todayIST = getISTDateString();
        const { data: dailyUsage } = await admin
          .from('daily_usage').select('*')
          .eq('student_id', body.studentId).eq('usage_date', todayIST).maybeSingle();

        const plan = subscription?.plan || 'basic';
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.basic;

        return new Response(
          JSON.stringify({
            success: true,
            subscription: subscription || { plan, tts_used: 0, tts_limit: plan === 'pro' ? 90000 : 0 },
            pendingRequest,
            studentType: studentInfo?.student_type || 'school_student',
            dailyUsage: {
              chatsUsed: dailyUsage?.chats_used || 0,
              imagesUsed: dailyUsage?.images_used || 0,
              chatsLimit: limits.chatsPerDay,
              imagesLimit: limits.imagesPerDay,
            },
            planLimits: limits,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_daily_usage": {
        if (!body.studentId) {
          return new Response(
            JSON.stringify({ success: false, error: "Student ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: sub } = await admin
          .from('subscriptions').select('plan')
          .eq('student_id', body.studentId).maybeSingle();

        const plan = sub?.plan || 'basic';
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.basic;
        const todayIST = getISTDateString();

        const { data: usage } = await admin
          .from('daily_usage').select('*')
          .eq('student_id', body.studentId).eq('usage_date', todayIST).maybeSingle();

        return new Response(
          JSON.stringify({
            success: true,
            chatsUsed: usage?.chats_used || 0,
            imagesUsed: usage?.images_used || 0,
            chatsLimit: limits.chatsPerDay,
            imagesLimit: limits.imagesPerDay,
            plan,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "check_daily_usage": {
        if (!body.studentId || !body.usageType) {
          return new Response(
            JSON.stringify({ success: false, error: "Student ID and usage type required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: sub } = await admin
          .from('subscriptions').select('plan')
          .eq('student_id', body.studentId).maybeSingle();

        const plan = sub?.plan || 'basic';
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.basic;
        const todayIST = getISTDateString();

        // Get or create daily usage record
        let { data: usage } = await admin
          .from('daily_usage').select('*')
          .eq('student_id', body.studentId).eq('usage_date', todayIST).maybeSingle();

        if (!usage) {
          const { data: newUsage } = await admin
            .from('daily_usage')
            .insert({ student_id: body.studentId, usage_date: todayIST, chats_used: 0, images_used: 0 })
            .select().single();
          usage = newUsage;
        }

        const currentCount = body.usageType === 'chat' ? (usage?.chats_used || 0) : (usage?.images_used || 0);
        const limit = body.usageType === 'chat' ? limits.chatsPerDay : limits.imagesPerDay;

        if (currentCount >= limit) {
          return new Response(
            JSON.stringify({
              success: true,
              allowed: false,
              currentCount,
              limit,
              plan,
              message: `Daily ${body.usageType} limit reached. Upgrade your plan for more.`,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Increment usage
        const updateField = body.usageType === 'chat' ? 'chats_used' : 'images_used';
        await admin
          .from('daily_usage')
          .update({ [updateField]: currentCount + 1 })
          .eq('student_id', body.studentId).eq('usage_date', todayIST);

        return new Response(
          JSON.stringify({
            success: true,
            allowed: true,
            currentCount: currentCount + 1,
            limit,
            remaining: limit - currentCount - 1,
            plan,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "increment_tts": {
        if (!body.studentId || !body.ttsCharacters) {
          return new Response(
            JSON.stringify({ success: false, error: "Student ID and character count required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: sub } = await admin
          .from('subscriptions').select('*')
          .eq('student_id', body.studentId).maybeSingle();

        if (!sub) {
          return new Response(
            JSON.stringify({ success: true, usePremiumTTS: false, reason: "No subscription found" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const isPro = sub.plan === 'pro' && sub.is_active;
        const hasQuota = sub.tts_used + body.ttsCharacters <= sub.tts_limit;
        const isExpired = sub.end_date && new Date(sub.end_date) < new Date();

        if (isPro && hasQuota && !isExpired) {
          await admin.from('subscriptions')
            .update({ tts_used: sub.tts_used + body.ttsCharacters })
            .eq('id', sub.id);

          return new Response(
            JSON.stringify({
              success: true, usePremiumTTS: true,
              ttsUsed: sub.tts_used + body.ttsCharacters,
              ttsLimit: sub.tts_limit,
              ttsRemaining: sub.tts_limit - (sub.tts_used + body.ttsCharacters)
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let reason = "Basic plan";
        if (isPro && !hasQuota) reason = "TTS limit reached";
        if (isPro && isExpired) reason = "Subscription expired";

        return new Response(
          JSON.stringify({ success: true, usePremiumTTS: false, reason }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // =============== INSTITUTION ADMIN ACTIONS ===============
      case "get_requests": {
        // Support both school and coaching session tokens
        const sessionToken = body.sessionToken || body.coachingSessionToken;
        const institutionId = body.schoolUuid || body.coachingUuid;
        const institutionType = body.coachingUuid ? 'coaching' : 'school';
        
        if (!sessionToken || !institutionId) {
          return new Response(
            JSON.stringify({ success: false, error: "Session token and institution ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const validation = await validateInstitutionSession(admin, sessionToken, institutionType, institutionId);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid or expired session" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const studentField = institutionType === 'school' ? 'school_id' : 'coaching_center_id';
        const { data: students, error: studentsError } = await admin
          .from('students')
          .select(`
            id, full_name, class, photo_url, is_approved, is_banned, student_type,
            subscriptions (plan, tts_used, tts_limit, start_date, end_date, is_active),
            upgrade_requests (id, status, requested_at, rejection_reason, requested_plan)
          `)
          .eq(studentField, institutionId)
          .eq('is_approved', true);

        if (studentsError) {
          console.error("Students query error:", studentsError);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to fetch students" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const pendingRequests = students?.filter(s =>
          Array.isArray(s.upgrade_requests) &&
          s.upgrade_requests.some((r: any) => r.status === 'pending')
        ).map(s => ({
          ...s,
          pendingRequest: Array.isArray(s.upgrade_requests)
            ? s.upgrade_requests.find((r: any) => r.status === 'pending')
            : null
        })) || [];

        return new Response(
          JSON.stringify({ success: true, students: students || [], pendingRequests }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "approve_request": {
        const sessionToken = body.sessionToken || body.coachingSessionToken;
        const institutionId = body.schoolUuid || body.coachingUuid;
        const institutionType = body.coachingUuid ? 'coaching' : 'school';

        if (!sessionToken || !institutionId || !body.requestId) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing required fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const validation = await validateInstitutionSession(admin, sessionToken, institutionType, institutionId);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid session" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: request } = await admin
          .from('upgrade_requests').select('student_id, status, requested_plan')
          .eq('id', body.requestId).maybeSingle();

        if (!request || request.status !== 'pending') {
          return new Response(
            JSON.stringify({ success: false, error: "Request not found or already processed" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const belongs = await verifyStudentInstitution(admin, request.student_id, institutionId, institutionType);
        if (!belongs) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await admin.from('upgrade_requests')
          .update({ status: 'approved', processed_at: new Date().toISOString(), processed_by: institutionId })
          .eq('id', body.requestId);

        const approvedPlan = request.requested_plan || 'pro';
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        const updateData: any = {
          plan: approvedPlan,
          start_date: new Date().toISOString(),
          end_date: endDate.toISOString(),
          is_active: true
        };

        // Reset TTS for pro plan
        if (approvedPlan === 'pro') {
          updateData.tts_used = 0;
          updateData.tts_limit = 90000;
        }

        await admin.from('subscriptions')
          .update(updateData)
          .eq('student_id', request.student_id);

        return new Response(
          JSON.stringify({ success: true, message: `${approvedPlan} plan activated for 30 days` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "reject_request": {
        const sessionToken = body.sessionToken || body.coachingSessionToken;
        const institutionId = body.schoolUuid || body.coachingUuid;
        const institutionType = body.coachingUuid ? 'coaching' : 'school';

        if (!sessionToken || !institutionId || !body.requestId) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing required fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const validation = await validateInstitutionSession(admin, sessionToken, institutionType, institutionId);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid session" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: request } = await admin
          .from('upgrade_requests').select('student_id, status')
          .eq('id', body.requestId).maybeSingle();

        if (!request || request.status !== 'pending') {
          return new Response(
            JSON.stringify({ success: false, error: "Request not found or already processed" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const belongs = await verifyStudentInstitution(admin, request.student_id, institutionId, institutionType);
        if (!belongs) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await admin.from('upgrade_requests')
          .update({
            status: 'rejected', processed_at: new Date().toISOString(),
            processed_by: institutionId,
            rejection_reason: body.rejectionReason || 'Request rejected'
          })
          .eq('id', body.requestId);

        return new Response(
          JSON.stringify({ success: true, message: "Request rejected" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "block_student": {
        const sessionToken = body.sessionToken || body.coachingSessionToken;
        const institutionId = body.schoolUuid || body.coachingUuid;
        const institutionType = body.coachingUuid ? 'coaching' : 'school';

        if (!sessionToken || !institutionId || !body.studentId) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing required fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const validation = await validateInstitutionSession(admin, sessionToken, institutionType, institutionId);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid session" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const belongs = await verifyStudentInstitution(admin, body.studentId, institutionId, institutionType);
        if (!belongs) {
          return new Response(
            JSON.stringify({ success: false, error: "Student not found in your institution" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await admin.from('upgrade_requests')
          .update({ status: 'blocked', processed_at: new Date().toISOString(), processed_by: institutionId })
          .eq('student_id', body.studentId).eq('status', 'pending');

        // Get student type to determine downgrade plan
        const { data: studentInfo } = await admin
          .from('students').select('student_type')
          .eq('id', body.studentId).maybeSingle();

        const downgradePlan = 'basic';

        await admin.from('subscriptions')
          .update({ plan: downgradePlan, end_date: null, is_active: true })
          .eq('student_id', body.studentId);

        return new Response(
          JSON.stringify({ success: true, message: "Student blocked from Pro access" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "cancel_pro": {
        const sessionToken = body.sessionToken || body.coachingSessionToken;
        const institutionId = body.schoolUuid || body.coachingUuid;
        const institutionType = body.coachingUuid ? 'coaching' : 'school';

        if (!sessionToken || !institutionId || !body.studentId) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing required fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const validation = await validateInstitutionSession(admin, sessionToken, institutionType, institutionId);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid session" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const belongs = await verifyStudentInstitution(admin, body.studentId, institutionId, institutionType);
        if (!belongs) {
          return new Response(
            JSON.stringify({ success: false, error: "Student not found in your institution" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: studentInfo } = await admin
          .from('students').select('student_type')
          .eq('id', body.studentId).maybeSingle();

        const downgradePlan = 'basic';

        await admin.from('subscriptions')
          .update({ plan: downgradePlan, end_date: null, is_active: true })
          .eq('student_id', body.studentId);

        return new Response(
          JSON.stringify({ success: true, message: "Pro subscription cancelled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // =============== SUPER ADMIN ACTIONS ===============
      case "get_school_stats": {
        if (!body.adminSessionToken) {
          return new Response(
            JSON.stringify({ success: false, error: "Admin session required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const validation = await validateAdminSession(admin, body.adminSessionToken);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid admin session" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get school stats
        const { data: schools } = await admin.from('schools').select('id, name, school_id, district, state');
        const schoolStats = await Promise.all((schools || []).map(async (school) => {
          const { count: totalStudents } = await admin
            .from('students').select('id', { count: 'exact', head: true })
            .eq('school_id', school.id).eq('is_approved', true);

          const { data: subs } = await admin
            .from('subscriptions').select('plan, students!inner(school_id)')
            .eq('students.school_id', school.id);

          const basicCount = subs?.filter(s => s.plan === 'basic').length || 0;
          const proCount = subs?.filter(s => s.plan === 'pro').length || 0;
          const estimatedRevenue = (basicCount * PLAN_LIMITS.basic.monthlyPrice) + (proCount * PLAN_LIMITS.pro.monthlyPrice);

          return {
            ...school, type: 'school', totalStudents: totalStudents || 0,
            basicUsers: basicCount, proUsers: proCount, starterUsers: 0, estimatedRevenue
          };
        }));

        // Get coaching center stats
        const { data: coachings } = await admin.from('coaching_centers').select('id, name, coaching_id, district, state');
        const coachingStats = await Promise.all((coachings || []).map(async (cc) => {
          const { count: totalStudents } = await admin
            .from('students').select('id', { count: 'exact', head: true })
            .eq('coaching_center_id', cc.id).eq('is_approved', true);

          const { data: subs } = await admin
            .from('subscriptions').select('plan, students!inner(coaching_center_id)')
            .eq('students.coaching_center_id', cc.id);

          const basicCount = (subs?.filter(s => s.plan === 'basic').length || 0) + (subs?.filter(s => s.plan === 'starter').length || 0);
          const proCount = subs?.filter(s => s.plan === 'pro').length || 0;
          const estimatedRevenue = (basicCount * PLAN_LIMITS.basic.monthlyPrice) + (proCount * PLAN_LIMITS.pro.monthlyPrice);

          return {
            ...cc, type: 'coaching', totalStudents: totalStudents || 0,
            starterUsers: 0, basicUsers: basicCount, proUsers: proCount, estimatedRevenue
          };
        }));

        return new Response(
          JSON.stringify({ success: true, schools: schoolStats, coachingCenters: coachingStats }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // =============== SYSTEM ACTIONS ===============
      case "check_expiry": {
        const { data: expiredSubs, error: expiredError } = await admin
          .from('subscriptions').select('id, student_id')
          .eq('plan', 'pro').lt('end_date', new Date().toISOString());

        if (expiredError) {
          console.error("Expiry check error:", expiredError);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to check expired subscriptions" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (expiredSubs && expiredSubs.length > 0) {
          // Determine correct downgrade plan per student
          for (const sub of expiredSubs) {
            const { data: student } = await admin
              .from('students').select('student_type')
              .eq('id', sub.student_id).maybeSingle();

            const downgradePlan = 'basic';

            await admin.from('subscriptions')
              .update({ plan: downgradePlan, end_date: null, is_active: true })
              .eq('id', sub.id);
          }

          console.log(`Expired ${expiredSubs.length} Pro subscriptions`);
        }

        return new Response(
          JSON.stringify({ success: true, expiredCount: expiredSubs?.length || 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("manage-subscription error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

Deno.serve(handler);
