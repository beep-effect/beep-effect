---
title: The docket register attributes a client last, only for a family with no direct-evidence vote, and never votes
date: 2026-11-23
reversal: Consult the docket register before folder-path and text-reference evidence, or let its client vote in family consensus.
governs:
  - src/PracticeKg.families.ts#directClientLookup
  - src/PracticeKg.families.ts#attributeDocuments
enforcedBy: []
---

Attribution precedence, strongest first: folder-path, text-reference, client-map, family-consensus, docket-register, then no client (filename or restored-name, the bare family). Only folder-path and text-reference are a document's own direct evidence, and only they vote in family consensus. The register answers last, and only for a family with no direct-evidence vote at all, when it lists exactly one client for the docket.

Reason: bare docket codes are reused across clients and the register lists only current dockets, so a register-first order moved older documents, whose own text names their client, onto whichever client holds that code today.

Rejected: register-first attribution, and counting the register's client as a consensus vote.
