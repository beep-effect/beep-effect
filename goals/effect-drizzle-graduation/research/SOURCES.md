# Effect-Drizzle Graduation — Sources & Provenance

- **Source exploration:** `scratchpad/bsl` (repo-tracked scratchpad
  experiment, not `explorations/`) — primary ledger:
  `scratchpad/bsl/research/`. Merged at PR #651 (`e92b8b7d9d`, 2026-08-10).
- **Provenance:** every constraint in `SPEC.md` traces to the graduation
  grill's locked decisions (`scratchpad/bsl/research/graduation-decisions.md`,
  2026-08-10) or to a named research artifact below.
- **P1 note:** when `scratchpad/bsl` is retired, its `research/` corpus moves
  with the package or into this packet's `research/`; update the paths here in
  the same PR so these links never dangle.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `grill` | Graduation grill locked decisions (9) | this repo | `scratchpad/bsl/research/graduation-decisions.md` | family, gates, sequencing | normative — reproduced in SPEC Constraints |
| `pubstd` | Published-package standards (import law, `@internal`, tstyche, JSDoc escaping, tooling audit) | this repo | `scratchpad/bsl/research/publishing-standards.md` | style-law scoping | normative for member code |
| `jsdoc` | Measured effect JSDoc grammar | this repo | `scratchpad/bsl/research/effect-jsdoc-conventions.md` | docs | port into member docgen posture |
| `rounds` | Round 2-7.5 briefs + reports with Fable post-review notes | this repo | `scratchpad/bsl/research/round*-{brief,report}.md` | design history | reference |
| `qloop` | Quality-loop inventories (44 defects), verification charter, PR #651 findings | this repo | `scratchpad/bsl/research/quality-loop/` | quality bar | reference |
| `basemig` | BaseEntity migration plan | this repo | `scratchpad/bsl/research/baseentity-migration-plan.md` | future adoption packet | reference only — OUT of scope here |

**How these inform implementation:** P0 transcribes `grill` into doctrine; P1
executes `grill` items 1-6 with `pubstd` governing member code; P2 executes
`grill` item 8. Nothing in this packet may contradict `grill` without the
operator reopening the decision.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `Effect-TS/effect` (v4 source checkout at `.repos/effect`; effect-smol lineage) | MIT | port-with-attribution | VariantSchema/Model integration surface, JSDoc grammar |
| `drizzle-team/drizzle-orm` (1.0.0-rc) | Apache-2.0 | port-with-attribution | column builder types, `Set*` brands, dialect DDL semantics |

## 3. External research sources

None beyond the upstream repositories above; the exploration's corpus is
entirely on-disk under `scratchpad/bsl/research/`.

## 4. In-repo capability references

- `@beep/drizzle` (`packages/drivers/drizzle`) — EXECUTION counterpart
  (service, transactions, error normalization); role split per SPEC
  Constraint 4. **reuse** (unchanged).
- `@beep/pglite` — test harness dependency, legal under the inverted gate
  (devDependencies only). **reuse**.
- `packages/shared/tables` — consumer of the updated projection contract
  line. **touched in P0 (one line)**.
- `packages/ecosystem/effect-drizzle/**` — **NET-NEW** (P1, via git-mv).

## 5. Cross-links & provenance

- Exploration → goal: `scratchpad/bsl/research/graduation-decisions.md`
  states these decisions "seed the goals packet's P0 docs PR"; this packet is
  that packet.
- Future sibling: the beep-adoption packet chartered by
  `scratchpad/bsl/research/baseentity-migration-plan.md` (not yet created).
- Decision trail: `standards/architecture/DECISIONS.md` entry 2026-08-10
  ("Add The `ecosystem` Package Family") lands in this packet's P0.
