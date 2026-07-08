# P1 property-lane evidence (Verification Matrix rows 4–6)

Evidence trail for orl-010/011/012 (D3, R2, fence 3).

## Row 5 — numRuns floors

- Helper: `@beep/test-utils` `fcRuns(inline?)` →
  `max(inline ?? 100, BEEP_FC_NUM_RUNS)`; 6 unit tests incl. a live
  `configureGlobal` floor probe and the never-lower guarantee (fence 3).
- Codemod (`goals/one-round-loop/ops/codemods/numruns-fcruns.codemod.ts`)
  golden-diff tested (rewrite, idempotence, negative), following the
  crispening harness.
- Sweep: 144/158 files rewritten (211 `fc.assert` sites) + 7 hand-rolled
  local wrappers migrated manually. **Floor invariant proven**: the
  removed `numRuns:` literal multiset equals the added `fcRuns(...)`
  multiset exactly (6×5, 8×10, 1×15, 3×16, 15×20, 70×25, 1×32, 101×50,
  5×100, 1×200).
- `it.prop`/`test.prop`: the repo's only two sites (drivers/pacer) pass
  NO fastCheck params — covered by the `configureGlobal` floor; zero
  param-carrying sites exist to migrate (fresh inventory,
  `research/p1-numruns-inventory.md`).
- Ledgered non-migrations: pacer `fc.sample(..., { numRuns: 24, seed })`
  (seeded fixture volume, not a law);
  `assertSchemaArbitraryDecodesToSelf` option objects (the helper
  routes through `fcRuns` internally).

## Row 4 — property lane catches a seeded non-round-tripper

- Lane: `beep ci lane property` → dedicated turbo task `test:property`
  (87 packages; `BEEP_FC_NUM_RUNS` declared in task `env` — own cache
  key, deliberately NOT passThroughEnv per R2), 400-run default floor.
- FAIL leg: seeded fixture
  (`assertSchemaArbitraryDecodesToSelf(S.NumberFromString, ...)` — the
  Type-side arbitrary cannot decode through the encoded-side codec) →
  `beep ci lane property --affected --base origin/main` exited 1.
- PASS leg: seed removed → lane green (run recorded below).

### First-sweep finding (timeout scaling)

The first 400-floor sweep failed 5 `@beep/agents-use-cases` tests —
ALL `Test timed out in 30000ms`, zero law violations (14/14 pass at
inline floors). Deep sweeps scale wall time like coverage
instrumentation does, so `vitest.shared.ts` now grants the same 180s
cap when `BEEP_FC_NUM_RUNS` is active (`fcDeepSweepActive`, beside the
existing `vitestCoverageRunActive` precedent). Post-fix: 14/14 green at
400; full lane sweep 86/87 → 87/87.

## Row 6 — nightly sweep

