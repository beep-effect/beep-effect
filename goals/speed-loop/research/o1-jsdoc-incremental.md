# Opportunities 1 + 7: incremental JSDoc inventory and Yeet attempt journal

Date: 2026-08-04  
Checkout: `/home/elpresidank/YeeBois/projects/beep-effect3`, PR #548 branch  
Method: read-only source inspection. No build, inventory regeneration, install, or network call was run.

## Executive recommendation

1. Put the Yeet attempt journal in **PR-A (instrument hygiene)**. It is a small extension of the same `attemptId`, run timing, and failure-attribution lifecycle, and delaying it would cause the newly instrumented verdicts to continue overwriting the very history the instrumentation is meant to create. Use two schema-decoded NDJSON event types per branch: `attempt-started` before execution and `attempt-finished` containing the exact terminal verdict after execution.
2. Put incremental JSDoc inventory in a **dedicated follow-on PR**. It changes the inventory's trust boundary, cache invalidation rules, generated-artifact assembly, CLI/CI behavior, and tests. The lowest-risk first implementation is a CLI-owned, content-addressed package-shard cache with a mandatory cold/full parity mode. Turbo remote-cache integration is a second step only if ephemeral hosted runners cannot restore the CLI cache economically.

The JSDoc change should turn a typical one-package ratchet run from roughly 230 seconds into an estimated **8–25 seconds** (about **89–97% saved**). This is a model, not a measurement: the prompt prohibited running the inventory. Instrument the phases in the implementation PR and reject the design if package analysis is not at least 85% of cold wall time.

## A. Incremental JSDoc inventory

### A1. Current pipeline map

#### Command/lane flow

The CI descriptor declares `jsdoc-ratchet` required, CLI-runnable, and exact-replay, explicitly documenting that inventory precedes ratchet (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:441-447`). Its plan is two serial commands:

1. `beep quality jsdoc-inventory --output-json .beep/ci/jsdoc-documentation.inventory.jsonc --output-markdown .beep/ci/jsdoc-documentation.inventory.md`.
2. `beep quality jsdoc-ratchet --inventory .beep/ci/jsdoc-documentation.inventory.jsonc`.

Those exact arguments are assembled at `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:829-845` and locked by a plan-shape test at `packages/tooling/tool/cli/test/ci-lane.test.ts:122-143`.

The ratchet then:

- decodes only the generated document's `totals` field (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts:149-156,264-277`);
- selects 20 named metrics for the committed baseline (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts:30-55,312-321`);
- fails if a baseline metric disappeared or any tracked value grew, and reports decreases as tightening opportunities (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts:335-379`);
- independently scans files changed from `origin/main...HEAD` plus dirty paths for legacy `@remarks`/`@example` cleanup-on-touch (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts:450-486`), after the totals comparison (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts:581-596`).

Therefore incremental inventory must not absorb or weaken cleanup-on-touch. That is already a separate, cheap changed-files gate.

#### Inventory inputs

The full builder resolves:

- the workspace-package map and ordered package universe (`discoverWorkspacePackages` plus `bun run topo-sort` output);
- the tracked-file set from `git ls-files` when `.git` exists;
- root `tsdoc.json` policy;
- each package's `package.json`-derived workspace metadata, optional `docgen.json`, and eligible tracked files beneath its configured `srcDir`.

The orchestration is visible at `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1439-1467`. Package analysis reads `docgen.json`, derives `srcDir` and exclude globs, walks source files, then filters by the global tracked-path set and docgen exclusions (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1111-1135`). The recursive source walk canonicalizes paths, rejects cycles, skips build/vendor directories, filters extensions/suffixes, and returns sorted paths (`packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts:503-582`).

The cache key must consequently include **path and content**, not merely Git diff membership or mtime. It must also encode whether each candidate path is tracked, because untracked source is deliberately excluded.

#### Per-package structure and analysis independence

For each package, the analyzer creates a new in-memory ts-morph project, adds each eligible source file, inventories direct exports/re-export declarations, and derives module and export findings (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1136-1167`). Re-export declarations are scored as graph edges without following the target symbol (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:834-882,1013-1033`), and exported declarations are retained only when their declaration belongs to the current source file (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1074-1094`). This is the key locality proof: the current package result does not depend on another package's analyzed result.

