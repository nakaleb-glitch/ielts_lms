# IELTS Assessment Hub

An online IELTS Reading test platform for schools. Teachers create and publish reading tests; students take them in an Inspera-style player with timer, question navigation, flagging, and autosave.

## Features

- **Test authoring** — Create passages and questions (MCQ, T/F/NG, Y/N/NG, gap fill, matching)
- **Publish & assign** — Assign published tests to individual students or whole classes
- **Admin roster** — Admins create student/teacher accounts and organize students into classes
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
3. Deploy edge functions:

```bash
supabase functions deploy score-session
supabase functions deploy create-user
supabase functions deploy reset-password
supabase functions deploy import-students-csv
```

4. Enable Email auth in Authentication → Providers
5. Disable **Enable sign ups** in Authentication → Settings (accounts are admin-provisioned only)

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

After creating teacher and student accounts via **Admin → Users**:

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
| Admin | User/class management, full test management |
| Teacher | Create tests, assign students/classes, view results |
| Student | My Tests, exam player, own results |

**Public sign-up is disabled.** Admins create student and teacher accounts at `/admin/users` and organize students into classes at `/admin/classes`.

**Student login:** Students sign in with their **Student ID** (not email). Default password is `royal@123`; students must change it on first login.

**CSV import:** At `/admin/users`, upload a CSV with columns `student_id,class` (optional `name`). Creates students, classes, and class memberships as needed.

**Teachers/admins** sign in with their email address.

**Default admin** (created by migration `20260619130100_seed_default_admin.sql`):

- Email: `na.kaleb@royal.edu.vn`
- Password: set in that migration — change it in Supabase → Authentication → Users after first login

## Project structure

```
src/
  pages/teacher/     Test list, builder, assign, results
  pages/admin/       User and class management
  pages/student/     My tests, results
  pages/player/      Inspera-style reading player
  components/        Auth, layout, question inputs
  lib/               Supabase client, scoring logic
supabase/
  migrations/        Database schema + RLS
  functions/         score-session, create-user edge functions
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
