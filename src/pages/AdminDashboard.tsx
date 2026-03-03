import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Users,
  Building2,
  GraduationCap,
  LogOut,
  Plus,
  Search,
  TrendingUp,
  Send,
  FileText,
  Loader2,
  Eye,
  EyeOff,
  X,
  ClipboardList,
  Ban,
  DollarSign,
  CheckCircle,
  XCircle,
  Trash2,
  AlertTriangle,
  Database,
  Trophy,
  Key,
  Crown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import StudentReportModal from "@/components/StudentReportModal";
import StudentRanking from "@/components/StudentRanking";
import SubscriptionAnalytics from "@/components/SubscriptionAnalytics";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import { useDebounce } from "@/hooks/useDebounce";

interface RankingData {
  id: string;
  name: string;
  photo?: string;
  class: string;
  schoolName?: string;
  improvementScore: number;
  dailyStudyTime: number;
  weeklyStudyDays: number;
  totalScore: number;
  rank: number;
}

interface School {
  id: string;
  school_id: string;
  name: string;
  district: string | null;
  state: string | null;
  studentCount: number;
  is_banned: boolean;
  fee_paid: boolean;
  email: string | null;
  contact_whatsapp: string | null;
}

interface CoachingCenter {
  id: string;
  coaching_id: string;
  name: string;
  district: string | null;
  state: string | null;
  studentCount: number;
  is_banned: boolean;
  fee_paid: boolean;
  email: string | null;
  contact_whatsapp: string | null;
}

interface Student {
  id: string;
  full_name: string;
  class: string;
  parent_whatsapp: string;
  school_name: string;
  photo_url?: string;
  is_banned: boolean;
  is_approved: boolean;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [adminName, setAdminName] = useState("Admin");
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"schools" | "coaching" | "students" | "reports" | "student-reports" | "rankings" | "subscriptions">("schools");
  const [rankings, setRankings] = useState<RankingData[]>([]);
  
  // Coaching centers state
  const [coachingCenters, setCoachingCenters] = useState<CoachingCenter[]>([]);
  const [showAddCoaching, setShowAddCoaching] = useState(false);
  const [newCoaching, setNewCoaching] = useState({ name: "", district: "", state: "Bihar", email: "", contact_whatsapp: "" });
  const [addingCoaching, setAddingCoaching] = useState(false);
  const [generatedCoachingCredentials, setGeneratedCoachingCredentials] = useState<{ id: string; password: string } | null>(null);
  const [coachingPasswordDialog, setCoachingPasswordDialog] = useState<{ open: boolean; coachingId: string; coachingName: string } | null>(null);
  const [resettingCoachingPassword, setResettingCoachingPassword] = useState(false);
  const [generatedCoachingPassword, setGeneratedCoachingPassword] = useState<string | null>(null);
  
