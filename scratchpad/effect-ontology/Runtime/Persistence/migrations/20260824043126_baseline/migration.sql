-- Drizzle Kit emits extension-dependent vector columns but cannot declare their
-- prerequisite extensions. This generator-owned prelude must precede every CREATE TABLE.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"uri" text NOT NULL,
	"ontology_id" text NOT NULL,
	"source_name" text,
	"headline" text,
	"published_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"graph_uri" text,
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"batch_id" text NOT NULL UNIQUE,
	"status" text DEFAULT 'pending' NOT NULL,
	"documents_total" integer DEFAULT 0,
	"documents_processed" integer DEFAULT 0,
	"claims_extracted" integer DEFAULT 0,
	"conflicts_detected" integer DEFAULT 0,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"error_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "batch_runs_status_check" CHECK ("status" IN ('pending', 'running', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "canonical_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ontology_id" text DEFAULT 'default' NOT NULL,
	"iri" text NOT NULL,
	"canonical_mention" text NOT NULL,
	"types" text[] DEFAULT '{}'::text[] NOT NULL,
	"embedding" vector(768) NOT NULL,
	"merge_count" integer DEFAULT 1,
	"confidence_avg" numeric(4,3),
	"first_seen_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"article_id" uuid NOT NULL,
	"ontology_id" text NOT NULL,
	"subject_iri" text NOT NULL,
	"predicate_iri" text NOT NULL,
	"object_value" text NOT NULL,
	"object_type" text DEFAULT 'iri',
	"object_datatype" text,
	"object_language" text,
	"rank" text DEFAULT 'normal' NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"asserted_at" timestamp with time zone DEFAULT now(),
	"derived_at" timestamp with time zone,
	"deprecated_at" timestamp with time zone,
	"deprecated_by" uuid,
	"confidence_score" numeric(4,3),
	"evidence_text" text,
	"evidence_start_offset" integer,
	"evidence_end_offset" integer,
	CONSTRAINT "claims_rank_check" CHECK ("rank" IN ('preferred', 'normal', 'deprecated'))
);
--> statement-breakpoint
CREATE TABLE "conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ontology_id" text NOT NULL,
	"conflict_type" text NOT NULL,
	"claim_a_id" uuid NOT NULL,
	"claim_b_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution_strategy" text,
	"accepted_claim_id" uuid,
	"resolved_by" text,
	"resolved_by_fingerprint" text,
	"resolved_at" timestamp with time zone,
	"resolution_notes" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conflicts_conflict_type_check" CHECK ("conflict_type" IN ('position', 'temporal')),
	CONSTRAINT "conflicts_status_check" CHECK ("status" IN ('pending', 'resolved', 'ignored')),
	CONSTRAINT "conflicts_canonical_claim_pair_check" CHECK ("claim_a_id" < "claim_b_id"),
	CONSTRAINT "conflicts_resolution_state_check" CHECK ((
        ("status" = 'pending'
          AND "resolution_strategy" IS NULL
          AND "accepted_claim_id" IS NULL
          AND "resolved_by" IS NULL
          AND "resolved_by_fingerprint" IS NULL
          AND "resolved_at" IS NULL
          AND "resolution_notes" IS NULL)
        OR ("status" = 'ignored'
          AND "resolution_strategy" IS NULL
          AND "accepted_claim_id" IS NULL
          AND "resolved_by" IS NOT NULL
          AND "resolved_at" IS NOT NULL)
        OR ("status" = 'resolved'
          AND "resolution_strategy" IS NOT NULL
          AND "accepted_claim_id" IS NOT NULL
          AND "resolved_by" IS NOT NULL
          AND "resolved_at" IS NOT NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "correction_claims" (
	"correction_id" uuid,
	"original_claim_id" uuid,
	"new_claim_id" uuid,
	CONSTRAINT "correction_claims_pkey" PRIMARY KEY("correction_id","original_claim_id")
);
--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"correction_type" text NOT NULL,
	"source_article_id" uuid,
	"reason" text,
	"correction_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"processed_at" timestamp with time zone,
	CONSTRAINT "corrections_correction_type_check" CHECK ("correction_type" IN ('retraction', 'clarification', 'update', 'amendment'))
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entity_type" varchar(20) NOT NULL,
	"entity_id" text NOT NULL,
	"ontology_id" text DEFAULT 'default' NOT NULL,
	"embedding" vector(768) NOT NULL,
	"content_text" text,
	"model" text DEFAULT 'nomic-embed-text-v1.5' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "embeddings_entity_type_check" CHECK ("entity_type" IN ('class', 'entity', 'claim', 'example'))
);
--> statement-breakpoint
CREATE TABLE "entity_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ontology_id" text DEFAULT 'default' NOT NULL,
	"canonical_entity_id" uuid NOT NULL,
	"mention" text NOT NULL,
	"mention_normalized" text NOT NULL,
	"embedding" vector(768),
	"resolution_method" text NOT NULL,
	"resolution_confidence" numeric(4,3) NOT NULL,
	"first_batch_id" text,
	"source_article_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entity_blocking_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ontology_id" text DEFAULT 'default' NOT NULL,
	"canonical_entity_id" uuid NOT NULL,
	"token" text NOT NULL,
	"token_type" text DEFAULT 'mention'
);
--> statement-breakpoint
CREATE TABLE "ingested_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"content_hash" varchar(64) NOT NULL,
	"ontology_id" text NOT NULL,
	"source_uri" text,
	"source_type" varchar(32),
	"headline" text,
	"description" text,
	"published_at" timestamp with time zone,
	"author" text,
	"organization" text,
	"language" varchar(8) DEFAULT 'en',
	"topics" jsonb DEFAULT '[]',
	"key_entities" jsonb DEFAULT '[]',
	"storage_uri" text NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enriched_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"word_count" integer,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ingested_links_status_check" CHECK ("status" IN ('pending', 'enriched', 'processing', 'processed', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "link_batch_items" (
	"batch_id" uuid,
	"link_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"extraction_run_id" text,
	"article_id" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	CONSTRAINT "link_batch_items_pkey" PRIMARY KEY("batch_id","link_id"),
	CONSTRAINT "link_batch_items_status_check" CHECK ("status" IN ('pending', 'processing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "link_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"batch_id" text NOT NULL UNIQUE,
	"status" text DEFAULT 'pending' NOT NULL,
	"links_total" integer DEFAULT 0,
	"links_processed" integer DEFAULT 0,
	"links_failed" integer DEFAULT 0,
	"ontology_uri" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	CONSTRAINT "link_batches_status_check" CHECK ("status" IN ('pending', 'running', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "llm_examples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ontology_id" text NOT NULL,
	"example_type" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"input_text" text NOT NULL,
	"target_class" text,
	"target_predicate" text,
	"evidence_text" text,
	"evidence_start_offset" integer,
	"evidence_end_offset" integer,
	"expected_output" jsonb NOT NULL,
	"prompt_messages" jsonb,
	"explanation" text,
	"embedding" vector(768) NOT NULL,
	"is_negative" boolean DEFAULT false NOT NULL,
	"negative_pattern" text,
	"usage_count" integer DEFAULT 0,
	"success_rate" numeric(4,3),
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "articles_ontology_uri_unique" ON "articles" ("ontology_id","uri");--> statement-breakpoint
CREATE INDEX "idx_articles_uri" ON "articles" ("uri");--> statement-breakpoint
CREATE INDEX "idx_articles_source" ON "articles" ("source_name");--> statement-breakpoint
CREATE INDEX "idx_articles_published" ON "articles" ("published_at");--> statement-breakpoint
CREATE INDEX "idx_articles_ontology_id" ON "articles" ("ontology_id");--> statement-breakpoint
CREATE INDEX "idx_articles_ontology_source" ON "articles" ("ontology_id","source_name");--> statement-breakpoint
CREATE INDEX "idx_articles_ontology_published" ON "articles" ("ontology_id","published_at");--> statement-breakpoint
CREATE INDEX "idx_batch_runs_batch_id" ON "batch_runs" ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_batch_runs_status" ON "batch_runs" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "canonical_entities_ontology_iri_unique" ON "canonical_entities" ("ontology_id","iri");--> statement-breakpoint
CREATE INDEX "idx_canonical_entities_iri" ON "canonical_entities" ("iri");--> statement-breakpoint
CREATE INDEX "idx_canonical_entities_ontology_id" ON "canonical_entities" ("ontology_id");--> statement-breakpoint
CREATE INDEX "idx_canonical_entities_ontology_iri" ON "canonical_entities" ("ontology_id","iri");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_claims_natural_key" ON "claims" ("article_id","subject_iri","predicate_iri","object_value");--> statement-breakpoint
CREATE INDEX "idx_claims_article" ON "claims" ("article_id");--> statement-breakpoint
CREATE INDEX "idx_claims_subject" ON "claims" ("subject_iri");--> statement-breakpoint
CREATE INDEX "idx_claims_predicate" ON "claims" ("predicate_iri");--> statement-breakpoint
CREATE INDEX "idx_claims_rank" ON "claims" ("rank");--> statement-breakpoint
CREATE INDEX "idx_claims_valid_period" ON "claims" ("valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "idx_claims_deprecated" ON "claims" ("deprecated_at") WHERE "deprecated_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_claims_derived_at" ON "claims" ("derived_at") WHERE "derived_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_claims_subject_predicate" ON "claims" ("subject_iri","predicate_iri");--> statement-breakpoint
CREATE INDEX "idx_claims_ontology_id" ON "claims" ("ontology_id");--> statement-breakpoint
CREATE INDEX "idx_claims_ontology_subject" ON "claims" ("ontology_id","subject_iri");--> statement-breakpoint
CREATE INDEX "idx_claims_ontology_predicate" ON "claims" ("ontology_id","predicate_iri");--> statement-breakpoint
CREATE INDEX "idx_claims_ontology_subject_predicate" ON "claims" ("ontology_id","subject_iri","predicate_iri");--> statement-breakpoint
CREATE INDEX "idx_conflicts_ontology_status" ON "conflicts" ("ontology_id","status");--> statement-breakpoint
CREATE INDEX "idx_conflicts_claims" ON "conflicts" ("claim_a_id","claim_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conflicts_ontology_claim_pair_unique" ON "conflicts" ("ontology_id","claim_a_id","claim_b_id");--> statement-breakpoint
CREATE INDEX "idx_correction_claims_original" ON "correction_claims" ("original_claim_id");--> statement-breakpoint
CREATE INDEX "idx_correction_claims_new" ON "correction_claims" ("new_claim_id");--> statement-breakpoint
CREATE INDEX "idx_corrections_type" ON "corrections" ("correction_type");--> statement-breakpoint
CREATE INDEX "idx_corrections_source" ON "corrections" ("source_article_id");--> statement-breakpoint
CREATE INDEX "idx_corrections_date" ON "corrections" ("correction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_embeddings_ontology_entity_unique" ON "embeddings" ("ontology_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_embeddings_entity_type_idx" ON "embeddings" ("entity_type");--> statement-breakpoint
CREATE INDEX "idx_embeddings_ontology_type_idx" ON "embeddings" ("ontology_id","entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_entity_aliases_ontology_mention" ON "entity_aliases" ("ontology_id","mention_normalized");--> statement-breakpoint
CREATE INDEX "idx_entity_aliases_canonical" ON "entity_aliases" ("canonical_entity_id");--> statement-breakpoint
CREATE INDEX "idx_entity_aliases_ontology" ON "entity_aliases" ("ontology_id");--> statement-breakpoint
CREATE INDEX "idx_blocking_tokens_token" ON "entity_blocking_tokens" ("token");--> statement-breakpoint
CREATE INDEX "idx_blocking_tokens_entity" ON "entity_blocking_tokens" ("canonical_entity_id");--> statement-breakpoint
CREATE INDEX "idx_blocking_tokens_ontology_token" ON "entity_blocking_tokens" ("ontology_id","token");--> statement-breakpoint
CREATE INDEX "idx_blocking_tokens_composite" ON "entity_blocking_tokens" ("ontology_id","token","canonical_entity_id");--> statement-breakpoint
CREATE INDEX "idx_ingested_links_status" ON "ingested_links" ("status");--> statement-breakpoint
CREATE INDEX "idx_ingested_links_source_uri" ON "ingested_links" ("source_uri");--> statement-breakpoint
CREATE INDEX "idx_ingested_links_fetched_at" ON "ingested_links" ("fetched_at");--> statement-breakpoint
CREATE INDEX "idx_ingested_links_source_type" ON "ingested_links" ("source_type");--> statement-breakpoint
CREATE INDEX "idx_ingested_links_organization" ON "ingested_links" ("organization");--> statement-breakpoint
CREATE INDEX "idx_ingested_links_ontology_id" ON "ingested_links" ("ontology_id");--> statement-breakpoint
CREATE INDEX "idx_ingested_links_ontology_status" ON "ingested_links" ("ontology_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ingested_links_ontology_content_unique" ON "ingested_links" ("ontology_id","content_hash");--> statement-breakpoint
CREATE INDEX "idx_link_batch_items_link" ON "link_batch_items" ("link_id");--> statement-breakpoint
CREATE INDEX "idx_link_batch_items_status" ON "link_batch_items" ("status");--> statement-breakpoint
CREATE INDEX "idx_link_batches_status" ON "link_batches" ("status");--> statement-breakpoint
CREATE INDEX "idx_llm_examples_ontology_type" ON "llm_examples" ("ontology_id","example_type");--> statement-breakpoint
CREATE INDEX "idx_llm_examples_ontology_active" ON "llm_examples" ("ontology_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_llm_examples_is_negative" ON "llm_examples" ("is_negative");--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_article_id_articles_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_deprecated_by_corrections_id_fkey" FOREIGN KEY ("deprecated_by") REFERENCES "corrections"("id");--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_claim_a_id_claims_id_fkey" FOREIGN KEY ("claim_a_id") REFERENCES "claims"("id");--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_claim_b_id_claims_id_fkey" FOREIGN KEY ("claim_b_id") REFERENCES "claims"("id");--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_accepted_claim_id_claims_id_fkey" FOREIGN KEY ("accepted_claim_id") REFERENCES "claims"("id");--> statement-breakpoint
ALTER TABLE "correction_claims" ADD CONSTRAINT "correction_claims_correction_id_corrections_id_fkey" FOREIGN KEY ("correction_id") REFERENCES "corrections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "correction_claims" ADD CONSTRAINT "correction_claims_original_claim_id_claims_id_fkey" FOREIGN KEY ("original_claim_id") REFERENCES "claims"("id");--> statement-breakpoint
ALTER TABLE "correction_claims" ADD CONSTRAINT "correction_claims_new_claim_id_claims_id_fkey" FOREIGN KEY ("new_claim_id") REFERENCES "claims"("id");--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_source_article_id_articles_id_fkey" FOREIGN KEY ("source_article_id") REFERENCES "articles"("id");--> statement-breakpoint
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_canonical_entity_id_canonical_entities_id_fkey" FOREIGN KEY ("canonical_entity_id") REFERENCES "canonical_entities"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_source_article_id_articles_id_fkey" FOREIGN KEY ("source_article_id") REFERENCES "articles"("id");--> statement-breakpoint
ALTER TABLE "entity_blocking_tokens" ADD CONSTRAINT "entity_blocking_tokens_Sx4xpmtdQjTC_fkey" FOREIGN KEY ("canonical_entity_id") REFERENCES "canonical_entities"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "link_batch_items" ADD CONSTRAINT "link_batch_items_batch_id_link_batches_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "link_batches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "link_batch_items" ADD CONSTRAINT "link_batch_items_link_id_ingested_links_id_fkey" FOREIGN KEY ("link_id") REFERENCES "ingested_links"("id") ON DELETE CASCADE;