Each `PackageInventory` contains identity/order/status, source and docgen coverage, package-local counts, module entries, and export entries (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:112-138`). Counts and status are calculated solely from that package's collected entries (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1169-1215`). Packages emitted by topo-sort but missing workspace metadata get a deterministic synthetic shard (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1218-1251`).

Today packages are analyzed with `concurrency: 1` (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1458-1467`). The committed inventory currently reports 134 packages, 2,363 public modules, and 15,522 public exports (`standards/jsdoc-documentation.inventory.jsonc:64-69`), and the JSONC artifact is about 15.9 MB. This combination strongly suggests that repeated parsing/AST inspection, not the final 20-number comparison, dominates.

#### Root policy, aggregate totals, and outputs

Root policy is independent of packages: it reads `tsdoc.json` and checks that four custom tags appear in both `tagDefinitions` and `supportForTags` (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1253-1282`).

All repo totals are reductions over package status, coverage, and counts, plus one `rootPolicyOpen` bit (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1284-1317`). There is no second semantic pass across module/export entries. Markdown rendering iterates the already-built totals, root policy, packages, and open findings (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1354-1428`). JSONC formatting and both artifact writes happen only after the complete inventory is assembled (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1494-1529`).

### A2. Recommended changed-packages-only design

#### Cache unit and schemas

Extract the existing private structural types into Effect Schemas and make the package shard the decode boundary:

```ts
const JSDocInventoryShard = S.Struct({
  standard: S.Literal("jsdoc-inventory-shard"),
  schemaVersion: S.Literal("1"),
  analyzerVersion: S.String,
  packageName: S.String,
  packagePath: S.String,
  inputSha256: Sha256Hex,
  inventory: PackageInventory
})

const JSDocInventoryCacheIndex = S.Struct({
  standard: S.Literal("jsdoc-inventory-cache-index"),
  schemaVersion: S.Literal("1"),
  entries: S.Array(S.Struct({
    packageName: S.String,
    packagePath: S.String,
    inputSha256: Sha256Hex,
    shardPath: S.String
  }))
})
```

`PackageInventory` and nested entries/counts should themselves be schemas rather than `JsonRecord` intersections. Decode every hit; a corrupt, wrong-version, wrong-package, or wrong-hash shard is a cache miss, never an inventory failure. Keep `topoOrder` out of the cached semantic payload (or overwrite it on merge), because order can change without package content changing.

Recommended local layout:

```text
.beep/cache/jsdoc-inventory/v1/
  shards/<safe-package-name>/<input-sha256>.json
  index.json
```

The shard filename is content-addressed, so an interrupted write cannot make a different input appear current. Write temp + rename, then update the advisory index. The index accelerates lookup but is not authoritative; the decoded shard and hash are.

#### Exact package input hash

Hash a canonical, length-delimited stream containing:

1. a literal analyzer/schema version (bump for every rule, parser, output-shape, or eligibility change);
2. package name and repo-relative package path;
3. the relevant workspace metadata from `package.json`;
4. `docgen.json` content or an explicit missing marker;
5. for every eligible source candidate in sorted repo-relative order: path, tracked/untracked marker, byte length, and SHA-256 content digest.

Do not key only on changed paths, mtimes, the Git tree SHA, or package directory bytes. The effective input includes docgen exclusions and tracked-state filtering (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1119-1135`), while the analyzer's rule set is compiled into the CLI (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:39-89,171-176`). The version is therefore a required explicit global invalidator.

This mirrors the useful parts of docgen proof manifests: typed standard/schema markers and per-file SHA-256 rows (`packages/tooling/tool/docgen/src/ProofManifest.ts:132-162,252-269`), sorted file digests (`packages/tooling/tool/docgen/src/ProofManifest.ts:308-357`), and current/stale verification by input and tool version (`packages/tooling/tool/docgen/src/ProofManifest.ts:530-578`). It should not copy docgen's output fingerprint because an inventory shard is itself the cached output.

#### Execution algorithm

