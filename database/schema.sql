-- The Ready Lab - Database Schema
-- Compatible with PostgreSQL and Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- VIDEO ASSETS
-- ============================================

CREATE TABLE IF NOT EXISTS video_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Metadata
  title TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL, -- Reference to user (auth.users in Supabase)

  -- Mux integration
  mux_asset_id TEXT,
  mux_upload_id TEXT,
  mux_playback_id TEXT,

  -- Video properties
  status TEXT NOT NULL DEFAULT 'uploading',
    -- 'uploading' | 'processing' | 'ready' | 'error'
  duration FLOAT,
  aspect_ratio TEXT,

  -- Error handling
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_video_assets_owner_id ON video_assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_status ON video_assets(status);
CREATE INDEX IF NOT EXISTS idx_video_assets_mux_asset_id ON video_assets(mux_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_mux_upload_id ON video_assets(mux_upload_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_created_at ON video_assets(created_at DESC);

-- ============================================
-- CAPTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS captions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  video_asset_id UUID NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,

  -- Caption properties
  language TEXT NOT NULL, -- 'en' | 'es'
  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'processing' | 'ready' | 'error'

  -- Storage
  vtt_url TEXT,
  mux_text_track_id TEXT,

  -- Error handling
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(video_asset_id, language)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_captions_video_asset_id ON captions(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_captions_language ON captions(language);
CREATE INDEX IF NOT EXISTS idx_captions_status ON captions(status);

-- ============================================
-- LIVE STREAMS (Phase 2)
-- ============================================

CREATE TABLE IF NOT EXISTS live_streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Metadata
  title TEXT NOT NULL,
  description TEXT,
  educator_id TEXT NOT NULL, -- Reference to user

  -- Mux integration
  mux_stream_id TEXT,
  mux_stream_key TEXT,
  mux_playback_id TEXT,

  -- Stream status
  status TEXT NOT NULL DEFAULT 'idle',
    -- 'idle' | 'active' | 'ended'

  -- Timing
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_live_streams_educator_id ON live_streams(educator_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_mux_stream_id ON live_streams(mux_stream_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_created_at ON live_streams(created_at DESC);

-- ============================================
-- COMMENTS (For future use - community features)
-- ============================================

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  video_asset_id UUID REFERENCES video_assets(id) ON DELETE CASCADE,
  live_stream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,

  -- Content
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Moderation
  is_deleted BOOLEAN DEFAULT FALSE,
  is_flagged BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (
    (video_asset_id IS NOT NULL AND live_stream_id IS NULL) OR
    (video_asset_id IS NULL AND live_stream_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_video_asset_id ON comments(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_comments_live_stream_id ON comments(live_stream_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- ============================================
-- REACTIONS (Likes, hearts, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  video_asset_id UUID REFERENCES video_assets(id) ON DELETE CASCADE,
  live_stream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

  -- Reaction
  user_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL, -- 'like' | 'heart' | 'fire' | etc.

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (
    (video_asset_id IS NOT NULL AND live_stream_id IS NULL AND comment_id IS NULL) OR
    (video_asset_id IS NULL AND live_stream_id IS NOT NULL AND comment_id IS NULL) OR
    (video_asset_id IS NULL AND live_stream_id IS NULL AND comment_id IS NOT NULL)
  ),
  UNIQUE(user_id, video_asset_id, reaction_type),
  UNIQUE(user_id, live_stream_id, reaction_type),
  UNIQUE(user_id, comment_id, reaction_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reactions_video_asset_id ON reactions(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_reactions_live_stream_id ON reactions(live_stream_id);
CREATE INDEX IF NOT EXISTS idx_reactions_comment_id ON reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_video_assets_updated_at
  BEFORE UPDATE ON video_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_captions_updated_at
  BEFORE UPDATE ON captions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_streams_updated_at
  BEFORE UPDATE ON live_streams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) - For Supabase
-- ============================================

-- Enable RLS on all tables
ALTER TABLE video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE captions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Public read access for now (will be refined later)
-- In production, you'd want more granular policies

-- Video assets: Anyone can read, only owner can modify
CREATE POLICY "Video assets are viewable by everyone"
  ON video_assets FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own videos"
  ON video_assets FOR INSERT
  WITH CHECK (true); -- Will check owner_id = auth.uid() when auth is implemented

CREATE POLICY "Users can update their own videos"
  ON video_assets FOR UPDATE
  USING (true); -- Will check owner_id = auth.uid() when auth is implemented

-- Captions: Public read
CREATE POLICY "Captions are viewable by everyone"
  ON captions FOR SELECT
  USING (true);

-- Live streams: Anyone can read
CREATE POLICY "Live streams are viewable by everyone"
  ON live_streams FOR SELECT
  USING (true);

CREATE POLICY "Educators can create live streams"
  ON live_streams FOR INSERT
  WITH CHECK (true);

-- Comments: Public read, authenticated write
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  USING (true);

-- Reactions: Public read, authenticated write
CREATE POLICY "Reactions are viewable by everyone"
  ON reactions FOR SELECT
  USING (true);

-- ============================================
-- SAMPLE DATA (For development/testing)
-- ============================================

-- Insert a sample video for testing
-- Uncomment when you want to add sample data
/*
INSERT INTO video_assets (id, title, description, owner_id, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Sample Course Video',
  'This is a sample video for testing the video player with captions',
  'sample-user-id',
  'ready'
);

INSERT INTO captions (video_asset_id, language, status, vtt_url)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'en',
  'ready',
  'https://example.com/captions/sample-en.vtt'
);
*/
