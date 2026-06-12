

# Real Progress Tracking System — Topic-Level Mastery

## Problem
Current tracking is shallow:
- Weak/strong analysis is only at **subject level** from weekly tests
- Study session topic-level data (weak_areas, strong_areas from AI) is **never shown** on the progress page
- MCQ attempts and quiz attempts data is **not combined** into the progress view
- Student gets no actionable topic-level guidance

## Solution
Build a **topic-level mastery system** that combines ALL data sources into one unified progress view with real, actionable insights.

## Data Sources (already exist, just not aggregated)

```text
┌─────────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  study_sessions     │   │  quiz_attempts   │   │  weekly_tests    │
│  - weak_areas[]     │   │  - accuracy %    │   │  - weak_subjects │
│  - strong_areas[]   │   │  - session_id    │   │  - strong_subj   │
│  - understanding    │   │  - correct_count │   │  - accuracy %    │
│  - subject/topic    │   └──────────────────┘   └──────────────────┘
└─────────────────────┘
         │                        │                       │
         └────────────────────────┴───────────────────────┘
                              │
                    ┌─────────────────────┐
                    │  NEW: topic_mastery  │
                    │  - topic + subject   │
                    │  - mastery_score     │
                    │  - attempt_count     │
                    │  - last_practiced    │
                    │  - trend (improving/ │
                    │    declining/stable) │
                    └─────────────────────┘
```

## Plan

### 1. Create `topic_mastery` Table
New table to aggregate topic-level performance:
- `student_id`, `subject`, `topic`, `mastery_score` (0-100), `attempt_count`, `last_practiced`, `trend` (improving/declining/stable), `source` (study_session/quiz/weekly_test)
- RLS: students can only view/update their own data
- Updated automatically when sessions end or tests complete

### 2. Create Edge Function: `update-topic-mastery`
Runs after each study session or test completion. Aggregates:
- Study session AI analysis (weak_areas → low mastery, strong_areas → high mastery)
- Quiz attempt accuracy per topic
- Weekly test subject performance
- Calculates trend by comparing last 3 data points

### 3. Redesign Progress Page with Real Data
Replace current static aggregation with live topic mastery data:

**Section 1: Key Metrics** (keep current 4 cards — they work)

**Section 2: Topic Mastery Map** (NEW — replaces Subject Health)
- List of ALL topics the student has studied
- Each topic shows: mastery score bar (0-100), attempt count, trend arrow
- Color-coded: Red (0-40), Yellow (40-70), Green (70-100)
- Sorted: weakest first (so student sees what to focus on)

**Section 3: Weak Topics Action Card** (NEW)
- Top 5 weakest topics with "Study Now" button linking to StudyChat with that topic pre-selected
- Shows how many times attempted + current score
- Real actionable guidance

**Section 4: Charts** (keep WPS Trend + Study Pattern, remove Subject Performance bar)

**Section 5: Recent Activity Timeline** (replaces Test History)
- Combined feed: study sessions + quizzes + weekly tests
- Shows what was studied, score achieved, topics covered
- Last 10 activities

**Section 6: AI Insights** (improved)
- Use actual topic mastery data for insights
- "Your weakest topic is X — studied 3 times but mastery still at 35%"
- "Y improved from 40% to 78% — great progress!"

### 4. Call `update-topic-mastery` After Sessions & Tests
- In `StudyPage.tsx` `handleEndStudy`: call the edge function after saving session
- In `WeeklyTest.tsx` after test submission: call the edge function

## Files to Create/Edit
- **New migration**: Create `topic_mastery` table with RLS
- **New edge function**: `supabase/functions/update-topic-mastery/index.ts`
- **Edit**: `src/pages/StudentProgress.tsx` — new UI with topic mastery data
- **Edit**: `src/pages/StudyPage.tsx` — trigger mastery update after session
- **Edit**: `src/pages/WeeklyTest.tsx` — trigger mastery update after test

## No Breaking Changes
All existing data stays. New table is populated going forward + can backfill from existing study_sessions data.

