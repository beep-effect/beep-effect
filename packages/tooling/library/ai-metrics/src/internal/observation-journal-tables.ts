/**
 * Fixed ownership boundary shared by journal initialization and physical backup.
 * @packageDocumentation
 */
/**
 * Tables owned by the observation journal.
 * **Example** Internal consumers check names before accepting a database.
 * @category internal
 */
export const observationJournalTables = [
  "observation_intake_config",
  "observation_launch_facts",
  "observation_intake_pages",
  "observation_source_cursors",
  "observation_schedule_cursor",
  "observation_native_schedule",
  "observation_native_events",
  "observation_native_receipts",
  "observation_delivery_config",
  "observation_delivery_pages",
  "observation_delivery_events",
  "observation_delivery_queries",
  "observation_delivery_attempts",
  "observation_delivery_attempt_events",
  "observation_delivery_results",
  "observation_delivery_visibility",
  "observation_page_dispositions",
  "observation_reclamation_config",
  "observation_evidence_window",
  "observation_evidence_policy",
  "observation_evidence_recovery",
  "observation_evidence_recovery_rows",
];
