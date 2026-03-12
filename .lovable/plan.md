

# Aapke App ke Saare Features (Complete Feature List)

Yeh app ek **AI-powered Education Platform** hai — "Study Buddy AI" — jo students, schools, parents, coaching centers aur admins ke liye banaya gaya hai. Neeche saare features detail mein hain:

---

## 1. User Roles & Authentication

| Role | Login Route | Dashboard |
|------|------------|-----------|
| **Student** | `/login` | `/dashboard` |
| **School** | `/school-login` | `/school-dashboard` |
| **Coaching Center** | `/coaching-login` | — |
| **Parent** | `/parent-view` | Parent Dashboard |
| **Super Admin** | `/admin-login` | `/admin-dashboard` |

- Email/password signup & login
- Forgot password & reset password flow
- School approval system (students need school approval)
- Terms & Conditions page

---

## 2. Student Features

- **AI Study Chat** (`/study`) — AI tutor se kisi bhi subject par padhai karo, voice input/output support ke saath
- **MCQ Practice** (`/mcq-practice`) — AI-generated multiple choice questions with timer
- **Weekly Test** (`/weekly-test`) — Timed weekly tests with scoring
- **Exam Prep** (`/exam-prep`) — Dedicated exam preparation module with onboarding, dashboard & invite system
- **Student Dashboard** — Today/weekly stats, study sessions, avg score, improvement trends
- **Student Rankings** — School-level & district-level leaderboards
- **Achievement Badges** — Gamification with badges & confetti celebrations
- **Student Profile** (`/profile`) — Profile management
- **Progress Tracking** (`/progress`) — Detailed study progress & analytics
- **Subscription Management** — Free/paid plans with upgrade popups
- **Daily Usage Widget** — Track daily study limits

---

## 3. AI-Powered Features

- **Study Chat AI** — Gemini/GPT powered tutoring chatbot (via backend edge function `study-chat`)
- **MCQ Generation** — AI generates subject-wise MCQs (`generate-mcq`)
- **Quiz Generation** — AI generates quizzes (`generate-quiz`)
- **Answer Analysis** — AI evaluates student answers (`analyze-answer`)
- **Exam Prep AI** — AI-assisted exam preparation (`exam-prep`)
- **Parent Chatbot** — Parents can chat with AI about child's progress (`parent-chat`)
- **Text-to-Speech** — AI reads out content using Speechify or native TTS
- **Voice Input** — Students can speak questions using voice input

---

## 4. School Dashboard Features

- Student management (approve/reject students)
- School analytics & student performance tracking
- Student report generation (PDF reports with engagement score, peer comparison, subject breakdown)
- School registration notifications

---

## 5. Parent Dashboard Features

- Child's study progress monitoring
- AI chatbot for parent queries about child's performance
- Weekly reports via WhatsApp (Twilio integration)

---

## 6. Super Admin Dashboard Features

- **Schools Management** — Create, ban/unban schools, fee tracking
- **Students Management** — View all students, search, filter
- **Boards Management** — Add/manage education boards (CBSE, ICSE, Bihar Board, etc.)
- **Student Rankings** — Global leaderboard management, weekly ranking saves
- **Subscription Analytics** — Revenue, active/expired subscriptions, upgrade requests
- **AI Usage Analytics** — Monitor AI API usage across the platform
- **Coaching Center Management** — Manage coaching centers
- **Schools Directory** (`/schools`) — Public directory of all registered schools

---

## 7. Technical/Platform Features

- **Bilingual Support** — English & Hindi (language toggle on every page)
- **Dark/Light Theme** — Theme toggle with system preference support
- **3D UI/UX** — Glassmorphism, liquid backgrounds, 3D hover effects
- **Capacitor Native App** — Ready for Android/iOS build via Capacitor
- **Bottom Navigation Bar** — Mobile-friendly app-like navigation
- **Real-time Data** — Supabase-powered real-time updates
- **PWA-ready** — Installable web app capabilities
- **Error Boundaries** — Global error handling & auth repair
- **Responsive Design** — Works on mobile, tablet & desktop

---

## 8. Integrations

| Service | Purpose |
|---------|---------|
| **Twilio** | WhatsApp notifications to parents |
| **Speechify** | High-quality text-to-speech |
| **Lovable AI** | AI tutoring, MCQ generation, answer analysis |
| **Capacitor** | Native Android/iOS app builds |

---

## 9. Backend Edge Functions (18 total)

`study-chat`, `generate-mcq`, `generate-quiz`, `analyze-answer`, `exam-prep`, `parent-chat`, `parent-dashboard`, `text-to-speech`, `manage-subscription`, `get-students`, `get-schools-public`, `secure-auth`, `school-student-approval`, `manage-coaching`, `admin-ai-usage`, `save-weekly-rankings`, `send-weekly-report`, `notify-school-registration`, `seed-schools`

---

Yeh ek **complete EdTech platform** hai jo AI tutoring, gamification, multi-role dashboards, native app support, aur parent engagement sab kuch cover karta hai.

