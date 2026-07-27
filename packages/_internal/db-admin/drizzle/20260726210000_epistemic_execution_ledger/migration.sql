CREATE TABLE epistemic_execution_decision (
  run_key TEXT NOT NULL,
  seq INTEGER NOT NULL,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  verdict TEXT NOT NULL,
  reason TEXT,
  operation_digest TEXT NOT NULL,
  sink_class TEXT NOT NULL,
  audience TEXT NOT NULL,
  destination_digest TEXT NOT NULL,
  grant_set_digest TEXT NOT NULL,
  policy_revision TEXT NOT NULL,
  decided_at BIGINT NOT NULL,
  CONSTRAINT epistemic_execution_decision_pk PRIMARY KEY (run_key, seq),
  CONSTRAINT epistemic_execution_decision_hash_unique UNIQUE (hash),
  CONSTRAINT epistemic_execution_decision_run_hash_unique UNIQUE (run_key, hash),
  CONSTRAINT epistemic_execution_decision_hash_verdict_unique UNIQUE (hash, verdict),
  CONSTRAINT epistemic_execution_decision_seq_nonnegative CHECK (seq >= 0),
  CONSTRAINT epistemic_execution_decision_genesis_prev CHECK ((seq = 0) = (prev_hash IS NULL)),
  CONSTRAINT epistemic_execution_decision_verdict_bounded CHECK (verdict IN ('allowed', 'denied')),
  CONSTRAINT epistemic_execution_decision_reason_iff_denied CHECK ((verdict = 'denied') = (reason IS NOT NULL)),
  CONSTRAINT epistemic_execution_decision_reason_bounded CHECK (
    reason IS NULL OR reason IN (
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
  CONSTRAINT epistemic_execution_decision_sink_class_bounded CHECK (sink_class IN ('network-egress', 'mcp-write')),
  CONSTRAINT epistemic_execution_decision_audience_bounded CHECK (
    audience IN ('local-workspace', 'external-network')
  )
);

CREATE TABLE epistemic_execution_outcome (
  run_key TEXT NOT NULL,
  decision_hash TEXT NOT NULL,
  decision_verdict TEXT NOT NULL DEFAULT 'allowed',
  settlement TEXT NOT NULL,
  recorded_at BIGINT NOT NULL,
  hash TEXT NOT NULL,
  CONSTRAINT epistemic_execution_outcome_pk PRIMARY KEY (decision_hash),
  CONSTRAINT epistemic_execution_outcome_decision_fk FOREIGN KEY (run_key, decision_hash)
    REFERENCES epistemic_execution_decision (run_key, hash),
  CONSTRAINT epistemic_execution_outcome_decision_verdict_fk FOREIGN KEY (decision_hash, decision_verdict)
    REFERENCES epistemic_execution_decision (hash, verdict),
  CONSTRAINT epistemic_execution_outcome_settles_allowed CHECK (decision_verdict = 'allowed'),
  CONSTRAINT epistemic_execution_outcome_hash_unique UNIQUE (hash),
  CONSTRAINT epistemic_execution_outcome_settlement_bounded CHECK (
    settlement IN ('completed', 'failed', 'interrupted')
  )
);

CREATE FUNCTION epistemic_execution_ledger_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
  RAISE EXCEPTION 'epistemic execution ledger is append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;

CREATE TRIGGER epistemic_execution_decision_append_only
  BEFORE UPDATE OR DELETE ON epistemic_execution_decision
  FOR EACH ROW EXECUTE FUNCTION epistemic_execution_ledger_block_mutation();

CREATE TRIGGER epistemic_execution_outcome_append_only
  BEFORE UPDATE OR DELETE ON epistemic_execution_outcome
  FOR EACH ROW EXECUTE FUNCTION epistemic_execution_ledger_block_mutation();

CREATE TRIGGER epistemic_execution_decision_block_truncate
  BEFORE TRUNCATE ON epistemic_execution_decision
  FOR EACH STATEMENT EXECUTE FUNCTION epistemic_execution_ledger_block_mutation();

CREATE TRIGGER epistemic_execution_outcome_block_truncate
  BEFORE TRUNCATE ON epistemic_execution_outcome
  FOR EACH STATEMENT EXECUTE FUNCTION epistemic_execution_ledger_block_mutation();
