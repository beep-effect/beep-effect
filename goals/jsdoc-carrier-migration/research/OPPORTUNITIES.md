# Opportunities & friction ledger

Receipts recorded at the moment of friction, per the repo friction-capture law.

## 2026-08-06 — P1 codemod build

### `A.makeBy` silently clamps its size to 1

- **What happened:** the synthetic-title generator used `A.makeBy(record.exampleTagCount, ...)`
  to build one placeholder per `@example` tag. For remarks-only blocks (`exampleTagCount = 0`)
  effect's `makeBy` returned a 1-element array — its `NonEmptyArray` contract clamps `n < 1`
  to 1 — so every remarks-only block failed the title-count check.
- **Evidence:** first full-corpus dry run of `beep quality jsdoc-migrate apply --dry-run
  --synthetic-titles` aborted with dozens of
  `title-count-mismatch: block has 0 @example tag(s), record has 1 title(s)` errors
  (e.g. `packages/drivers/duckdb/src/index.ts#<fileoverview>#0`), costing one corpus-scale
  run (~1 min) plus a repro cycle to attribute.
- **Prevention:** a lint or tsgo diagnostic flagging `A.makeBy` calls whose size argument is
  not provably ≥ 1 would surface the clamp at write time; alternatively an `A.makeBy0`-style
  wrapper in `@beep/utils` with a plain-`Array` return for possibly-zero sizes.

### Census figures were regex-derived and diverged from the gate's scanner

- **What happened:** three P1 measurements disagreed with `research/corpus-census.md`:
  affected blocks 11,674 vs 13,265 (the census's `/\*\*[\s\S]*?\*\//` block regex is not
  fence-aware and over-splits blocks whose examples contain `/**`), unfenced examples 31 vs
  114 (the census counted any `@example` not *immediately* followed by a fence, which
  includes caption-then-fence blocks the codemod converts cleanly), and the "zero collision"
  claim missed 188 bare untitled `**Example**` markers sitting directly above a legacy
  `@example` tag (its query grepped for `**Example** (` with the paren).
- **Evidence:** `beep quality jsdoc-migrate extract` summary line
  (`files=1899 blocks=11674 multiExample=19 remarks=495 unfencedExamples=31`) and the first
  dry-run manifest showing 188 `mixed-example-carriers` quarantines, later resolved by the
  stray-marker consumption rule.
- **Prevention:** the census itself predicted this ("`beep quality jsdoc-migrate extract`
  supersedes this document in P1") — the durable fix is to regenerate census numbers from
  `extract.jsonl` and never quote the ad-hoc regex figures once an extract exists. The two
  stable-tail figures (19 multi-example, 114 unfenced) were load-bearing in planning; only
  the 19 survived contact with the gate-consistent scanner.

### Schema-first inventory entries are line-pinned and go stale on unrelated edits

- **What happened:** the four documented schema-first exceptions for the P1 codemod carry a
  `"line"` field. Adding `@param`/`@returns` doc lines to the same files shifted every pinned
  line by two, which made the exceptions "stale inventory entry" errors and failed the next
  full `yeet verify` lint lane — a whole verify cycle (~8 min) to learn a doc edit moved a line.
- **Evidence:** round-5 verify log: `Stale schema-first inventory entry is no longer present in
  the live scan` for `computeJSDocMigrateBinding` (line 176 → 178) and three siblings.
- **Prevention:** key advisory exceptions by `file#symbol#ruleId` alone, or treat `line` as
  display metadata rather than part of the match key; `--write` refreshing lines without
  resetting a reviewed `status: "exception"` would also close the loop.

### `beep sync-data-to-ts --target iana-timezones` was dead for months and nothing noticed

- **What happened:** P2's regeneration of iana-timezones failed before rendering:
  `extractArchiveTextEntries` matched tar entries with bare `Str.endsWith(suffix)`, so the
  tzdata entry `australasia` matched the requested suffix `asia`, tripping the duplicate-entry
  guard. The matcher landed in PR #456; the last successful regeneration was PR #326
  (2026-07-08) — a checked-in generated file was silently unreproducible with no gate
  reporting it.
- **Evidence:** `Archive contains duplicate entry for asia. (file=australasia)`;
  `tar -tzf tzdata-latest.tar.gz` lists both `asia` and `australasia`. Fixed in P2 with a
  segment-aware match (`path === suffix || endsWith("/" + suffix)`), after which the target
  regenerated cleanly (tzdb 2026b → 2026c, zero identifier changes).
- **Prevention:** a drift lane that periodically regenerates each generated file and diffs
  would have caught this the week it broke. Any target whose generator cannot run is
  invisible until someone needs its output.

### acp `schema.gen.ts` regeneration is a staleness bomb — deferred to its own PR

- **What happened:** regenerating acp with the current emitter + `@effect/openapi-generator`
  4.0.0-beta.103 produces a 16,607-line rewrite of which only ~684 lines are the carrier
  conversion. The rest is materialized staleness: +171 `SchemaUtils.withCodecStatics`, 328
  `S.Unknown` → `S.Json`, inline schemas → `S.suspend` cross-references, changed emission
  order, and dozens of `schemaNumber` (TS377098) governance errors — the regenerated file
  cannot pass `bun run check` at all, and `S.Json` breaks the hand-authored
  `Acp.errors.ts` call site.
- **Evidence:** control run of the UNMODIFIED emitter produced 6,202 insertions / 9,337
  deletions; `bun run check` on the regenerated file fails with repeated TS377098; acp's
  `beep:audit` does not run `generate`, so no gate ever regenerated it.
- **Prevention / follow-up:** P2 shipped the emitter conversion and the clean `meta.gen.ts`
  but reverted `schema.gen.ts` to HEAD (still carries 342 `@example`). An acp-resync PR must
  land before the packet's DoD item 2 (all generated files law-compliant in
  generated-inclusive scope) can close: fix S.Number/S.Finite emission or suppression
  policy, align `Acp.errors.ts` with `S.Json`, and prove typecheck + tests.

