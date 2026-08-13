-- Migration: 004_ingested_links
-- Description: Schema for ingested links via Jina Reader API
-- Created: 2024-12-19
--
-- Tracks content fetched from URLs for batch extraction.
-- Content is stored in GCS/local storage; this table holds metadata.

-- =============================================================================
-- Ingested Links Table
-- =============================================================================
-- Tracks URLs fetched and processed for extraction

CREATE TABLE IF NOT EXISTS ingested_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Content identification (content-addressed storage)
    content_hash VARCHAR(64) NOT NULL UNIQUE,    -- SHA-256 hash of content

    -- Source information
    source_uri TEXT,                              -- Original URL fetched
    source_type VARCHAR(32),                      -- news, blog, press_release, etc.

    -- Extracted metadata (from ContentEnrichmentAgent)
    headline TEXT,
    description TEXT,
    published_at TIMESTAMPTZ,
    author TEXT,
    organization TEXT,
    language VARCHAR(8) DEFAULT 'en',

    -- Topics and entities (JSONB for flexibility)
    topics JSONB DEFAULT '[]'::jsonb,
    key_entities JSONB DEFAULT '[]'::jsonb,

    -- Storage location
    storage_uri TEXT NOT NULL,                    -- GCS/local path to content

    -- Processing status
    status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'enriched', 'processed', 'failed', 'skipped')),

    -- Timestamps
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When content was fetched
    enriched_at TIMESTAMPTZ,                       -- When metadata was extracted
    processed_at TIMESTAMPTZ,                      -- When extraction completed

    -- Error tracking (for failed status)
    error_message TEXT,

    -- Word count for filtering
    word_count INTEGER,

    -- Metadata (extensible)
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ingested_links_status ON ingested_links(status);
CREATE INDEX IF NOT EXISTS idx_ingested_links_source_uri ON ingested_links(source_uri);
CREATE INDEX IF NOT EXISTS idx_ingested_links_fetched_at ON ingested_links(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingested_links_source_type ON ingested_links(source_type);
CREATE INDEX IF NOT EXISTS idx_ingested_links_organization ON ingested_links(organization);

-- GIN index for topics/entities array queries
CREATE INDEX IF NOT EXISTS idx_ingested_links_topics ON ingested_links USING GIN (topics);
CREATE INDEX IF NOT EXISTS idx_ingested_links_entities ON ingested_links USING GIN (key_entities);

-- =============================================================================
-- Link Batches Table
-- =============================================================================
-- Groups ingested links for batch extraction

CREATE TABLE IF NOT EXISTS link_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT UNIQUE NOT NULL,                -- External batch identifier

    -- Status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed')),

    -- Metrics
    links_total INTEGER DEFAULT 0,
    links_processed INTEGER DEFAULT 0,
    links_failed INTEGER DEFAULT 0,

    -- Ontology used for extraction
    ontology_uri TEXT,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Error info
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_link_batches_status ON link_batches(status);

-- =============================================================================
-- Link Batch Items Junction
-- =============================================================================
-- Links ingested_links to batches

CREATE TABLE IF NOT EXISTS link_batch_items (
    batch_id UUID NOT NULL REFERENCES link_batches(id) ON DELETE CASCADE,
    link_id UUID NOT NULL REFERENCES ingested_links(id) ON DELETE CASCADE,

    -- Item-level status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

    -- Result reference
    extraction_run_id TEXT,                       -- Reference to extraction run
    article_id UUID,                              -- Created article reference

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Error
    error_message TEXT,

    PRIMARY KEY (batch_id, link_id)
);

CREATE INDEX IF NOT EXISTS idx_link_batch_items_link ON link_batch_items(link_id);
CREATE INDEX IF NOT EXISTS idx_link_batch_items_status ON link_batch_items(status);

-- =============================================================================
-- Update Trigger for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_ingested_links_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ingested_links_updated_at ON ingested_links;
CREATE TRIGGER ingested_links_updated_at
    BEFORE UPDATE ON ingested_links
    FOR EACH ROW
    EXECUTE FUNCTION update_ingested_links_timestamp();

-- =============================================================================
-- Record Migration
-- =============================================================================

INSERT INTO schema_migrations (version, name)
VALUES (4, '004_ingested_links')
ON CONFLICT (version) DO NOTHING;
