# The Ready Lab - Complete API Plan

Based on the user journey map analysis for Students, Educators, and Institutions.

---

## User Types & Requirements

### 1. Students/Entrepreneurs
- Browse and enroll in courses
- Track progress and certifications
- Join communities and discussions
- Receive AI-powered recommendations
- Manage profile and preferences

### 2. Educators/Creators
- Create and manage courses (micro/deep learning)
- Host live streaming sessions
- Track student progress and analytics
- Manage payouts and revenue
- Sell digital products

### 3. Institutions
- Manage cohorts and teams
- Assign educators to programs
- Track organizational analytics
- Issue bulk certifications
- Generate custom reports

---

## API Architecture Overview

```
Current Status:
✅ Video Management (upload, streaming, captions)
✅ Live Streaming (basic infrastructure)
✅ Database schema (videos, captions, streams)

New Requirements:
🆕 User Management & Auth (3 roles)
🆕 Course Management
🆕 Progress Tracking & Certifications
🆕 Community Features
🆕 Analytics & Reporting
🆕 Payment & Billing (Stripe)
🆕 AI Recommendations
```

---

## Detailed API Requirements

### Phase 1: Authentication & User Management

#### Endpoints Needed

**Auth**
```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/password-reset
GET    /api/auth/me
```

**Users**
```
GET    /api/users/:id
PUT    /api/users/:id
DELETE /api/users/:id
POST   /api/users/:id/profile-image
```

**Student Onboarding**
```
POST   /api/students/onboarding
PUT    /api/students/:id/interests
PUT    /api/students/:id/language
```

**Educator Onboarding**
```
POST   /api/educators/onboarding
PUT    /api/educators/:id/profile
PUT    /api/educators/:id/teaching-styles
POST   /api/educators/:id/plan-subscription
```

**Institution Setup**
```
POST   /api/institutions/inquiry
POST   /api/institutions/onboarding
PUT    /api/institutions/:id/profile
```

#### Database Tables

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  role TEXT NOT NULL, -- 'student' | 'educator' | 'institution'
  full_name TEXT NOT NULL,
  bio TEXT,
  profile_image_url TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student-specific data
CREATE TABLE student_profiles (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id),
  interests TEXT[], -- ['funding', 'branding', 'ai']
  onboarding_completed BOOLEAN DEFAULT FALSE,
  ai_roadmap JSONB
);

-- Educator-specific data
CREATE TABLE educator_profiles (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id),
  expertise_tags TEXT[],
  teaching_styles TEXT[], -- ['visual', 'auditory', 'kinesthetic']
  subscription_plan TEXT, -- 'basic' | 'pro' | 'enterprise'
  stripe_connect_id TEXT,
  total_students INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0
);

-- Institution-specific data
CREATE TABLE institution_profiles (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id),
  organization_name TEXT NOT NULL,
  contact_title TEXT,
  phone TEXT,
  is_partnered BOOLEAN DEFAULT FALSE,
  custom_requests TEXT,
  account_manager_id UUID REFERENCES user_profiles(id)
);
```

---

### Phase 2: Course Management

#### Endpoints Needed

**Courses**
```
POST   /api/courses
GET    /api/courses
GET    /api/courses/:id
PUT    /api/courses/:id
DELETE /api/courses/:id
POST   /api/courses/:id/publish
GET    /api/courses/explore

