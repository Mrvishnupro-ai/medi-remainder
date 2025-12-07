# Project Report: MediRemainder - Intelligent Medication Reminder System

**Date:** December 07, 2025
**Author:** MediRemainder Team

---

# Abstract

MediRemainder is a web-based integrated health management application designed to improve medication adherence among patients. Non-adherence to medication regimens is a significant public health issue, leading to poor health outcomes and increased healthcare costs. This project addresses the problem by providing a user-friendly platform that schedules automated reminders, tracks adherence, and escalates missed doses to family members. Furthermore, it leverages Artificial Intelligence (Google Gemini) to provide personalized health tips and answer medical-related queries, acting as a virtual health assistant.

---

# 1. Introduction

## 1.1 Problem Statement

In today's fast-paced world, managing complex medication schedules can be challenging, especially for the elderly or those with chronic conditions. Forgetting to take medication or taking incorrect dosages can lead to severe health complications. Existing solutions often lack "smart" features such as family notification systems or context-aware health advice.

## 1.2 Motivation

The primary motivation behind MediRemainder is to create a "set it and forget it" system that proactively looks after the user. By combining standard scheduling with modern cloud technologies and AI, we aim to bridge the gap between doctor instructions and patient daily actions.

## 1.3 Objectives

- To develop a secure and accessible web application for medication management.
- To implement a reliable reminder system via Email (with future support for WhatsApp/Telegram).
- To enable family monitoring features where caregivers are alerted if a patient misses consecutive doses.
- To integrate Generative AI for interpreting health data and providing wellness tips.

## 1.4 Scope

The project covers the entire lifecycle of medication management:

- **User Side:** Account creation, profile management (allergies, age, etc.), medication entry, and dashboard viewing.
- **System Side:** Automated cron jobs for checking schedules, sending emails via SMTP/Resend, and logging adherence.
- **AI Side:** A chatbot interface and health tip generator using the Google Gemini API.

---

# 2. System Analysis

## 2.1 Existing System

Currently, most patients rely on:

- Manual memory (highly unreliable).
- Smartphone alarms (generic, no dosage info, no record keeping).
- Physical pillboxes (requires manual filling, no digital alerts).

## 2.2 Proposed System

MediRemainder offers:

- **Centralized Database:** Stores all prescriptions and history in the cloud (Supabase).
- **Intelligent Reminders:** Sends notifications only when needed, containing specific dosage instructions.
- **Adherence Tracking:** Records 'Taken' or 'Missed' status for every dose.
- **Caregiver Loop:** Alerts family members in case of non-compliance.

## 2.3 Feasibility Study

- **Technical Feasibility:** The project uses standard, well-supported technologies (React, Node.js, PostgreSQL). The "Serverless" architecture via Supabase reduces maintenance overhead.
- **Operational Feasibility:** The UI is designed with simplicity in mind (large buttons, clear text), making it suitable for all age groups.
- **Economic Feasibility:** The system runs effectively on free-tier cloud services (Supabase Free Tier, Google Gemini Free Tier), making it cost-effective.

---

# 3. System Design

## 3.1 Architecture

The application follows a modern **Client-Server-Database** architecture, utilizing a "Backend-as-a-Service" (BaaS) model.

- **Frontend (Client):** Built with React + Vite. It handles the UI, state management, and direct interaction with the Supabase API for data retrieval.
- **Backend (Serverless):** Supabase Edge Functions handling critical business logic like Cron Jobs (time-based triggers) and secure email dispatching.
- **Database:** PostgreSQL (hosted on Supabase) serving as the single source of truth.

## 3.2 Database Schema (Key Tables)

1. **`user_profiles`**: Stores user demographics, medical conditions, and preferred communication channels.
2. **`medications`**: Stores drug names, dosages, instructions, and end dates.
3. **`medication_schedules`**: Links medications to specific times of the day.
4. **`adherence_logs`**: Tracks the history of taken vs. missed doses.
5. **`family_members`**: Stores contact info for emergency contacts/caregivers.
6. **`reminder_logs`**: Audit trail of every email sent by the system.

