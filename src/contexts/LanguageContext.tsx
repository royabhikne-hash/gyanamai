import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'hi';

interface Translations {
  [key: string]: {
    en: string;
    hi: string;
  };
}

// Common translations used across the app - English primary
export const translations: Translations = {
  // Navigation & Common
  'app.name': { en: 'Study Buddy AI', hi: 'Study Buddy AI' },
  'nav.home': { en: 'Home', hi: 'Home' },
  'nav.login': { en: 'Login', hi: 'Login' },
  'nav.signup': { en: 'Sign Up', hi: 'Sign Up' },
  'nav.logout': { en: 'Logout', hi: 'Logout' },
  'nav.dashboard': { en: 'Dashboard', hi: 'Dashboard' },
  'nav.progress': { en: 'Progress', hi: 'Progress' },
  
  // Auth
  'auth.email': { en: 'Email', hi: 'Email' },
  'auth.password': { en: 'Password', hi: 'Password' },
  'auth.newPassword': { en: 'New Password', hi: 'New Password' },
  'auth.confirmPassword': { en: 'Confirm Password', hi: 'Confirm Password' },
  'auth.loginButton': { en: 'Login', hi: 'Login' },
  'auth.signupButton': { en: 'Sign Up', hi: 'Sign Up' },
  'auth.forgotPassword': { en: 'Forgot Password?', hi: 'Forgot Password?' },
  'auth.resetPassword': { en: 'Reset Password', hi: 'Reset Password' },
  'auth.adminId': { en: 'Admin ID', hi: 'Admin ID' },
  'auth.schoolId': { en: 'School ID', hi: 'School ID' },
  'auth.loggingIn': { en: 'Logging in...', hi: 'Logging in...' },
  'auth.enterAdmin': { en: 'Enter Admin Panel', hi: 'Enter Admin Panel' },
  'auth.adminLogin': { en: 'Admin Login', hi: 'Admin Login' },
  'auth.schoolLogin': { en: 'School Login', hi: 'School Login' },
  'auth.studentLogin': { en: 'Student Login', hi: 'Student Login' },
  'auth.loginAsStudent': { en: 'Login as Student', hi: 'Login as Student' },
  'auth.loginAsSchool': { en: 'Login as School', hi: 'Login as School' },
  'auth.loginAsAdmin': { en: 'Login as Admin', hi: 'Login as Admin' },
  'auth.passwordResetRequired': { en: 'Password Reset Required', hi: 'Password Reset Required' },
  'auth.mustResetPassword': { en: 'You must reset your password before continuing.', hi: 'You must reset your password before continuing.' },
  'auth.updating': { en: 'Updating...', hi: 'Updating...' },
  'auth.updatePassword': { en: 'Update Password', hi: 'Update Password' },
  
  // Dashboard
  'dashboard.welcome': { en: 'Welcome', hi: 'Welcome' },
  'dashboard.totalStudents': { en: 'Total Students', hi: 'Total Students' },
  'dashboard.totalSchools': { en: 'Total Schools', hi: 'Total Schools' },
  'dashboard.activeSchools': { en: 'Active Schools', hi: 'Active Schools' },
  'dashboard.bannedSchools': { en: 'Banned Schools', hi: 'Banned Schools' },
  'dashboard.unpaidFees': { en: 'Unpaid Fees', hi: 'Unpaid Fees' },
  'dashboard.loading': { en: 'Loading...', hi: 'Loading...' },
  'dashboard.search': { en: 'Search...', hi: 'Search...' },

  // School Dashboard
  'school.dashboardTitle': { en: 'School Dashboard', hi: 'School Dashboard' },
  'school.dashboardLoading': { en: 'Loading dashboard...', hi: 'Loading dashboard...' },
  'school.accessSuspendedTitle': { en: 'Access Suspended', hi: 'Access Suspended' },
  'school.accessSuspendedDesc': { en: "Your school's dashboard access has been suspended due to unpaid fees. Please contact the admin to resolve this issue.", hi: "Your school's dashboard access has been suspended due to unpaid fees. Please contact the admin to resolve this issue." },
  'school.bannedDesc': { en: 'Your school has been banned. Please contact admin.', hi: 'Your school has been banned. Please contact admin.' },
  'school.removeStudentFailed': { en: 'Failed to remove student. Please try again.', hi: 'Failed to remove student. Please try again.' },
  'school.today': { en: 'Today', hi: 'Today' },
  'school.improving': { en: 'Improving', hi: 'Improving' },
  'school.pendingApprovalsTitle': { en: 'Pending Student Approvals', hi: 'Pending Student Approvals' },
  'school.pendingApprovalsDesc': { en: 'Review and approve students to allow them access.', hi: 'Review and approve students to allow them access.' },
  'school.selectedCount': { en: 'selected', hi: 'selected' },
  'school.selectAll': { en: 'Select All', hi: 'Select All' },
  'school.deselect': { en: 'Deselect', hi: 'Deselect' },
  'school.approveAll': { en: 'Approve All', hi: 'Approve All' },
  'school.rejectAll': { en: 'Reject All', hi: 'Reject All' },
  'school.noPendingTitle': { en: 'No pending approvals!', hi: 'No pending approvals!' },
  'school.noPendingDesc': { en: 'All students have been reviewed.', hi: 'All students have been reviewed.' },
  'school.searchStudents': { en: 'Search students...', hi: 'Search students...' },
  'school.allClasses': { en: 'All Classes', hi: 'All Classes' },
  'school.studentActivity': { en: 'Student Activity', hi: 'Student Activity' },
  'school.noApprovedTitle': { en: 'No approved students yet.', hi: 'No approved students yet.' },
  'school.noApprovedDesc': { en: 'Approve pending students to see them here.', hi: 'Approve pending students to see them here.' },
  'school.table.student': { en: 'Student', hi: 'Student' },
  'school.table.today': { en: 'Today', hi: 'Today' },
  'school.table.topicStudied': { en: 'Topic Studied', hi: 'Topic Studied' },
  'school.table.trend': { en: 'Trend', hi: 'Trend' },
  'school.table.sessions': { en: 'Sessions', hi: 'Sessions' },
  'school.table.actions': { en: 'Actions', hi: 'Actions' },
  'school.yes': { en: 'Yes', hi: 'Yes' },
  'school.no': { en: 'No', hi: 'No' },
  'school.studied': { en: 'Studied', hi: 'Studied' },
  'school.notYet': { en: 'Not Yet', hi: 'Not Yet' },
  'school.topicLabel': { en: 'Topic', hi: 'Topic' },
  'school.trendLabel': { en: 'Trend', hi: 'Trend' },
  'school.viewReport': { en: 'View Report', hi: 'View Report' },
  'school.rejectStudentTitle': { en: 'Reject Student Registration', hi: 'Reject Student Registration' },
  'school.rejectStudentDesc': { en: "You are about to reject {name}'s registration. Please provide a reason (optional):", hi: "You are about to reject {name}'s registration. Please provide a reason (optional):" },
  'school.rejectReasonPlaceholder': { en: 'Enter reason for rejection (e.g., Invalid details, Not a student of this school, etc.)', hi: 'Enter reason for rejection (e.g., Invalid details, Not a student of this school, etc.)' },
  'school.rejectStudentsTitle': { en: 'Reject {count} Students', hi: 'Reject {count} Students' },
  'school.rejectStudentsDesc': { en: 'You are about to reject {count} students. Please provide a reason (optional):', hi: 'You are about to reject {count} students. Please provide a reason (optional):' },
  'school.removeStudentTitle': { en: 'Remove Student', hi: 'Remove Student' },
  'school.removeStudentDesc': { en: 'Are you sure you want to remove {name} from your school? This will permanently delete their account and all study data.', hi: 'Are you sure you want to remove {name} from your school? This will permanently delete their account and all study data.' },

  // Trends
  'trend.improving': { en: 'Improving', hi: 'Improving' },
  'trend.declining': { en: 'Declining', hi: 'Declining' },
  'trend.stable': { en: 'Stable', hi: 'Stable' },

  // Student Progress
  'progress.title': { en: 'Progress Report', hi: 'Progress Report' },
  'progress.overallGrade': { en: 'Overall Grade', hi: 'Overall Grade' },
  'progress.downloadPdf': { en: 'Download PDF', hi: 'Download PDF' },
  'progress.totalSessions': { en: 'Total Sessions', hi: 'Total Sessions' },
  'progress.studyTime': { en: 'Study Time', hi: 'Study Time' },
  'progress.avgScore': { en: 'Avg Score', hi: 'Avg Score' },
  'progress.consistency': { en: 'Consistency', hi: 'Consistency' },
  'progress.streak': { en: 'Streak', hi: 'Streak' },
  'progress.quizzes': { en: 'Quizzes', hi: 'Quizzes' },
  'progress.quizAccuracy': { en: 'Quiz Accuracy', hi: 'Quiz Accuracy' },
  'progress.improvementOverTime': { en: 'Improvement Over Time (Last 30 Days)', hi: 'Improvement Over Time (Last 30 Days)' },
  'progress.startStudyingEmpty': { en: 'Start studying to see your progress!', hi: 'Start studying to see your progress!' },
  'progress.skillAssessment': { en: 'Skill Assessment', hi: 'Skill Assessment' },
  'progress.subjectPerformance': { en: 'Subject Performance', hi: 'Subject Performance' },
  'progress.noDataYet': { en: 'No data available yet', hi: 'No data available yet' },
  'progress.weeklyComparison': { en: 'Weekly Comparison', hi: 'Weekly Comparison' },
  'progress.weeklyStudyPattern': { en: 'Weekly Study Pattern', hi: 'Weekly Study Pattern' },
  'progress.understandingLevels': { en: 'Understanding Levels', hi: 'Understanding Levels' },
  'progress.recentQuizPerformance': { en: 'Recent Quiz Performance', hi: 'Recent Quiz Performance' },
  'progress.correctLabel': { en: 'correct', hi: 'correct' },
  'progress.strongAreas': { en: 'Strong Areas', hi: 'Strong Areas' },
  'progress.keepStudyingStrengths': { en: 'Keep studying to identify your strengths!', hi: 'Keep studying to identify your strengths!' },
  'progress.areasToImprove': { en: 'Areas to Improve', hi: 'Areas to Improve' },
  'progress.noWeakAreasYet': { en: 'Great job! No weak areas identified yet.', hi: 'Great job! No weak areas identified yet.' },
  'progress.downloadFailedTitle': { en: 'Download Failed', hi: 'Download Failed' },
  'progress.downloadFailedDesc': { en: 'Could not generate PDF. Please try again.', hi: 'Could not generate PDF. Please try again.' },

  // Tabs
  'tab.schools': { en: 'Schools', hi: 'Schools' },
  'tab.students': { en: 'Students', hi: 'Students' },
  'tab.reports': { en: 'Send Reports', hi: 'Send Reports' },
  'tab.studentReports': { en: 'Student Reports', hi: 'Student Reports' },
  
  // Actions
  'action.add': { en: 'Add', hi: 'Add' },
  'action.edit': { en: 'Edit', hi: 'Edit' },
  'action.delete': { en: 'Delete', hi: 'Delete' },
  'action.ban': { en: 'Ban', hi: 'Ban' },
  'action.unban': { en: 'Unban', hi: 'Unban' },
  'action.approve': { en: 'Approve', hi: 'Approve' },
  'action.reject': { en: 'Reject', hi: 'Reject' },
  'action.save': { en: 'Save', hi: 'Save' },
  'action.cancel': { en: 'Cancel', hi: 'Cancel' },
  'action.confirm': { en: 'Confirm', hi: 'Confirm' },
  'action.send': { en: 'Send', hi: 'Send' },
  'action.view': { en: 'View', hi: 'View' },
  'action.addSchool': { en: 'Add School', hi: 'Add School' },
  'action.sendReport': { en: 'Send Report', hi: 'Send Report' },
  'action.viewReport': { en: 'View Report', hi: 'View Report' },
  'action.markPaid': { en: 'Mark Paid', hi: 'Mark Paid' },
  'action.markUnpaid': { en: 'Mark Unpaid', hi: 'Mark Unpaid' },
  
  // School
  'school.name': { en: 'School Name', hi: 'School Name' },
  'school.district': { en: 'District', hi: 'District' },
  'school.state': { en: 'State', hi: 'State' },
  'school.email': { en: 'Email', hi: 'Email' },
  'school.whatsapp': { en: 'WhatsApp', hi: 'WhatsApp' },
  'school.students': { en: 'Students', hi: 'Students' },
  'school.feePaid': { en: 'Fee Paid', hi: 'Fee Paid' },
  'school.feeUnpaid': { en: 'Fee Unpaid', hi: 'Fee Unpaid' },
  'school.banned': { en: 'Banned', hi: 'Banned' },
  'school.active': { en: 'Active', hi: 'Active' },
  'school.credentials': { en: 'School Credentials', hi: 'School Credentials' },
  'school.credentialsSave': { en: 'Save these credentials! They cannot be recovered.', hi: 'Save these credentials! They cannot be recovered.' },
  
  // Student
  'student.name': { en: 'Name', hi: 'Name' },
  'student.class': { en: 'Class', hi: 'Class' },
  'student.parentWhatsapp': { en: 'Parent WhatsApp', hi: 'Parent WhatsApp' },
  'student.approved': { en: 'Approved', hi: 'Approved' },
  'student.pending': { en: 'Pending', hi: 'Pending' },
  
  // Messages
  'msg.success': { en: 'Success', hi: 'Success' },
  'msg.error': { en: 'Error', hi: 'Error' },
  'msg.loading': { en: 'Loading...', hi: 'Loading...' },
  'msg.noData': { en: 'No data found', hi: 'No data found' },
  'msg.confirmDelete': { en: 'Are you sure you want to delete?', hi: 'Are you sure you want to delete?' },
  'msg.confirmBan': { en: 'Are you sure you want to ban?', hi: 'Are you sure you want to ban?' },
  'msg.passwordsMismatch': { en: 'Passwords do not match', hi: 'Passwords do not match' },
  'msg.passwordTooShort': { en: 'Password must be at least 8 characters', hi: 'Password must be at least 8 characters' },
  'msg.reportSent': { en: 'Report sent successfully', hi: 'Report sent successfully' },
  'msg.schoolAdded': { en: 'School added successfully', hi: 'School added successfully' },
  
  // Landing
  'landing.hero': { en: 'AI-Powered Education for Every Student', hi: 'AI-Powered Education for Every Student' },
  'landing.heroSub': { en: 'Personalized learning that adapts to you', hi: 'Personalized learning that adapts to you' },
  'landing.getStarted': { en: 'Get Started', hi: 'Get Started' },
  'landing.learnMore': { en: 'Learn More', hi: 'Learn More' },
  
  // Language toggle
  'language.toggle': { en: 'Switch Language', hi: 'Switch Language' },
  'language.current': { en: 'English', hi: 'English' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('appLanguage');
    return (stored === 'en' || stored === 'hi') ? stored : 'en';
  });

  useEffect(() => {
    localStorage.setItem('appLanguage', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState(prev => prev === 'en' ? 'hi' : 'en');
  };

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }
    return translation[language];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
