/*
  # Full Database Schema - MediRemainder
  
  ## Overview
  This migration sets up the entire database schema for the MediRemainder application.
  It includes tables for users, medications, reminders, family, and health reports.
  
  ## Tables
  - user_profiles (Extends auth.users)
  - medications
  - medication_schedules
  - adherence_logs
  - reminder_logs
  - medication_info (Reference data)
  - family_members
  - doctor_appointments
  - health_reports

  ## Security
  - Row Level Security (RLS) is enabled on all tables.
  - Policies ensure users can only access their own data.

  ## Extensions
  - pg_cron (For scheduling reminders)
  - pg_net (For making HTTP requests from the database)
*/

-- 1. Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  preferred_channel text DEFAULT 'email',
  whatsapp_number text,
  telegram_chat_id text,
  email text,
  age integer,
  weight numeric,
  blood_group text,
  allergies text[],
  medical_conditions text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3. Create medications table
CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  medication_name text NOT NULL,
  dosage text NOT NULL,
  instructions text DEFAULT '',
  active boolean DEFAULT true,
  medication_type text DEFAULT 'Pill',
  end_date date,
  relevant_symptoms text[],
  user_description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own medications" ON medications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own medications" ON medications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own medications" ON medications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own medications" ON medications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Create medication_schedules table
CREATE TABLE IF NOT EXISTS medication_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  reminder_time time NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read schedules for own medications" ON medication_schedules FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM medications WHERE medications.id = medication_schedules.medication_id AND medications.user_id = auth.uid()));
CREATE POLICY "Users can insert schedules for own medications" ON medication_schedules FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM medications WHERE medications.id = medication_schedules.medication_id AND medications.user_id = auth.uid()));
CREATE POLICY "Users can update schedules for own medications" ON medication_schedules FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM medications WHERE medications.id = medication_schedules.medication_id AND medications.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM medications WHERE medications.id = medication_schedules.medication_id AND medications.user_id = auth.uid()));
CREATE POLICY "Users can delete schedules for own medications" ON medication_schedules FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM medications WHERE medications.id = medication_schedules.medication_id AND medications.user_id = auth.uid()));

-- 5. Create adherence_logs table
CREATE TABLE IF NOT EXISTS adherence_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  scheduled_time timestamptz NOT NULL,
  taken_at timestamptz,
  status text NOT NULL DEFAULT 'missed',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE adherence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own adherence logs" ON adherence_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own adherence logs" ON adherence_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own adherence logs" ON adherence_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Create medication_info table
CREATE TABLE IF NOT EXISTS medication_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_name text NOT NULL UNIQUE,
  common_dosage text NOT NULL,
  side_effects text NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE medication_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read medication info" ON medication_info FOR SELECT TO authenticated USING (true);

-- Insert sample medication information
INSERT INTO medication_info (drug_name, common_dosage, side_effects, description) VALUES
  ('Aspirin', '81-325mg once daily', 'Stomach upset, heartburn, nausea, easy bruising', 'Pain reliever and anti-inflammatory medication used to reduce fever and prevent blood clots.'),
  ('Lisinopril', '10-40mg once daily', 'Dizziness, headache, persistent cough, fatigue', 'ACE inhibitor used to treat high blood pressure and heart failure.'),
  ('Metformin', '500-2000mg daily in divided doses', 'Nausea, diarrhea, stomach upset, metallic taste', 'Oral diabetes medication that helps control blood sugar levels.'),
  ('Atorvastatin', '10-80mg once daily', 'Muscle pain, digestive problems, headache', 'Statin medication used to lower cholesterol and reduce risk of heart disease.'),
  ('Levothyroxine', '25-200mcg once daily', 'Hair loss, weight changes, increased appetite', 'Thyroid hormone replacement used to treat hypothyroidism.'),
  ('Omeprazole', '20-40mg once daily', 'Headache, stomach pain, nausea, diarrhea', 'Proton pump inhibitor used to treat acid reflux and stomach ulcers.')
ON CONFLICT (drug_name) DO NOTHING;

-- 7. Create reminder_logs table
CREATE TABLE IF NOT EXISTS reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES medications(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own reminder logs" ON reminder_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 8. Create family_members table
CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text,
  contact_number text,
  email text,
  is_emergency_contact boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own family members" ON family_members USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. Create doctor_appointments table
CREATE TABLE IF NOT EXISTS doctor_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  doctor_name text NOT NULL,
  specialty text,
  hospital_clinic text,
  appointment_date timestamptz NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE doctor_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own appointments" ON doctor_appointments USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10. Create health_reports table
CREATE TABLE IF NOT EXISTS health_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  report_date date NOT NULL,
  type text,
  file_url text,
  summary text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE health_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reports" ON health_reports USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 11. Create Indexes
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_schedules_medication_id ON medication_schedules(medication_id);
CREATE INDEX IF NOT EXISTS idx_adherence_logs_user_id ON adherence_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_adherence_logs_scheduled_time ON adherence_logs(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_user_id ON reminder_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_info_drug_name ON medication_info(drug_name);

-- 12. Setup Cron Job for Reminders
-- IMPORTANT: Enable this manually after deploying by replacing YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY

select
  cron.schedule(
    'invoke-send-reminders', -- unique name of the job
    '* * * * *', -- every minute
    $$
    select
      net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body:='{"mode": "scheduled"}'::jsonb
      ) as request_id;
    $$
  );

