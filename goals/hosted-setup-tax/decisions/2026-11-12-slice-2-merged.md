---
title: "Slice 2 (PERIH-02, PERIL-04) merged as #3117 over two attributed reds"
date: 2026-11-12
kind: checkpoint
lane: "docs/hosted-setup-tax-slice-2-merged"
pullRequest: 3117
reversal: "Revert #3117 (10ed12d4410) as recorded in the slice 2 decision file; this checkpoint is status only."
---

#3117 merged as 10ed12d4410 on 2026-11-12 from head 2c988a91828. The planted-violation gate was shown on hosted runs before the merge: Repo Sanity failed on the planted `bg-zinc-100` at 4afb6371360 (job 129702702080, its only failing step) and passed with the plant removed at 2c988a91828 (job 129705325011); the planted file is in neither the squash nor main. The push-event half rests on the shared lane body (check.yml runs `ci lane repo-sanity` on push; `ci-repo-sanity-owners.test.ts` asserts the step for both event shapes), not on a planted push to main. Two reds merged with it under S11. Heavy / Lint Policy was introduced by this slice: `lint:effect-vitest` flagged the trailing `.pipe(Effect.scoped)` in the masking test of `ci-repo-sanity-owners.test.ts`; it reached main and #3120 (5e9ee8341bd) fixed it. The local proof missed it because `package-verify` does not run that root lint and the final-check run was cut short by host load. Heavy / Coverage Regression's nine ratchet rows were inherited. Job removed for the merge-group-parity candidate: Shadcn Lint (non-required).
