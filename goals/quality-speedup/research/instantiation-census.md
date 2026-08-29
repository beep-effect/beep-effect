# Instantiation census — TypeScript check cost and OOM risk

Measured 2026-08-03/04 on `chore/improve-speed-of-things`,
tsgo `7.0.2+effect-tsgo.0.24.3` (recorded per row), workstation 32c/64t/128GB.
Method: `goals/box-typecheck-cost` (binding) — per-package overlay tsconfig
(`extends` package config, `include: ["src"]`, composite/incremental off,
noEmit) run sequentially through `tsgo -p --extendedDiagnostics` under
`/usr/bin/time -v`; per-file probes use `"include": [], "files": [<one>]`
(the empty include is load-bearing — `files` does NOT clear an inherited
`include`). Instantiation/type/symbol counts are deterministic; check times
are single-run wall values on a lightly loaded machine (estimates ±10%).

Data: [`data/census-results.tsv`](./data/census-results.tsv) (129 packages +
2 floor probes), [`data/census-perfile.tsv`](./data/census-perfile.tsv)
(7 per-file probes, normalized). A parallel session ran an independent probe
set concurrently — its raw rows (including BlockRepair/Chat.rpc and
schema-divergent duplicates) are in
[`data/census-perfile-probes.tsv`](./data/census-perfile-probes.tsv); where
the two sets overlap they agree within ~1%. Pre-publish chore: collapse the
two per-file TSVs into one normalized file.

An earlier same-day session ran this census with identical method; its raw
data was not retained. This re-run reproduces its findings (e.g. @beep/data
847,641 vs "848K", professional-desktop 23.56M vs "23.5M", 117 vs 116
packages ≥15s) — the two independent sweeps validate each other.

## 1. Headline totals

- 129 measured packages: **2,149s (35.8 min) summed check time**, ~0.40B
  summed instantiations, per full uncached sweep.
- **117 of 129 packages take ≥15s check time.** The 12 fast ones (identity
  0.05s/149K, types 0.001s/845, utils 0.08s/321K, data 0.36s/848K…) share one
  property: they do not import the `@beep/schema` barrel.
- 4 packages emit errors under the overlay (duckdb 1, form 14,
  ontology-server 6, ontology-ui 1) — diagnostics still complete; the counts
  are recorded in the TSV `errors` column.

Top offenders (absolute package cost):

| Package | Instantiations | Check s | Peak RSS |
| --- | ---: | ---: | ---: |
| @beep/professional-desktop | 23,561,112 | 26.5 | **11.1 GB** |
| @beep/repo-cli | 20,480,006 | 22.6 | 5.8 GB |
| @beep/ontology-ui | 15,848,929 | 21.0 | 5.0 GB |
| @beep/agents-server | 15,721,597 | 21.0 | 5.3 GB |
| @beep/ontology-client | 15,660,777 | 20.8 | 5.1 GB |
| @beep/agents-client | 15,257,385 | 20.6 | 5.1 GB |
| @beep/agents-use-cases | 15,010,145 | 20.6 | 4.7 GB |
| @beep/md | 14,310,078 | 19.4 | 3.8 GB |
| @beep/html | 14,067,219 | 19.6 | 3.9 GB |
| @beep/practice-kg-mcp | 5,913,620 | 22.1 | 5.6 GB |
| @beep/law-practice-server | 5,805,910 | 20.9 | 6.1 GB |
| @beep/db-admin | 4,980,615 | 20.3 | **7.5 GB** |

## 2. Floor probes (the import floor is the story)

Probe file: one trivial `S.Struct` in `packages/shared/domain`:

| Probe | Instantiations | Check s | Peak RSS |
| --- | ---: | ---: | ---: |
| A: `effect/Schema` only | **84** | **0.001** | 118 MB |
| B: A + `@beep/schema` barrel | **1,726,586** | **17.79** | 1.39 GB |
| B with `MimeType` removed from the barrel | 1,624,030 | **0.43** | 606 MB |

Three conclusions, each probe-verified:

