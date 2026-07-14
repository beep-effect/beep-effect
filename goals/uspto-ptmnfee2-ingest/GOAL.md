# GOAL: deliver the weekly PTMNFEE2 full-replace ingest

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the weekly cumulative USPTO `PTMNFEE2` release is checksum-pinned,
replaced into typed native maintenance events, and represented by an
attributed network-free fixture plus deterministic refresh manifest.

This is a compact `/goal` launcher. Treat these as the detailed contract:

- `goals/uspto-ptmnfee2-ingest/README.md`
- `goals/uspto-ptmnfee2-ingest/SPEC.md`
- `goals/uspto-ptmnfee2-ingest/PLAN.md`
- `goals/uspto-ptmnfee2-ingest/ops/manifest.json`

Read them first, then repo instructions and governing standards,
`goals/uspto-prosecution-read/SPEC.md`, and the source exploration research.

Scope:

- In: `packages/drivers/uspto` bulk release discovery/download/validation,
  schema-first parsing, staged atomic full replacement, typed native events,
  the shared four-vocabulary mechanism, fixture attribution, refresh manifest,
  focused tests, and packet evidence.
- Out: append ingestion, per-record polling, deadline/legal-status computation,
  family/reissue interpretation, scheduling/recovery, or a new MCP host.

Workflow:

1. Inspect live source and preserve unrelated changes.
2. Complete P0 against an authorized current release: exact filenames/archive
   layout, delimiters/widths, encoding/null/date/header rules, complete
   `MaintFeeEventsDesc`, sizes/counts, numeric limits, resolved-file anonymous
   access, and documentation/code checksums. Invent none of these.
3. Reuse—do not fork—the generation/vocabulary mechanism delivered by
   `goals/uspto-prosecution-read`.
4. Implement checksum-pinned staged download, validation, typed lossless parse,
   and atomic full replacement. Preserve raw unknown values and fail explicitly
   on schema/code drift.
5. Commit only small government-authored structured fixture excerpts carrying
   USPTO, `PTMNFEE2`, release/source/checksum/extraction/access-date, and Public
   Domain Mark 1.0 attribution.
6. Prove the fixture shape consumed by the patent-spine maintenance-fee intake;
   keep schedules/cursors in `goals/law-docketing-reliability`.
7. At P3 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; reflection lint and Yeet PR-to-mergeable proof must pass.

Acceptance:

- [ ] Every `SPEC.md` criterion and P0 gate passes.
- [ ] A pinned rerun is byte-for-byte deterministic and a new release yields a
      reviewable manifest/vocabulary diff.
- [ ] Full replacement cannot append or expose a partially parsed release.
- [ ] The attributed fixture feeds the patent-spine acceptance case.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/uspto-ptmnfee2-ingest/GOAL.md)" -le 4000
jq . goals/uspto-ptmnfee2-ingest/ops/manifest.json
rg -n "uspto-ptmnfee2-ingest|GOAL.md|agentLaunchers|packetAnchorDocument" goals/uspto-ptmnfee2-ingest
git diff --check -- goals/uspto-ptmnfee2-ingest
bun run beep yeet verify
```

Stop before P1 if the current layout, companion vocabulary, or access behavior
is unverified; stop before unnamed credentials, cost, destructive state, or a
fork of the shared generator.

Done only when full-replace, deterministic refresh, fixture attribution,
patent-spine contract, reflection, and Yeet/GitHub mergeability are green;
otherwise report blockers with file/command evidence.
