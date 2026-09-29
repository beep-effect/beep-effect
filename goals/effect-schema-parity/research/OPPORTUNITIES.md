# Opportunities

Friction ledger for `goals/effect-schema-parity`. Record a receipt at the
moment the friction happens, never at closeout: what you were doing, the
evidence (command, error text, PR or file), and what would have prevented it.
This repo is public: redact secrets, write home paths as `~`, drop session and
machine ids, quote only the minimal identifying error text.

## 2026-09-15 — Audit rows can rule RETIRE on a facet nobody counted

- **What I was doing:** Decomposing the exploration into this goal.
- **Evidence:** `explorations/effect-schema-parity/research/idiom-families.md`
  §F01 ruled LiteralKit a retirement with "Full static-member consumer census
  is UNVERIFIED" in its own row; the align ruling of 2026-09-14 took it. A
  census at decompose (Enum 1,172 lines, is 603, Options 395, $match 243)
  reversed it to ADAPT.
- **What would have prevented it:** A retirement audit lane that refuses to
  emit RETIRE for any concept over 100 consumers without a per-facet count;
  now the `SPEC.md` facet census gate, but it should be the audit tool's rule.

## 2026-09-15 — Goal doctor still calls a brand-new untracked packet stale

- **What I was doing:** Validating this packet right after graduation.
- **Evidence:** `bun run beep goals doctor` returned `blocking_new=0` and one
  advisory: `effect-schema-parity [stale-active] active packet untouched for
  21+ days with no blockedBy/statusNote`, on a packet whose manifest dates
  are both 2026-09-15 and which has no commit yet. Same shape as the
  2026-08-30 receipt in `goals/schema-utils-selective-codec-statics/research/OPPORTUNITIES.md`.
- **What would have prevented it:** The stale-active advisory should use the
  manifest `created`/`updated` dates or the first commit date, not only git
  history, for untracked packets. Two packets have now paid for this.

## 2026-09-16 — Exploration research scripts trip the production lint and fallow gates at publish

- **What I was doing:** First Yeet repair on the packet-only lane
  (branch `effect-schema-parity-graduate` under the `docs` prefix), a
  docs-and-evidence PR.
- **Evidence:** `feedback:00-heavy:01-lint-fix` exit 1 (biome `noConsole`,
  `useTemplate`, `useNodejsImportProtocol`, `noUselessStringRaw`,
  `noInnerDeclarations`, `noExplicitAny` across nine files under
  `explorations/effect-schema-parity/research/`) and
  `feedback:00-cheap-gates` exit 1 on `fallow:audit` (29 introduced: 18
  dead-code, 11 complexity), `fallow:dead-code` (9 unused files, 9 unresolved
  imports into `.repos/effect`), all in the same directory. The Yeet routing
  labelled the cheap-gates red as `schema-first`, which was green.
- **What would have prevented it:** A standing exclusion for
  `explorations/**/research/**` in `biome.jsonc` (console allowlist) and
  `.fallowrc.jsonc` (`ignorePatterns`), the way `scratchpad/**` and three
  earlier exploration evidence directories already have. Added for this
  packet only, per the existing per-packet precedent; a generic rule is a
  decision for the explorations convention. Also: route a cheap-gates red to
  the lane that actually failed, not the first lane in the repair hint.

## 2026-09-29 — An Effect snapshot bump merged without regenerating the inventory

- **What I was doing:** Starting P0 from the `/goal` launcher.
- **Evidence:** PR #1330 moved the root `package.json` catalog `effect` to
  `df77fff939` while every inventory row and the `INDEX.md` pin line still
  read `e5f7d12af9`. The SPEC stop condition ("regenerate the inventory
  directory for the new sha in the bump PR itself before any further phase
  PR opens") held P0 until a catch-up PR regenerated the rows.
- **What would have prevented it:** A gate the bump PR cannot miss. Until
  P1 ships `lint effect-schema-inventory --check`, the rule lives only in
  packet prose that the effect bump lane never reads. P1 should run the
  pin check (catalog sha equals the fixture pin line) as a cheap gate in
  hosted CI, so a bump PR goes red until it regenerates.

## 2026-09-29 — The SPEC facet-census command reads zero for the dominant facets

- **What I was doing:** Running the P3 Facet Census Gate for `Number`, `Int`,
  `Unknown` and `Opaque` with the command shape in `SPEC.md` §Facet Census Gate.
- **Evidence:** The shape `rg -c -e '\.<member>\b' ... --glob '!**/<Concept>/**'`
  returned 0 lines for `NonNegativeInt` and `UnknownFromJsonString`, which the
  import-anchored count puts at 2,129 and 170 lines, because consumers use
  bare named imports. It returned 926 lines for `.Int` and 342 for `.Unknown`,
  almost all upstream `S.Int` and `S.Unknown`. The directory glob also never
  excludes the concept's own file, since all four concepts are single files.
  Separately, the audit's upstream target for `UnknownFromJsonString`
  (`S.UnknownFromJsonString`) is `@internal` at the pin and missing from the
  installed `Schema.d.ts`.
- **What would have prevented it:** A census tool that resolves imports
  instead of matching `.<member>`; one is now committed at
  `goals/effect-schema-parity/research/tools/facet-census.ts`, and the gate
  text now names it the count of record with the `rg` shape as a cross-check. The retirement audit tool should
  check each upstream target against the installed `dist/*.d.ts` before it
  prints the row.
## 2026-09-29 — A new test file cannot enter the effect-vitest baseline without rewriting it

- **What I was doing:** P1, adding the two repo-cli tests for
  `lint effect-schema-inventory`. Each imports `NodeServices`, which the
  effect-vitest detector reports as one EV010 `platform-resource-provenance-review`
  judgment row, the same row `effect-vitest-store.test.ts` already carries.
- **Evidence:** `bun run beep lint effect-vitest` reported
  `2 new finding(s)`; the prescribed `bun run beep lint effect-vitest --write`
  rewrote `standards/effect-vitest.inventory.jsonc` by about 100k lines
  (5,008 rows down to 4,764: 246 rows already resolved on `main`, plus
  reordering). The two rows were inserted by hand at their sorted position
  instead (42 added lines; the check then reports `introduced=0 resolved=246`).
- **What would have prevented it:** An additive mode such as
  `lint effect-vitest --admit <file>` that appends reviewed rows for named
  files without dropping resolved rows, or a main that keeps the baseline
  tight so `--write` is a small diff.

## 2026-09-29 — The committed schema catalog is stale on main

- **What I was doing:** P1, checking generated baselines after adding the
  inventory schemas.
- **Evidence:** `bun run beep lint schema-catalog` exits 1 with
  `stale standards/schema-catalog.generated.jsonc`; `--write` changes about
  8,500 lines, almost all in files this goal does not touch (lab apps,
  todox, infra), so the refresh was not taken into the P1 change.
- **What would have prevented it:** A hosted lane, or a Yeet cheap gate, that
  keeps the catalog current per PR; today nothing fails when it drifts.
