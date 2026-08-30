# RESEARCH — v3-consistency-audit

> The research stage has two halves — an **in-repo inventory** and an
> **external landscape**. This packet has no external half: both "landscapes"
> are local checkouts (v3 archive, v4 `main`). Every artifact lives in
> [`synthesis/`](./synthesis/); this file is the **index**. Start with
> [`synthesis/00-convention-inventory.md`](./synthesis/00-convention-inventory.md),
> then [`synthesis/40-recommendations-ranked.md`](./synthesis/40-recommendations-ranked.md).

## How this packet was built

1. **Inline scout** (orchestrating session): file counts, suffix
   distributions, barrel styles, casing, test placement, CLI surface, doctrine
   headings — from both checkouts. Raw numbers in
   [`CAPTURE.md`](./CAPTURE.md). Two of the brief's hypotheses fell here.
2. **Workflow fan-out** (`wf_a80afa0d-c1a`, 31 agents planned, 11 completed
   before the Fable session limit): six parallel inventory readers (`10`–`15`)
   and six pattern-family cross-check tables (`20`–`25`). Each reader was told
   the scout numbers as *hints to verify* and reported its own "Surprises vs
   scout facts" — several scout counts were corrected (coverage-directory
   pollution, undercounted suffixes, `Tools.ts` composers exist, use-cases
   `test.ts` only 2/8).
3. **Adversarial verification** (Codex `codex exec`, effort medium, one job
   per family table): every row re-counted against both checkouts (evidence
   lens) and re-read against the cited doctrine section (doctrine lens);
   corrections applied in place with a `## Verification log` per file.
4. **Align grill** (`/grilling`, 16 decisions): see
   [`DECISIONS.md`](./DECISIONS.md). Ran *after* the tables so every question
   carried its counts.
5. **Assessment and ranking** (orchestrating session, `30`, `40`):
   judgment work written from the verified tables and the locked decisions.
6. **Consolidation and critique** (Codex): the single deliverable table
   (`00`) and a completeness critique (`90`) against the brief's four tasks
   and prior hypotheses.

Evidence baseline: v4 `main` `3435c24f94` (checkout fast-forwarded to
`2c0c8eb046` mid-session; `git diff --stat` shows no slice package or
`ARCHITECTURE.md` change between them); v3 `beep-effect4` `997a827454`.

## Recommended read order

`00` → `40` → `30` → `DECISIONS.md` → `BRIEF.md` → `MAP.md`; then the family
tables `20`–`25` for the rows behind any verdict; the inventories `10`–`15`
only when a row's evidence needs its source; `90` last.

## Synthesis index

### Centerpiece
| # | Doc | One line |
|---|---|---|
| **00** | [`00-convention-inventory.md`](./synthesis/00-convention-inventory.md) | The deliverable: pattern → v3 evidence → v4 status (codified / codified-but-drifted / drifted / missing / v4-only / not-worth-porting) → enforcement today. **Read first.** |
| **40** | [`40-recommendations-ranked.md`](./synthesis/40-recommendations-ranked.md) | Ranked adoption list, each paired with its mechanism (audit rule, scaffold change, ratchet, doctrine amendment) and the pressure-test of the brief's leading hypothesis. **Read second.** |
| 30 | [`30-assessment.md`](./synthesis/30-assessment.md) | Likes / dislikes of the v3 patterns, v4-only strengths to protect, what "uniform" in v3 really was. |
| 90 | [`90-completeness-critique.md`](./synthesis/90-completeness-critique.md) | What the packet still does not answer, and claims without a path + count. |

### Inventories (stage 1 readers)
| # | Doc | One line |
|---|---|---|
| 10 | [`10-v3-iam-inventory.md`](./synthesis/10-v3-iam-inventory.md) | v3 IAM: 20/20 identical entity folders; kebab client/tables dialects; server thinner than assumed; 6 tests / 980 files. |
| 11 | [`11-v3-knowledge-inventory.md`](./synthesis/11-v3-knowledge-inventory.md) | v3 Knowledge: scaffold-uniform domain (36% real content), two *different* error homes, suffix-less topical server, mirrored `test/` at 0.28 files / 0.64 LOC. |
| 12 | [`12-v4-doctrine-inventory.md`](./synthesis/12-v4-doctrine-inventory.md) | v4 doctrine: 41 suffixes / 7 tiers, 22 used; no enforcement lane for any topology rule; the kind-folder contradiction between the tree and `13/09/10`. |
| 13 | [`13-v4-slices-census.md`](./synthesis/13-v4-slices-census.md) | v4 slices: 948 files / 40 packages; 77.5% tier-correct suffixes; kind folders 50/50 outside domain+tables; `.converters` the largest undocumented habit. |
| 14 | [`14-v4-enforcement-tooling.md`](./synthesis/14-v4-enforcement-tooling.md) | What checks what today: `check` is plan-only and unwired; 1 real / 4 scoped / 7 absent gates; nearest walkers to host an auditor. |
| 15 | [`15-architecture-lab-vs-doctrine.md`](./synthesis/15-architecture-lab-vs-doctrine.md) | The canonical proof vs the vocabulary: 9 undecided divergences, all templated into every `add concept`. |