- `.github/workflows/property-laws-nightly.yml`: `schedule` +
  `workflow_dispatch` (runs input, default 1000), `issues: write`;
  failure opens/updates ONE tracking issue (stable title "Nightly
  property-law sweep failures", label `property-laws-nightly`).
- Manual-dispatch verification is a POST-MERGE step: workflow_dispatch
  only registers once the file reaches the default branch (P0 lesson,
  evidence §1). To be executed and recorded immediately after the P1 PR
  merges.

## Lane wiring (D3)

- check.yml gains the `property-laws` job (context name **Property
  Laws**, frozen at introduction; NON-required — the ruleset 10240248
  addition is a P4 close criterion after a stable green history).
- `beep ci lane --list` now enumerates 22 descriptors; the lane carries
  `--runs` (floor override; raise-only semantics via fcRuns).
- `beep ci local` battery includes the property lane (affected shape
  passthrough; not skipped by `--fast`).

## Row 4 addendum — live catch on the P1 PR itself (2026-07-08)

The property lane caught a **pre-existing non-round-tripping schema on
the P1 PR's own CI run** — the packet's thesis proving itself:

- `@beep/box` `BoxError` fails equivalence round-trip for an
  empty-message `Error` cause (`new Error("")`, seed 1731503382, first
  counterexample at test #216). Invisible at the pre-P1 inline value of
  25 runs; surfaced once the lane raised the floor to 400.
- Encode→decode succeeds; line 180's `Equal.equals || toEquivalence`
  assertion is what fails (the decoded empty-message Error is not
  equivalent to the original).
- SPEC stop-condition disposition: this is product work (fixing the Box
  cause codec could change wire shape — fence 4 bars it here). Filed as
  a spawned task; the single `assertSchemaRoundTrip(B.BoxError)` call is
  seed-excluded via `assertSchemaRoundTripPinned` (hard `{ numRuns: 25 }`,
  its original value — no floor lowered, fence 3 intact). The other
  three Box schemas stay env-raisable. Remove the pin when the codec is
  fixed.

## Review-fix findings (PR #327)

- **Dependency cycle (blocking).** The sweep introduced the first
  `@beep/test-utils` import into 55 packages; declaring it as a devDep
  in the three that are in test-utils's OWN dependency closure
  (`@beep/utils`, `@beep/schema`, `@beep/pglite`) created a turbo cycle
  (`utils→data→schema→pglite→test-utils→…`), failing every affected
  turbo lane instantly. Those three keep the undeclared import (always
  resolvable — test-utils depends on them, so they are always
  installed); the other 52 declare it. This is the reason foundation
  packages never declared test-utils before.
- **Blank `--runs` floor drop.** `resolvePropertyLaneRuns` normalizes a
  blank/whitespace `--runs` back to 400 (`??` only guards `undefined`).

## Review-fix round 2 (PR #327 CI failures, all diagnosed locally)

CI on the review-fix push went red on 9→3 lanes; each root-caused and
fixed without a wasted round beyond the discovery:

1. **Dependency cycle** (fixed prior commit): 3 closure packages reverted.
2. **Repo Sanity → tsconfig-sync**: adding test-utils devDeps to 52
   packages requires their tsconfig `references` (+ docgen fields) to
   mirror it — `bun run config-sync` synced 100 files (cycle packages
   correctly excluded).
3. **Repo Sanity → fallow-boundaries-config**: the new dep edges change
   the boundary graph — `fallow:boundaries:write` regenerated it.
4. **Coverage → @beep/test-utils SqlTest.test**: my earlier `Bun.env`→
   `Config` change (to satisfy the processEnv law + the "Cannot find
   name 'Bun'" surfaced when the sweep pulled SqlTest into consumer
   typechecks) broke the gate's RUNTIME env observation (Config
   snapshots at boot). Fixed by reading `process.env` (live, Node-typed
   — no Bun global) with `@effect-diagnostics-next-line processEnv:off`
   directives on the legitimate test-infra reads; `withBunEnv` now
   drives `process.env`. Test 14/14, tsgo clean.
5. **Property Laws (advisory, non-required — confirmed NOT in ruleset
   10240248)**: surfaced the empty-`Error` round-trip class in a second
   driver, `@beep/runpod` `RunpodError`/`RunpodDocsError` (seed
   948470019), same pre-existing product bug as `@beep/box`. Both
   seed-excluded by pinning the error-schema round-trips to their
   ORIGINAL 25 runs — this restores exactly the pre-P1 behavior for the
   known-buggy schemas (they ran at 25 on main; no floor lowered, fence
   3) while every other schema is raised to 400. Filed under the shared
   empty-Error task. Because the lane is advisory, residual redness from
   other unlucky seeds does not block merge; the P4 required-flip is
   explicitly gated on these product bugs being fixed (D3: "flip after a
   stable green history").


## Review-fix round 3 — the SqlTest env-read 3-way bind (resolved)

`@beep/test-utils` SqlTest's PGLite gate reads test env. My earlier
attempts hit a genuine three-way constraint, each fix breaking another:

- `Bun.env` (main's form) → breaks consumer builds: oip-web's `next
  build` deep-type-checks the barrel's SqlTest.ts and lacks Bun types
  ("Cannot find name 'Bun'"), surfaced because the sweep added an
  fcRuns import to oip-web's tests.
- `process.env` → trips both the `processEnv` tsgo rule and the
  `native-runtime` lint rule; `@effect-diagnostics:off` directives are
  themselves banned in scanned src/test roots (`tsgo-rules` enforcement
  drift).
- `Config` (boot snapshot) → satisfies the laws and builds, but cannot
  observe the runtime env mutation the branch test relied on.

Resolution: `makePgliteIntegrationGate(env?)` reads via `Config` by
default (Node-safe, law-clean; CI exports the vars before boot, so the
snapshot is correct) and accepts an explicit `env` override so the
branch test injects each case directly — no env mutation, no Bun global,
no suppression directives. Verified: oip-web build green, test-utils
check green, `tsgo-rules` exit 0, `native-runtime` clean, SqlTest 14/14.


## Final resolution (rebased onto main; supersedes the interim fixes above)

After main advanced (Box product fix #331 merged), PR #327 was rebased
and the two interim seed-exclusions were replaced with their proper
forms. Both classes are now GREEN at the full env floor — no run-count
pins remain anywhere in the lane.

- **Empty-`Error` round-trip.**
  - *Box*: `#331` fixed `BoxError`'s codec upstream, so the pin is gone —
    `B.BoxError` runs at the full env floor via `assertSchemaRoundTrip`.
    Verified 3× at `BEEP_FC_NUM_RUNS=1000` on fresh seeds, plus the full
    file (18/18) at 400.
  - *Runpod*: not yet fixed upstream, so the exclusion moved from a
    run-count pin to an explicit **input** seed-exclusion — the error
    arbitraries force `cause: O.none()` (the buggy field) so the lane
    runs at the FULL env floor over every other field. Verified 3× at
    1000 (7/7 at 400). Product codec fix filed as a follow-up task
    (mirror #331).
  - Net: `assertSchemaRoundTripPinned` deleted from both driver tests;
    the SPEC's "seed-exclude explicitly" is now satisfied by excluding
    the buggy INPUT, never by lowering a run count.

- **Cyclic helper import (the 3 closure packages).** Greptile flagged the
  undeclared `@beep/test-utils` import in `@beep/schema`, `@beep/utils`,
  and `@beep/pglite` — packages inside test-utils's OWN dependency
  closure, which cannot declare it without a cycle. Superseding the
  interim "keep the undeclared import" waiver, all closure test files
  were reverted from `fcRuns(N)` to their pre-P1 inline `{ numRuns: N }`
  (schema **29** files, utils **1**, pglite **1**) — eliminating the
  import entirely (no floor lowered; the base N is unchanged, the closure
  simply opts out of the env-raise). The `numruns→fcRuns` codemod now
  refuses these packages via `isTestUtilsClosureFile` (guard + a
  dedicated closure-skip test), so a re-run cannot reintroduce the cycle.
  Repo-wide invariant re-proved: every external `fcRuns` importer
  declares `@beep/test-utils` (0 violations). Relocating `fcRuns` to an
  upstream leaf so the closure can env-raise is filed as a follow-up.

Local verification (all green): `@beep/schema` 69 files / 614 tests;
Box 18/18 and Runpod 7/7 at 400; the 3 reverted closure files at 400;
codemod golden-diff + idempotency + negative + closure-skip 4/4.