# Course content
POST   /api/courses/:id/lessons
PUT    /api/courses/:id/lessons/:lessonId
DELETE /api/courses/:id/lessons/:lessonId
POST   /api/courses/:id/lessons/:lessonId/video
```

**Enrollments**
```
POST   /api/courses/:id/enroll
GET    /api/courses/:id/enrollments
DELETE /api/courses/:id/enrollments/:userId
GET    /api/students/:id/enrollments
```

**Progress Tracking**
```
GET    /api/courses/:id/progress
POST   /api/courses/:id/lessons/:lessonId/complete
GET    /api/students/:id/progress
```

**Quizzes**
```
GET    /api/courses/:id/lessons/:lessonId/quiz
POST   /api/courses/:id/lessons/:lessonId/quiz/submit
GET    /api/courses/:id/lessons/:lessonId/quiz/results
```

#### Database Tables

```sql
-- Courses
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  educator_id UUID NOT NULL REFERENCES educator_profiles(user_id),
  title TEXT NOT NULL,
  description TEXT,
  course_type TEXT NOT NULL, -- 'microlearning' | 'deep_learning' | 'digital_product'
  teaching_style TEXT[], -- ['visual', 'auditory', 'kinesthetic']
  price DECIMAL(10,2),
  is_published BOOLEAN DEFAULT FALSE,
  thumbnail_url TEXT,
  total_enrollments INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lessons
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  lesson_type TEXT NOT NULL, -- 'video' | 'quiz' | 'reading' | 'live'
  video_asset_id UUID REFERENCES video_assets(id),
  order_index INTEGER NOT NULL,
  duration INTEGER, -- in seconds
  is_free_preview BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enrollments
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES student_profiles(user_id),
  course_id UUID NOT NULL REFERENCES courses(id),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  progress_percentage INTEGER DEFAULT 0,
  last_accessed_lesson_id UUID REFERENCES lessons(id),
  UNIQUE(student_id, course_id)
);

-- Progress tracking
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  time_spent INTEGER DEFAULT 0, -- in seconds
  UNIQUE(enrollment_id, lesson_id)
);

-- Quizzes
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  passing_score INTEGER DEFAULT 70,
  max_attempts INTEGER DEFAULT 3,
  questions JSONB NOT NULL -- [{question, options, correct_answer}]
);

-- Quiz attempts
CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id),
  student_id UUID NOT NULL REFERENCES student_profiles(user_id),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB NOT NULL,
  attempt_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Phase 3: Certifications

#### Endpoints Needed

```
GET    /api/certifications/:id
GET    /api/students/:id/certifications
POST   /api/certifications/:id/download
POST   /api/certifications/:id/share/linkedin
GET    /api/certifications/:id/verify/:code
```

#### Database Tables

```sql
CREATE TABLE certifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES student_profiles(user_id),
  course_id UUID NOT NULL REFERENCES courses(id),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  verification_code TEXT UNIQUE NOT NULL,
  qr_code_url TEXT,
  certificate_pdf_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);
```

---

### Phase 4: Community Features

#### Endpoints Needed

**Communities**
```
GET    /api/communities
GET    /api/communities/:id
POST   /api/communities/:id/join
DELETE /api/communities/:id/leave
```

**Posts & Discussions**
```
POST   /api/communities/:id/posts
GET    /api/communities/:id/posts
GET    /api/posts/:id
PUT    /api/posts/:id
DELETE /api/posts/:id
```

**Comments & Reactions**
```
POST   /api/posts/:id/comments
GET    /api/posts/:id/comments
POST   /api/posts/:id/reactions
DELETE /api/posts/:id/reactions
POST   /api/comments/:id/reactions
```

#### Database Tables

```sql
-- Communities
CREATE TABLE communities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  topic TEXT NOT NULL, -- 'funding' | 'ai' | 'branding'
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community memberships
CREATE TABLE community_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID NOT NULL REFERENCES communities(id),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

-- Posts
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id),
  course_id UUID REFERENCES courses(id), -- for lesson discussions
  author_id UUID NOT NULL REFERENCES user_profiles(id),
  content TEXT NOT NULL,
  type TEXT DEFAULT 'discussion', -- 'discussion' | 'question' | 'announcement'
  is_pinned BOOLEAN DEFAULT FALSE,
  reaction_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: comments and reactions tables already exist from original schema
```

---

### Phase 5: Live Streaming & Events

#### Endpoints Needed

```
POST   /api/live/schedule
PUT    /api/live/:id/start
PUT    /api/live/:id/end
GET    /api/live/:id/participants
POST   /api/live/:id/chat
GET    /api/live/:id/chat
POST   /api/live/:id/polls
```

#### Database Tables

```sql
-- Extend existing live_streams table
ALTER TABLE live_streams ADD COLUMN educator_id UUID REFERENCES educator_profiles(user_id);
ALTER TABLE live_streams ADD COLUMN course_id UUID REFERENCES courses(id);
ALTER TABLE live_streams ADD COLUMN scheduled_at TIMESTAMPTZ;
ALTER TABLE live_streams ADD COLUMN max_participants INTEGER;
ALTER TABLE live_streams ADD COLUMN participant_count INTEGER DEFAULT 0;

-- Live stream participants
CREATE TABLE live_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  live_stream_id UUID NOT NULL REFERENCES live_streams(id),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  UNIQUE(live_stream_id, user_id)
);

-- Live chat (separate from community posts)
CREATE TABLE live_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  live_stream_id UUID NOT NULL REFERENCES live_streams(id),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Live polls
CREATE TABLE live_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  live_stream_id UUID NOT NULL REFERENCES live_streams(id),
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE live_poll_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES live_polls(id),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);
```

