# IELTS Reading LMS

An online IELTS Reading test platform for schools. Teachers create and publish reading tests; students take them in an Inspera-style player with timer, question navigation, flagging, and autosave.

## Features

- **Test authoring** — Create passages and questions (MCQ, T/F/NG, Y/N/NG, gap fill, matching)
- **Publish & assign** — Assign published tests to student accounts
- **Exam player** — Split-pane passage + question view, question tabs, countdown timer, flag for review
- **Auto-marking** — Scores submitted tests and estimates IELTS Reading band
- **Results** — Students and teachers view scores and question breakdown

## Tech stack

- React 19 + Vite + TypeScript + Tailwind CSS
- Supabase (Auth, Postgres, RLS, Edge Functions)
- Vercel (frontend deployment)

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations from `supabase/migrations/` in order (SQL Editor or `supabase db push`)
3. Deploy the edge function:

```bash
supabase functions deploy score-session
```

4. Enable Email auth in Authentication → Providers

### 2. Environment variables

Copy `.env.example` to `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Local development

```bash
npm install
npm run dev
```

### 4. Seed demo data (optional)

After creating at least one teacher and one student account via sign-up:

- Run `supabase/migrations/20260619120100_seed_demo.sql` in the SQL Editor
- Or create a test manually in the UI

### 5. Deploy to Vercel

```bash
npm run build
```

Connect the repo to Vercel and set the same environment variables. SPA routing is configured in `vercel.json`.

## User roles

| Role | Access |
|------|--------|
| Admin | Full access to test management |
| Teacher | Create tests, assign students, view results |
| Student | My Tests, exam player, own results |

Sign up at `/login` and choose a role. For production, restrict admin/teacher sign-up or create accounts via Supabase dashboard.

## Project structure

```
src/
  pages/teacher/     Test list, builder, assign, results
  pages/student/     My tests, results
  pages/player/      Inspera-style reading player
  components/        Auth, layout, question inputs
  lib/               Supabase client, scoring logic
supabase/
  migrations/        Database schema + RLS
  functions/         score-session edge function
```

## Question answer keys (JSON format)

- **Multiple choice:** `["Option B"]`
- **True/False/Not Given:** `["TRUE"]`
- **Yes/No/Not Given:** `["NOT GIVEN"]`
- **Gap fill:** `[["food"], ["security"]]` (one array per blank, multiple acceptable answers allowed)
- **Matching:** `{"0": "Benefit", "1": "Challenge"}`

## Roadmap (not in MVP)

- Listening, Writing, Speaking modules
- Import from PDF/Word
- Integration with school gradebook roster
- Lockdown browser / proctoring tools
