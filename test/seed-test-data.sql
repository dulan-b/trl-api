-- Seed test data for API testing
-- Run with: psql $DATABASE_URL -f test/seed-test-data.sql

-- Test Users (profiles)
INSERT INTO profiles (id, email, full_name, avatar_url, role, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'student@test.com', 'Test Student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=student', 'student', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'educator@test.com', 'Test Educator', 'https://api.dicebear.com/7.x/avataaars/svg?seed=educator', 'educator', NOW()),
  ('33333333-3333-3333-3333-333333333333', 'admin@test.com', 'Test Admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', 'admin', NOW())
ON CONFLICT (id) DO NOTHING;

-- Test Tracks
INSERT INTO tracks (id, title, description, thumbnail_url, category, level, estimated_hours, created_by, price, created_at) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'Introduction to Psychology', 'Learn the fundamentals of psychology', 'https://picsum.photos/seed/psych/400/300', 'psychology', 'beginner', 10, '22222222-2222-2222-2222-222222222222', 0, NOW()),
  ('aaaa2222-2222-2222-2222-222222222222', 'Advanced Therapy Techniques', 'Master therapeutic approaches', 'https://picsum.photos/seed/therapy/400/300', 'therapy', 'advanced', 20, '22222222-2222-2222-2222-222222222222', 49.99, NOW()),
  ('aaaa3333-3333-3333-3333-333333333333', 'Mindfulness Basics', 'Introduction to mindfulness practices', 'https://picsum.photos/seed/mindful/400/300', 'wellness', 'beginner', 5, '22222222-2222-2222-2222-222222222222', 0, NOW())
ON CONFLICT (id) DO NOTHING;

-- Test Modules
INSERT INTO modules (id, track_id, title, description, order_index, created_at) VALUES
  ('bbbb1111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'Module 1: History of Psychology', 'Explore the origins of psychology', 1, NOW()),
  ('bbbb2222-2222-2222-2222-222222222222', 'aaaa1111-1111-1111-1111-111111111111', 'Module 2: Research Methods', 'Learn scientific research methods', 2, NOW()),
  ('bbbb3333-3333-3333-3333-333333333333', 'aaaa2222-2222-2222-2222-222222222222', 'Module 1: CBT Fundamentals', 'Cognitive Behavioral Therapy basics', 1, NOW())
ON CONFLICT (id) DO NOTHING;

-- Test Lessons
INSERT INTO lessons (id, module_id, title, description, content_type, content_url, duration, order_index, created_at) VALUES
  ('cccc1111-1111-1111-1111-111111111111', 'bbbb1111-1111-1111-1111-111111111111', 'What is Psychology?', 'Introduction to the field', 'video', 'https://example.com/video1.mp4', 15, 1, NOW()),
  ('cccc2222-2222-2222-2222-222222222222', 'bbbb1111-1111-1111-1111-111111111111', 'Early Pioneers', 'Freud, Jung, and more', 'video', 'https://example.com/video2.mp4', 20, 2, NOW()),
  ('cccc3333-3333-3333-3333-333333333333', 'bbbb2222-2222-2222-2222-222222222222', 'Scientific Method', 'How to conduct research', 'video', 'https://example.com/video3.mp4', 25, 1, NOW()),
  ('cccc4444-4444-4444-4444-444444444444', 'bbbb3333-3333-3333-3333-333333333333', 'CBT Introduction', 'Understanding CBT basics', 'video', 'https://example.com/video4.mp4', 30, 1, NOW())
ON CONFLICT (id) DO NOTHING;

-- Test Enrollments
INSERT INTO enrollments (id, user_id, track_id, status, progress, enrolled_at) VALUES
  ('dddd1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'active', 25, NOW()),
  ('dddd2222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'aaaa3333-3333-3333-3333-333333333333', 'active', 50, NOW())
ON CONFLICT (id) DO NOTHING;

-- Test Communities
INSERT INTO communities (id, name, description, thumbnail_url, created_by, type, member_count, created_at) VALUES
  ('eeee1111-1111-1111-1111-111111111111', 'Psychology Students', 'A community for psychology learners', 'https://picsum.photos/seed/comm1/400/300', '22222222-2222-2222-2222-222222222222', 'public', 2, NOW()),
  ('eeee2222-2222-2222-2222-222222222222', 'Therapist Network', 'Professional therapist community', 'https://picsum.photos/seed/comm2/400/300', '22222222-2222-2222-2222-222222222222', 'private', 1, NOW())
ON CONFLICT (id) DO NOTHING;

-- Test Community Members
INSERT INTO community_members (id, community_id, user_id, role, joined_at) VALUES
  ('ffff1111-1111-1111-1111-111111111111', 'eeee1111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'admin', NOW()),
  ('ffff2222-2222-2222-2222-222222222222', 'eeee1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'member', NOW()),
  ('ffff3333-3333-3333-3333-333333333333', 'eeee2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'admin', NOW())
ON CONFLICT (id) DO NOTHING;

-- Test Posts
INSERT INTO posts (id, community_id, user_id, title, content, likes_count, comments_count, created_at) VALUES
  ('1111aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeee1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'My Learning Journey', 'Just started the psychology track, excited to learn!', 5, 2, NOW()),
  ('2222aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeee1111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Welcome New Students!', 'Feel free to ask questions here.', 10, 5, NOW())
ON CONFLICT (id) DO NOTHING;

-- Test Bookmarks
INSERT INTO bookmarks (id, user_id, bookmarkable_type, bookmarkable_id, created_at) VALUES
  ('3333aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'lesson', 'cccc1111-1111-1111-1111-111111111111', NOW()),
  ('4444aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'track', 'aaaa2222-2222-2222-2222-222222222222', NOW())
ON CONFLICT (id) DO NOTHING;

-- Test Lesson Progress
INSERT INTO lesson_progress (id, user_id, lesson_id, completed, watched_duration, last_watched_at, created_at) VALUES
  ('5555aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'cccc1111-1111-1111-1111-111111111111', true, 900, NOW(), NOW()),
  ('6666aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'cccc2222-2222-2222-2222-222222222222', false, 600, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

SELECT 'Test data seeded successfully!' as result;
