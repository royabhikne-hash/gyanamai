import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import GlobalErrorHandlers from "@/components/GlobalErrorHandlers";
import { Loader2 } from "lucide-react";

// Lazy load all pages
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const SchoolLogin = lazy(() => import("./pages/SchoolLogin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const SchoolDashboard = lazy(() => import("./pages/SchoolDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const StudentProgress = lazy(() => import("./pages/StudentProgress"));
const TermsConditions = lazy(() => import("./pages/TermsConditions"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SchoolsDirectory = lazy(() => import("./pages/SchoolsDirectory"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const StudyPage = lazy(() => import("./pages/StudyPage"));
const CoachingLogin = lazy(() => import("./pages/CoachingLogin"));
const McqPractice = lazy(() => import("./pages/McqPractice"));
const WeeklyTest = lazy(() => import("./pages/WeeklyTest"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ExamPrep = lazy(() => import("./pages/ExamPrep"));
const StudyBlaster = lazy(() => import("./pages/StudyBlaster"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

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
                <Suspense fallback={<PageLoader />}>
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
                    <Route path="/study-blaster" element={<StudyBlaster />} />
                    <Route path="/terms" element={<TermsConditions />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </AppErrorBoundary>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
