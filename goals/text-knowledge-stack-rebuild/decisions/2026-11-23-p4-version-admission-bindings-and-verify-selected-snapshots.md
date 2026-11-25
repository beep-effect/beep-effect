---
title: "P4: version admission bindings and verify selected snapshots"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Version the binding and retraction preimages together and migrate explicit verification ports while preserving old event records."
---

Use claim-set/v1 for canonical trusted claim-set membership and claim-retraction/v1 for the exact encoded prior Retraction record. Admission ports resolve authenticated principals, immutable action-revision claim bindings, native claim generation and current sources; historical views use a distinct selected-time source resolver. A readmission clearing is verified at its own admission time before closing the named prior retraction, and eligibility separately verifies the selected snapshot. Unavailable historical verification remains unknown and never grants eligibility; direct retractions at the same time as a clearing win.
