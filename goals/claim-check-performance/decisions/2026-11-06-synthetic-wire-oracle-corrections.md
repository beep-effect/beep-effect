---
title: "Version synthetic wire corrections while preserving baselines"
date: 2026-11-06
lane: "feat/claim-check-clauses"
reversal: "Remove the explicit corrected conformance overlay while retaining every original and corrected artifact and run."
---

Independent frozen-source adjudication found three errors in the newly authored synthetic public-wire expectations: two omitted packet antecedent edges and two ordering discrepancies across three cases. The existing product edge builder remains unchanged.

Preserve every original expected object and failed run. Use a separate three-entry development correction overlay, guarded by original file, source and complete-tree hashes and exact old edge arrays. Only the derived expected edges change. Assert the complete corrected trees and report historical original-oracle conformance separately. This is not a revision to any legacy evaluation label, scorer, source selection, prior result or protected passing claim. Other product failures remain unwaived.

Independent review receipt SHA-256: 33aa11f42363987b429160abf8dcc704bf11c929819db5215dfb68a83808cda0. Correction overlay SHA-256: e1ec75e1750e096902bb034243083cfdae09c09d59784622b45fe0c269268cfb. The original 25 synthetic expectations, six private legacy characterizations and 54 historical source fixtures remain unchanged.