  // Add school modal state
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [newSchool, setNewSchool] = useState({
    name: "",
    district: "",
    state: "Bihar",
    email: "",
    contact_whatsapp: "",
  });
  const [addingSchool, setAddingSchool] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ id: string; password: string } | null>(null);

  // Send report state
  const [sendingReportFor, setSendingReportFor] = useState<string | null>(null);
  
  // Student report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Ban/Delete confirmation states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "ban" | "unban" | "delete" | "fee";
    entity: "school" | "student";
    id: string;
    name: string;
  } | null>(null);

  // Seed schools state
  const [seedingSchools, setSeedingSchools] = useState(false);
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [seededSchools, setSeededSchools] = useState<{ name: string; schoolId: string; password: string }[]>([]);

   // School password reset state
   const [schoolPasswordDialog, setSchoolPasswordDialog] = useState<{
     open: boolean;
     schoolId: string;
     schoolName: string;
   } | null>(null);
   const [newSchoolPassword, setNewSchoolPassword] = useState("");
   const [showNewSchoolPassword, setShowNewSchoolPassword] = useState(false);
   const [resettingSchoolPassword, setResettingSchoolPassword] = useState(false);
   const [generatedSchoolPassword, setGeneratedSchoolPassword] = useState<string | null>(null);

  // Report preview state
  const [reportPreviewDialog, setReportPreviewDialog] = useState<{
    open: boolean;
    student: Student | null;
    reportUrl: string | null;
    loading: boolean;
    reportData: any;
  } | null>(null);

  // Parent token cache for WhatsApp links
  const [parentTokens, setParentTokens] = useState<Record<string, string>>({});
  const [loadingTokens, setLoadingTokens] = useState<Record<string, boolean>>({});

  // Debounced search
  const debouncedSearch = useDebounce(searchQuery, 300);
  useEffect(() => {
    const storedAdminId = localStorage.getItem("adminId");
    const storedAdminName = localStorage.getItem("adminName");
    
    if (!storedAdminId) {
      navigate("/admin-login");
      return;
    }
    
    if (storedAdminName) {
      setAdminName(storedAdminName);
    }

    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      // Use edge function to bypass RLS and get all data for admin
      const sessionToken = localStorage.getItem("adminSessionToken");
      
      if (!sessionToken) {
        toast({
          title: t('msg.error'),
          description: "Session expired. Please login again.",
          variant: "destructive",
        });
        navigate("/admin-login");
        return;
      }
      
      const { data, error } = await supabase.functions.invoke("get-students", {
        body: {
          user_type: "admin",
          session_token: sessionToken,
        },
      });

      if (error) {
        console.error("Error fetching data:", error);
        toast({
          title: t('msg.error'),
          description: "Failed to load data. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      if (data?.error) {
        if (data.error.includes("expired") || data.error.includes("Invalid")) {
          localStorage.clear();
          navigate("/admin-login");
          return;
        }
        console.error("Data error:", data.error);
        setLoading(false);
        return;
      }

      if (data?.schools && data?.students) {
        const schoolsWithCounts = data.schools.map((school: any) => ({
          ...school,
          studentCount: data.students.filter((s: any) => s.school_id === school.id).length,
          is_banned: school.is_banned || false,
          fee_paid: school.fee_paid !== false,
        }));
        setSchools(schoolsWithCounts);

        const formattedStudents = data.students.map((s: any) => ({
          id: s.id,
          full_name: s.full_name,
          class: s.class,
          parent_whatsapp: s.parent_whatsapp,
          school_name: s.schools?.name || "No School",
          photo_url: s.photo_url || undefined,
          is_banned: s.is_banned || false,
          is_approved: s.is_approved || false,
        }));
        setStudents(formattedStudents);
        
        // Set rankings from backend
        if (data?.rankings) {
          setRankings(data.rankings);
        }
      }

      // Load coaching centers
      try {
        const { data: ccData, error: ccError } = await supabase.functions.invoke("manage-coaching", {
          body: {
            action: "list_coaching_centers",
            adminCredentials: { sessionToken },
          },
        });
        if (!ccError && ccData?.coachingCenters) {
          setCoachingCenters(ccData.coachingCenters.map((cc: any) => ({
            id: cc.id,
            coaching_id: cc.coaching_id,
            name: cc.name,
            district: cc.district,
            state: cc.state,
            studentCount: cc.studentCount || 0,
            is_banned: cc.is_banned || false,
            fee_paid: cc.fee_paid !== false,
            email: cc.email,
            contact_whatsapp: cc.contact_whatsapp,
          })));
        }
      } catch (ccErr) {
        console.error("Error loading coaching centers:", ccErr);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSchool = async () => {
    if (!newSchool.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter school name",
        variant: "destructive",
      });
      return;
    }

    setAddingSchool(true);

    try {
      // Use secure edge function to create school with cryptographically random credentials
      const adminId = localStorage.getItem("adminId");
      const sessionToken = localStorage.getItem("adminSessionToken");
      
      const { data, error } = await supabase.functions.invoke("secure-auth", {
        body: {
          action: "create_school",
          adminCredentials: {
            adminId,
            sessionToken,
          },
          schoolData: {
            name: newSchool.name,
            district: newSchool.district || null,
            state: newSchool.state || null,
            email: newSchool.email || null,
            contact_whatsapp: newSchool.contact_whatsapp || null,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        if (data.error.includes("23505") || data.error.includes("duplicate")) {
          toast({
            title: "School Already Exists",
            description: "A school with similar credentials already exists.",
            variant: "destructive",
          });
        } else {
          throw new Error(data.error);
        }
      } else if (data.success) {
        setGeneratedCredentials(data.credentials);
        toast({
          title: "School Added!",
          description: `${newSchool.name} has been added successfully.`,
        });
        loadData();
      }
    } catch (error) {
      console.error("Error adding school:", error);
      toast({
        title: "Error",
        description: "Failed to add school. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingSchool(false);
    }
  };

  const handleBanSchool = async (schoolId: string, ban: boolean) => {
    setActionLoading(schoolId);
    try {
      const adminId = localStorage.getItem("adminId");
      const sessionToken = localStorage.getItem("adminSessionToken");
      
      const { data, error } = await supabase.functions.invoke("secure-auth", {
        body: {
          action: "update_school",
          adminCredentials: { adminId, sessionToken },
          schoolData: {
            schoolId,
            updates: { is_banned: ban },
          },
        },
      });

      if (error || data?.error) throw error || new Error(data.error);

      setSchools(prev => prev.map(s => 
        s.id === schoolId ? { ...s, is_banned: ban } : s
      ));

      toast({
        title: ban ? "School Banned" : "School Unbanned",
        description: ban ? "School can no longer access the dashboard." : "School access has been restored.",
      });
    } catch (error) {
      console.error("Error updating school:", error);
      toast({
        title: "Error",
        description: "Failed to update school. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const handleToggleFee = async (schoolId: string, paid: boolean) => {
    setActionLoading(schoolId);
    try {
      const adminId = localStorage.getItem("adminId");
      const sessionToken = localStorage.getItem("adminSessionToken");
      
      const { data, error } = await supabase.functions.invoke("secure-auth", {
        body: {
          action: "update_school",
          adminCredentials: { adminId, sessionToken },
          schoolData: {
            schoolId,
            updates: { fee_paid: paid },
          },
        },
      });

      if (error || data?.error) throw error || new Error(data.error);

      setSchools(prev => prev.map(s => 
        s.id === schoolId ? { ...s, fee_paid: paid } : s
      ));

      toast({
        title: paid ? "Fee Marked as Paid" : "Fee Marked as Unpaid",
        description: paid ? "School can access the dashboard." : "School access has been suspended.",
      });
    } catch (error) {
      console.error("Error updating fee status:", error);
      toast({
        title: "Error",
        description: "Failed to update fee status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const handleDeleteSchool = async (schoolId: string) => {
    setActionLoading(schoolId);
    try {
      const adminId = localStorage.getItem("adminId");
      const sessionToken = localStorage.getItem("adminSessionToken");
      
      const { data, error } = await supabase.functions.invoke("secure-auth", {
        body: {
          action: "delete_school",
          adminCredentials: { adminId, sessionToken },
          schoolData: { schoolId },
        },
      });

      if (error || data?.error) throw error || new Error(data.error);

      setSchools(prev => prev.filter(s => s.id !== schoolId));

      toast({
        title: "School Deleted",
        description: "School has been permanently removed.",
      });
    } catch (error) {
      console.error("Error deleting school:", error);
      toast({
        title: "Error",
        description: "Failed to delete school. It may have associated students.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const handleBanStudent = async (studentId: string, ban: boolean) => {
    setActionLoading(studentId);
    try {
      const { error } = await supabase
        .from("students")
        .update({ is_banned: ban })
        .eq("id", studentId);

      if (error) throw error;

      setStudents(prev => prev.map(s => 
        s.id === studentId ? { ...s, is_banned: ban } : s
      ));

      toast({
        title: ban ? "Student Banned" : "Student Unbanned",
        description: ban ? "Student can no longer access the platform." : "Student access has been restored.",
      });
    } catch (error) {
      console.error("Error updating student:", error);
      toast({
        title: "Error",
        description: "Failed to update student. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    setActionLoading(studentId);
    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentId);

      if (error) throw error;

      setStudents(prev => prev.filter(s => s.id !== studentId));

      toast({
        title: "Student Deleted",
        description: "Student has been permanently removed.",
      });
    } catch (error) {
      console.error("Error deleting student:", error);
      toast({
        title: "Error",
        description: "Failed to delete student. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

   const handleResetSchoolPassword = async () => {
     if (!schoolPasswordDialog) return;

     setResettingSchoolPassword(true);
     try {
       const adminId = localStorage.getItem("adminId");
       const sessionToken = localStorage.getItem("adminSessionToken");

       const { data, error } = await supabase.functions.invoke("secure-auth", {
         body: {
           action: "force_password_reset",
           adminCredentials: { adminId, sessionToken },
           schoolData: { schoolId: schoolPasswordDialog.schoolId },
         },
       });

       if (error || data?.error) {
         throw error || new Error(data.error);
       }

       if (data?.success && data?.newPassword) {
         setGeneratedSchoolPassword(data.newPassword);
         toast({
           title: "Password Reset Successfully!",
           description: `New password generated for ${schoolPasswordDialog.schoolName}`,
         });
       }
     } catch (error) {
       console.error("Error resetting school password:", error);
       toast({
         title: "Error",
         description: "Failed to reset password. Please try again.",
         variant: "destructive",
       });
     } finally {
       setResettingSchoolPassword(false);
     }
   };

  // ========== Coaching Center Handlers ==========
  const handleAddCoaching = async () => {
    if (!newCoaching.name.trim()) {
      toast({ title: "Error", description: "Please enter coaching name", variant: "destructive" });
      return;
    }
    setAddingCoaching(true);
    try {
      const sessionToken = localStorage.getItem("adminSessionToken");
      const { data, error } = await supabase.functions.invoke("manage-coaching", {
        body: {
          action: "create_coaching_center",
          adminCredentials: { sessionToken },
          coachingData: {
            name: newCoaching.name,
            district: newCoaching.district || null,
            state: newCoaching.state || null,
            email: newCoaching.email || null,
            contact_whatsapp: newCoaching.contact_whatsapp || null,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.success) {
        setGeneratedCoachingCredentials(data.credentials);
        toast({ title: "Coaching Added!", description: `${newCoaching.name} has been added successfully.` });
        loadData();
      }
    } catch (error) {
      console.error("Error adding coaching:", error);
      toast({ title: "Error", description: "Failed to add coaching center.", variant: "destructive" });
    } finally {
      setAddingCoaching(false);
    }
  };

  const handleBanCoaching = async (coachingId: string, ban: boolean) => {
    setActionLoading(coachingId);
    try {
      const sessionToken = localStorage.getItem("adminSessionToken");
      const { data, error } = await supabase.functions.invoke("manage-coaching", {
        body: {
          action: "update_coaching_center",
          adminCredentials: { sessionToken },
          coachingData: { coachingId, updates: { is_banned: ban } },
        },
      });
      if (error || data?.error) throw error || new Error(data.error);
      setCoachingCenters(prev => prev.map(c => c.id === coachingId ? { ...c, is_banned: ban } : c));
      toast({ title: ban ? "Coaching Banned" : "Coaching Unbanned" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update coaching.", variant: "destructive" });
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const handleToggleCoachingFee = async (coachingId: string, paid: boolean) => {
    setActionLoading(coachingId);
    try {
      const sessionToken = localStorage.getItem("adminSessionToken");
      const { data, error } = await supabase.functions.invoke("manage-coaching", {
        body: {
          action: "update_coaching_center",
          adminCredentials: { sessionToken },
          coachingData: { coachingId, updates: { fee_paid: paid } },
        },
      });
      if (error || data?.error) throw error || new Error(data.error);
      setCoachingCenters(prev => prev.map(c => c.id === coachingId ? { ...c, fee_paid: paid } : c));
      toast({ title: paid ? "Fee Marked as Paid" : "Fee Marked as Unpaid" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update fee status.", variant: "destructive" });
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const handleDeleteCoaching = async (coachingId: string) => {
    setActionLoading(coachingId);
    try {
      const sessionToken = localStorage.getItem("adminSessionToken");
      const { data, error } = await supabase.functions.invoke("manage-coaching", {
        body: {
          action: "delete_coaching_center",
          adminCredentials: { sessionToken },
          coachingData: { coachingId },
        },
      });
      if (error || data?.error) throw error || new Error(data.error);
      setCoachingCenters(prev => prev.filter(c => c.id !== coachingId));
      toast({ title: "Coaching Deleted" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete coaching.", variant: "destructive" });
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const handleResetCoachingPassword = async () => {
    if (!coachingPasswordDialog) return;
    setResettingCoachingPassword(true);
    try {
      const sessionToken = localStorage.getItem("adminSessionToken");
      const { data, error } = await supabase.functions.invoke("manage-coaching", {
        body: {
          action: "force_password_reset_coaching",
          adminCredentials: { sessionToken },
          coachingData: { coachingId: coachingPasswordDialog.coachingId },
        },
      });
      if (error || data?.error) throw error || new Error(data?.error);
      if (data?.success && data?.newPassword) {
        setGeneratedCoachingPassword(data.newPassword);
        toast({ title: "Password Reset!", description: `New password generated for ${coachingPasswordDialog.coachingName}` });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to reset password.", variant: "destructive" });
    } finally {
      setResettingCoachingPassword(false);
    }
  };

  const handleSendReport = async (studentId: string, parentWhatsapp: string) => {
    setSendingReportFor(studentId);
    try {
      const { data, error } = await supabase.functions.invoke("send-weekly-report", {
        body: { studentId, sendWhatsApp: true },
      });

      if (error) throw error;

      if (data?.success && data?.reports?.[0]?.sent) {
        await supabase.from("parent_reports").insert({
          student_id: studentId,
          report_type: "manual",
          report_data: data.reports[0].reportData || {},
          sent_at: new Date().toISOString(),
          sent_to: parentWhatsapp,
          created_by: localStorage.getItem("adminId"),
          created_by_type: "admin",
        });

        toast({
          title: "Report Sent!",
          description: `WhatsApp report sent to ${parentWhatsapp}`,
        });
      } else {
        throw new Error(data?.reports?.[0]?.sent === false ? "WhatsApp delivery failed" : "Failed to send report");
      }
    } catch (error) {
      console.error("Error sending report:", error);
      toast({
        title: "Failed to send report",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSendingReportFor(null);
    }
  };

  const handleViewStudentReport = (student: Student) => {
    setSelectedStudent(student);
    setShowReportModal(true);
  };

  const handlePreviewReport = async (student: Student) => {
    setReportPreviewDialog({
      open: true,
      student,
      reportUrl: null,
      loading: true,
      reportData: null,
    });

    try {
      const { data, error } = await supabase.functions.invoke("send-weekly-report", {
        body: { studentId: student.id, previewOnly: true },
      });

      if (error) throw error;
      
      setReportPreviewDialog(prev => prev ? {
        ...prev,
        loading: false,
        reportData: data?.reports?.[0]?.reportData || data?.reportData,
        reportUrl: null,
      } : null);
    } catch (error) {
      console.error("Error generating preview:", error);
      toast({
        title: "Preview Error",
        description: "Could not generate report preview.",
        variant: "destructive",
      });
      setReportPreviewDialog(null);
    }
  };

  const handleConfirmSendReport = async () => {
    if (!reportPreviewDialog?.student) return;
    
    const student = reportPreviewDialog.student;
    setReportPreviewDialog(null);
    
    await handleSendReport(student.id, student.parent_whatsapp);
  };

  // Fetch or create parent access token for a student
  const getParentToken = async (studentId: string): Promise<string | null> => {
    if (parentTokens[studentId]) return parentTokens[studentId];
    
    setLoadingTokens(prev => ({ ...prev, [studentId]: true }));
    try {
      const sessionToken = localStorage.getItem("adminSessionToken");
      const { data, error } = await supabase.functions.invoke("get-students", {
        body: {
          action: "get_parent_token",
          session_token: sessionToken,
          user_type: "admin",
          studentId,
        },
      });
      
      if (error || data?.error) {
        console.error("Token fetch error:", error || data?.error);
        return null;
      }
      
      if (data?.token) {
        setParentTokens(prev => ({ ...prev, [studentId]: data.token }));
        return data.token;
      }
      return null;
    } catch (err) {
      console.error("Error getting parent token:", err);
      return null;
    } finally {
      setLoadingTokens(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const handleOpenWhatsApp = async (student: Student) => {
    const token = await getParentToken(student.id);
    
    const formatWhatsAppNumber = (phone: string) => {
      let cleaned = phone.replace(/\D/g, '');
      if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
      if (!cleaned.startsWith('91') && cleaned.length === 10) cleaned = '91' + cleaned;
      return cleaned;
    };
    
    const whatsappNumber = formatWhatsAppNumber(student.parent_whatsapp);
    const parentLink = token 
      ? `https://studybuddyaiapp.lovable.app/parent-view?token=${token}`
      : '';
    
    const reportMessage = encodeURIComponent(
      `🎓 *Study Buddy AI*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *Weekly Progress Report*\n\n` +
      `👤 *Student:* ${student.full_name}\n` +
      `📚 *Class:* ${student.class}\n` +
      `🏫 *School:* ${student.school_name}\n\n` +
      `Hello! 🙏\n` +
      `Your child's weekly progress report is ready.\n\n` +
      (parentLink 
        ? `📱 *View Full Report:*\n🔗 ${parentLink}\n\n`
        : '') +
      `Click the link above to see your child's:\n` +
      `✅ Study time & consistency\n` +
      `✅ Quiz performance\n` +
      `✅ Strong & weak subjects\n` +
      `✅ Weekly test scores\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📱 *Study Buddy AI*\n` +
      `🌟 AI-Powered Study Partner\n` +
      `📅 ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
    );
    
    window.open(`https://wa.me/${whatsappNumber}?text=${reportMessage}`, '_blank');
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const filteredSchools = useMemo(() => 
    schools.filter((school) =>
      school.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      school.school_id.toLowerCase().includes(debouncedSearch.toLowerCase())
    ), [schools, debouncedSearch]);

  const filteredCoachingCenters = useMemo(() => 
    coachingCenters.filter((cc) =>
      cc.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      cc.coaching_id.toLowerCase().includes(debouncedSearch.toLowerCase())
    ), [coachingCenters, debouncedSearch]);

  const filteredStudents = useMemo(() => 
    students.filter(
      (student) =>
        student.full_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        student.school_name.toLowerCase().includes(debouncedSearch.toLowerCase())
    ), [students, debouncedSearch]);

  const stats = useMemo(() => ({
    totalStudents: students.length,
    totalSchools: schools.length,
    totalCoaching: coachingCenters.length,
    activeSchools: schools.filter((s) => s.studentCount > 0 && !s.is_banned && s.fee_paid).length,
    bannedSchools: schools.filter((s) => s.is_banned).length,
    unpaidSchools: schools.filter((s) => !s.fee_paid).length,
  }), [schools, students, coachingCenters]);

  const handleSeedSchools = async () => {
    setSeedingSchools(true);
    try {
      const sessionToken = localStorage.getItem("adminSessionToken");
      
      const { data, error } = await supabase.functions.invoke("seed-schools", {
        body: {
          action: "seed_default",
          sessionToken,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.created && data.created.length > 0) {
        setSeededSchools(data.created);
        toast({
          title: `${data.created.length} Schools Created!`,
          description: "Default schools have been added successfully.",
        });
        loadData();
      } else if (data?.errors?.length > 0) {
        toast({
          title: "Some schools already exist",
          description: data.errors.join(", "),
        });
      } else {
        toast({
          title: "No schools created",
          description: "All default schools already exist.",
        });
      }
    } catch (error) {
      console.error("Seed schools error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to seed schools.",
        variant: "destructive",
      });
    } finally {
      setSeedingSchools(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-destructive flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-6 h-6 text-destructive-foreground" />
          </div>
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-destructive flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 sm:w-6 sm:h-6 text-destructive-foreground" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-sm sm:text-lg truncate block">Admin Panel</span>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Welcome, {adminName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <div className="edu-card p-3 sm:p-4 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <p className="text-xl sm:text-2xl font-bold">{stats.totalStudents}</p>
            <p className="text-[10px] sm:text-sm text-muted-foreground">Students</p>
          </div>
          <div className="edu-card p-3 sm:p-4 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-2">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
            </div>
            <p className="text-xl sm:text-2xl font-bold">{stats.totalSchools}</p>
            <p className="text-[10px] sm:text-sm text-muted-foreground">Schools</p>
          </div>
          <div className="edu-card p-3 sm:p-4 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <p className="text-xl sm:text-2xl font-bold">{stats.totalCoaching}</p>
            <p className="text-[10px] sm:text-sm text-muted-foreground">Coaching</p>
          </div>
          <div className="edu-card p-3 sm:p-4 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <p className="text-xl sm:text-2xl font-bold">{stats.activeSchools}</p>
            <p className="text-[10px] sm:text-sm text-muted-foreground">Active Schools</p>
          </div>
          <div className="edu-card p-3 sm:p-4 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-2">
              <Ban className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
            </div>
            <p className="text-xl sm:text-2xl font-bold">{stats.bannedSchools}</p>
            <p className="text-[10px] sm:text-sm text-muted-foreground">Banned</p>
          </div>
          <div className="edu-card p-3 sm:p-4 text-center col-span-2 sm:col-span-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-warning/10 flex items-center justify-center mx-auto mb-2">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
            </div>
            <p className="text-xl sm:text-2xl font-bold">{stats.unpaidSchools}</p>
            <p className="text-[10px] sm:text-sm text-muted-foreground">Unpaid Fees</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
          <Button
            variant={activeTab === "schools" ? "default" : "outline"}
            onClick={() => setActiveTab("schools")}
            size="sm"
            className="text-xs sm:text-sm whitespace-nowrap"
          >
            <Building2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Schools
          </Button>
          <Button
            variant={activeTab === "coaching" ? "default" : "outline"}
            onClick={() => setActiveTab("coaching")}
            size="sm"
            className="text-xs sm:text-sm whitespace-nowrap"
          >
            <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Coaching
          </Button>
          <Button
            variant={activeTab === "students" ? "default" : "outline"}
            onClick={() => setActiveTab("students")}
            size="sm"
            className="text-xs sm:text-sm whitespace-nowrap"
          >
            <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Students
          </Button>
          <Button
            variant={activeTab === "reports" ? "default" : "outline"}
            onClick={() => setActiveTab("reports")}
            size="sm"
            className="text-xs sm:text-sm whitespace-nowrap"
          >
            <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Reports
          </Button>
          <Button
            variant={activeTab === "student-reports" ? "default" : "outline"}
            onClick={() => setActiveTab("student-reports")}
            size="sm"
            className="text-xs sm:text-sm whitespace-nowrap"
          >
            <ClipboardList className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Reports
          </Button>
          <Button
            variant={activeTab === "rankings" ? "default" : "outline"}
            onClick={() => setActiveTab("rankings")}
            size="sm"
            className="text-xs sm:text-sm whitespace-nowrap"
          >
            <Trophy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Rankings
          </Button>
          <Button
            variant={activeTab === "subscriptions" ? "default" : "outline"}
            onClick={() => setActiveTab("subscriptions")}
            size="sm"
            className="text-xs sm:text-sm whitespace-nowrap"
          >
            <Crown className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Plans
          </Button>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 sm:pl-10 h-10 sm:h-12"
            />
          </div>
          {activeTab === "schools" && (
            <Dialog open={showAddSchool} onOpenChange={setShowAddSchool}>
              <DialogTrigger asChild>
                <Button variant="hero" size="sm" className="text-xs sm:text-sm">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Add School
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New School</DialogTitle>
                </DialogHeader>
                {generatedCredentials ? (
                  <div className="space-y-4">
                    <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                      <p className="font-semibold text-accent mb-2">School Added Successfully!</p>
                      <p className="text-sm text-muted-foreground mb-4">Share these credentials with the school:</p>
                      <div className="space-y-2 bg-background rounded-lg p-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">School ID:</span>
                          <span className="font-mono font-bold">{generatedCredentials.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Password:</span>
                          <span className="font-mono font-bold">{generatedCredentials.password}</span>
                        </div>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => { setShowAddSchool(false); setGeneratedCredentials(null); setNewSchool({ name: "", district: "", state: "Bihar", email: "", contact_whatsapp: "" }); }}>Done</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div><Label htmlFor="schoolName">School Name *</Label><Input id="schoolName" placeholder="Enter school name" value={newSchool.name} onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })} /></div>
                    <div><Label htmlFor="district">District</Label><Input id="district" placeholder="e.g., Kishanganj" value={newSchool.district} onChange={(e) => setNewSchool({ ...newSchool, district: e.target.value })} /></div>
                    <div><Label htmlFor="state">State</Label><Input id="state" placeholder="e.g., Bihar" value={newSchool.state} onChange={(e) => setNewSchool({ ...newSchool, state: e.target.value })} /></div>
                    <div><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="school@example.com" value={newSchool.email} onChange={(e) => setNewSchool({ ...newSchool, email: e.target.value })} /></div>
                    <div><Label htmlFor="whatsapp">WhatsApp</Label><Input id="whatsapp" placeholder="9876543210" value={newSchool.contact_whatsapp} onChange={(e) => setNewSchool({ ...newSchool, contact_whatsapp: e.target.value })} /></div>
                    <Button className="w-full" onClick={handleAddSchool} disabled={addingSchool}>
                      {addingSchool ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : <><Plus className="w-4 h-4 mr-2" />Add School</>}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
          {activeTab === "coaching" && (
            <Dialog open={showAddCoaching} onOpenChange={setShowAddCoaching}>
              <DialogTrigger asChild>
                <Button variant="hero" size="sm" className="text-xs sm:text-sm">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Add Coaching
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Coaching Center</DialogTitle>
                </DialogHeader>
                {generatedCoachingCredentials ? (
                  <div className="space-y-4">
                    <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                      <p className="font-semibold text-accent mb-2">Coaching Center Added!</p>
                      <p className="text-sm text-muted-foreground mb-4">Share these credentials:</p>
                      <div className="space-y-2 bg-background rounded-lg p-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Coaching ID:</span>
                          <span className="font-mono font-bold">{generatedCoachingCredentials.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Password:</span>
                          <span className="font-mono font-bold">{generatedCoachingCredentials.password}</span>
                        </div>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => { setShowAddCoaching(false); setGeneratedCoachingCredentials(null); setNewCoaching({ name: "", district: "", state: "Bihar", email: "", contact_whatsapp: "" }); }}>Done</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div><Label>Coaching Name *</Label><Input placeholder="Enter coaching name" value={newCoaching.name} onChange={(e) => setNewCoaching({ ...newCoaching, name: e.target.value })} /></div>
                    <div><Label>District</Label><Input placeholder="e.g., Kishanganj" value={newCoaching.district} onChange={(e) => setNewCoaching({ ...newCoaching, district: e.target.value })} /></div>
                    <div><Label>State</Label><Input placeholder="e.g., Bihar" value={newCoaching.state} onChange={(e) => setNewCoaching({ ...newCoaching, state: e.target.value })} /></div>
                    <div><Label>Email</Label><Input type="email" placeholder="coaching@example.com" value={newCoaching.email} onChange={(e) => setNewCoaching({ ...newCoaching, email: e.target.value })} /></div>
                    <div><Label>WhatsApp</Label><Input placeholder="9876543210" value={newCoaching.contact_whatsapp} onChange={(e) => setNewCoaching({ ...newCoaching, contact_whatsapp: e.target.value })} /></div>
                    <Button className="w-full" onClick={handleAddCoaching} disabled={addingCoaching}>
                      {addingCoaching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : <><Plus className="w-4 h-4 mr-2" />Add Coaching</>}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Content */}
        {activeTab === "schools" && (
          <div className="edu-card overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-border bg-secondary/30">
              <h2 className="font-bold text-sm sm:text-base">Registered Schools</h2>
            </div>
            <div className="divide-y divide-border">
              {filteredSchools.map((school) => (
                <div key={school.id} className={`p-3 sm:p-4 ${school.is_banned ? 'bg-destructive/5' : !school.fee_paid ? 'bg-warning/5' : ''}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${school.is_banned ? 'bg-destructive/10' : !school.fee_paid ? 'bg-warning/10' : 'bg-accent/10'}`}>
                        <Building2 className={`w-4 h-4 sm:w-5 sm:h-5 ${school.is_banned ? 'text-destructive' : !school.fee_paid ? 'text-warning' : 'text-accent'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          <p className="font-semibold text-sm sm:text-base truncate">{school.name}</p>
                          {school.is_banned && (
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] sm:text-xs font-medium">Banned</span>
                          )}
                          {!school.fee_paid && !school.is_banned && (
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] sm:text-xs font-medium">Unpaid</span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          ID: {school.school_id} • {school.studentCount} students
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 ml-10 sm:ml-0">
                      {/* Fee Toggle */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDialog({
                          open: true,
                          type: "fee",
                          entity: "school",
                          id: school.id,
                          name: school.name,
                        })}
                        disabled={actionLoading === school.id}
                        className={`text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 ${school.fee_paid ? "text-accent" : "text-warning"}`}
                      >
                        <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                        {school.fee_paid ? "Paid" : "Unpaid"}
                      </Button>
                      
                      {/* Ban/Unban */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDialog({
                          open: true,
                          type: school.is_banned ? "unban" : "ban",
                          entity: "school",
                          id: school.id,
                          name: school.name,
                        })}
                        disabled={actionLoading === school.id}
                        className={`text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 ${school.is_banned ? "text-accent" : "text-destructive"}`}
                      >
                        {school.is_banned ? <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" /> : <Ban className="w-3 h-3 sm:w-4 sm:h-4" />}
                      </Button>
                      
                      {/* Delete */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDialog({
                          open: true,
                          type: "delete",
                          entity: "school",
                          id: school.id,
                          name: school.name,
                        })}
                        disabled={actionLoading === school.id}
                        className="text-destructive hover:bg-destructive/10 h-7 sm:h-8 px-2 sm:px-3"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>

                       {/* Password Reset */}
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => {
                           setSchoolPasswordDialog({
                             open: true,
                             schoolId: school.id,
                             schoolName: school.name,
                           });
                           setGeneratedSchoolPassword(null);
                         }}
                         disabled={actionLoading === school.id}
                         className="text-primary hover:bg-primary/10 h-7 sm:h-8 px-2 sm:px-3"
                         title="Reset Password"
                       >
                         <Key className="w-3 h-3 sm:w-4 sm:h-4" />
                       </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredSchools.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No schools found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Coaching Centers Tab */}
        {activeTab === "coaching" && (
          <div className="edu-card overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-border bg-secondary/30">
              <h2 className="font-bold text-sm sm:text-base">Registered Coaching Centers</h2>
            </div>
            <div className="divide-y divide-border">
              {filteredCoachingCenters.map((cc) => (
                <div key={cc.id} className={`p-3 sm:p-4 ${cc.is_banned ? 'bg-destructive/5' : !cc.fee_paid ? 'bg-warning/5' : ''}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cc.is_banned ? 'bg-destructive/10' : !cc.fee_paid ? 'bg-warning/10' : 'bg-primary/10'}`}>
                        <GraduationCap className={`w-4 h-4 sm:w-5 sm:h-5 ${cc.is_banned ? 'text-destructive' : !cc.fee_paid ? 'text-warning' : 'text-primary'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          <p className="font-semibold text-sm sm:text-base truncate">{cc.name}</p>
                          {cc.is_banned && <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] sm:text-xs font-medium">Banned</span>}
                          {!cc.fee_paid && !cc.is_banned && <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] sm:text-xs font-medium">Unpaid</span>}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          ID: {cc.coaching_id} • {cc.studentCount} students
                          {cc.district && ` • ${cc.district}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 ml-10 sm:ml-0">
                      <Button variant="outline" size="sm" onClick={() => setConfirmDialog({ open: true, type: "fee", entity: "school", id: cc.id, name: cc.name })} disabled={actionLoading === cc.id} className={`text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 ${cc.fee_paid ? "text-accent" : "text-warning"}`}>
                        <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />{cc.fee_paid ? "Paid" : "Unpaid"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleBanCoaching(cc.id, !cc.is_banned)} disabled={actionLoading === cc.id} className={`text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 ${cc.is_banned ? "text-accent" : "text-destructive"}`}>
                        {cc.is_banned ? <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" /> : <Ban className="w-3 h-3 sm:w-4 sm:h-4" />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteCoaching(cc.id)} disabled={actionLoading === cc.id} className="text-destructive hover:bg-destructive/10 h-7 sm:h-8 px-2 sm:px-3">
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setCoachingPasswordDialog({ open: true, coachingId: cc.id, coachingName: cc.name }); setGeneratedCoachingPassword(null); }} disabled={actionLoading === cc.id} className="text-primary hover:bg-primary/10 h-7 sm:h-8 px-2 sm:px-3" title="Reset Password">
                        <Key className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredCoachingCenters.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No coaching centers found.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "students" && (
          <div className="edu-card overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-border bg-secondary/30">
              <h2 className="font-bold text-sm sm:text-base">All Students</h2>
            </div>
            <div className="divide-y divide-border">
              {filteredStudents.map((student) => (
                <div key={student.id} className={`p-3 sm:p-4 ${student.is_banned ? 'bg-destructive/5' : ''}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {student.photo_url ? (
                        <img 
                          src={student.photo_url} 
                          alt={student.full_name}
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 flex-shrink-0 ${student.is_banned ? 'border-destructive/30' : 'border-primary/20'}`}
                        />
                      ) : (
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-lg font-bold flex-shrink-0 ${student.is_banned ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                          {student.full_name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          <p className="font-semibold text-sm sm:text-base truncate">{student.full_name}</p>
                          {student.is_banned && (
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] sm:text-xs font-medium">Banned</span>
                          )}
                          {!student.is_approved && !student.is_banned && (
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] sm:text-xs font-medium">Pending</span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {student.class} • {student.school_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 ml-10 sm:ml-0">
                      {/* Ban/Unban */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDialog({
                          open: true,
                          type: student.is_banned ? "unban" : "ban",
                          entity: "student",
                          id: student.id,
                          name: student.full_name,
                        })}
                        disabled={actionLoading === student.id}
                        className={`text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 ${student.is_banned ? "text-accent" : "text-destructive"}`}
                      >
                        {student.is_banned ? <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" /> : <Ban className="w-3 h-3 sm:w-4 sm:h-4" />}
                      </Button>
                      
                      {/* Delete */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDialog({
                          open: true,
                          type: "delete",
                          entity: "student",
                          id: student.id,
                          name: student.full_name,
                        })}
                        disabled={actionLoading === student.id}
                        className="text-destructive hover:bg-destructive/10 h-7 sm:h-8 px-2 sm:px-3"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredStudents.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No students found.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="edu-card overflow-hidden">
            <div className="p-4 border-b border-border bg-gradient-to-r from-accent/10 to-primary/10">
              <h2 className="font-bold text-lg">📱 Send Parent Reports</h2>
              <p className="text-sm text-muted-foreground">
                Click "Open WhatsApp" to manually send progress reports to parents
              </p>
            </div>
            <div className="divide-y divide-border">
              {filteredStudents.filter(s => !s.is_banned).map((student) => (
                  <div key={student.id} className="p-3 sm:p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      {student.photo_url ? (
                        <img 
                          src={student.photo_url} 
                          alt={student.full_name}
                          className="w-9 h-9 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-primary/20 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-base sm:text-lg font-bold text-primary flex-shrink-0">
                          {student.full_name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm sm:text-base truncate">{student.full_name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {student.class} • {student.school_name}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                          📞 {student.parent_whatsapp}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleOpenWhatsApp(student)}
                        disabled={loadingTokens[student.id]}
                        className="bg-[#25D366] hover:bg-[#20BD5A] text-white font-medium text-xs sm:text-sm shadow-sm flex-shrink-0 gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 h-auto"
                      >
                        {loadingTokens[student.id] ? (
                          <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        )}
                        <span className="hidden xs:inline">WhatsApp</span>
                      </Button>
                    </div>
                  </div>
              ))}
              {filteredStudents.filter(s => !s.is_banned).length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No students found.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "student-reports" && (
          <div className="edu-card overflow-hidden">
            <div className="p-4 border-b border-border bg-secondary/30">
              <h2 className="font-bold">Student Report Generator</h2>
              <p className="text-sm text-muted-foreground">
                View detailed study reports for any student (weekly summary, weak areas, AI feedback)
              </p>
            </div>
            <div className="divide-y divide-border">
              {filteredStudents.filter(s => !s.is_banned).map((student) => (
                <div key={student.id} className="p-3 sm:p-4">
                  <div className="flex items-center gap-3 mb-2 sm:mb-0">
                    {student.photo_url ? (
                      <img 
                        src={student.photo_url} 
                        alt={student.full_name}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-primary/20 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center text-base sm:text-lg font-bold flex-shrink-0">
                        {student.full_name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm sm:text-base truncate">{student.full_name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {student.class} • {student.school_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 ml-12 sm:ml-13">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewStudentReport(student)}
                      className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                    >
                      <ClipboardList className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      View Report
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreviewReport(student)}
                      disabled={reportPreviewDialog?.loading && reportPreviewDialog?.student?.id === student.id}
                      className="text-primary text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                    >
                      {reportPreviewDialog?.loading && reportPreviewDialog?.student?.id === student.id ? (
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 animate-spin" />
                      ) : (
                        <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      )}
                      Preview & Send
                    </Button>
                  </div>
                </div>
              ))}
              {filteredStudents.filter(s => !s.is_banned).length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No students found.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "rankings" && (
          <StudentRanking 
            rankings={rankings} 
            title="🏆 Global Student Rankings"
            showTop={50}
          />
        )}

        {activeTab === "subscriptions" && (
          <SubscriptionAnalytics />
        )}
      </main>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Confirm Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.type === "ban" && `Are you sure you want to ban ${confirmDialog.name}? They will lose access to the platform.`}
              {confirmDialog?.type === "unban" && `Are you sure you want to unban ${confirmDialog.name}? They will regain access to the platform.`}
              {confirmDialog?.type === "delete" && `Are you sure you want to permanently delete ${confirmDialog.name}? This action cannot be undone.`}
              {confirmDialog?.type === "fee" && (
                (() => {
                  const item = schools.find(s => s.id === confirmDialog.id) || coachingCenters.find(c => c.id === confirmDialog.id);
                  return item?.fee_paid
                    ? `Mark ${confirmDialog.name}'s fee as unpaid? They will lose dashboard access.`
                    : `Mark ${confirmDialog.name}'s fee as paid? They will regain dashboard access.`;
                })()
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmDialog?.type === "delete" || confirmDialog?.type === "ban" ? "bg-destructive hover:bg-destructive/90" : ""}
              onClick={() => {
                if (!confirmDialog) return;
                
                if (confirmDialog.type === "ban") {
                  if (confirmDialog.entity === "school") handleBanSchool(confirmDialog.id, true);
                  else handleBanStudent(confirmDialog.id, true);
                } else if (confirmDialog.type === "unban") {
                  if (confirmDialog.entity === "school") handleBanSchool(confirmDialog.id, false);
                  else handleBanStudent(confirmDialog.id, false);
                } else if (confirmDialog.type === "delete") {
                  if (confirmDialog.entity === "school") handleDeleteSchool(confirmDialog.id);
                  else handleDeleteStudent(confirmDialog.id);
                } else if (confirmDialog.type === "fee") {
                  const school = schools.find(s => s.id === confirmDialog.id);
                  if (school) {
                    handleToggleFee(confirmDialog.id, !school.fee_paid);
                  } else {
                    const cc = coachingCenters.find(c => c.id === confirmDialog.id);
                    if (cc) handleToggleCoachingFee(confirmDialog.id, !cc.fee_paid);
                  }
                }
              }}
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Student Report Modal */}
      {selectedStudent && (
        <StudentReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setSelectedStudent(null);
          }}
          studentId={selectedStudent.id}
          studentName={selectedStudent.full_name}
          studentPhoto={selectedStudent.photo_url}
          studentClass={selectedStudent.class}
          userType="admin"
        />
      )}

       {/* School Password Reset Dialog */}
       <Dialog 
         open={schoolPasswordDialog?.open} 
         onOpenChange={(open) => {
           if (!open) {
             setSchoolPasswordDialog(null);
             setNewSchoolPassword("");
             setGeneratedSchoolPassword(null);
           }
         }}
       >
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Key className="w-5 h-5 text-primary" />
               Reset School Password
             </DialogTitle>
           </DialogHeader>
           
           {generatedSchoolPassword ? (
             <div className="space-y-4">
               <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                 <p className="font-semibold text-accent mb-2">Password Reset Successfully!</p>
                 <p className="text-sm text-muted-foreground mb-4">
                   Share these new credentials with <span className="font-medium">{schoolPasswordDialog?.schoolName}</span>:
                 </p>
                 <div className="space-y-2 bg-background rounded-lg p-3">
                   <div className="flex justify-between items-center">
                     <span className="text-sm text-muted-foreground">New Password:</span>
                     <div className="flex items-center gap-2">
                       <span className="font-mono font-bold text-sm">{generatedSchoolPassword}</span>
                       <Button
                         variant="ghost"
                         size="sm"
                         className="h-6 w-6 p-0"
                         onClick={() => {
                           navigator.clipboard.writeText(generatedSchoolPassword);
                           toast({
                             title: "Copied!",
                             description: "Password copied to clipboard",
                           });
                         }}
                       >
                         📋
                       </Button>
                     </div>
                   </div>
                 </div>
                 <p className="text-xs text-muted-foreground mt-3">
                   ⚠️ School will be required to change this password on next login.
                 </p>
               </div>
               <Button
                 className="w-full"
                 onClick={() => {
                   setSchoolPasswordDialog(null);
                   setGeneratedSchoolPassword(null);
                 }}
               >
                 Done
               </Button>
             </div>
           ) : (
             <div className="space-y-4">
               <p className="text-sm text-muted-foreground">
                 This will generate a new secure password for <span className="font-medium">{schoolPasswordDialog?.schoolName}</span>. 
                 All existing sessions will be revoked.
               </p>
               <DialogFooter>
                 <Button
                   variant="outline"
                   onClick={() => setSchoolPasswordDialog(null)}
                 >
                   Cancel
                 </Button>
                 <Button
                   onClick={handleResetSchoolPassword}
                   disabled={resettingSchoolPassword}
                 >
                   {resettingSchoolPassword ? (
                     <>
                       <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                       Generating...
                     </>
                   ) : (
                     <>
                       <Key className="w-4 h-4 mr-2" />
                       Generate New Password
                     </>
                   )}
                 </Button>
               </DialogFooter>
             </div>
           )}
         </DialogContent>
       </Dialog>

       {/* Coaching Password Reset Dialog */}
       <Dialog 
         open={coachingPasswordDialog?.open} 
         onOpenChange={(open) => {
           if (!open) { setCoachingPasswordDialog(null); setGeneratedCoachingPassword(null); }
         }}
       >
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Key className="w-5 h-5 text-primary" />Reset Coaching Password
             </DialogTitle>
           </DialogHeader>
           {generatedCoachingPassword ? (
             <div className="space-y-4">
               <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                 <p className="font-semibold text-accent mb-2">Password Reset Successfully!</p>
                 <p className="text-sm text-muted-foreground mb-4">Share with <span className="font-medium">{coachingPasswordDialog?.coachingName}</span>:</p>
                 <div className="space-y-2 bg-background rounded-lg p-3">
                   <div className="flex justify-between items-center">
                     <span className="text-sm text-muted-foreground">New Password:</span>
                     <div className="flex items-center gap-2">
                       <span className="font-mono font-bold text-sm">{generatedCoachingPassword}</span>
                       <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(generatedCoachingPassword); toast({ title: "Copied!" }); }}>📋</Button>
                     </div>
                   </div>
                 </div>
                 <p className="text-xs text-muted-foreground mt-3">⚠️ Coaching will be required to change this password on next login.</p>
               </div>
               <Button className="w-full" onClick={() => { setCoachingPasswordDialog(null); setGeneratedCoachingPassword(null); }}>Done</Button>
             </div>
           ) : (
             <div className="space-y-4">
               <p className="text-sm text-muted-foreground">This will generate a new secure password for <span className="font-medium">{coachingPasswordDialog?.coachingName}</span>. All existing sessions will be revoked.</p>
               <DialogFooter>
                 <Button variant="outline" onClick={() => setCoachingPasswordDialog(null)}>Cancel</Button>
                 <Button onClick={handleResetCoachingPassword} disabled={resettingCoachingPassword}>
                   {resettingCoachingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Key className="w-4 h-4 mr-2" />Generate New Password</>}
                 </Button>
               </DialogFooter>
             </div>
           )}
         </DialogContent>
       </Dialog>

      {/* Report Preview Dialog */}
      <Dialog 
        open={reportPreviewDialog?.open} 
        onOpenChange={(open) => !open && setReportPreviewDialog(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Report Preview
            </DialogTitle>
          </DialogHeader>
          
          {reportPreviewDialog?.loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating report preview...</p>
            </div>
          ) : reportPreviewDialog?.reportData ? (
            <div className="space-y-4">
              {/* Student Info */}
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl">
                {reportPreviewDialog.student?.photo_url ? (
                  <img 
                    src={reportPreviewDialog.student.photo_url} 
                    alt={reportPreviewDialog.student.full_name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold">
                    {reportPreviewDialog.student?.full_name?.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{reportPreviewDialog.student?.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {reportPreviewDialog.student?.class} • 📞 {reportPreviewDialog.student?.parent_whatsapp}
                  </p>
                </div>
              </div>

              {/* Grade Badge */}
              <div className="text-center p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl">
                <div className="text-4xl font-bold text-primary">{reportPreviewDialog.reportData.grade}</div>
                <div className="text-sm text-muted-foreground">{reportPreviewDialog.reportData.gradeLabel}</div>
                <div className="text-xs mt-1">
                  {reportPreviewDialog.reportData.trend === "improving" ? "📈 Improving" : 
                   reportPreviewDialog.reportData.trend === "declining" ? "📉 Declining" : "➡️ Stable"}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-secondary/30 rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{reportPreviewDialog.reportData.totalSessions}</div>
                  <div className="text-xs text-muted-foreground">Sessions</div>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{reportPreviewDialog.reportData.avgAccuracy}%</div>
                  <div className="text-xs text-muted-foreground">Quiz Accuracy</div>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{reportPreviewDialog.reportData.daysStudied}/7</div>
                  <div className="text-xs text-muted-foreground">Days Studied</div>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{reportPreviewDialog.reportData.currentStreak}🔥</div>
                  <div className="text-xs text-muted-foreground">Streak</div>
                </div>
              </div>

              {/* Daily Breakdown */}
              {reportPreviewDialog.reportData.dailyBreakdown && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm">📅 Daily Breakdown</p>
                  <div className="space-y-1">
                    {reportPreviewDialog.reportData.dailyBreakdown.map((day: any, i: number) => (
                      <div key={i} className={`flex justify-between items-center p-2 rounded-lg text-xs ${day.sessions > 0 ? 'bg-accent/10' : 'bg-secondary/30'}`}>
                        <span>{day.sessions > 0 ? '✅' : '❌'} {day.day} ({day.date})</span>
                        <span className="text-muted-foreground">{day.sessions} sessions</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {reportPreviewDialog.reportData.recommendations?.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm">💡 AI Recommendations</p>
                  <div className="space-y-1 text-xs">
                    {reportPreviewDialog.reportData.recommendations.map((rec: string, i: number) => (
                      <p key={i} className="p-2 bg-accent/10 rounded-lg">{rec}</p>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setReportPreviewDialog(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmSendReport}
                  disabled={sendingReportFor === reportPreviewDialog.student?.id}
                  className="bg-[#25D366] hover:bg-[#20BD5A] text-white"
                >
                  {sendingReportFor === reportPreviewDialog.student?.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send to WhatsApp
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No report data available.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
