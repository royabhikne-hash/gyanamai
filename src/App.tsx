import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SchoolLogin from "./pages/SchoolLogin";
import AdminLogin from "./pages/AdminLogin";
import StudentDashboard from "./pages/StudentDashboard";
import SchoolDashboard from "./pages/SchoolDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import StudentProgress from "./pages/StudentProgress";
import TermsConditions from "./pages/TermsConditions";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SchoolsDirectory from "./pages/SchoolsDirectory";
import StudentProfile from "./pages/StudentProfile";
import StudyPage from "./pages/StudyPage";
import CoachingLogin from "./pages/CoachingLogin";
import McqPractice from "./pages/McqPractice";
import WeeklyTest from "./pages/WeeklyTest";
import ParentDashboard from "./pages/ParentDashboard";
import NotFound from "./pages/NotFound";
import ExamPrep from "./pages/ExamPrep";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import GlobalErrorHandlers from "@/components/GlobalErrorHandlers";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <GlobalErrorHandlers />
            <AppErrorBoundary>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/schools" element={<SchoolsDirectory />} />
                  <Route path="/school-login" element={<SchoolLogin />} />
                  <Route path="/admin-login" element={<AdminLogin />} />
                  <Route path="/coaching-login" element={<CoachingLogin />} />
                  <Route path="/dashboard" element={<StudentDashboard />} />
                  <Route path="/progress" element={<StudentProgress />} />
                  <Route path="/profile" element={<StudentProfile />} />
                  <Route path="/study" element={<StudyPage />} />
                  <Route path="/mcq-practice" element={<McqPractice />} />
                  <Route path="/weekly-test" element={<WeeklyTest />} />
                  <Route path="/school-dashboard" element={<SchoolDashboard />} />
                  <Route path="/admin-dashboard" element={<AdminDashboard />} />
                  <Route path="/parent-view" element={<ParentDashboard />} />
                  <Route path="/exam-prep" element={<ExamPrep />} />
                  <Route path="/terms" element={<TermsConditions />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </AppErrorBoundary>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
