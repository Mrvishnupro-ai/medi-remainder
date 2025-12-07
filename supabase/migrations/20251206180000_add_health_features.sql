/*
  # Health Features Update
  
  ## New Tables
  1. `family_members`
     - Contact info for family members
  2. `doctor_appointments`
     - Appointment management
  3. `health_reports`
     - Health report metadata
  
  ## Updates
  1. `user_profiles`
     - Added health info columns (age, blood_group, etc.)
  2. `medications`
     - Added details (type, end_date, symptoms, description)
*/

-- Update user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS age integer,
ADD COLUMN IF NOT EXISTS weight numeric,
ADD COLUMN IF NOT EXISTS blood_group text,
ADD COLUMN IF NOT EXISTS allergies text[],
ADD COLUMN IF NOT EXISTS medical_conditions text[];

-- Update medications
ALTER TABLE medications 
ADD COLUMN IF NOT EXISTS medication_type text DEFAULT 'Pill',
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS relevant_symptoms text[],
ADD COLUMN IF NOT EXISTS user_description text;

-- Create family_members table
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

CREATE POLICY "Users can manage own family members"
  ON family_members
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create doctor_appointments table
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

CREATE POLICY "Users can manage own appointments"
  ON doctor_appointments
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create health_reports table
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

CREATE POLICY "Users can manage own reports"
  ON health_reports
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