1. Always rediscover the package universe and topo order, tracked-path set, and root policy.
2. For every current package, compute its effective input hash. Hashing may run with bounded concurrency (for example 8); analysis misses should begin conservatively at concurrency 1 to preserve today's memory behavior.
3. Decode a matching shard. On miss/stale/corrupt, call the existing `analyzePackage`, strip/normalize `topoOrder`, and atomically persist the shard.
4. Drop cached packages no longer present from the merge (physical garbage collection can be separate).
5. Reapply current topo order, merge hit and rebuilt shards, recompute root policy and all totals, then render the complete JSONC and Markdown exactly as today.
6. Emit cache telemetry: package count, hits, misses by reason, hash/scan/merge/render/write milliseconds, and bytes read/written. Add `--no-cache` (authoritative cold path) and `--cache-dir` for tests/CI.

The generated inventory remains a **complete snapshot**, not a changed-package report. The ratchet remains unchanged because it still sees all totals and all 20 metrics.

#### Turbo versus CLI-owned cache

Start CLI-owned. It is the smallest seam around the existing `analyzePackage`, avoids adding a script to 134 workspaces, and can reuse package-local proof-manifest hashing patterns already in the repo. It materially accelerates repeated local Yeet runs whenever `.beep/cache` survives.

However, `.beep` is gitignored (`.gitignore:106-107`), so a fresh hosted runner gets no hits unless CI restores that directory. There are two deployment options:

- **Small follow-on:** persist `.beep/cache/jsdoc-inventory/v1` through the existing CI cache mechanism, keyed broadly enough to restore the prior branch/base cache; content-addressed shards make cross-head reuse safe.
- **Turbo-native follow-on:** create a genuine per-workspace shard task whose inputs are `src/**`, `package.json`, `docgen.json`, and explicit global rule inputs, with the shard as a declared output. Turbo remote cache then supplies unchanged shards. This offers the best hosted reuse but is materially larger: task/script rollout, output-path conventions, packages without public surfaces, and root merge orchestration.

A root Turbo task over the whole inventory is not incremental: its cache key changes whenever any package changes. A Turbo query used only to select “affected” packages is also insufficient unless every unaffected package has a trusted shard available.

### A3. What can break and correctness argument

#### Cross-package aggregates

Nothing semantic currently crosses package boundaries. Package status/counts are local (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1169-1215`), while repo totals are associative sums/counts over the package array (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1284-1317`). Reapplying current topo order is enough for deterministic output ordering. Package add/delete/rename and topo-only changes must still rebuild the universe/merge, but unchanged content shards remain valid.

#### Root-policy and global-rule changes

`tsdoc.json` is evaluated fresh every run, so its change cannot be masked by package cache (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1253-1282`). Changes to compiled rules, required tags, parsing helpers, ts-morph behavior, or output schema are not package bytes; they must invalidate all shards via `analyzerVersion`. Automate that version from a hash of the analyzer's transitive implementation inputs if maintainable; otherwise make a literal version bump mandatory and test it.

The policy Markdown and JSDoc skill are recorded as source metadata but are not read by the analyzer (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1469-1484`). If policy edits are intended to change enforcement, the corresponding analyzer change/version bump is the operative invalidation. Including the policy file hash defensively is cheap and prevents ambiguity.

#### Re-exports and package dependencies

