Bhai, PRD padh liya. Ye "New Gyanam" ek small redesign nahi hai — ye product philosophy ka **complete flip** hai:

> Old = Tool platform (student chooses feature).
> **New = AI Teacher (AI chooses strategy, student just shows up).**

Isko ek turn me thoonsna matlab shallow, buggy output. Yaha proper phased roadmap hai. Har phase ek turn.

---

## The core shift (non-negotiable)

Dashboard = 15 feature cards ❌
Dashboard = **one conversation with your AI Teacher** ✅

Student app kholta hai → AI khud bolta hai:

> "Good evening Aman. Kal Fractions kiya tha, Q4 & Q7 galat the. Pehle wo, phir 10 min revision, phir Ch 6. Total 65 min. Chalein?"

MCQ / Podcast / Flashcards / Study Blaster / Exam Prep — ye sab **gayab nahi ho rahe**, bas ab AI internally launch karega, student manually nahi.

---

## Phase 1 — Foundation (this turn, if approved)

The bones ke bina baaki kuch nahi ban sakta.

1. **Book-cover onboarding**
  - New signup step: "Har subject ki book ka front cover upload karo"
  - Edge function `detect-books`: Gemini Vision → publisher + class + subject
  - Confirmation screen → lock `academic_profile` (class, board, per-subject book/publisher)
  - New table `student_books` (student_id, subject, publisher, book_title, cover_url) + RLS + GRANTs
2. **New Home = "Today with your AI Teacher"**
  - Replace `StudentDashboard` grid with a single conversational hero:
    - Greeting + last-session recap + today's plan (3-4 steps) + big "Chalo shuru karte hain" button
  - Old feature cards move to a small "Tools" drawer (still reachable, not primary)
3. **Session Orchestrator (Decision Engine v0)**
  - Edge function `daily-plan`: reads last session, weak topics, days-to-exam → returns ordered steps:
   `[{type:'homework_review'|'revision'|'teach'|'mcq'|'notebook', topic, minutes}]`
  - New `TeacherSession` component runs steps sequentially, one screen at a time. Student never picks — just taps "Next".
4. **Observation + Memory tables**
  - `student_observations` (mood, focus, session_length, time_of_day, device)
  - `student_memory` (weak_topics jsonb, strong_topics jsonb, learning_style, best_study_time, streak_health)
  - Every existing feature (study-chat, mcq, exam-prep) writes to these on completion.

---

## Phase 2 — The Living Teacher (next turn)

5. **Proactive greeting engine** — AI initiates every session using memory ("Kal tum thake the, aaj halka rakhte hain")
6. **Adaptive re-planning** — student missed a day → plan auto-shifts, doesn't break
7. **Homework capture** — photo upload of notebook → AI marks Q-by-Q, updates weak_topics
8. **Emotional tone layer** — praise, concern, encouragement based on observations (no generic motivational quotes)

## Phase 3 — Internal Tool Wiring

9. AI auto-launches MCQ / Podcast / Flashcards / Study Blaster mid-session based on rules:
  - 3 wrong in a row → flashcards
  - visual-learner signal → podcast
  - exam ≤7 days → Exam Prep Mode takes over dashboard

## Phase 4 — The Network (Student / Parent / Teacher / School AI)

10. Parent AI sends WhatsApp digest driven by observations
11. Teacher AI: class heatmap + "these 6 students need attention today"
12. School AI: cross-class trends
  (Overlaps with GLIS Layer 4 we already planned — will merge.)

---

## What Phase 1 will actually touch

**New:**

- `src/components/onboarding/BookCoverUpload.tsx`
- `src/components/teacher/TeacherHome.tsx` (new dashboard hero)
- `src/components/teacher/TeacherSession.tsx` (sequential runner)
- `supabase/functions/detect-books/index.ts`
- `supabase/functions/daily-plan/index.ts`
- Migration: `student_books`, `student_observations`, `student_memory` (+ RLS + GRANTs)