---

### Phase 6: Analytics & Reporting

#### Endpoints Needed

**Student Analytics**
```
GET    /api/students/:id/analytics
GET    /api/students/:id/achievements
GET    /api/students/:id/learning-time
```

**Educator Analytics**
```
GET    /api/educators/:id/analytics
GET    /api/educators/:id/revenue
GET    /api/educators/:id/top-courses
GET    /api/educators/:id/student-performance
```

**Institution Analytics**
```
GET    /api/institutions/:id/analytics
GET    /api/institutions/:id/cohorts/:cohortId/report
GET    /api/institutions/:id/export-report
```

#### Database Tables

```sql
-- Cohorts (for institutions)
CREATE TABLE cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institution_profiles(user_id),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cohort enrollments
CREATE TABLE cohort_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id),
  student_id UUID NOT NULL REFERENCES student_profiles(user_id),
  educator_id UUID REFERENCES educator_profiles(user_id),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cohort_id, student_id)
);

-- Analytics events (for tracking)
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  event_type TEXT NOT NULL, -- 'course_view' | 'lesson_complete' | 'quiz_pass' | etc
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Phase 7: Payment & Billing

#### Endpoints Needed

**Student Payments**
```
POST   /api/payments/checkout
GET    /api/payments/:id
GET    /api/students/:id/purchases
```

**Educator Subscriptions**
```
POST   /api/educators/:id/subscribe
PUT    /api/educators/:id/subscription
DELETE /api/educators/:id/subscription
GET    /api/educators/:id/subscription
```

**Educator Payouts**
```
GET    /api/educators/:id/payouts
POST   /api/educators/:id/payouts/withdraw
GET    /api/educators/:id/stripe-connect/onboard
```

**Institution Billing**
```
GET    /api/institutions/:id/billing
POST   /api/institutions/:id/licenses/add
GET    /api/institutions/:id/invoices
```

#### Database Tables

```sql
-- Purchases
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES student_profiles(user_id),
  course_id UUID NOT NULL REFERENCES courses(id),
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_charge_id TEXT,
  status TEXT NOT NULL, -- 'pending' | 'completed' | 'refunded'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Educator subscriptions
CREATE TABLE educator_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  educator_id UUID NOT NULL REFERENCES educator_profiles(user_id),
  plan TEXT NOT NULL, -- 'basic' | 'pro' | 'enterprise'
  stripe_subscription_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'active' | 'canceled' | 'past_due'
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payouts
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  educator_id UUID NOT NULL REFERENCES educator_profiles(user_id),
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  stripe_payout_id TEXT,
  status TEXT NOT NULL, -- 'pending' | 'paid' | 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform fees by plan
CREATE TABLE platform_fees (
  plan TEXT PRIMARY KEY,
  fee_percentage DECIMAL(5,2) NOT NULL
);

INSERT INTO platform_fees VALUES
  ('basic', 10.00),
  ('pro', 6.00),
  ('enterprise', 0.00);