The analyzer records a re-export declaration itself and deliberately does not score its target (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:834-882`). It filters resolved declarations to the current source file (`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1085-1089`). Thus a dependency's documentation change cannot affect another package's shard under current semantics. If a future analyzer follows symbols across package boundaries, this proof becomes false; either hash the transitive dependency surface or bump the shard format and disable reuse until dependency-aware invalidation exists.

#### Correctness theorem

For analyzer version `V`, let `P_i` be the canonical effective input stream for current package `i`, and `A_V(P_i)` the deterministic existing package analyzer. A shard hit is accepted only when its decoded `(V, packageName, packagePath, sha256(P_i))` matches current values. Therefore the cached package payload equals the payload a cold run would compute, assuming `A_V` is deterministic and package-local. The full package list and order are rediscovered, root policy is recomputed, and totals/rendering are pure functions of those values. Consequently cached and cold runs must be byte-identical after normalizing the intentionally variable `generatedAt` and cache telemetry (which should not enter canonical artifacts).

### A4. Estimated saving and implementation size

Observed structural work is 134 serial package analyses over 2,363 modules/15,522 exports, followed by reductions and rendering (`standards/jsdoc-documentation.inventory.jsonc:64-69`; `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1458-1467`). Given the reported 230-second cold runtime:

| Phase | Estimated cold share | Cold estimate | One-package warm estimate |
|---|---:|---:|---:|
| package walking, ts-morph parse, export/JSDoc analysis | 90–97% | 207–223 s | 2–8 s changed package |
| package hashing + shard decode | new | — | 2–8 s for all inputs/shards |
| universe/git/root-policy discovery | 1–3% | 2–7 s | 2–7 s |
| aggregate + 15.9 MB JSONC/Markdown render/write | 2–7% | 5–16 s | 4–12 s |
| **total** | | **~230 s** | **~8–25 s** |

For five average changed packages, expect roughly 15–35 seconds. A cold/no-cache run should remain near 230 seconds plus low-single-digit hashing/write overhead. Large packages will skew these estimates; phase timers are a shipping requirement.

Sizing for the recommended CLI cache:

- production: **350–550 LOC** across schemas/cache/hash orchestration plus a modest refactor of `JSDocDocumentationInventory.ts`;
- tests: **250–400 LOC** for fixtures, parity, invalidation, corruption, and add/delete cases;
- engineering: **3–5 focused days**, including benchmarks and review;
- Turbo-native hosted caching: add approximately **250–450 LOC/config lines** and **1–3 days**, depending on how workspace scripts are generated.

### A5. Falsification tests

The implementation is rejected or cache disabled on any parity failure.

1. **Warm/full golden parity:** run `--no-cache` and warm cached generation with fixed `generatedAt`; assert JSONC and Markdown byte identity.
2. **One-package mutation:** seed two packages, warm cache, change JSDoc/source in one; assert exactly one miss and full output equals cold output.
3. **Deletion/rename/addition:** remove a file, rename an exported symbol/file, add a package, delete a package, and change topo order; compare warm with cold every time.
4. **Tracked-state change:** transition an otherwise identical source between untracked and tracked; assert package hash/miss and cold parity, because tracked filtering is an input.
5. **Docgen configuration:** change `srcDir` and exclude globs, add/delete `docgen.json`; assert invalidation and cold parity.
6. **Global analyzer change:** change/bump `analyzerVersion`; assert zero shard hits. A test should fail if a rule-version fixture changes without invalidation.
7. **Root policy only:** edit `tsdoc.json`; assert package shards hit, `rootPolicyOpen` changes correctly, and cold parity holds.
8. **Corrupt/partial/wrong-package shard:** truncate JSON, alter schema version/hash/package identity; assert safe miss and replacement, never acceptance or lane failure.
9. **Re-export dependency mutation:** change only package B behind a re-export in A; assert A remains a hit and cached/cold output matches. This guards the current locality assumption.
10. **Performance falsifier:** on three cold and three warm runs, phase timers must show package analysis >=85% of cold time and one-package warm p50 <=25 seconds or >=80% improvement. Otherwise the optimization target/model was wrong.
11. **Ratchet equivalence:** feed cached and cold inventories into existing comparison tests; both must produce identical increases/decreases/missing metrics. Current fail-on-growth behavior is covered at `packages/tooling/tool/cli/test/quality-tasks.test.ts:862-908`.

## B. Append-only Yeet attempt journal

### B1. Current overwrite and lifecycle

`runIdForContext` is the sanitized branch plus the first 12 SHA-256 characters of that same branch, so it is stable across every attempt on a branch (`packages/tooling/tool/cli/src/commands/Yeet/internal/ArtifactPaths.ts:33-61`). Run artifacts live at `<packetDir>/runs/<runId>/<fileName>` (`packages/tooling/tool/cli/src/commands/Yeet/internal/ArtifactPaths.ts:79-109`). Therefore every attempt writes the same `verdict.json` path.

The verdict schema currently stores terminal `createdAt`, run identity, outcome, lanes, and optional supplemental artifacts, but no attempt identity or run start/end duration (`packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:178-201`). Step duration is measured around execution and retained in the in-memory recorder (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:185-208`), while `RepoStepRunResult` itself has no timing fields (`packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:341-366`). At terminal handling, Yeet builds the verdict and overwrites `verdict.json` (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:645-710`). Success and handled failure both route through that writer (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:767-786`), but a killed process writes no terminal verdict.