### Pattern-family cross-check tables (verified)
| # | Doc | One line |
|---|---|---|
| 20 | [`20-family-directory-grammar.md`](./synthesis/20-family-directory-grammar.md) | Spine, tiers, kind folders, concept folders, casing. |
| 21 | [`21-family-file-role-suffix.md`](./synthesis/21-family-file-role-suffix.md) | Role vocabulary per tier, folder/file prefix agreement, off-vocabulary suffixes. |
| 22 | [`22-family-barrel-namespace.md`](./synthesis/22-family-barrel-namespace.md) | `index.ts` per level, namespace vs flat, completeness, export-map subpath grammar; **BN-20–BN-24** (2026-08-30 operator addenda): role-named members, namespace access, operation contracts — Codex-verified 2026-08-30 (BN-22/23 confirmed; BN-20/21/24 corrected, see the file's addendum verification log). |
| 23 | [`23-family-collocation-identity.md`](./synthesis/23-family-collocation-identity.md) | One concept across tiers; `$I` presence and key grammar; `EntityId`/`toPgTable`/converters links. |
| 24 | [`24-family-tests.md`](./synthesis/24-family-tests.md) | Placement, mirroring, lens names, shared helpers, ratios, ratchets. |
| 25 | [`25-family-errors-layers.md`](./synthesis/25-family-errors-layers.md) | Error homes and names, port errors, Layer placement and names, the use-cases Layer ban. |

## In-Repo Capability Inventory

See [`research/SOURCES.md`](./research/SOURCES.md) §4 — the bricks the two
goal packets compose (`Architecture.schemas.ts`, the `Lint` walkers,
`SchemaTopology`'s regexes, `LiteralKit`, the coverage ratchet lane, Fallow
zones). NET-NEW: the audit rule set, the report/baseline schemas, the lane.

## Constraints Discovered

- The server tier's `.<port-name>.ts` role is open-ended by doctrine; a closed
  vocabulary must be unioned with port names parsed from `.ports.ts`.
- Kind-folder moves rewrite `package.json#exports` subpaths; codemods must
  move exports and consumers together.
- `$I` keys are persisted tag strings in places; renames ratchet, never bulk.
- `explorations/ATLAS.md` is a generated, untracked projection (DECISIONS
  2026-08-27); packet README `Stage`/`Status` regions are generated too.
- effect v4 `Rpc.make(tag, { payload, success, error, defect, stream })` — the
  option key is `error`; `Failure` is the member name only
  (`.repos/effect/packages/effect/src/unstable/rpc/Rpc.ts` L902-913).
- Role-member renames change every deep named import (724 sites repo-wide);
  the codemod must rewrite import sites to namespace access in the same PR.
- Coverage directories mirror `src/` and pollute naive counts; every walker
  and every number here excludes them.
- Capability gate (2026-08-30, 19-agent Workflow: 9 cite verifiers, 5
  NET-NEW refuters, 5 definition-of-ready critics): 8/9 cites confirmed, the
  `TemplateRetarget.ts` range corrected; four NET-NEW marks downgraded to
  existing bricks — package discovery is `@beep/repo-utils`
  `resolveWorkspaceDirs` (`Workspaces.ts`), the ratchet is
  `cli/src/internal/ratchet` (`diffMembership`/`diffTotals`/`enforceRatchet`),
  the lane is a row in `CiLane.ts`'s closed registry, and the `Contract` kit
  extends `@beep/schema/Fn`'s statics + `implement*` construction (with
  `drivers/govinfo` `contracts/Search` as the one live `Payload`/`Success`/
  `Failure` precedent); `move concept --kind` and the per-slice codemods stay
  NET-NEW (substrate: `TSMorphService`, `createRepoTsMorphProject`,
  `Laws/EffectImports.ts`, `repo-crispening-orchestration/ops/codemods`).
