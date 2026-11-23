---
title: "P4: missing confidence stays absent and docket unknown is not passed"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Revert consumer projections with explicit versioned stored readers; never silently infer missing numbers."
---

Office-action extraction with no model confidence emits Absent not-assessed; semantica optional confidence uses the same carrier, preserving explicit zero and one. Reported unit-interval confidence is a named reported measurement with producer/method provenance, not ClassifierProbability. DeterministicCheck replaces passed with Passed, Failed or Unknown document-text-unavailable. Check cited passages against available message text first; a demonstrated message match passes even if document text is unavailable. A missing passage with attached unavailable text is unknown, and with complete available text is failed. The gate passes only Passed, and explanation retains unknown separately from contradictions. Urgent tentative entries remain visible. Any stored boolean check reader maps old true to historical Passed with legacy provenance, never to a newly verified current check; rerun before using a live gate. SourceQuote becomes TextAnchor, TextQuote becomes the text quote selector, and SourceRef keeps its legal locator fields with the shared selector.

The extractor signal value schema accepts existing Measurement cases and the tagged ReportedConfidence case, with value, method and optional producer pin. Existing stored Measurement encodings remain readable. Semantica legacy scalar origin may be unprovable because of its old default: keep raw numeric metadata and emit Absent legacy-unknown unless the frozen provider response proves an explicit report. LedgerLive claims and nested batches verify their original raw digests before read projection; a repeat append compares normalized facts or returns an immutable-payload conflict, never overwrites the old payload.