The quality-speedup audit already identifies stable-run-id overwrite and prescribes `startedAt`/`endedAt`/`elapsedMs`, `attemptId`, `failedStepId`, and `failureKind` (`goals/quality-speedup/research/quality-time-inventory.md:27-34`). The grill decision groups those changes into one schema-first instrument-hygiene PR (`goals/quality-speedup/history/2026-08-03-grill-decisions.md:28-32`).

### B2. Smallest durable design

Use one append-only NDJSON stream per stable branch run id:

```text
.beep/yeet/runs/<runId>/attempts.ndjson
```

Keep `verdict.json` as the latest-state compatibility snapshot used by status/PR tooling. The journal is history, not a replacement.

Use **two events**, because a terminal-record-only journal cannot distinguish “never started” from SIGKILL/power loss:

```ts
import { UUID } from "@beep/schema/String"
import * as S from "effect/Schema"

const YeetAttemptStarted = S.Struct({
  schemaVersion: S.Literal("yeet-attempt-journal/v1"),
  _tag: S.Literal("attempt-started"),
  attemptId: UUID,
  runId: S.String,
  branch: S.String,
  base: S.String,
  head: S.String,
  mode: S.String,
  startedAt: S.String
})

const YeetAttemptFinished = S.Struct({
  schemaVersion: S.Literal("yeet-attempt-journal/v1"),
  _tag: S.Literal("attempt-finished"),
  attemptId: UUID,
  recordedAt: S.String,
  verdict: YeetVerdict // enriched v2: startedAt, endedAt, elapsedMs,
                         // attemptId, failedStepId/failureKind, phase totals,
                         // and selected Turbo-summary reference
})

const YeetAttemptJournalEvent = S.Union([
  YeetAttemptStarted,
  YeetAttemptFinished
]).pipe(S.toTaggedUnion("_tag"))
```

In production, make these named/annotated schemas/classes and use the canonical branded `UUID`; the repo exports that schema at `packages/foundation/modeling/schema/src/String.ts:87-124`. Keep time fields encoded as canonical ISO strings consistently with today's verdict until the wider instrument PR chooses a stricter wire schema.

Lifecycle:

1. Generate one UUID `attemptId` and `startedAt` after context/plan hydration and before the first execution step. Append and `sync` one decoded/encoded `attempt-started` line.
2. Thread the same identity/timestamp through `BuildYeetVerdictInput`. Enrich the latest verdict with the instrument-hygiene fields.
3. On success or handled failure, write `verdict.json`, then append and `sync` one `attempt-finished` event embedding that exact schema-valid verdict. Embedding avoids maintaining a second drifting analytics projection.
4. Fleet ingestion pairs events by `attemptId`. A start with no finish after a conservative age threshold is `interrupted/unknown`; do not rewrite the journal to synthesize an outcome.
5. `--plan`, `status`, and pre-push-hook modes should not journal unless they are explicitly considered execution attempts. Today's execution excludes only status from verdict writes while plan returns before execution (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:767-786,859-864`); lock the intended mode set in tests.

The repo already has an Effect/FileSystem append-and-sync pattern: open with flag `"a"`, write newline-delimited records serially, then sync (`packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:890-919`). Extract/reuse a small generic append-NDJSON helper if it avoids duplication without broadening the PR.

#### Atomicity and malformed tails

- Encode and validate the whole event before opening the file.
- Make one bounded append call per event, include the trailing newline, and sync before returning.
- Serialize writers with a branch-journal lock or reuse the full-proof ownership mechanism. `O_APPEND` protects offsets but a multi-call `writeAll` should not be assumed safe against cross-process interleaving.
- The reader must decode line-by-line. A malformed non-final line is corruption and should be reported; one unterminated/malformed final line is a crash tail, reported and ignored for analytics rather than hiding all prior rows.
- Journal-write failure should be visible. For PR-A, make failure to write the **start** event fail closed (otherwise the attempt is knowingly unobservable); on terminal handling, preserve the primary Yeet error while loudly reporting a journal failure rather than replacing it.

#### Retention

Do **not** prune in the Yeet write path. That would make the hot path slower, turn append into rewrite, and make “permanent” conditional. NDJSON rows containing compact metadata and the bounded verdict are small relative to existing logs.

