# MediRemainder - Medication Reminder App

A simple, effective web application to remind users to take their medication on time. Built with React (Vite) and Supabase.

## Features

- **Medication Management**: Add, edit, and list medications with dosage and instructions.
- **Reminders**: Automated email reminders sent at scheduled times.
- **Family Alerts**: Notifications can be sent to family members if medications are missed (configurable).
- **AI Integration**: (Optional) Features for interpreting prescriptions using Gemini AI.
- **Responsive Design**: Works on mobile and desktop.

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Supabase Account**: You need a free Supabase project.

## Setup Guide

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd medi-remainder
npm install
```

### 2. Supabase Setup

1. Create a new project on [Supabase.com](https://supabase.com/).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Copy the contents of `supabase/migrations/20251207000000_init_schema.sql` and run it in the SQL Editor.
    - This creates all valid tables (Users, Medications, etc.) and security policies.
    - **Important**: At the bottom of the SQL file, there is a commented-out section for the Cron Job.
    - Uncomment that section and replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` with your actual values to enable automated reminders.

### 3. Environment Variables

1. Copy `.env.example` to `.env`:

    ```bash
    cp .env.example .env
    ```

2. Open `.env` and fill in your details:
    - `VITE_SUPABASE_URL`: Your Supabase Project URL.
    - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon/Public Key.
    - `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key (for backend functions).
    - **Email Settings**: Configure `GMAIL_EMAIL` and `GMAIL_APP_PASSWORD` (recommended for simple setup) OR `RESEND_API_KEY`.

### 4. Deploy Backend Function

This project uses Supabase Edge Functions to send reminders.

1. Login to Supabase CLI:

    ```bash
    npx supabase login
    ```

2. Deploy the function:

    ```bash
    npx supabase functions deploy send-reminders
    ```

3. Set secrets for the function (VERY IMPORTANT):

    ```bash
    npx supabase secrets set GMAIL_EMAIL=your@gmail.com GMAIL_APP_PASSWORD=your_app_password --env-file .env
    ```

### 5. Running the App

Start the frontend development server:

```bash
npm run dev
```

Open `http://localhost:5173` to see the app.

---

## Folder Structure & Functionality

### `src/` (Frontend)

- **`components/`**: Reusable UI components.
  - `AddMedicationModal.tsx`: Form to add new medications.
  - `MedicationList.tsx`: Displays the list of user's medications.
  - `Navbar.tsx`: Top navigation bar.
  - `Auth.tsx`: Handles user login/signup.
- **`lib/`**: Usage helpers and configuration.
  - `supabase.ts`: Initializes the Supabase client.
  - `reminderService.ts`: Helper functions to manage reminder logic on the frontend.
- **`App.tsx`**: Main application component containing routing and layout.
- **`main.tsx`**: Entry point of the React application.

### `supabase/` (Backend)

- **`functions/send-reminders/`**: The customized Edge Function that sends emails.
  - `index.ts`: The main logic. It checks the database for reminders due at the current time and sends emails via Gmail SMTP or Resend.
  - **Key Functions inside `index.ts`**:
    - `sendViaSMTP(...)`: Sends email using Nodemailer and Gmail.
    - `sendViaResend(...)`: Sends email using Resend API.
    - `processReminders()`: Main cron job logic (simplified name for explanation).

### `scripts/` (Utilities)

- `create-demo-user.mjs`: A helper script to create a demo user in Supabase for testing purposes.

---

## How It Works

1. **User Signs Up**: Users create an account via the frontend.
2. **Add Medication**: Users add their medications and set a reminder time.
3. **Cron Job**: You can set up a Cron Job in Supabase (or use a scheduled trigger) to invoke the `send-reminders` function every minute/hour.
    - The function checks `medication_schedules` for any reminder matching the current time.
    - It fetches the user's email from `user_profiles`.
    - It sends an email using the configured provider.

## Upcoming Features (Next Phase)

- WhatsApp Integration
- Telegram Integration

---

## License

[MIT](LICENSE)
