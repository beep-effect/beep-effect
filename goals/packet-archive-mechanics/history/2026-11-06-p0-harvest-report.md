# P0 slice 1 report: `beep goals harvest` (2026-11-06)

## Files

- New: `packages/tooling/tool/cli/src/commands/Goals/Harvest.schemas.ts` (HarvestSource,
  HarvestKind, HarvestRowId, HarvestPacketRef, HarvestRowDraft, HarvestRow,
  HarvestLedgerHeader, HarvestLedger), `Harvest.service.ts` (HarvestProjector,
  HarvestProjectorLive, JSONL render/parse, source parsers), `Harvest.ts` (command).
- Changed: `Goals.errors.ts` (HarvestError + HarvestErrorReason), `Goals.command.ts`
  (registration), `Goals/index.ts` (barrel), `Lint/ReflectionArtifact.ts` (exports
  `ReflectionFrontmatter` and `decodeReflectionFrontmatterText`; lint reuses it).
- Test: `packages/tooling/tool/cli/test/commands/Goals/Harvest.test.ts` (6 tests).
- Ledger: `explorations/packet-archive-and-alpha-harvest/research/harvest/ledger.jsonl`.

## Real run (`bun run beep goals harvest --kind all`, source commit c86f3b3183)

6,629 rows: reflection-finding 1,098; reflection-todo 643; friction-receipt 2,170;
plan-unchecked 1,394; status-note 146; stop-condition 1,105; decision-file 23;
open-question 50. 4,719 rows are terminal. No duplicate ids. Every row resolved a
line (no fallback to line 1). `--check` passes right after the write.
`infra/r2-cache/research/OPPORTUNITIES.md` is read but has no `## ` sections, so it
contributes 0 receipts.

## Deviations from P0-DESIGN.md

1. `HarvestRow.packet` is `S.NullOr(HarvestPacketRef)` and `status` is
   `S.NullOr(PacketStatusToken)`: a ledger outside any packet has neither. This follows
   the conclusion of design section 1.
2. `HarvestProjector` methods have `R = never`. The Live layer captures FileSystem, Path,
   ChildProcessSpawner, SecureRandom and Digest, because git (HEAD and `ls-files`) and
   sha-256 need more than FileSystem | Path. I added a `read` method so `--check` can run.
3. `--check` ignores `sourceCommit` and every row's `commit` as well as `generatedAt`.
   Committing the ledger moves HEAD, so a check that compared commits could never pass.
4. Commit shas reuse `GitCommitSha` (Codex/Findings.capture.schemas). I did not add a
   second `GitObjectSha`; the archive slice can import or promote it.
5. `HarvestRowId` is the branded `Sha256Hex` from `@beep/schema/Sha256`.
6. Non-packet ledgers are read only with `--kind all`. Ledgers under `_template` are
   skipped. `plan-unchecked` covers both PLAN.md and SPEC.md, as the brief asked, which
   explains why there are 1,394 rows rather than the design's estimate of about 90.
7. The test lives at `test/commands/Goals/Harvest.test.ts`, as the brief asked. The
   package's other tests sit flat as `test/goals-*.test.ts`.
8. `.gitleaks.toml` gets a narrow allowlist. gitleaks' sourcegraph-access-token rule
   reported every 40-hex row `commit` in the ledger (6,631 findings, all commit shas),
   so the allowlist covers that rule on this ledger path for exact 40-hex secrets only.
   The pre-commit hook also regenerated the repo-cli instrumentation and schema catalogs.

## Verification

- `bun run beep quality package-verify @beep/repo-cli --quick`: `ok lint`, `ok check`.
- Full `package-verify`, run 1: `ok audit`, `fail docgen` (missing JSDoc on the
  `HarvestError.message` getter). After the fix, `docgen:local` exits 0.
- Full `package-verify`, run 2: `fail audit`, `ok docgen`. The audit failure is 3 tests in
  `test/yeet-pr-wave-notifier.test.ts` ("W9 monitor escalation", each a 30 s timeout).
  They passed in run 1 on the same code apart from a doc comment, and that file imports
  nothing this slice touches. They still fail when the file runs alone, so this is
  unrelated to the slice and probably environmental.
- `Harvest.test.ts`: 6/6 pass. `goals harvest --check`: OK at 6,629 rows.