Recommended policy:

- local journal: retain indefinitely by default;
- fleet collector: checkpoint the last complete byte offset plus file identity and ingest idempotently by `attemptId + _tag`;
- optional future maintenance command: after confirmed fleet ingestion, rotate whole immutable monthly segments and retain at least 180 days locally. Never edit individual historical rows.

Because `.beep` is ignored (`.gitignore:106-107`), “permanent fleet analytics” ultimately requires collector ingestion; the journal makes attempts survive branch-level verdict overwrite, not disk loss or workspace deletion. Do not put hostnames, usernames, raw environment, command output, secrets, or absolute paths in journal identity fields.

### B3. Sizing and placement

Recommended PR placement: **PR-A instrument hygiene**, not a follow-on.

Why: `attemptId` must be created before execution and carried into the terminal verdict. Implementing the fields without the journal immediately discards all but the newest attempt, reproducing the audit gap (`goals/quality-speedup/research/quality-time-inventory.md:27-34`). The journal itself is approximately:

- **120–220 production LOC**: schemas, path helper, append/read utility, lifecycle plumbing;
- **150–250 test LOC**: encode/decode, append ordering, failure/success, interruption-tail fixtures, concurrency/retention contract;
- **1–2 focused days** inside PR-A.

If PR-A scope pressure is severe, the irreducible slice is: schema + start append + terminal append + decode tests. Reader/reporting CLI and rotation may follow, but the writer must land with `attemptId` so history begins immediately.

### B4. Falsification tests

1. **Same branch, two attempts:** run two fixture attempts with the same stable `runId`; latest `verdict.json` equals attempt 2, journal contains two starts and two finishes with distinct UUIDs and preserved attempt-1 verdict.
2. **Handled failure:** force a step exit failure; start and finish share `attemptId`, finish contains `outcome: failure`, the correct `failedStepId`/`failureKind`, and real non-negative timing.
3. **Hard interruption:** child fixture appends start and is killed before terminal handling; journal retains exactly one unmatched start and prior attempts remain readable.
4. **Schema round-trip:** every emitted line decodes as `YeetAttemptJournalEvent`; the embedded finished verdict decodes as the canonical enriched verdict schema.
5. **Crash tail:** append half a JSON row without newline; reader returns all prior events plus one explicit tail warning, not an empty history.
6. **Corrupt middle:** malformed newline-terminated row in the middle is surfaced as corruption and is not silently skipped.
7. **Concurrent writers:** two processes append bounded events to the same branch journal; every line independently decodes and event counts/IDs match. If this fails, the writer lock is mandatory.
8. **Journal write failure:** unwritable start path prevents execution; terminal append failure preserves the original Yeet result/error and emits a prominent secondary diagnostic.
9. **Mode contract:** `plan` and `status` produce no attempt events; every agreed execution mode produces them exactly once.
10. **Fleet idempotency:** ingest the same file twice and then ingest a grown file; dedupe by `(attemptId, _tag)` and add only new complete rows.
11. **Coverage target:** after two weeks, >95% of finished journal attempts have nonzero/credible run timing and all failed terminal attempts have a failure stage or explicit `unknown`, matching the existing audit's success criterion (`goals/quality-speedup/research/quality-time-inventory.md:161-170`).

## Proposed PR sequence

| PR | Scope | Exit proof |
|---|---|---|
| **PR-A: instrument hygiene** | enriched verdict/RepoRun timing and failure fields; `attemptId`; two-event append-only journal; existing fallow/agent-effectiveness instrument fixes | schema decode tests; same-branch two-attempt preservation; handled failure; killed-process unmatched start; append corruption/concurrency tests |
| **PR-B: incremental JSDoc inventory** | typed package shards; canonical hash; local cache; full merge/totals/render; telemetry and `--no-cache` | fixed-time warm/cold byte parity; all invalidation tests; one-package p50 <=25 s or >=80% saving |
| **PR-C only if needed** | CI cache restore or Turbo per-package shard task | fresh-runner cache-hit proof; hosted JSDoc Ratchet p50 over 20 runs; no cold/warm parity delta |

This ordering starts collecting trustworthy historical timing immediately, while giving the cache correctness work its own reviewable proof surface.
