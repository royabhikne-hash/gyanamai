import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Validate session token from database
async function validateSessionToken(
  supabase: any,
  token: string,
  expectedUserType?: 'admin' | 'school',
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
  
  if (expectedUserType && data.user_type !== expectedUserType) {
    return { valid: false };
  }
  
  if (expectedUserId && data.user_id !== expectedUserId) {
    return { valid: false };
  }
  
  return { valid: true, userId: data.user_id, userType: data.user_type };
}

// Calculate rankings for a list of students with sessions
function calculateStudentRankings(studentsWithSessions: any[], filterDistrict?: string) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  
  // Filter by district if specified
  const studentsToRank = filterDistrict 
    ? studentsWithSessions.filter((s: any) => s.district === filterDistrict)
    : studentsWithSessions;
  
  const rankings = studentsToRank.map((student: any) => {
    const sessions = student.study_sessions || [];
    
    const improvementScores = sessions
      .map((s: any) => s.improvement_score || 50)
      .slice(0, 10);
    const avgImprovement = improvementScores.length > 0
      ? Math.round(improvementScores.reduce((a: number, b: number) => a + b, 0) / improvementScores.length)
      : 0;
    
    const todaySessions = sessions.filter((s: any) => 
      new Date(s.created_at) >= startOfToday
    );
    const dailyStudyTime = todaySessions.reduce((acc: number, s: any) => acc + (s.time_spent || 0), 0);
    
    const weekSessions = sessions.filter((s: any) => 
      new Date(s.created_at) >= startOfWeek
    );
    const uniqueDays = new Set(
      weekSessions.map((s: any) => new Date(s.created_at).toDateString())
    ).size;
    
    const improvementPoints = avgImprovement * 0.4;
    const dailyPoints = Math.min(dailyStudyTime, 120) * 0.25;
    const consistencyPoints = (uniqueDays / 7) * 30;
    const totalScore = Math.round(improvementPoints + dailyPoints + consistencyPoints);
    
    return {
      id: student.id,
      name: student.full_name,
      photo: student.photo_url,
      class: student.class,
      district: student.district,
      schoolId: student.school_id,
      schoolName: student.schools?.name || 'No School',
      improvementScore: avgImprovement,
      dailyStudyTime,
      weeklyStudyDays: uniqueDays,
      totalScore,
      rank: 0
    };
  });
  
  // Sort by total score descending and assign ranks
  rankings.sort((a: any, b: any) => b.totalScore - a.totalScore);
  rankings.forEach((student: any, index: number) => {
    student.rank = index + 1;
  });
  
  return rankings;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, session_token, user_type, school_id, student_id, student_class, schoolId, sessionToken, studentId } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Handle student ranking request (for student dashboard)
    if (action === 'get_student_rankings') {
      if (!student_id) {
        return new Response(
          JSON.stringify({ error: 'Student ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the student's info including district and school
      const { data: studentData } = await supabaseAdmin
        .from('students')
        .select('*, schools(name)')
        .eq('id', student_id)
        .maybeSingle();

      if (!studentData || !studentData.is_approved) {
        return new Response(
          JSON.stringify({ error: 'Student not found or not approved' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch ALL approved students from the same school and district for rankings
      const { data: allSchoolStudents } = await supabaseAdmin
        .from('students')
        .select('*, schools(name)')
        .eq('school_id', studentData.school_id)
        .eq('is_approved', true)
        .or('is_banned.eq.false,is_banned.is.null');

      const { data: allDistrictStudents } = await supabaseAdmin
        .from('students')
        .select('*, schools(name)')
        .eq('district', studentData.district)
        .eq('is_approved', true)
        .or('is_banned.eq.false,is_banned.is.null');

      // Fetch sessions for all students
      const fetchSessionsForStudents = async (students: any[]) => {
        return Promise.all(
          (students || []).map(async (student) => {
            const { data: sessions } = await supabaseAdmin
              .from('study_sessions')
              .select('*, quiz_attempts(accuracy_percentage)')
              .eq('student_id', student.id)
              .order('created_at', { ascending: false })
              .limit(10);

            const enhancedSessions = (sessions || []).map((session: any) => {
              const quizAttempts = session.quiz_attempts as { accuracy_percentage: number | null }[] | null;
              const quizScore = (quizAttempts && quizAttempts.length > 0 && quizAttempts[0].accuracy_percentage !== null)
                ? quizAttempts[0].accuracy_percentage
                : null;
              return {
                ...session,
                improvement_score: quizScore !== null ? quizScore : session.improvement_score,
              };
            });

            return {
              ...student,
              study_sessions: enhancedSessions
            };
          })
        );
      };

      const schoolStudentsWithSessions = await fetchSessionsForStudents(allSchoolStudents || []);
      const districtStudentsWithSessions = await fetchSessionsForStudents(allDistrictStudents || []);

      // Calculate rankings
      const schoolRankings = calculateStudentRankings(schoolStudentsWithSessions);
      const districtRankings = calculateStudentRankings(districtStudentsWithSessions);

      // Find the current student's position in each
      const studentSchoolRank = schoolRankings.find((r: any) => r.id === student_id);
      const studentDistrictRank = districtRankings.find((r: any) => r.id === student_id);

      // Get ranking history for the student
      const { data: rankingHistory } = await supabaseAdmin
        .from('ranking_history')
        .select('*')
        .eq('student_id', student_id)
        .order('week_start', { ascending: false })
        .limit(10);

      return new Response(
        JSON.stringify({
          student: studentData,
          mySchoolRank: studentSchoolRank || null,
          myDistrictRank: studentDistrictRank || null,
          schoolRankings: schoolRankings.slice(0, 10),
          districtRankings: districtRankings.slice(0, 10),
          totalSchoolStudents: schoolRankings.length,
          totalDistrictStudents: districtRankings.length,
          rankingHistory: rankingHistory || [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle student report data request
    if (action === 'get_student_report') {
      let isAuthorized = false;
      let authorizedSchoolId: string | null = null;
      
      if (user_type === 'school' && school_id && session_token) {
        const validation = await validateSessionToken(supabaseAdmin, session_token, 'school', school_id);
        isAuthorized = validation.valid;
        if (isAuthorized) authorizedSchoolId = school_id;
      } else if (user_type === 'admin' && session_token) {
        const validation = await validateSessionToken(supabaseAdmin, session_token, 'admin');
        isAuthorized = validation.valid;
      }

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Load student info with school
      const { data: studentData } = await supabaseAdmin
        .from('students')
        .select('*, schools(*)')
        .eq('id', student_id)
        .maybeSingle();

      // For school users, verify the student belongs to their school
      if (user_type === 'school' && studentData?.school_id !== authorizedSchoolId) {
        return new Response(
          JSON.stringify({ error: 'Student does not belong to your school' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Load study sessions from last 7 days with quiz attempts for accurate scoring
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: sessionsData } = await supabaseAdmin
        .from('study_sessions')
        .select('*, quiz_attempts(accuracy_percentage)')
        .eq('student_id', student_id)
        .gte('created_at', weekAgo.toISOString())
        .order('created_at', { ascending: false });

      const { data: quizzesData } = await supabaseAdmin
        .from('quiz_attempts')
        .select('*')
        .eq('student_id', student_id)
        .gte('created_at', weekAgo.toISOString())
        .order('created_at', { ascending: false });
      
      // Enhance sessions with quiz accuracy as primary score
      const enhancedSessions = (sessionsData || []).map((session: any) => {
        const quizAttempts = session.quiz_attempts as { accuracy_percentage: number | null }[] | null;
        const quizScore = (quizAttempts && quizAttempts.length > 0 && quizAttempts[0].accuracy_percentage !== null)
          ? quizAttempts[0].accuracy_percentage
          : null;
        
        return {
          ...session,
          improvement_score: quizScore !== null ? quizScore : session.improvement_score,
        };
      });

      // Load class averages for comparison
      let classAverages = null;
      if (student_class) {
        const { data: classStudents } = await supabaseAdmin
          .from('students')
          .select('id')
          .eq('class', student_class);

        if (classStudents && classStudents.length > 0) {
          const studentIds = classStudents.map((s: { id: string }) => s.id);

          const { data: classSessions } = await supabaseAdmin
            .from('study_sessions')
            .select('*')
            .in('student_id', studentIds)
            .gte('created_at', weekAgo.toISOString());

          const { data: classQuizzes } = await supabaseAdmin
            .from('quiz_attempts')
            .select('*')
            .in('student_id', studentIds)
            .gte('created_at', weekAgo.toISOString());

          const studentCount = classStudents.length;
          const totalSessions = classSessions?.length || 0;
          const totalQuizzes = classQuizzes?.length || 0;
          const totalTimeSpent = classSessions?.reduce((acc: number, s: { time_spent?: number }) => acc + (s.time_spent || 0), 0) || 0;
          const totalAccuracy = classQuizzes?.reduce((acc: number, q: { accuracy_percentage?: number }) => acc + (q.accuracy_percentage || 0), 0) || 0;
          const totalImprovementScore = classSessions?.reduce((acc: number, s: { improvement_score?: number }) => acc + (s.improvement_score || 50), 0) || 0;

          classAverages = {
            avgSessions: Math.round((totalSessions / studentCount) * 10) / 10,
            avgTimeSpent: Math.round(totalTimeSpent / studentCount),
            avgAccuracy: totalQuizzes > 0 ? Math.round(totalAccuracy / totalQuizzes) : 0,
            avgQuizzes: Math.round((totalQuizzes / studentCount) * 10) / 10,
            avgImprovementScore: totalSessions > 0 ? Math.round(totalImprovementScore / totalSessions) : 50,
          };
        }
      }

      return new Response(
        JSON.stringify({
          student: studentData,
          sessions: enhancedSessions,
          quizzes: quizzesData || [],
          classAverages,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle get_parent_token action (for admin WhatsApp links)
    if (action === 'get_parent_token') {
      if (!session_token) {
        return new Response(
          JSON.stringify({ error: 'Session token required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const validation = await validateSessionToken(supabaseAdmin, session_token, 'admin');
      if (!validation.valid) {
        // Also allow school users
        const schoolValidation = await validateSessionToken(supabaseAdmin, session_token, 'school');
        if (!schoolValidation.valid) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const targetStudentId = studentId || student_id;
      
      if (!targetStudentId) {
        return new Response(
          JSON.stringify({ error: 'Student ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for existing active token
      const { data: existingToken } = await supabaseAdmin
        .from('parent_access_tokens')
        .select('token')
        .eq('student_id', targetStudentId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (existingToken?.token) {
        return new Response(
          JSON.stringify({ token: existingToken.token }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create new token
      const { data: newToken, error: tokenError } = await supabaseAdmin
        .from('parent_access_tokens')
        .insert({ student_id: targetStudentId })
        .select('token')
        .single();

      if (tokenError) {
        console.error('Error creating parent token:', tokenError);
        return new Response(
          JSON.stringify({ error: 'Failed to create token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ token: newToken.token }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // School Analytics action - handle before generic session_token check
    if (action === 'get_school_analytics') {
      const sId = schoolId || school_id;
      const sToken = sessionToken || session_token;
      
      if (!sId || !sToken) {
        return new Response(
          JSON.stringify({ error: 'School ID and session token required' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const validation = await validateSessionToken(supabaseAdmin, sToken, 'school');
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: 'Invalid session' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get all approved students in this school
      const { data: students } = await supabaseAdmin
        .from('students')
        .select('id, full_name, class')
        .eq('school_id', sId)
        .eq('is_approved', true);

      if (!students || students.length === 0) {
        return new Response(JSON.stringify({
          topPerformers: [], lowPerformers: [], classAccuracy: [],
          weeklyEngagement: { activeStudents: 0, totalStudents: 0, avgSessions: 0 },
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const studentIds = students.map(s => s.id);
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const { data: mcqAttempts } = await supabaseAdmin
        .from('mcq_attempts')
        .select('student_id, accuracy_percentage')
        .in('student_id', studentIds);

      const { data: weekSessions } = await supabaseAdmin
        .from('study_sessions')
        .select('student_id')
        .in('student_id', studentIds)
        .gte('created_at', weekStart.toISOString());

      const studentAccMap: Record<string, { total: number; sum: number; sessions: number }> = {};
      mcqAttempts?.forEach(a => {
        if (!studentAccMap[a.student_id]) studentAccMap[a.student_id] = { total: 0, sum: 0, sessions: 0 };
        studentAccMap[a.student_id].total++;
        studentAccMap[a.student_id].sum += Number(a.accuracy_percentage);
      });

      const weekSessionCounts: Record<string, number> = {};
      weekSessions?.forEach(s => {
        weekSessionCounts[s.student_id] = (weekSessionCounts[s.student_id] || 0) + 1;
      });

      const performerList = students
        .filter(s => studentAccMap[s.id] && studentAccMap[s.id].total > 0)
        .map(s => ({
          name: s.full_name,
          class: s.class,
          accuracy: Math.round(studentAccMap[s.id].sum / studentAccMap[s.id].total),
          sessions: studentAccMap[s.id].total,
        }))
        .sort((a, b) => b.accuracy - a.accuracy);

      const topPerformers = performerList.slice(0, 10);
      const lowPerformers = performerList.filter(p => p.accuracy < 50).slice(0, 10);

      const classMap: Record<string, { sum: number; count: number; students: number }> = {};
      students.forEach(s => {
        if (!classMap[s.class]) classMap[s.class] = { sum: 0, count: 0, students: 0 };
        classMap[s.class].students++;
        if (studentAccMap[s.id]) {
          classMap[s.class].sum += Math.round(studentAccMap[s.id].sum / studentAccMap[s.id].total);
          classMap[s.class].count++;
        }
      });

      const classAccuracy = Object.entries(classMap)
        .map(([className, data]) => ({
          className,
          avgAccuracy: data.count > 0 ? Math.round(data.sum / data.count) : 0,
          studentCount: data.students,
        }))
        .sort((a, b) => a.className.localeCompare(b.className));

      const activeStudents = new Set(weekSessions?.map(s => s.student_id)).size;
      const totalSessions = weekSessions?.length || 0;

      return new Response(JSON.stringify({
        topPerformers,
        lowPerformers,
        classAccuracy,
        weeklyEngagement: {
          activeStudents,
          totalStudents: students.length,
          avgSessions: students.length > 0 ? Math.round(totalSessions / students.length) : 0,
        },
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate session token for list operations
    if (!session_token) {
      return new Response(
        JSON.stringify({ error: 'Session token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (user_type === 'school') {
      // Validate school session token
      const validation = await validateSessionToken(supabaseAdmin, session_token, 'school', school_id);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired school session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify school exists and is not banned
      const { data: school, error } = await supabaseAdmin
        .from('schools')
        .select('id, name, is_banned, fee_paid, district')
        .eq('id', school_id)
        .maybeSingle();

      if (error || !school) {
        return new Response(
          JSON.stringify({ error: 'School not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (school.is_banned) {
        return new Response(
          JSON.stringify({ error: 'School is banned' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch students for this school
      const { data: students, error: studentsError } = await supabaseAdmin
        .from('students')
        .select('*')
        .eq('school_id', school_id)
        .or('is_banned.eq.false,is_banned.is.null')
        .order('created_at', { ascending: false });

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch students' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch all students from the same district for district rankings
      const { data: districtStudents } = await supabaseAdmin
        .from('students')
        .select('*, schools(name)')
        .eq('district', school.district)
        .eq('is_approved', true)
        .or('is_banned.eq.false,is_banned.is.null');

      // Fetch study sessions with quiz attempts for each student
      const studentsWithSessions = await Promise.all(
        (students || []).map(async (student) => {
          const { data: sessions } = await supabaseAdmin
            .from('study_sessions')
            .select('*, quiz_attempts(accuracy_percentage)')
            .eq('student_id', student.id)
            .order('created_at', { ascending: false })
            .limit(10);

          const enhancedSessions = (sessions || []).map((session: any) => {
            const quizAttempts = session.quiz_attempts as { accuracy_percentage: number | null }[] | null;
            const quizScore = (quizAttempts && quizAttempts.length > 0 && quizAttempts[0].accuracy_percentage !== null)
              ? quizAttempts[0].accuracy_percentage
              : null;
            
            return {
              ...session,
              improvement_score: quizScore !== null ? quizScore : session.improvement_score,
            };
          });

          return {
            ...student,
            study_sessions: enhancedSessions
          };
        })
      );

      // Fetch sessions for district students
      const districtStudentsWithSessions = await Promise.all(
        (districtStudents || []).map(async (student) => {
          const { data: sessions } = await supabaseAdmin
            .from('study_sessions')
            .select('*, quiz_attempts(accuracy_percentage)')
            .eq('student_id', student.id)
            .order('created_at', { ascending: false })
            .limit(10);

          const enhancedSessions = (sessions || []).map((session: any) => {
            const quizAttempts = session.quiz_attempts as { accuracy_percentage: number | null }[] | null;
            const quizScore = (quizAttempts && quizAttempts.length > 0 && quizAttempts[0].accuracy_percentage !== null)
              ? quizAttempts[0].accuracy_percentage
              : null;
            return {
              ...session,
              improvement_score: quizScore !== null ? quizScore : session.improvement_score,
            };
          });

          return {
            ...student,
            study_sessions: enhancedSessions
          };
        })
      );

      // Calculate school rankings (only approved students from this school)
      const approvedSchoolStudents = studentsWithSessions.filter((s: any) => s.is_approved);
      const schoolRankings = calculateStudentRankings(approvedSchoolStudents);

      // Calculate district rankings (all approved students from same district)
      const districtRankings = calculateStudentRankings(districtStudentsWithSessions);

      return new Response(
        JSON.stringify({ 
          students: studentsWithSessions, 
          school, 
          rankings: schoolRankings,
          districtRankings,
          schoolDistrict: school.district
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (user_type === 'coaching') {
      // Validate coaching session token
      const validation = await validateSessionToken(supabaseAdmin, session_token, 'coaching', school_id);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired coaching session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch students for this coaching center
      const { data: students, error: studentsError } = await supabaseAdmin
        .from('students')
        .select('*')
        .eq('coaching_center_id', school_id)
        .or('is_banned.eq.false,is_banned.is.null')
        .order('created_at', { ascending: false });

      if (studentsError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch students' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch study sessions with quiz attempts for each student
      const studentsWithSessions = await Promise.all(
        (students || []).map(async (student) => {
          const { data: sessions } = await supabaseAdmin
            .from('study_sessions')
            .select('*, quiz_attempts(accuracy_percentage)')
            .eq('student_id', student.id)
            .order('created_at', { ascending: false })
            .limit(10);

          const enhancedSessions = (sessions || []).map((session: any) => {
            const quizAttempts = session.quiz_attempts as { accuracy_percentage: number | null }[] | null;
            const quizScore = (quizAttempts && quizAttempts.length > 0 && quizAttempts[0].accuracy_percentage !== null)
              ? quizAttempts[0].accuracy_percentage : null;
            return { ...session, improvement_score: quizScore !== null ? quizScore : session.improvement_score };
          });

          return { ...student, study_sessions: enhancedSessions, schools: { name: 'Coaching Center' } };
        })
      );

      const approvedStudents = studentsWithSessions.filter((s: any) => s.is_approved);
      const rankings = calculateStudentRankings(approvedStudents);

      return new Response(
        JSON.stringify({ students: studentsWithSessions, rankings }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (user_type === 'admin') {
      // Validate admin session token
      const validation = await validateSessionToken(supabaseAdmin, session_token, 'admin');
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired admin session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch all students with school info and study sessions for rankings
      const { data: students, error: studentsError } = await supabaseAdmin
        .from('students')
        .select('*, schools(name, district)')
        .order('created_at', { ascending: false });

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch students' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch all schools
      const { data: schools, error: schoolsError } = await supabaseAdmin
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false });

      if (schoolsError) {
        console.error('Error fetching schools:', schoolsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch schools' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch study sessions for all students to calculate rankings
      const studentsWithSessions = await Promise.all(
        (students || []).map(async (student) => {
          const { data: sessions } = await supabaseAdmin
            .from('study_sessions')
            .select('*, quiz_attempts(accuracy_percentage)')
            .eq('student_id', student.id)
            .order('created_at', { ascending: false })
            .limit(10);

          const enhancedSessions = (sessions || []).map((session: any) => {
            const quizAttempts = session.quiz_attempts as { accuracy_percentage: number | null }[] | null;
            const quizScore = (quizAttempts && quizAttempts.length > 0 && quizAttempts[0].accuracy_percentage !== null)
              ? quizAttempts[0].accuracy_percentage
              : null;
            return {
              ...session,
              improvement_score: quizScore !== null ? quizScore : session.improvement_score,
            };
          });

          return {
            ...student,
            study_sessions: enhancedSessions
          };
        })
      );

      // Calculate global rankings for all approved students
      const approvedStudentsForRanking = studentsWithSessions.filter((s: any) => s.is_approved && !s.is_banned);
      const globalRankings = calculateStudentRankings(approvedStudentsForRanking);

      // Get unique districts and create district-wise rankings
      const districts = [...new Set(approvedStudentsForRanking.map((s: any) => s.district).filter(Boolean))];
      const districtRankings: Record<string, any[]> = {};
      
      for (const district of districts) {
        districtRankings[district] = calculateStudentRankings(approvedStudentsForRanking, district);
      }

      return new Response(
        JSON.stringify({ 
          students: students || [], 
          schools: schools || [], 
          rankings: globalRankings,
          districtRankings,
          districts
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Board management actions (admin only)
    if (action === 'list_boards') {
      const { data: boards } = await supabaseAdmin
        .from('custom_boards')
        .select('*')
        .order('created_at', { ascending: true });
      return new Response(JSON.stringify({ boards: boards || [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'add_board') {
      const token = session_token || sessionToken;
      if (!token) {
        return new Response(JSON.stringify({ error: 'Auth required' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const session = await validateSessionToken(supabaseAdmin, token, 'admin');
      if (!session.valid) {
        return new Response(JSON.stringify({ error: 'Invalid admin session' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { board_name, board_state } = await req.clone().then(r => r.json());
      if (!board_name || board_name.trim().length < 2) {
        return new Response(JSON.stringify({ error: 'Board name is required (min 2 chars)' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data, error: insertErr } = await supabaseAdmin
        .from('custom_boards')
        .insert({ name: board_name.trim(), state: board_state?.trim() || null })
        .select()
        .single();
      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ board: data }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'delete_board') {
      const token = session_token || sessionToken;
      if (!token) {
        return new Response(JSON.stringify({ error: 'Auth required' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const session = await validateSessionToken(supabaseAdmin, token, 'admin');
      if (!session.valid) {
        return new Response(JSON.stringify({ error: 'Invalid admin session' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { board_id } = await req.clone().then(r => r.json());
      const { error: delErr } = await supabaseAdmin
        .from('custom_boards')
        .delete()
        .eq('id', board_id);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid user type or action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});