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
  (`docs/effect-schema-parity-graduate`), a docs-and-evidence PR.
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
