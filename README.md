# MediBot – Medication Adherence Companion

MediBot is a full-stack medication adherence assistant built with Vite, React and TypeScript on the front end and Supabase for authentication, data storage, and database functions. It helps patients log their prescriptions, schedule reminders, track adherence, and chat with an AI assistant for medication guidance.

> **Channel roadmap**: In-app reminders and dashboard notifications are live today. Email, WhatsApp, and Telegram delivery are designed in the profile model and UI but are not yet wired to outbound messaging services.

## Working Features

- Secure authentication with Supabase (email/password and Google OAuth) and profile bootstrap for new users.  
- Medication library management including multi-time schedules, editing, soft delete, and validation for clean dose data.  
- Reminder engine that checks schedules every minute, surfaces in-app modals, and records adherence outcomes (taken, missed, auto-marked).  
- Adherence snapshot cards and trend views on the dashboard to highlight active meds, upcoming doses, and daily compliance.  
- AI assistant powered by Gemini Flash that answers medication questions using the signed-in user’s context (profile, prescriptions, adherence history).  
- Demo seeding script (`npm run seed:demo`) to create a sample user, medications, and adherence logs for quick exploration.

## Upcoming Messaging Channels

Although profile settings already let users pick a preferred channel, outbound delivery is still pending:

- Email notifications via a transactional provider (e.g., Resend, SendGrid).
- WhatsApp reminders using a verified business account (e.g., Twilio/Meta Cloud API).
- Telegram bot delivery with chat ID linking inside the profile page.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Tailwind CSS, Lucide icons, Vite build tooling.
- **Backend**: Supabase Auth, Postgres tables & functions (see `supabase/migrations`).
- **AI**: Google Gemini 2.5 Flash via `@google/generative-ai`.
- **Tooling**: ESLint, TypeScript project refs, Supabase CLI (optional for local dev).

## Prerequisites

- A Supabase project (hosted or local) with the migration in `supabase/migrations` applied.
- Google AI Studio API key with Gemini access.
- Node.js 20 LTS (or newer) and npm 10+.

### Install Node.js & npm

**Windows (PowerShell)**

```powershell
wget https://nodejs.org/dist/v20.17.0/node-v20.17.0-x64.msi -OutFile node.msi
Start-Process msiexec.exe -Wait -ArgumentList '/i node.msi /qn'
Remove-Item node.msi
node --version
npm --version
```

Alternatively, use [nvm-windows](https://github.com/coreybutler/nvm-windows) to manage versions.

**Ubuntu (bash)**

```bash
sudo apt update
sudo apt install -y curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

Using [nvm](https://github.com/nvm-sh/nvm) is recommended if you prefer per-project Node versions.

## Environment Variables

Create a `.env` file at the repository root (Vite loads variables with the `VITE_` prefix):

```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

Do **not** commit real secrets. For local testing, you can copy `.env` to `.env.local` and set different values.

## Database Setup

1. Open the Supabase SQL editor and run `supabase/migrations/20251103060515_create_medication_tables.sql`, or use the Supabase CLI:
   ```bash
   supabase db push
   ```
2. Ensure the following tables exist: `user_profiles`, `medications`, `medication_schedules`, `adherence_logs`, and helper functions/triggers included in the migration.
3. Optional: run `npm run seed:demo` to insert a sample user (credentials printed in the console) plus demo medications and adherence data.

## Install & Run

The npm workflow is identical on Windows and Ubuntu once Node is installed.

```bash
npm install
npm run dev
```

- `npm run dev` – Vite dev server with hot reload (default at `http://localhost:5173`).
- `npm run build` – Production build to `dist/`.
- `npm run preview` – Serves the build locally to verify assets.
- `npm run lint` / `npm run typecheck` – Quality gates for CI or local checks.

## Project Structure

```
src/
  components/    // Dashboard, medication manager, chatbot widget, modals
  contexts/      // Supabase auth provider
  lib/           // Supabase client, reminder service, Gemini helpers
  App.tsx        // Navigation shell and reminder orchestration
supabase/
  migrations/    // Postgres schema for medications & adherence tracking
scripts/
  create-demo-user.mjs // Seeds demo data
```

## Development Notes

- The reminder service runs in the browser context, polling Supabase every minute and triggering in-app modals plus optional browser notifications (permission requested on login).
- Adherence records are auto-marked as “not taken” if no action occurs within five minutes of the scheduled time; users can manually mark doses as taken or missed from the reminder modal.
- The chatbot fetches live user context on each query to keep responses relevant; errors from the Gemini API surface as a banner inside the widget.
- Profile settings already capture preferred channels and contact fields, paving the way for external messaging integrations.

## Troubleshooting

- **Missing environment variables** – The app throws an error on startup if Supabase or Gemini keys are absent. Double-check `.env`.
- **Supabase session issues** – Ensure the redirect URL in Supabase Auth settings includes your local dev origin (`http://localhost:5173`).
- **Notifications blocked** – Browsers require HTTPS for notifications in production; on localhost, allow notifications when prompted.

Happy building! Contributions, feedback, and integration PRs for the additional messaging channels are welcome.

