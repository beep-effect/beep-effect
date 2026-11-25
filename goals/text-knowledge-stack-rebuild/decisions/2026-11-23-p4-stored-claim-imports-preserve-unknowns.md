---
title: "P4: frozen claim rows become explicit import records without fabricated authority"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Keep the frozen source bytes and revert the read projection; reassert any new core as another record."
---

Frozen Kb and Holds ClaimVersion schemas live only in private persistence readers, not public compatibility exports. Read a whole old log plus assertion/probe sidecars before resolving supersedes. Emit LegacyClaimImported records with source digest, old id, original valid/knowledge bounds, proposition, evidence references, five signals and review payload. Split review and challenges into separate claim-local imported records; preserve old reference namespaces in a lookup keyed by ledger and old id. Missing scope, generation, actor, text identity and human token are represented as a nonempty missing-facts set, not invented. These are new records returned by the declared read-time transform, not ClaimCore and not Admission. Historical CLI views read this import projection; live authority and L4 log appends accept only fully materialized minted cores. When all creation facts are available, materialization emits a new core plus an import-to-core link; otherwise it remains explicitly imported. Legacy accepted review never becomes an authenticated admission. Keep expiredAt even when no successor is present as import history; do not fake a superseder. New writes are version-tagged core/record events. This satisfies the stored-row-to-new-record requirement without claiming missing facts were stored.
