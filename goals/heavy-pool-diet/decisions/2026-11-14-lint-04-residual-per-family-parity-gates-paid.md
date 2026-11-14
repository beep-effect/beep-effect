---
title: "LINT-04 residual: per-family parity gates paid"
date: 2026-11-14
kind: checkpoint
reversal: "Revert this slice's squash commit; the fixtures and parity record disappear and no checker changes."
---

Slice 4b pays the LINT-04 per-family gate items #3019 never recorded; the record is `history/2026-11-13-lint-04-parity-gates.md`. No checker's output changed.

- **S2 retired-iri: paid.** Rule 1's pre-filter is generated from the retired-host rows (`retiredIriAuthorityPrefilter`), and tests pin every row, the exact findings per host in five forms and a negative fixture. Over 38,224 tracked text files the rule reports 50,603 matches with no pre-filter and behind each of the generated, hand-written and pre-#3019 pre-filters, with one digest.
- **P55 effect-imports: paid.** A planted file (import type, import-equals, dynamic import, require, an import type node, two JSDoc fences, a comment, a string) gives a byte-identical check-mode summary at HEAD and with #3019's P55 hunks reverted; the exact rows are pinned.
- **S4 effect-vitest: paid.** Repo-wide findings diff empty twice: HEAD against HEAD minus #3019's S4 hunks (3,852 files, 729 findings, one sha256) and `027664ba178^` against `027664ba178` (3,855 files, 746 findings). A 39-file committed fixture set pins the 30-row digest all four versions produce.
- **P12/P11 opaque-roundtrips: partly paid.** The aliased-assertion fixture is pinned and found by both versions. The whole-repo pre/post digest is not paid: the pre-#3019 scanner needs more than the 8 GiB cap (an unbounded run reached 14 GiB at 47 minutes and was stopped to protect the worker), so it was compared with HEAD over four sampled packages instead (154 assertions, identical digests). HEAD alone over the whole repo: 888 assertions, 0 diagnostics, 0 findings. #3019's 814 / 42 / `44b7c59c9033de74` cannot be reproduced because its serialization and diagnostic set are unrecorded. Paying the rest needs a host with more than 21 GB free for the old scanner.
- **P28 lint:laws walk: paid.** Exact census over a fixture tree (7 manifests read against 15 unpruned, depths 7 to 9, read set equal to the seal's route selection); the walk module still carries `WORKSPACE_MANIFEST_WALK`; a real Turbo probe shows a depth-8 manifest and its rename re-key the lint-laws seal.

Coverage floors are untouched.
