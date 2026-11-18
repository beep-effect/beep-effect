---
title: "A pruned packet whose directory survives through a kept file stays present"
date: 2026-11-18
lane: "feat/prunable-seam-1b"
reversal: "Treat a packet whose directory holds only kept files as pruned and skip its packet-level findings."
---

Seam 1b, the partial case of 2026-11-18-checkout-prune-declaration.md. Agent call: a packet whose directory still exists is present, even when the only file left in it is one a keep entry carves out of a prune, so the goals doctor and the knowledge doctor check it in full (manifest-missing, research-reports-drift and every other packet finding), as for any present packet. Owned stays the one exception to the present-strict rule. A prune entry that names such a packet's root names a live path, so the inventory read refuses it (see 2026-11-18-live-prune-entry-refused.md); a prune of only the packet's contents (its root followed by /**) leaves a present packet that is checked in full. A checkout that keeps one file of a packet it otherwise dropped declares the packet owned, with a keep entry for the file so a link to that file stays strict. packages/tooling/tool/cli/test/goals-doctor.test.ts proves all three forms.
