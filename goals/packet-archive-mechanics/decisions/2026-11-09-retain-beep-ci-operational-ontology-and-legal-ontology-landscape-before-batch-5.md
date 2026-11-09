---
title: "Retain beep-ci-operational-ontology and legal-ontology-landscape before batch 5"
date: 2026-11-09
lane: "feat/packet-archive-batch-5"
reversal: "Remove each retentionReason after moving what apps/labs/ciops and SemanticFoundation.test read"
---

Batch 5's scan found two explorations still read live: apps/labs/ciops reads and hash-pins the ontology packet's 10,465 files, and SemanticFoundation.test decodes the legal ontology asset manifest. Both stay on main with a retentionReason. Provenance strings in the editor capability atlas and the lejeune-bolt bundle are citations that nothing opens, so those packets are archived. From this batch on the archive push comes last, after every gate, so a packet found to be live can be retained without leaving a copy in the public archive.