**Edited:**

- `src/pages/StudentDashboard.tsx` — new home layout, old grid demoted to "Tools" drawer
- `src/pages/Signup.tsx` or onboarding flow — insert book-cover step after language picker

**Untouched this phase:** Admin, School, Parent dashboards; existing MCQ / StudyBlaster / ExamPrep internals (they just become tools the AI calls).

---

## What I need from you

Reply **"go phase 1"** to start.

Or override the order — e.g.:

- "Home redesign first, book-cover later" (I ship #2 + #3 with a dummy plan)
- "Books first, home stays" (I ship #1 only)
- "Skip book-cover, use current class+board" (faster, less accurate)

Note about "/skill:accessibility": accessibility audit is best run **after** Phase 1 lands, so we audit the new home, not the one we're about to delete. I'll run it at the end of Phase 1.     everything in english  and yee plan ka GYANAM AI — Complete AI Tutor Product Blueprint

# Product Vision

Gyanam AI is not an AI chatbot and not just a collection of study tools.

Gyanam AI is a **Personal AI Tutor** that teaches students, understands their learning behaviour, evaluates their progress, identifies weaknesses, prepares them for exams, and keeps parents, teachers, and schools informed.

The core mission:

> "The AI Tutor's goal is simple: Teach the student, understand the student, evaluate the student, improve the student, and guide the student continuously."

---

# Core Transformation

## Old Model

Student opens app → chooses a feature.

Examples:

- MCQ
- Chat
- Flashcards
- Podcast
- Exam Preparation
- Notes
- Study Material

Problem:

Students know the tools, but they do not always know:

- What should I study today?
- What topic am I weak in?
- Am I ready for exams?
- What mistakes am I repeating?

---

# New Model

Student opens Gyanam → AI Tutor takes responsibility.

The AI Tutor decides:

- What to teach
- What to revise
- What questions to practice
- When to test
- When to change strategy
- When parents or teachers should be informed

---

# AI Tutor Daily Experience

Example:

Good Evening Aman 👋

I analyzed your previous learning session.

Yesterday you studied Fractions.

Your understanding:  
70%

Issue found:  
Division of fractions concept needs improvement.

Today's learning plan:

1. Concept revision — 15 minutes
2. Guided practice — 20 minutes
3. Homework support — 15 minutes
4. Quick assessment — 10 minutes

Total learning time:  
60 minutes

Ready to start?

[Start Learning]

---

# AI Tutor Responsibilities

The AI Tutor performs the complete role of a personal teacher:

## 1. Teaching

AI Tutor teaches:

- Concepts
- Chapters
- Topics
- Examples
- Problem-solving methods

Teaching style adapts according to:

- Student level
- Learning speed
- Previous mistakes
- Preferred learning method

---

## 2. Daily Learning Planning

Every day AI creates:

"Today's Study Plan"

Based on:

- Previous performance
- School schedule
- Homework
- Weak topics
- Upcoming exams
- Learning goals

---

## 3. Homework Assistance

Student uploads homework/notebook images.

AI Tutor:

- Reads questions
- Checks answers
- Explains mistakes
- Updates learning records

Example:

Question:

Solve 5/10 + 2/10

Student Answer:

8/10

AI Feedback:

"Your addition is correct, but let's simplify the final answer."

---

# AI Assessment System

Evaluation is a core responsibility of the AI Tutor.

The AI does not only teach.

It tests, measures, and improves.

---

# Weekly AI Test

## Purpose:

Evaluate everything taught during the week.

Every week AI automatically conducts:

"Weekly Progress Test"

Based on:

- Topics completed
- Student mistakes
- Learning goals

Test includes:

- MCQ
- Short answers
- Problem solving
- Concept questions

After test:

AI generates:

Weekly Report

Example:

Weekly Performance:

Mathematics:  
82%

Strong Areas:

- Algebra
- Linear equations

Needs Improvement:

- Fractions

Next Week Focus:

Fractions revision + practice

---

# Monthly AI Assessment

## Purpose:

Measure overall academic growth.

Every month AI conducts:

"Monthly Performance Assessment"

Includes:

- Full month syllabus
- Previous weak areas
- Revision topics

AI compares:

Previous Month:

68%

Current Month:

78%

Growth:

+10%

---

# Surprise AI Tests

## Purpose:

Check real understanding without preparation.

The AI Tutor can conduct surprise tests.

Examples:

"Quick 10-minute challenge"

or

"Let's check your understanding of yesterday's topic."

Purpose:

- Prevent memorization
- Check retention
- Improve confidence

---

# Exam Preparation Mode

Exam Preparation is a dedicated AI Tutor mode.

It is not the complete Gyanam experience.

Normal Mode:

Daily learning + improvement

Exam Mode:

Maximum exam readiness

---

# Exam Prep AI Features

When exams are approaching:

AI automatically creates:

## Revision Plan

Example:

30 days before exam:

Complete remaining chapters

15 days before exam:

Full revision

7 days before exam:

Previous year questions

3 days before exam:

Final revision

---

## AI Mock Tests

AI creates:

- Full syllabus tests
- Chapter tests
- Time-based exams

After every test:

AI identifies:

- Weak chapters
- Common mistakes
- Exam strategy issues

---

# Student Intelligence System

The AI Tutor maintains a learning profile.

Not simple memory.

Evidence-based intelligence.

Example:

Topic:

Fractions

Skill Level:

Needs Improvement

Confidence:

82%

Evidence:

- 20 practice questions
- 5 mistakes
- Weekly test performance

---

# Parent AI System

Parents should not only receive marks.

They should understand progress.

Parent Report:

Student:

Aman

Weekly Learning:

6 hours 20 minutes

Improvement:

+12%

Strong Areas:

Science

Needs Attention:

Mathematics Fractions

AI Recommendation:

Practice 15 minutes daily

---

# Parent Alerts

AI informs parents when:

- Student misses learning sessions
- Performance decreases
- Homework is incomplete
- Exam preparation is weak
- Continuous mistakes appear

---

# School & Class Teacher AI

Gyanam connects students, parents, and teachers.

Teachers receive:

## Class Performance Dashboard

Example:

Class 8A

Mathematics:

Average:

76%

Students needing attention:

8

Weak Topic:

Fractions

---

# Teacher Notifications

AI informs teachers:

"5 students in Class 8A are struggling with Chapter 6 Algebra."

Teacher can intervene early.

---

# School Intelligence System

For schools:

AI provides:

- Class performance trends
- Subject analysis
- Student growth reports
- Teacher support insights

---

# AI Learning Tools

Existing features become internal teaching tools:

## MCQ Engine

Used for:

- Practice
- Testing
- Assessment

## Flashcards

Used for:

- Revision
- Memory improvement

## Podcast/Lecture Mode

Used for:

- Audio learners

## Study Chat

Used for:

- Doubt solving

## Study Blaster

Used for:

- Intensive learning sessions

## Exam Prep

Used for:

- Exam readiness

The AI Tutor decides when and how to use these.

---

# Complete AI Tutor Cycle

Student joins Gyanam

↓

AI understands academic profile

↓

AI creates daily plan

↓

AI teaches

↓

AI checks understanding

↓

AI assigns practice

↓

AI conducts weekly tests

↓

AI conducts monthly assessments

↓

AI detects weaknesses

↓

AI improves teaching strategy

↓

AI informs parents and teachers

↓

Student improves continuously

---

# Final Product Identity

Gyanam AI is:

Not an AI chatbot.

Not a digital textbook.

Not a study app.

Gyanam AI is:

> "A complete AI Tutor that teaches, tests, evaluates, guides, and works together with students, parents, teachers, and schools to improve learning outcomes."  
>
>
> like a presonal tutor his goal simple complete student syllabus and test him teach him prep for exam and revison etc like a tutor 