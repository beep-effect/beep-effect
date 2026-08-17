-- PostgreSQL features that Drizzle's table metadata cannot currently express.
ALTER TABLE embeddings ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', COALESCE(content_text, ''))) STORED;
--> statement-breakpoint
CREATE INDEX idx_embeddings_ivfflat ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
--> statement-breakpoint
CREATE INDEX idx_embeddings_tsv ON embeddings USING gin(content_tsv);
--> statement-breakpoint
CREATE INDEX idx_canonical_entities_types ON canonical_entities USING gin(types);
--> statement-breakpoint
CREATE INDEX idx_canonical_entities_embedding_hnsw ON canonical_entities USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
--> statement-breakpoint
CREATE INDEX idx_llm_examples_target_class ON llm_examples(ontology_id, target_class);
--> statement-breakpoint
CREATE INDEX idx_llm_examples_target_predicate ON llm_examples(ontology_id, target_predicate);
--> statement-breakpoint
CREATE INDEX idx_llm_examples_embedding_hnsw ON llm_examples USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
--> statement-breakpoint
CREATE INDEX idx_llm_examples_input_text_trgm ON llm_examples USING gin (input_text gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX idx_ingested_links_topics ON ingested_links USING gin(topics);
--> statement-breakpoint
CREATE INDEX idx_ingested_links_entities ON ingested_links USING gin(key_entities);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION update_ingested_links_timestamp() RETURNS TRIGGER LANGUAGE plpgsql AS 'BEGIN NEW.updated_at = NOW(); RETURN NEW; END';
--> statement-breakpoint
CREATE TRIGGER ingested_links_updated_at BEFORE UPDATE ON ingested_links FOR EACH ROW EXECUTE FUNCTION update_ingested_links_timestamp();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(768), query_text TEXT, search_ontology_id TEXT, search_entity_type TEXT,
  result_limit INTEGER DEFAULT 20, vector_weight DOUBLE PRECISION DEFAULT 0.6, text_weight DOUBLE PRECISION DEFAULT 0.4
)
RETURNS TABLE (entity_id TEXT, entity_type TEXT, rrf_score DOUBLE PRECISION, vector_rank INTEGER, text_rank INTEGER)
LANGUAGE sql STABLE
AS $$
WITH vector_results AS (
  SELECT e.entity_id, e.entity_type, ROW_NUMBER() OVER (ORDER BY e.embedding <=> query_embedding) AS vrank
  FROM embeddings e WHERE e.ontology_id = search_ontology_id AND e.entity_type = search_entity_type
  ORDER BY e.embedding <=> query_embedding LIMIT result_limit * 2
), text_results AS (
  SELECT e.entity_id, e.entity_type, ROW_NUMBER() OVER (ORDER BY ts_rank(e.content_tsv, plainto_tsquery('english', query_text)) DESC) AS trank
  FROM embeddings e WHERE e.ontology_id = search_ontology_id AND e.entity_type = search_entity_type
    AND e.content_tsv @@ plainto_tsquery('english', query_text)
  ORDER BY ts_rank(e.content_tsv, plainto_tsquery('english', query_text)) DESC LIMIT result_limit * 2
), combined AS (
  SELECT COALESCE(v.entity_id, t.entity_id) AS entity_id, COALESCE(v.entity_type, t.entity_type) AS entity_type,
    v.vrank, t.trank,
    (CASE WHEN v.vrank IS NULL THEN 0 ELSE vector_weight / (60 + v.vrank) END) +
    (CASE WHEN t.trank IS NULL THEN 0 ELSE text_weight / (60 + t.trank) END) AS rrf_score
  FROM vector_results v FULL OUTER JOIN text_results t ON v.entity_id = t.entity_id AND v.entity_type = t.entity_type
)
SELECT c.entity_id, c.entity_type, c.rrf_score::DOUBLE PRECISION,
  COALESCE(c.vrank, 0)::INTEGER, COALESCE(c.trank, 0)::INTEGER
FROM combined c ORDER BY c.rrf_score DESC LIMIT result_limit
$$;
--> statement-breakpoint
COMMENT ON COLUMN claims.asserted_at IS 'Transaction time: when this claim was asserted to the knowledge base';
--> statement-breakpoint
COMMENT ON COLUMN claims.derived_at IS 'Transaction time: when this derived assertion was produced by inference (NULL for extracted claims)';
