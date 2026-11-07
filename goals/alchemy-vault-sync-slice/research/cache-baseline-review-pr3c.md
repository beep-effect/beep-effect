# PR 3c cache dependency review

Reviewers: GPT-6.1 Sol, medium (first pass); Claude Opus 5.5, medium (fallback
lane, 2026-11-07), implementation self-review.

This lane merged origin/main, including the #2881 global-input baseline repair.
It adds two existing workspace dependencies to documents-server and runs
tsconfig-sync for its reference lists and the Fallow boundaries:

- `@beep/mcp-kit`, for the closed Views-only MCP registration.
- `@beep/shared-tables`, for the live shared membership read behind the
  production SessionResolver adapters.

The server build/check/test/deprecated-api graph edges now include both.
No task script, root Turbo input, output, environment or cache qualification
setting changed in this lane. The fallback lane changed no manifest.

Only the documents-server subject is reviewed here. The branch also inherits
unrecorded documents-use-cases dependency drift (`@alchemy.run/domain`,
`@beep/alchemy-postgres`, `@beep/pglite`) from the PR 2b/3a/3b stack. Its
packet review requests belong to the orchestrator; this request does not
silently re-review that subject. No cache qualification is granted.
