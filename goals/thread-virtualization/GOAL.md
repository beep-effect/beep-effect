# GOAL: Deliver exact-height thread virtualization

Repo root: the current beep-effect checkout. Do not assume an absolute path.

Outcome: the editor-stack thread renderer uses exact-height virtualization
derived from the `@beep/pretext` root surface plus a client capture pass.

Read first:

- `goals/thread-virtualization/README.md`
- `goals/thread-virtualization/SPEC.md`
- `goals/thread-virtualization/PLAN.md`
- `goals/thread-virtualization/ops/manifest.json`
- `explorations/computable-workspace-geometry/MAP.md`
- `AGENTS.md` and `CLAUDE.md`

Scope:

- In: the live editor-stack thread renderer, its exact-height virtualization,
  the client capture seam, focused tests, and browser QA evidence.
- Out: dock-kernel residue, a pretext rewrite, desktop-shell work, and unrelated
  editor changes.

Workflow:

1. Locate the live renderer and confirm the ownership boundary still holds.
2. Define the exact-height contract using the shipped `@beep/pretext` root.
3. Implement the smallest virtualization and client capture path.
4. Verify behavior with focused tests and the required browser QA loop.
5. Publish through Yeet, close review threads, and write the P4 reflection.

Done only when `SPEC.md` acceptance passes and the PR is merge-ready, or a
named stop condition is reported with evidence.
