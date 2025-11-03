/*
  # Medication Reminder System - Database Schema

  ## Overview
  Creates the complete database schema for the medication reminder web app including user profiles, medications, schedules, adherence tracking, and medication information.

  ## New Tables

  ### 1. `user_profiles`
  Stores additional user information beyond auth.users
  - `id` (uuid, primary key, references auth.users)
  - `full_name` (text)
  - `preferred_channel` (text: 'whatsapp', 'telegram', or 'email')
  - `whatsapp_number` (text, optional)
  - `telegram_chat_id` (text, optional)
  - `email` (text, optional)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `medications`
  Stores medication information for each user
  - `id` (uuid, primary key)
  - `user_id` (uuid, references user_profiles)
  - `medication_name` (text)
  - `dosage` (text)
  - `instructions` (text, optional)
  - `active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `medication_schedules`
  Stores reminder times for each medication
  - `id` (uuid, primary key)
  - `medication_id` (uuid, references medications)
  - `reminder_time` (time)
  - `active` (boolean, default true)
  - `created_at` (timestamptz)

  ### 4. `adherence_logs`
  Tracks when medications are marked as taken
  - `id` (uuid, primary key)
  - `medication_id` (uuid, references medications)
  - `user_id` (uuid, references user_profiles)
  - `scheduled_time` (timestamptz)
  - `taken_at` (timestamptz)
  - `status` (text: 'taken' or 'missed')
  - `created_at` (timestamptz)

  ### 5. `medication_info`
  Basic medication information database
  - `id` (uuid, primary key)
  - `drug_name` (text)
  - `common_dosage` (text)
  - `side_effects` (text)
  - `description` (text)
  - `created_at` (timestamptz)

  ### 6. `reminder_logs`
  Logs all sent reminders
  - `id` (uuid, primary key)
  - `user_id` (uuid, references user_profiles)
  - `medication_id` (uuid, references medications)
  - `channel` (text)
  - `status` (text: 'sent', 'failed', 'pending')
  - `sent_at` (timestamptz)
  - `error_message` (text, optional)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Users can only access their own data
  - Medication info table is readable by all authenticated users
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  preferred_channel text DEFAULT 'email',
  whatsapp_number text,
  telegram_chat_id text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create medications table
CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  medication_name text NOT NULL,
  dosage text NOT NULL,
  instructions text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own medications"
  ON medications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medications"
  ON medications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medications"
  ON medications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own medications"
  ON medications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create medication_schedules table
CREATE TABLE IF NOT EXISTS medication_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  reminder_time time NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read schedules for own medications"
  ON medication_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medications
      WHERE medications.id = medication_schedules.medication_id
      AND medications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert schedules for own medications"
  ON medication_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM medications
      WHERE medications.id = medication_schedules.medication_id
      AND medications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update schedules for own medications"
  ON medication_schedules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medications
      WHERE medications.id = medication_schedules.medication_id
      AND medications.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM medications
      WHERE medications.id = medication_schedules.medication_id
      AND medications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete schedules for own medications"
  ON medication_schedules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medications
      WHERE medications.id = medication_schedules.medication_id
      AND medications.user_id = auth.uid()
    )
  );

-- Create adherence_logs table
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

CREATE POLICY "Users can read own adherence logs"
  ON adherence_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own adherence logs"
  ON adherence_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own adherence logs"
  ON adherence_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create medication_info table
CREATE TABLE IF NOT EXISTS medication_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_name text NOT NULL UNIQUE,
  common_dosage text NOT NULL,
  side_effects text NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE medication_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read medication info"
  ON medication_info FOR SELECT
  TO authenticated
  USING (true);

-- Create reminder_logs table
CREATE TABLE IF NOT EXISTS reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reminder logs"
  ON reminder_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert sample medication information
INSERT INTO medication_info (drug_name, common_dosage, side_effects, description) VALUES
  ('Aspirin', '81-325mg once daily', 'Stomach upset, heartburn, nausea, easy bruising', 'Pain reliever and anti-inflammatory medication used to reduce fever and prevent blood clots.'),
  ('Lisinopril', '10-40mg once daily', 'Dizziness, headache, persistent cough, fatigue', 'ACE inhibitor used to treat high blood pressure and heart failure.'),
  ('Metformin', '500-2000mg daily in divided doses', 'Nausea, diarrhea, stomach upset, metallic taste', 'Oral diabetes medication that helps control blood sugar levels.'),
  ('Atorvastatin', '10-80mg once daily', 'Muscle pain, digestive problems, headache', 'Statin medication used to lower cholesterol and reduce risk of heart disease.'),
  ('Levothyroxine', '25-200mcg once daily', 'Hair loss, weight changes, increased appetite', 'Thyroid hormone replacement used to treat hypothyroidism.'),
  ('Omeprazole', '20-40mg once daily', 'Headache, stomach pain, nausea, diarrhea', 'Proton pump inhibitor used to treat acid reflux and stomach ulcers.')
ON CONFLICT (drug_name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_schedules_medication_id ON medication_schedules(medication_id);
CREATE INDEX IF NOT EXISTS idx_adherence_logs_user_id ON adherence_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_adherence_logs_scheduled_time ON adherence_logs(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_user_id ON reminder_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_info_drug_name ON medication_info(drug_name);