CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
DROP INDEX "epistemic_candidate_claim_org_id_btree_idx";--> statement-breakpoint
DROP INDEX "epistemic_candidate_claim_source_btree_idx";--> statement-breakpoint
DROP INDEX "epistemic_claim_disposition_org_id_btree_idx";--> statement-breakpoint
DROP INDEX "epistemic_claim_disposition_source_btree_idx";--> statement-breakpoint
DROP INDEX "epistemic_edge_version_org_id_btree_idx";--> statement-breakpoint
DROP INDEX "epistemic_edge_version_source_btree_idx";--> statement-breakpoint
DROP INDEX "epistemic_evidence_org_id_btree_idx";--> statement-breakpoint
DROP INDEX "epistemic_evidence_source_btree_idx";--> statement-breakpoint
ALTER TABLE "epistemic_edge_version"
  ADD CONSTRAINT "epistemic_edge_source_claim_fk" FOREIGN KEY ("source_claim_id") REFERENCES "epistemic_candidate_claim" ("id"),
  ADD CONSTRAINT "epistemic_edge_source_evidence_fk" FOREIGN KEY ("source_evidence_id") REFERENCES "epistemic_evidence" ("id"),
  ADD CONSTRAINT "epistemic_edge_supersedes_fk" FOREIGN KEY ("supersedes_id") REFERENCES "epistemic_edge_version" ("id"),
  ADD CONSTRAINT "epistemic_edge_target_claim_fk" FOREIGN KEY ("target_claim_id") REFERENCES "epistemic_candidate_claim" ("id"),
  ADD CONSTRAINT "epistemic_edge_target_evidence_fk" FOREIGN KEY ("target_evidence_id") REFERENCES "epistemic_evidence" ("id"),
  ADD CONSTRAINT "epistemic_edge_valid_ordered" CHECK ("valid_to" IS NULL OR "valid_from" < "valid_to"),
  ADD CONSTRAINT "epistemic_edge_txn_ordered" CHECK ("expired_at" IS NULL OR "recorded_at" < "expired_at"),
  ADD CONSTRAINT "epistemic_edge_no_self_supersede" CHECK ("supersedes_id" IS NULL OR "supersedes_id" <> "id"),
  ADD CONSTRAINT "epistemic_edge_source_bounded" CHECK (
    "source_kind" IN ('claim', 'evidence', 'entity', 'observation')
    AND (("source_kind" = 'claim') = ("source_claim_id" IS NOT NULL))
    AND (("source_kind" = 'evidence') = ("source_evidence_id" IS NOT NULL))
    AND (("source_kind" = 'entity') = ("source_entity_ref" IS NOT NULL))
    AND (("source_kind" = 'observation') = ("source_observation_ref" IS NOT NULL))
  ),
  ADD CONSTRAINT "epistemic_edge_target_bounded" CHECK (
    "target_kind" IN ('claim', 'evidence', 'entity', 'observation')
    AND (("target_kind" = 'claim') = ("target_claim_id" IS NOT NULL))
    AND (("target_kind" = 'evidence') = ("target_evidence_id" IS NOT NULL))
    AND (("target_kind" = 'entity') = ("target_entity_ref" IS NOT NULL))
    AND (("target_kind" = 'observation') = ("target_observation_ref" IS NOT NULL))
  ),
  ADD CONSTRAINT "epistemic_edge_logical_version_unique" UNIQUE ("logical_key", "version"),
  ADD CONSTRAINT "epistemic_edge_no_overlap" EXCLUDE USING gist (
    "logical_key" WITH =,
    int8range("valid_from", "valid_to", '[)') WITH &&
  ) WHERE ("expired_at" IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_edge_open_head_idx"
  ON "epistemic_edge_version" ("logical_key")
  WHERE "valid_to" IS NULL AND "expired_at" IS NULL;--> statement-breakpoint
CREATE INDEX "epistemic_edge_asof_idx"
  ON "epistemic_edge_version" ("logical_key", "valid_from", "recorded_at");--> statement-breakpoint
CREATE INDEX "epistemic_edge_qualifiers_gin_idx"
  ON "epistemic_edge_version" USING gin ("qualifiers");--> statement-breakpoint
ALTER TABLE "epistemic_claim_disposition"
  ADD CONSTRAINT "epistemic_claim_disposition_claim_fk" FOREIGN KEY ("claim_id") REFERENCES "epistemic_candidate_claim" ("id"),
  ADD CONSTRAINT "epistemic_claim_disposition_bounded" CHECK ("status" IN ('active', 'rejected', 'superseded'));--> statement-breakpoint
ALTER TABLE "epistemic_execution_decision"
  ADD CONSTRAINT "epistemic_execution_decision_pk" PRIMARY KEY ("run_key", "seq"),
  ADD CONSTRAINT "epistemic_execution_decision_hash_unique" UNIQUE ("hash"),
  ADD CONSTRAINT "epistemic_execution_decision_run_hash_unique" UNIQUE ("run_key", "hash"),
  ADD CONSTRAINT "epistemic_execution_decision_hash_verdict_unique" UNIQUE ("hash", "verdict"),
  ADD CONSTRAINT "epistemic_execution_decision_seq_nonnegative" CHECK ("seq" >= 0),
  ADD CONSTRAINT "epistemic_execution_decision_genesis_prev" CHECK (("seq" = 0) = ("prev_hash" IS NULL)),
  ADD CONSTRAINT "epistemic_execution_decision_verdict_bounded" CHECK ("verdict" IN ('allowed', 'denied')),
  ADD CONSTRAINT "epistemic_execution_decision_reason_iff_denied" CHECK (("verdict" = 'denied') = ("reason" IS NOT NULL)),
  ADD CONSTRAINT "epistemic_execution_decision_reason_bounded" CHECK (
    "reason" IS NULL OR "reason" IN (
      'no-grant-in-scope',
      'grant-set-digest-mismatch',
      'operation-not-granted',
      'sink-class-not-granted',
      'audience-not-granted',
      'destination-not-granted',
      'grant-expired',
      'policy-revision-mismatch',
      'ledger-unavailable'
    )
  ),
  ADD CONSTRAINT "epistemic_execution_decision_sink_class_bounded" CHECK ("sink_class" IN ('network-egress', 'mcp-write')),
  ADD CONSTRAINT "epistemic_execution_decision_audience_bounded" CHECK ("audience" IN ('local-workspace', 'external-network'));--> statement-breakpoint
ALTER TABLE "epistemic_execution_outcome"
  DROP CONSTRAINT "epistemic_execution_outcome_pkey",
  ADD CONSTRAINT "epistemic_execution_outcome_pk" PRIMARY KEY ("decision_hash"),
  ADD CONSTRAINT "epistemic_execution_outcome_decision_fk" FOREIGN KEY ("run_key", "decision_hash") REFERENCES "epistemic_execution_decision" ("run_key", "hash"),
  ADD CONSTRAINT "epistemic_execution_outcome_decision_verdict_fk" FOREIGN KEY ("decision_hash", "decision_verdict") REFERENCES "epistemic_execution_decision" ("hash", "verdict"),
  ADD CONSTRAINT "epistemic_execution_outcome_settles_allowed" CHECK ("decision_verdict" = 'allowed'),
  ADD CONSTRAINT "epistemic_execution_outcome_hash_unique" UNIQUE ("hash"),
  ADD CONSTRAINT "epistemic_execution_outcome_settlement_bounded" CHECK ("settlement" IN ('completed', 'failed', 'interrupted'));--> statement-breakpoint
CREATE FUNCTION epistemic_execution_ledger_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
  RAISE EXCEPTION 'epistemic execution ledger is append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;--> statement-breakpoint
CREATE TRIGGER epistemic_execution_decision_append_only
  BEFORE UPDATE OR DELETE ON "epistemic_execution_decision"
  FOR EACH ROW EXECUTE FUNCTION epistemic_execution_ledger_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_execution_outcome_append_only
  BEFORE UPDATE OR DELETE ON "epistemic_execution_outcome"
  FOR EACH ROW EXECUTE FUNCTION epistemic_execution_ledger_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_execution_decision_block_truncate
  BEFORE TRUNCATE ON "epistemic_execution_decision"
  FOR EACH STATEMENT EXECUTE FUNCTION epistemic_execution_ledger_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_execution_outcome_block_truncate
  BEFORE TRUNCATE ON "epistemic_execution_outcome"
  FOR EACH STATEMENT EXECUTE FUNCTION epistemic_execution_ledger_block_mutation();--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_contradiction_candidate_org_key_unique_idx"
  ON "epistemic_contradiction_candidate" ("org_id", "candidate_key");--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_contradiction_receipt_org_id_receipt_key_unique_idx"
  ON "epistemic_contradiction_receipt" ("org_id", "receipt_key");--> statement-breakpoint
ALTER TABLE "epistemic_contradiction_candidate"
  ADD CONSTRAINT "epistemic_contradiction_candidate_valid_interval_ordered" CHECK ("valid_to" IS NULL OR "valid_from" < "valid_to"),
  ADD CONSTRAINT "epistemic_contradiction_candidate_key_sha256" CHECK ("candidate_key" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "epistemic_contradiction_candidate_digest_sha256" CHECK ("candidate_digest" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "epistemic_contradiction_candidate_org_id_id_unique" UNIQUE ("org_id", "id");--> statement-breakpoint
ALTER TABLE "epistemic_contradiction_receipt"
  ADD CONSTRAINT "epistemic_contradiction_receipt_key_sha256" CHECK ("receipt_key" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "epistemic_contradiction_receipt_candidate_fk" FOREIGN KEY ("org_id", "candidate_id") REFERENCES "epistemic_contradiction_candidate" ("org_id", "id");--> statement-breakpoint
ALTER TABLE "epistemic_contradiction_disposition"
  ADD CONSTRAINT "epistemic_contradiction_disposition_candidate_fk" FOREIGN KEY ("org_id", "candidate_id") REFERENCES "epistemic_contradiction_candidate" ("org_id", "id"),
  ADD CONSTRAINT "epistemic_contradiction_disposition_decision_valid" CHECK (
    jsonb_typeof("decision") = 'object'
    AND "decision" ? 'status'
    AND jsonb_typeof("decision" -> 'status') = 'string'
    AND "decision" ->> 'status' IN ('rejected', 'superseded')
    AND "decision" ? 'reason'
    AND jsonb_typeof("decision" -> 'reason') = 'string'
    AND (
      char_length("decision" ->> 'reason')
      + regexp_count("decision" ->> 'reason', '[\U00010000-\U0010FFFF]')
    ) BETWEEN 1 AND 2000
    AND trim(
      BOTH U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
      FROM "decision" ->> 'reason'
    ) <> ''
    AND CASE "decision" ->> 'status'
      WHEN 'rejected' THEN TRUE
      WHEN 'superseded' THEN
        "decision" ? 'formerEdgeVersionId'
        AND jsonb_typeof("decision" -> 'formerEdgeVersionId') = 'number'
        AND "decision" ->> 'formerEdgeVersionId' ~ '^[1-9][0-9]*$'
        AND "decision" ? 'proposalDigest'
        AND jsonb_typeof("decision" -> 'proposalDigest') = 'string'
        AND "decision" ->> 'proposalDigest' ~ '^[0-9a-f]{64}$'
        AND "decision" ? 'proposalId'
        AND jsonb_typeof("decision" -> 'proposalId') = 'string'
        AND "decision" ->> 'proposalId' ~ '^[0-9a-f]{64}$'
        AND "decision" ? 'replacementEdgeVersionId'
        AND jsonb_typeof("decision" -> 'replacementEdgeVersionId') = 'number'
        AND "decision" ->> 'replacementEdgeVersionId' ~ '^[1-9][0-9]*$'
      ELSE FALSE
    END
  );--> statement-breakpoint
CREATE FUNCTION epistemic_contradiction_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
  RAISE EXCEPTION 'epistemic contradiction records are append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_candidate_append_only BEFORE UPDATE OR DELETE ON "epistemic_contradiction_candidate" FOR EACH ROW EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_receipt_append_only BEFORE UPDATE OR DELETE ON "epistemic_contradiction_receipt" FOR EACH ROW EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_disposition_append_only BEFORE UPDATE OR DELETE ON "epistemic_contradiction_disposition" FOR EACH ROW EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_candidate_block_truncate BEFORE TRUNCATE ON "epistemic_contradiction_candidate" FOR EACH STATEMENT EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_receipt_block_truncate BEFORE TRUNCATE ON "epistemic_contradiction_receipt" FOR EACH STATEMENT EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_disposition_block_truncate BEFORE TRUNCATE ON "epistemic_contradiction_disposition" FOR EACH STATEMENT EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE INDEX "epistemic_evidence_verification_as_of_idx"
  ON "epistemic_evidence_verification" ("org_id", "evidence_id", "created_at", "id");--> statement-breakpoint
ALTER TABLE "epistemic_evidence"
  ADD CONSTRAINT "epistemic_evidence_org_id_id_unique" UNIQUE ("org_id", "id");--> statement-breakpoint
ALTER TABLE "epistemic_evidence_verification"
  ADD CONSTRAINT "epistemic_evidence_verification_evidence_fk" FOREIGN KEY ("org_id", "evidence_id") REFERENCES "epistemic_evidence" ("org_id", "id"),
  ADD CONSTRAINT "epistemic_evidence_verification_manifestation_unique" UNIQUE ("org_id", "manifestation_key"),
  ADD CONSTRAINT "epistemic_evidence_verification_manifestation_sha256" CHECK ("manifestation_key" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
CREATE FUNCTION epistemic_evidence_verification_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
  RAISE EXCEPTION 'epistemic evidence verification records are append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;--> statement-breakpoint
CREATE TRIGGER epistemic_evidence_verification_append_only BEFORE UPDATE OR DELETE ON "epistemic_evidence_verification" FOR EACH ROW EXECUTE FUNCTION epistemic_evidence_verification_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_evidence_verification_block_truncate BEFORE TRUNCATE ON "epistemic_evidence_verification" FOR EACH STATEMENT EXECUTE FUNCTION epistemic_evidence_verification_block_mutation();--> statement-breakpoint
ALTER TABLE "law_practice_candor_disposition"
  ADD CONSTRAINT "law_practice_candor_disposition_org_id_id_unique" UNIQUE ("org_id", "id"),
  ADD CONSTRAINT "law_practice_candor_disposition_supersedes_fk" FOREIGN KEY ("org_id", "supersedes") REFERENCES "law_practice_candor_disposition" ("org_id", "id");--> statement-breakpoint
ALTER TABLE "law_practice_patent_citation_event"
  ADD CONSTRAINT "law_practice_patent_citation_event_org_id_id_unique" UNIQUE ("org_id", "id"),
  ADD CONSTRAINT "law_practice_patent_citation_event_possible_duplicate_fk" FOREIGN KEY ("org_id", "possible_duplicate_of") REFERENCES "law_practice_patent_citation_event" ("org_id", "id");--> statement-breakpoint
CREATE FUNCTION law_practice_candor_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
  RAISE EXCEPTION 'law practice candor records are append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;--> statement-breakpoint
CREATE TRIGGER law_practice_patent_citation_event_append_only BEFORE UPDATE OR DELETE ON "law_practice_patent_citation_event" FOR EACH ROW EXECUTE FUNCTION law_practice_candor_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_patent_citation_event_block_truncate BEFORE TRUNCATE ON "law_practice_patent_citation_event" FOR EACH STATEMENT EXECUTE FUNCTION law_practice_candor_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_candor_disposition_append_only BEFORE UPDATE OR DELETE ON "law_practice_candor_disposition" FOR EACH ROW EXECUTE FUNCTION law_practice_candor_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_candor_disposition_block_truncate BEFORE TRUNCATE ON "law_practice_candor_disposition" FOR EACH STATEMENT EXECUTE FUNCTION law_practice_candor_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_ids_submission_fact_append_only BEFORE UPDATE OR DELETE ON "law_practice_ids_submission_fact" FOR EACH ROW EXECUTE FUNCTION law_practice_candor_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_ids_submission_fact_block_truncate BEFORE TRUNCATE ON "law_practice_ids_submission_fact" FOR EACH STATEMENT EXECUTE FUNCTION law_practice_candor_block_mutation();--> statement-breakpoint
CREATE FUNCTION law_practice_legal_position_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
  RAISE EXCEPTION 'law practice legal position records are append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;--> statement-breakpoint
CREATE TRIGGER law_practice_legal_position_relator_append_only BEFORE UPDATE OR DELETE ON "law_practice_legal_position_relator" FOR EACH ROW EXECUTE FUNCTION law_practice_legal_position_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_legal_position_relator_block_truncate BEFORE TRUNCATE ON "law_practice_legal_position_relator" FOR EACH STATEMENT EXECUTE FUNCTION law_practice_legal_position_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_act_frame_append_only BEFORE UPDATE OR DELETE ON "law_practice_act_frame" FOR EACH ROW EXECUTE FUNCTION law_practice_legal_position_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_act_frame_block_truncate BEFORE TRUNCATE ON "law_practice_act_frame" FOR EACH STATEMENT EXECUTE FUNCTION law_practice_legal_position_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_power_exercise_append_only BEFORE UPDATE OR DELETE ON "law_practice_power_exercise" FOR EACH ROW EXECUTE FUNCTION law_practice_legal_position_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_power_exercise_block_truncate BEFORE TRUNCATE ON "law_practice_power_exercise" FOR EACH STATEMENT EXECUTE FUNCTION law_practice_legal_position_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_correction_delta_append_only BEFORE UPDATE OR DELETE ON "law_practice_correction_delta" FOR EACH ROW EXECUTE FUNCTION law_practice_legal_position_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_correction_delta_block_truncate BEFORE TRUNCATE ON "law_practice_correction_delta" FOR EACH STATEMENT EXECUTE FUNCTION law_practice_legal_position_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_legal_opposition_candidate_append_only BEFORE UPDATE OR DELETE ON "law_practice_legal_opposition_candidate" FOR EACH ROW EXECUTE FUNCTION law_practice_legal_position_block_mutation();--> statement-breakpoint
CREATE TRIGGER law_practice_legal_opposition_candidate_block_truncate BEFORE TRUNCATE ON "law_practice_legal_opposition_candidate" FOR EACH STATEMENT EXECUTE FUNCTION law_practice_legal_position_block_mutation();