### Volatile upstream digests ride along in any regeneration PR

- **What happened:** two generators hash moving targets into checked-in output:
  cldr-territories digests the GitHub `/releases/latest` API response body (volatile
  server-side JSON; release identity unchanged), and ai-sync's source-metadata digests
  schemastore/modelcontextprotocol main-branch URLs (4 hashes drifted before any edit).
- **Evidence:** `cldr-latest-release` sha256 changed while releaseTag 48.2.0 and both pinned
  raw.githubusercontent digests stayed byte-identical; ai-sync pre-edit control run showed
  the same 4 contentHash changes as the post-edit run.
- **Prevention:** hash pinned artifacts (tag URLs), not `latest` API bodies; treat
  moving-target digests as advisory metadata rather than diffable output.

### The census's generated-surface count missed header-generated and apps/ generators

- **What happened:** "18 generated files, 9 emitters" was path-pattern derived
  (`.generated.ts$|/_generated/|/generated/`). It missed `Html.model.ts` + `Html.meta.ts`
  (generated-by-header, 350 examples — the gate's `isGeneratedSourceFile` already excludes
  them from cleanup-on-touch) and a 10th repo-owned generator entirely:
  `apps/professional-desktop/scripts/sync-migration-bundle.ts`, whose output
  `Migrations.gen.ts` lives outside `packages/**` and would have re-introduced `@example`
  on every migration sync after P3.
- **Evidence:** P2 conversion surface was 21 outputs / 10 emitters, not 18 / 9.
- **Prevention:** enumerate generated surfaces by asking the gate (`isGeneratedSourceFile`,
  header probe included) across the whole repo, not by path regex under `packages/`.

### No cheap "check these N files" entry point for the documentation shape rules

- **What happened:** three P2 agents independently hand-wired scratchpad validators (one
  imported `documentationShapeViolations` directly, two wrote throwaway parsers) because the
  real rules are only reachable via repo-wide `jsdoc-ratchet` or the frozen-extract
  `jsdoc-migrate verify` pipeline.
- **Evidence:** converter/reviewer reports in the P2 workflow (`wf_b6a1e831-5bd`).
- **Prevention:** a `beep quality jsdoc-check <path>...` subcommand that runs
  `documentationShapeViolations` on explicit paths would make scoped agent verification a
  one-liner.

### A post-closeout "fix" commit silently deleted 146 migrated Example blocks

- **What happened:** after P3 closed the packet, commit `78ac876c26` ("clear jsdoc-carrier
  fallow attribution and JSDoc baseline", subject-only message) hand-deleted 1,462 lines /
  ~146 titled Example sections across 52 files — `{@inheritDoc}` type-level companions the
  codemod had just migrated — leaving the shipped conservation proof
  (`data/jsdoc-migrate.proof-manifest.jsonc`, `conservationViolations: 0`) describing a tree
  that no longer existed, with `extract.jsonl`/`titles.jsonl` records dangling. The deletion
  was law-permissible (type-level Examples are optional) but forced by nothing: restoring
  all 52 files reproduced `fallow audit --check --base origin/main` exit 0 / `introduced: 0`
  — the same commit's `fallow-ignore-next-line` suppressions and `.fallowrc.jsonc` waiver
  were what actually cleared the attribution.
- **Evidence:** adversarial audit of PR #608 (workflow `wf_34316a3a-e48`); restore verified
  by fallow audit, `jsdoc-ratchet` both scopes exit 0, and `@beep/schema` docgen exit 0.
  The deletion also self-inflicted the baseline bump it papered over:
  `multiple-description-paragraphs` returned to 543 matching the committed baseline once
  the docs were restored.
- **Prevention:** the zero-hand-edits invariant applies until merge, not until closeout;
  any post-closeout commit touching migrated files must re-run `jsdoc-migrate verify` and
  disclose doc deletions in the commit body.

### The generated-inclusive scope was proof-only until it was wired into CI

- **What happened:** SPEC row 6's `--include-generated` check existed but no CI lane, script,
  or yeet step invoked it — the acp `schema.gen.ts` allowlist was unenforced, nothing would
  have caught a new legacy carrier in any other generated file, and nothing would force the
  allowlist's removal at acp-resync time. Separately, `apps/**` holds 282 legacy carriers in
  91 files that no gate scans at all (`git ls-files packages` corpus).
- **Evidence:** `rg include-generated .github packages/tooling/tool/cli/src/commands/Ci`
  had zero hits before this fix; audit finding "generated-inclusive proof is inert".
- **Prevention:** the hosted `ci:jsdoc-ratchet:ratchet` step now passes
  `--include-generated` (superset scope: everything the non-generated scan catches, plus
  generated files minus the one allowlisted residual). The `apps/**` scope gap is a
  candidate follow-up: extend the corpus or add an apps-scoped totals metric.