```

---

### Phase 8: AI Features

#### Endpoints Needed

```
GET    /api/ai/recommendations/:userId
POST   /api/ai/roadmap/generate
GET    /api/ai/course-suggestions/:educatorId
POST   /api/ai/student-insights/:courseId
```

#### Implementation Notes

- Use OpenAI API for recommendations
- Store user interaction data for training
- Cache recommendations in Redis
- Queue AI jobs in BullMQ worker

---

## API Architecture Summary

### Current Structure (Video Platform)
```
packages/
├── api/          # Fastify REST API
├── worker/       # BullMQ workers
└── shared/       # Types & utilities
```

### Expanded Structure

```
packages/
├── api/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts              ✅ NEW
│   │   │   ├── users.ts             ✅ NEW
│   │   │   ├── students.ts          ✅ NEW
│   │   │   ├── educators.ts         ✅ NEW
│   │   │   ├── institutions.ts      ✅ NEW
│   │   │   ├── courses.ts           ✅ NEW
│   │   │   ├── lessons.ts           ✅ NEW
│   │   │   ├── enrollments.ts       ✅ NEW
│   │   │   ├── certifications.ts    ✅ NEW
│   │   │   ├── communities.ts       ✅ NEW
│   │   │   ├── analytics.ts         ✅ NEW
│   │   │   ├── payments.ts          ✅ NEW
│   │   │   ├── videos.ts            ✅ EXISTING
│   │   │   ├── live.ts              ✅ EXISTING
│   │   │   └── webhooks.ts          ✅ EXISTING
│   │   ├── services/
│   │   │   ├── stripe.ts            ✅ NEW
│   │   │   ├── ai.ts                ✅ NEW
│   │   │   ├── pdf.ts               ✅ NEW (for certificates)
│   │   │   ├── email.ts             ✅ NEW
│   │   │   └── mux.ts               ✅ EXISTING
│   │   └── middleware/
│   │       ├── auth.ts              ✅ EXTEND (Supabase Auth)
│   │       ├── roles.ts             ✅ NEW
│   │       └── rate-limit.ts        ✅ NEW
│
├── worker/
│   ├── src/
│   │   ├── workers/
│   │   │   ├── caption-worker.ts    ✅ EXISTING
│   │   │   ├── ai-worker.ts         ✅ NEW
│   │   │   ├── email-worker.ts      ✅ NEW
│   │   │   ├── analytics-worker.ts  ✅ NEW
│   │   │   └── certificate-worker.ts ✅ NEW
│
└── shared/
    └── src/
        └── types/
            ├── video.ts             ✅ EXISTING
            ├── live.ts              ✅ EXISTING
            ├── user.ts              ✅ NEW
            ├── course.ts            ✅ NEW
            ├── certification.ts     ✅ NEW
            ├── community.ts         ✅ NEW
            └── payment.ts           ✅ NEW
```

---

## Implementation Priority

### Phase 1 (Weeks 1-2): Foundation
- [ ] Extend authentication (Supabase Auth with 3 roles)
- [ ] User profiles and onboarding flows
- [ ] Database migrations for all new tables

### Phase 2 (Weeks 3-4): Core Learning
- [ ] Course CRUD operations
- [ ] Lesson management
- [ ] Video integration with courses
- [ ] Enrollment system
- [ ] Progress tracking

### Phase 3 (Weeks 5-6): Certifications & Quizzes
- [ ] Quiz system
- [ ] Certificate generation (PDF)
- [ ] Verification system (QR codes)

### Phase 4 (Weeks 7-8): Community & Social
- [ ] Communities
- [ ] Posts and discussions
- [ ] Comments and reactions
- [ ] Live chat for streaming

### Phase 5 (Weeks 9-10): Payments & Monetization
- [ ] Stripe integration
- [ ] Course purchases
- [ ] Educator subscriptions
- [ ] Payout system (Stripe Connect)

### Phase 6 (Weeks 11-12): Analytics & Reporting
- [ ] Student analytics
- [ ] Educator dashboards
- [ ] Institution reports
- [ ] Export functionality

### Phase 7 (Month 4+): Advanced Features
- [ ] AI recommendations
- [ ] Advanced live streaming features
- [ ] Institution-specific features (cohorts)
- [ ] White-label options

---

## Current API vs Full Platform

### Already Built ✅
- Video upload and storage
- Caption generation (EN + ES)
- Live streaming infrastructure
- Basic database schema

### Need to Build 🔨
- Authentication with 3 user roles
- Complete course management system
- Progress tracking and certifications
- Community and social features
- Payment processing and billing
- Analytics and reporting
- AI-powered recommendations

### Estimated Scope
- **Current codebase**: ~15% of full platform
- **Remaining work**: ~85% of full platform
- **Timeline**: 3-4 months for MVP with all core features

---

## Next Steps

1. **Review this plan** - Confirm priorities and scope
2. **Set up Supabase Auth** - Multi-role authentication
3. **Extend database schema** - Add all new tables
4. **Build course management** - Core learning functionality
5. **Integrate payments** - Stripe for monetization
6. **Add analytics** - Track everything
7. **Implement AI features** - Recommendations and insights

Let me know which phase you'd like to start with!
