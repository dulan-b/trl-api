-- Migration 001: Add Users and Profiles
-- This extends the base video platform with user management
-- Can be run WITHOUT Supabase Auth for testing (uses simple user table)

-- ============================================
-- USER PROFILES
-- ============================================

-- Main user profiles table (without Supabase Auth dependency for now)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'educator', 'institution', 'admin')),
  bio TEXT,
  profile_image_url TEXT,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'es')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- ============================================
-- STUDENT PROFILES
-- ============================================

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  interests TEXT[], -- ['funding', 'branding', 'ai', 'compliance']
  onboarding_completed BOOLEAN DEFAULT FALSE,
  ai_roadmap JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- EDUCATOR PROFILES
-- ============================================

CREATE TABLE IF NOT EXISTS educator_profiles (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  expertise_tags TEXT[],
  teaching_styles TEXT[], -- ['visual', 'auditory', 'kinesthetic', 'reading_writing']
  preferred_content_types TEXT[], -- ['microlearning', 'deep_learning', 'live']
  subscription_plan TEXT DEFAULT 'basic' CHECK (subscription_plan IN ('basic', 'pro', 'enterprise')),
  stripe_connect_id TEXT,
  total_students INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  total_certifications_issued INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_educator_profiles_subscription ON educator_profiles(subscription_plan);

-- ============================================
-- INSTITUTION PROFILES
-- ============================================

CREATE TABLE IF NOT EXISTS institution_profiles (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,
  contact_title TEXT,
  phone TEXT,
  areas_of_interest TEXT[], -- ['funding', 'business', 'branding', 'compliance', 'ai']
  custom_requests TEXT,
  is_partnered BOOLEAN DEFAULT FALSE,
  account_manager_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_institution_profiles_partnered ON institution_profiles(is_partnered);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Uncomment to add sample users for testing

/*
-- Sample Student
INSERT INTO user_profiles (id, email, full_name, role, bio, language)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'student@test.com',
  'Test Student',
  'student',
  'Learning entrepreneurship',
  'en'
);

INSERT INTO student_profiles (user_id, interests, onboarding_completed)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  ARRAY['funding', 'branding'],
  TRUE
);

-- Sample Educator
INSERT INTO user_profiles (id, email, full_name, role, bio, language)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'educator@test.com',
  'Test Educator',
  'educator',
  'Teaching business fundamentals',
  'en'
);

INSERT INTO educator_profiles (user_id, expertise_tags, teaching_styles, subscription_plan)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  ARRAY['funding', 'business'],
  ARRAY['visual', 'auditory'],
  'pro'
);

-- Sample Institution
INSERT INTO user_profiles (id, email, full_name, role, language)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'institution@test.com',
  'Test Institution Admin',
  'institution',
  'en'
);

INSERT INTO institution_profiles (user_id, organization_name, areas_of_interest, is_partnered)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Test Business School',
  ARRAY['business', 'compliance'],
  TRUE
);
*/