1. **`effect/Schema` is free.** The v4 schema core adds 84 instantiations.
2. **The `@beep/schema` barrel is the repo's effective floor**: 1.73M
   instantiations and ~17.8s of check time added to every one of the **738
   files** (`rg -l 'from "@beep/schema"'`) that import it — which is why 117
   packages cost ≥15s and why marginal (total − 1.73M) is the only honest
   per-file metric.
3. **MimeType.ts is a check-TIME bomb, not an instantiation bomb**: removing
   its barrel export drops only ~103K instantiations but cuts barrel-importer
   check time **17.79s → 0.43s (−97.6%)**. The mass is in type-relation
   caching over the 2,302-literal IANA union, invisible to instantiation
   counts.

## 3. Mechanisms, tied to files

1. **MimeType type-level slicing** —
   `packages/foundation/modeling/schema/src/MimeType.ts` (993,247 inst /
   17.36s / 0.98GB *alone*), rewritten in `880c620e89` (PR #531) to slice
   `OfficialMimeType` with `Extract<…, \`${TopLevel}/${string}\`>` ×5 +
   `Exclude` + `A.filter` inference + 6 LiteralKits. Exported through the
   barrel ⇒ every importer pays. Estimated bound: ~117 packages × ~17.3s ≈
   **~34 of the 36 minutes of repo-wide check time** (estimate; per-package
   residuals vary).
2. **Html derived-ops lump** — `Html.serialize.ts` 11.04M and `Html.policy.ts`
   11.00M vs `Html.model.ts` 4.82M: ~6.2M each of conditional-type mass over
   the element union in derived operations, not the model.
3. **Barrel-transitive lump inheritance** — `Md.safe.ts` (14.14M) imports two
   schemas from the `@beep/html` barrel and drags the lump into `@beep/md`;
   one file then prices whole packages: `Session.atoms.ts` = 15.66M of
   ontology-client's 15.66M; `Chat.rpc.ts` = 14.77M and `BlockRepair.ts` =
   15.22M (corroborating parallel-session probes) in the agents layer.
4. **App-level aggregation without demand scoping** — professional-desktop
   (23.6M / 11.1GB) and repo-cli (20.5M / 5.8GB) import multiple lumps.
5. **Domain packages are innocent** — ontology-domain 503K marginal-class,
   agents-domain ~2.2M, @beep/data 848K: the client/server/use-cases layers
   inherit cost through barrels, they don't create it.

Settled dead ends (do not re-explore, measured in `box-typecheck-cost`):
removing `withCodecStatics` **increases** instantiations 41%; `$I.annoteSchema`
removal moves ≤2.4%; file splits redistribute mass without reducing it.

## 4. Staged remediation plan (lever order is binding)

Lever order per target: **(1) prune/de-blast declared surface → (2)
generator-emitted explicit types → (3) split**, each firing only if the
previous misses budget. Budgets in **marginals vs the 1.73M barrel floor**
(re-derive the floor whenever `effect` or `@beep/schema` moves).

| Stage | Target | Lever | Budget (exit) | Expected win |
| --- | --- | --- | --- | --- |
| 1 | `MimeType.ts` | replace type-level `Extract`/`Exclude` slicing with codegen-emitted per-category tuples (data-level, generator-annotated) | barrel probe ≤0.6s check | ~17s × 738 importers; bounds at ~34 min/sweep |
| 2 | `@beep/schema` barrel | audit remaining barrel marginal (literal tables ~34%, EntitySchema ~15%, LiteralKit substrate ~22% per prior session, labeled estimate); promote subpath imports (`@beep/schema/LiteralKit` measured ~406K prior session) for hot importers | floor ≤0.8M | seconds/package across 117 |
| 3 | `Html.serialize.ts` / `Html.policy.ts` | explicit annotated operation signatures (lever 2 — cap inference over the element union); keep model untouched | package ≤8M abs | ~6M ×2 + inheritance chain |
| 4 | `Md.safe.ts` | import the two needed schemas via @beep/html subpaths, not the barrel | md ≤6M abs | breaks the md→agents→ontology chain |
| 5 | agents/ontology client barrels | demand-scope what `Session.atoms.ts`/`Chat.rpc.ts`/`BlockRepair.ts` re-export | 15M class → ≤8M abs | RSS below 4GB each |
| 6 | professional-desktop / repo-cli | inherit wins from 1–5, then re-measure before any local action | ≤10M abs, RSS ≤6GB | removes the 11.1GB peak |

No stage lands in this packet (docs-only for C); stage 1 is the obvious first
follow-up and is independently falsifiable by re-running probe B.

## 5. OOM risk

- **Local**: peak RSS is additive under concurrency. The repo's own tooling
  caps local root turbo at `--concurrency=3` (`Quality/Tasks.ts:494-513`);
  three concurrent packages from the top table can already stack >20GB.
  Fine on this 128GB workstation, fatal on small machines.
- **Hosted**: `boundedRootTurboArgs` **skips** the concurrency cap when
  `isCi()` — turbo defaults to ~10 concurrent tasks. On `blacksmith-4vcpu`
  runners this reproduces the "runner lost communication" whole-runner deaths
  (30/56 failed jobs in the prior session's sweep of failed check.yml runs —
  labeled historical). Still on 4vcpu today: **Repo Sanity, Test Unit,
  Docgen, Codegen Drift** (`check.yml:68,80,98,104`) and the push-only Build
  job (`check.yml:249`) — Test Unit and Docgen are heavy lanes running
  full-graph work on the smallest runners.
- **TS2589 relation**: the no-location TS2589 native-compiler flake
  (quarantined by `Quality/internal/FlakeQuarantine.ts`) was observed at
  ~7.3M instantiations in @beep/box; the 15M class sits at 2× that depth
  exposure, so the quarantine is compensating for exactly the mass measured
  here. Shrinking the 15M class is the structural fix; the quarantine is the
  symptom ledger.
- **One-bump-from-failure**: any dependency bump that widens the html element
  union, the IANA MIME table, or the schema barrel raises all 117 floors at
  once — the census re-run ritual (below) is the guard.

## 5b. Addendum — stage 1 landed in the same PR (2026-08-04)

Scope was amended (see `history/2026-08-03-grill-decisions.md`): the MimeType
fix shipped with this packet's PR rather than as a follow-up. The generator
(`beep sync-data-to-ts --target iana-media-types`) now emits six per-category
tuples (application 1,759 / audio 163 / image 87 / text 103 / video 96 /
misc 94 = 2,302, byte-stable across re-runs), and
`packages/foundation/modeling/schema/src/MimeType.ts` builds its LiteralKits
from them directly — the `Extract`/`Exclude` slicing and refinement filters
are gone with an unchanged public surface.

Post-fix measurements (same method, independently run twice):

| Probe | Before | After |
| --- | ---: | ---: |
| Barrel floor probe check time | 17.79s | **0.445–0.465s** |
| Barrel floor probe peak RSS | 1.39 GB | 0.63 GB |
| `@beep/xai` package check time | 17.94s | **0.488s** |

Instantiations barely moved (1.73M → 1.63M floor) — confirming §2's
diagnosis that MimeType was a check-time bomb, not an instantiation bomb.
Stages 2–6 (barrel de-blast, html derived-ops, md subpath imports,
agents/ontology demand-scoping) remain follow-ups and now carry the
instantiation mass story alone.

## 6. Regression gate verdict (typeperf prior art)

`.repos/effect/packages/effect/typeperf/` gates per-fixture type-perf in
upstream effect. For this repo, a full ratcheted CI lane would tax every PR
with exactly the cost class this packet is deleting elsewhere — **rejected**.
Verdict: keep the census as a **documented ritual** (this file + the two
committed TSVs + the floor probes), re-run triggered by: (a) edits to
`@beep/schema` barrel/generators, (b) `effect` or `@beep/schema` version
moves, (c) any PR touching MimeType/Html/Md derived ops, (d) adding a
generated surface (box precedent: review-time obligation on manifest edits).
The floor probe (probe B) is cheap (~18s) and is the single-number canary:
if it exceeds ~2M instantiations or ~2s check post-stage-1, the ratchet
fires — as a review obligation, not a lane.
