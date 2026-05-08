import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNavBar from "@/components/BottomNavBar";
import StudyBlasterProjectList from "@/components/study-blaster/StudyBlasterProjectList";
import StudyBlasterDashboard from "@/components/study-blaster/StudyBlasterDashboard";

const StudyBlaster = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  const fetchStudent = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setStudentId(data.id);
    }
  }, [user]);

  const fetchProjects = useCallback(async () => {
    if (!studentId) return;
    const { data } = await supabase
      .from("study_projects")
      .select("*")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false });
    setProjects(data || []);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { fetchStudent(); }, [fetchStudent]);
  useEffect(() => { if (studentId) fetchProjects(); }, [studentId, fetchProjects]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen liquid-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen liquid-bg pb-20 sm:pb-6">
      <div className="liquid-orb liquid-orb-blue w-[300px] sm:w-[400px] h-[300px] sm:h-[400px] top-[-80px] sm:top-[-100px] right-[-100px] sm:right-[-150px]" />
      <div className="liquid-orb liquid-orb-green w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] bottom-[-60px] sm:bottom-[-80px] left-[-80px] sm:left-[-100px]" />

      <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-4 pt-4 sm:pt-10">
        {selectedProjectId && studentId ? (
          <StudyBlasterDashboard
            projectId={selectedProjectId}
            studentId={studentId}
            onBack={() => setSelectedProjectId(null)}
          />
        ) : studentId ? (
          <StudyBlasterProjectList
            projects={projects}
            studentId={studentId}
            onSelectProject={setSelectedProjectId}
            onRefresh={fetchProjects}
          />
        ) : null}
      </div>

      <BottomNavBar />
    </div>
  );
};

export default StudyBlaster;