## 3.3 Module Design

- **Auth Module:** Manages secure sign-up/sign-in using Supabase Authentication.
- **Dashboard Module:** A comprehensive view showing "Next Dose," "Today's Schedule," and "Adherence Stats."
- **Reminder Engine:** A background process running every minute to check if any medication is due.
- **AI Assistant:** A conversational interface integrated with Google Gemini to answer questions like "What are the side effects of Aspirin?" or "Give me diet tips for diabetes."

---

# 4. Implementation Details

## 4.1 Technology Stack

- **Languages:** TypeScript (Frontend & Backend), SQL (Database).
- **Frontend Framework:** React 18, Vite.
- **Styling:** Tailwind CSS (for responsive, modern aesthetics).
- **State Management:** React Context API (`AuthContext`).
- **Icons:** Lucide-React.
- **Backend Platform:** Supabase (PostgreSQL + Edge Functions + Auth).
- **AI API:** Google Gemini (`@google/genai`).
- **Email Service:** Nodemailer (SMTP) / Resend API.

## 4.2 Key Features Implementation

### Automating Reminders

The system uses `pg_cron` (a PostgreSQL extension) to trigger an HTTP request every minute.

```sql
select cron.schedule('invoke-send-reminders', '* * * * *', ...);
```

This invokes the `send-reminders` Edge Function, which:

1. Calculates the current time (adjusting for Timezone).
2. Queries user schedules matching that time.
3. Formats an HTML email template.
4. Dispatches it via SMTP.

### AI Health Tips

The `AiHealthTips.tsx` component connects directly to Google's Gemini Flash model. It feeds the user's health profile (age, weight, conditions) into a prompt to generate personalized advice, ensuring the data is relevant and actionable.

### Security

- **Row Level Security (RLS):** All database tables have strict policies. A user can only `SELECT`, `INSERT`, or `UPDATE` their own data.
- **Environment Variables:** API keys and sensitive secrets are stored in `.env` files and never exposed in the client-side code (except for public keys).

---

# 5. Testing & Validation

## 5.1 Testing Strategy

- **Unit Testing:** Individual components (e.g., `MedicationForm`) were tested for input validation (ensuring dosage is not empty).
- **Integration Testing:** Verified that creating a medication entry correctly spawns a schedule in the `medication_schedules` table.
- **System Testing:** "Test Reminder" functionality was used to simulate a reminder event, ensuring the email arrives in the inbox with the correct formatting.

## 5.2 Test Cases

| Test Case ID | Description | Expected Result | Status |
|--------------|-------------|-----------------|--------|
| TC01 | User Login | User redirected to Dashboard | Pass |
| TC02 | Add Medication | Medication appears in list | Pass |
| TC03 | Cron Trigger | Edge Function executes 200 OK | Pass |
| TC04 | AI Query | Gemini returns text response | Pass |
| TC05 | Profile Update | Changes reflected in DB | Pass |

---

# 6. Future Scope & Conclusion

## 6.1 Future Enhancements

- **Multi-Channel Support:** The backend structure is already prepared for WhatsApp (Twilio) and Telegram APIs. These will be enabled in Phase 2.
- **Mobile App:** Converting the React web app into React Native for better push notifications.
- **Drug Interaction Checker:** Using AI to automatically warn users if two added medications react negatively.

## 6.2 Conclusion

MediRemainder successfully demonstrates how modern web technologies can solving critical healthcare problems. By automating the remembrance process and providing AI-backed support, the system significantly reduces the cognitive load on patients and improves their quality of life. The scalable architecture ensures it can grow from a personal tool to a widely used platform.

---

# 7. References

- React Documentation (react.dev)
- Supabase Docs (supabase.com)
- Google AI Studio (aistudio.google.com)
- MDN Web Docs (developer.mozilla.org)
