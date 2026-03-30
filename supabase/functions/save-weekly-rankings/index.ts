import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Send WhatsApp notification via Twilio
async function sendWhatsAppNotification(
  phoneNumber: string, 
  message: string
): Promise<{ success: boolean; error?: string }> {
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioWhatsappFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");

  if (!twilioSid || !twilioAuthToken || !twilioWhatsappFrom) {
    console.log("Twilio credentials not configured");
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const formattedPhone = phoneNumber.startsWith("+") 
      ? phoneNumber 
      : `+91${phoneNumber.replace(/\D/g, "").slice(-10)}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const formData = new URLSearchParams();
    formData.append("To", `whatsapp:${formattedPhone}`);
    formData.append("From", twilioWhatsappFrom);
    formData.append("Body", message);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (response.ok) {
      console.log(`WhatsApp sent to ${formattedPhone}`);
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error("Twilio error:", errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error("WhatsApp error:", error);
    return { success: false, error: String(error) };
  }
}

// Calculate rankings for a list of students with sessions
function calculateStudentRankings(studentsWithSessions: any[]) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  
  const rankings = studentsWithSessions.map((student: any) => {
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
      district: student.district,
      schoolId: student.school_id,
      improvementScore: avgImprovement,
      dailyStudyTime,
      weeklyStudyDays: uniqueDays,
      totalScore,
      rank: 0
    };
  });
  
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log('Starting weekly ranking snapshot...');

    // Calculate week dates
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const weekStartStr = startOfWeek.toISOString().split('T')[0];
    const weekEndStr = endOfWeek.toISOString().split('T')[0];

    // Fetch all approved students with their sessions
    const { data: students, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('*')
      .eq('is_approved', true)
      .or('is_banned.eq.false,is_banned.is.null');

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      throw studentsError;
    }

    if (!students || students.length === 0) {
      console.log('No students found');
      return new Response(
        JSON.stringify({ success: true, message: 'No students to process' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch sessions for all students
    const studentsWithSessions = await Promise.all(
      students.map(async (student) => {
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

    // Get previous week's rankings for comparison
    const prevWeekStart = new Date(startOfWeek);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0];

    const { data: previousRankings } = await supabaseAdmin
      .from('ranking_history')
      .select('student_id, school_rank, district_rank')
      .eq('week_start', prevWeekStartStr);

    const prevRankMap = new Map((previousRankings || []).map((r: any) => [r.student_id, r]));

    // Calculate global rankings
    const globalRankings = calculateStudentRankings(studentsWithSessions);
    const globalRankMap = new Map(globalRankings.map((r: any) => [r.id, r]));

    // Calculate school-wise rankings
    const schoolGroups = new Map<string, any[]>();
    studentsWithSessions.forEach(student => {
      if (student.school_id) {
        if (!schoolGroups.has(student.school_id)) {
          schoolGroups.set(student.school_id, []);
        }
        schoolGroups.get(student.school_id)!.push(student);
      }
    });

    const schoolRankings = new Map<string, Map<string, number>>();
    schoolGroups.forEach((students, schoolId) => {
      const rankings = calculateStudentRankings(students);
      const rankMap = new Map(rankings.map((r: any) => [r.id, r.rank]));
      schoolRankings.set(schoolId, rankMap);
    });

    // Calculate district-wise rankings
    const districtGroups = new Map<string, any[]>();
    studentsWithSessions.forEach(student => {
      if (student.district) {
        if (!districtGroups.has(student.district)) {
          districtGroups.set(student.district, []);
        }
        districtGroups.get(student.district)!.push(student);
      }
    });

    const districtRankings = new Map<string, Map<string, number>>();
    districtGroups.forEach((students, district) => {
      const rankings = calculateStudentRankings(students);
      const rankMap = new Map(rankings.map((r: any) => [r.id, r.rank]));
      districtRankings.set(district, rankMap);
    });

    // Save ranking history and create achievements/notifications
    const rankingHistoryInserts: any[] = [];
    const achievementInserts: any[] = [];
    const notificationInserts: any[] = [];
    const whatsappNotifications: { phone: string; message: string; studentName: string }[] = [];

    for (const student of studentsWithSessions) {
      const globalRank = globalRankMap.get(student.id);
      if (!globalRank) continue;

      const schoolRank = student.school_id 
        ? schoolRankings.get(student.school_id)?.get(student.id) || null
        : null;
      
      const districtRank = student.district
        ? districtRankings.get(student.district)?.get(student.id) || null
        : null;

      // Save ranking history
      rankingHistoryInserts.push({
        student_id: student.id,
        week_start: weekStartStr,
        week_end: weekEndStr,
        school_rank: schoolRank,
        district_rank: districtRank,
        global_rank: globalRank.rank,
        total_score: globalRank.totalScore,
        improvement_score: globalRank.improvementScore,
        daily_study_time: globalRank.dailyStudyTime,
        weekly_study_days: globalRank.weeklyStudyDays,
        district: student.district,
        school_id: student.school_id,
      });

      const prevRank = prevRankMap.get(student.id);

      // Create achievements for top 3
      if (schoolRank && schoolRank <= 3) {
        const titles = ['🥇 School Champion!', '🥈 School Runner-up!', '🥉 School Bronze!'];
        achievementInserts.push({
          student_id: student.id,
          achievement_type: `school_top_${schoolRank}`,
          achievement_title: titles[schoolRank - 1],
          achievement_description: `You ranked #${schoolRank} in your school this week!`,
          badge_icon: schoolRank === 1 ? 'crown' : schoolRank === 2 ? 'medal' : 'award',
          week_start: weekStartStr,
          ranking_type: 'school',
          rank_achieved: schoolRank,
        });

        // Queue WhatsApp notification for parent
        if (student.parent_whatsapp) {
          const rankEmoji = schoolRank === 1 ? '🥇' : schoolRank === 2 ? '🥈' : '🥉';
          whatsappNotifications.push({
            phone: student.parent_whatsapp,
            studentName: student.full_name,
            message: `${rankEmoji} *Gyanam AI Achievement Alert!*\n\n🎉 Congratulations! Your child *${student.full_name}* has achieved *Rank #${schoolRank}* in their school this week!\n\n${titles[schoolRank - 1]}\n\nKeep encouraging them to maintain this excellent performance! 📚✨`
          });
        }
      }

      if (districtRank && districtRank <= 3) {
        const titles = ['🏆 District Champion!', '🥈 District Runner-up!', '🥉 District Bronze!'];
        achievementInserts.push({
          student_id: student.id,
          achievement_type: `district_top_${districtRank}`,
          achievement_title: titles[districtRank - 1],
          achievement_description: `You ranked #${districtRank} in ${student.district} district this week!`,
          badge_icon: districtRank === 1 ? 'trophy' : districtRank === 2 ? 'medal' : 'award',
          week_start: weekStartStr,
          ranking_type: 'district',
          rank_achieved: districtRank,
        });

        // Queue WhatsApp notification for parent (only if not already notified for school rank)
        if (student.parent_whatsapp && !(schoolRank && schoolRank <= 3)) {
          const rankEmoji = districtRank === 1 ? '🏆' : districtRank === 2 ? '🥈' : '🥉';
          whatsappNotifications.push({
            phone: student.parent_whatsapp,
            studentName: student.full_name,
            message: `${rankEmoji} *Gyanam AI Achievement Alert!*\n\n🎉 Amazing news! Your child *${student.full_name}* has achieved *Rank #${districtRank}* in ${student.district} district this week!\n\n${titles[districtRank - 1]}\n\nThis is a remarkable achievement! Keep supporting their learning journey! 📚🌟`
          });
        }
      }

      // Create notifications for rank improvements
      if (prevRank) {
        // School rank improvement
        if (schoolRank && prevRank.school_rank) {
          if (schoolRank < prevRank.school_rank) {
            notificationInserts.push({
              student_id: student.id,
              notification_type: 'rank_improved',
              message: `🎉 Your school rank improved from #${prevRank.school_rank} to #${schoolRank}!`,
              old_rank: prevRank.school_rank,
              new_rank: schoolRank,
              ranking_type: 'school',
            });
          }
          if (schoolRank <= 10 && prevRank.school_rank > 10) {
            notificationInserts.push({
              student_id: student.id,
              notification_type: 'entered_top_10',
              message: `🌟 Congratulations! You entered the Top 10 in your school!`,
              old_rank: prevRank.school_rank,
              new_rank: schoolRank,
              ranking_type: 'school',
            });
          }
        }

        // District rank improvement
        if (districtRank && prevRank.district_rank) {
          if (districtRank < prevRank.district_rank) {
            notificationInserts.push({
              student_id: student.id,
              notification_type: 'rank_improved',
              message: `🎉 Your district rank improved from #${prevRank.district_rank} to #${districtRank}!`,
              old_rank: prevRank.district_rank,
              new_rank: districtRank,
              ranking_type: 'district',
            });
          }
          if (districtRank <= 10 && prevRank.district_rank > 10) {
            notificationInserts.push({
              student_id: student.id,
              notification_type: 'entered_top_10',
              message: `🌟 Amazing! You entered the Top 10 in your district!`,
              old_rank: prevRank.district_rank,
              new_rank: districtRank,
              ranking_type: 'district',
            });
          }
        }
      }
    }

    // Insert ranking history (upsert to handle re-runs)
    if (rankingHistoryInserts.length > 0) {
      const { error: historyError } = await supabaseAdmin
        .from('ranking_history')
        .upsert(rankingHistoryInserts, { 
          onConflict: 'student_id,week_start',
          ignoreDuplicates: false 
        });

      if (historyError) {
        console.error('Error saving ranking history:', historyError);
      } else {
        console.log(`Saved ${rankingHistoryInserts.length} ranking history records`);
      }
    }

    // Insert achievements (upsert to avoid duplicates)
    if (achievementInserts.length > 0) {
      const { error: achievementError } = await supabaseAdmin
        .from('achievements')
        .upsert(achievementInserts, { 
          onConflict: 'student_id,achievement_type,week_start',
          ignoreDuplicates: true 
        });

      if (achievementError) {
        console.error('Error saving achievements:', achievementError);
      } else {
        console.log(`Saved ${achievementInserts.length} achievement records`);
      }
    }

    // Insert notifications
    if (notificationInserts.length > 0) {
      const { error: notificationError } = await supabaseAdmin
        .from('rank_notifications')
        .insert(notificationInserts);

      if (notificationError) {
        console.error('Error saving notifications:', notificationError);
      } else {
        console.log(`Saved ${notificationInserts.length} notification records`);
      }
    }

    // Send WhatsApp notifications for achievements
    let whatsappSentCount = 0;
    if (whatsappNotifications.length > 0) {
      console.log(`Sending ${whatsappNotifications.length} WhatsApp notifications...`);
      
      for (const notification of whatsappNotifications) {
        const result = await sendWhatsAppNotification(notification.phone, notification.message);
        if (result.success) {
          whatsappSentCount++;
        } else {
          console.log(`Failed to send WhatsApp to ${notification.studentName}: ${result.error}`);
        }
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`Successfully sent ${whatsappSentCount}/${whatsappNotifications.length} WhatsApp notifications`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Weekly rankings saved successfully',
        stats: {
          studentsProcessed: students.length,
          rankingsSaved: rankingHistoryInserts.length,
          achievementsCreated: achievementInserts.length,
          notificationsSent: notificationInserts.length,
          whatsappSent: whatsappSentCount,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in save-weekly-rankings:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});