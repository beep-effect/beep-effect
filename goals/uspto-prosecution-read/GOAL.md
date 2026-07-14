# GOAL: deliver the known-application USPTO prosecution read

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a known application number produces a schema-decoded,
provenance-bearing prosecution observation with native status, transaction, and
authoritative office-action/document evidence, typed technical failures, and
deterministic generated artifacts for all four USPTO vocabularies.

This is a compact `/goal` launcher. Treat these as the detailed contract:

- `goals/uspto-prosecution-read/README.md`
- `goals/uspto-prosecution-read/SPEC.md`
- `goals/uspto-prosecution-read/PLAN.md`
- `goals/uspto-prosecution-read/ops/manifest.json`

Read them first, then repo instructions, governing standards, the source
exploration, and `goals/uspto-ptmnfee2-ingest/SPEC.md`.

Scope:

- In: `packages/drivers/uspto`, the existing `packages/drivers/uspto-mcp`
  toolkit under its shipped soft gate, `@beep/api-transport` adoption, generated
  native-vocabulary artifacts, fixtures, focused tests, and packet evidence.
- Out: polling/scheduling, deadline or legal-status computation, a second MCP
  host, a law-practice overlay, EPO/BigQuery, structured search, and production
  ppubs.

Workflow:

1. Inspect live driver/MCP/transport source and preserve unrelated changes.
2. Complete all four P0 spikes before freezing public schemas or fixtures: OA
   endpoint/envelope and transaction path; authoritative vocabulary retrieval
   and checksum stability; current `PTMNFEE2` layout/code-list/size/rate/access
   facts; authenticated ODP retry headers/statuses/idempotency assumptions.
3. Implement the smallest schema-first, Effect-first observation and one
   deterministic four-vocabulary generator satisfying `SPEC.md`.
4. Adopt the promoted `@beep/api-transport` transformer for every
   `@beep/uspto` request while retaining single-request service semantics.
5. Prove the patent-spine intake shape with network-free provenance fixtures;
   credentialed captures are optional and sanitized.
6. Keep matter authorization in law practice; expose only the technical
   source-capability metadata required by the two-control model.
7. At P3 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; reflection lint and Yeet PR-to-mergeable proof must pass.

Acceptance:

- [ ] Every `SPEC.md` criterion and the four P0 gates pass.
- [ ] The observation contains the driver-promised minimum OA fields.
- [ ] Refreshes are deterministic, reviewable, and never silently mutate decode
      authority.
- [ ] The ingest sibling can reuse the same generation mechanism.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/uspto-prosecution-read/GOAL.md)" -le 4000
jq . goals/uspto-prosecution-read/ops/manifest.json
rg -n "uspto-prosecution-read|GOAL.md|agentLaunchers|packetAnchorDocument" goals/uspto-prosecution-read
git diff --check -- goals/uspto-prosecution-read
bun run beep yeet verify
```

Stop before P1 if a P0 gate cannot support an honest contract, or before unnamed
credentials, cost, destructive state, dependency expansion, or broader API.

Done only when the fixture contract, deterministic generation/drift proof,
focused tests, reflection, and Yeet/GitHub mergeability are green; otherwise
report the blocker with file/command evidence.
