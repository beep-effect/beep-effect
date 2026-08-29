# Lab Apps Lifecycle — Sources & Provenance

- **Source exploration:** none — this packet was authored directly from the
  operator objective (goals/README.md source #1) plus a six-lane exploration
  fan-out and a four-round `/grill-with-docs` interview, both on 2026-08-13.
  The definition-of-ready content (problem, appetite, no-gos, decision log,
  first slice, capability check) lives in `SPEC.md`.
- **Provenance:** the six lane reports in this directory are the fan-out
  output (grok headless lanes over the live checkout at `343fc60735`,
  branch `feat/experiment-apps-lifecycle`). The interview decisions are
  reproduced verbatim as SPEC Decision Log D1–D14.

## 1. Mined source corpus (this packet's research/)

| Source | Title | Location | Theme | Disposition |
|--------|-------|----------|-------|-------------|
| L1 | create-package anatomy and extension points | `research/01-create-package-anatomy.md` | CLI pipeline, AppKinds, templates, reuse-vs-net-new for variants and delete | evidence |
| L2 | Registration blast-radius census | `research/02-registration-blast-radius.md` | Every surface a package occupies; §19 master table is the geometry-schema seed | evidence |
| L3 | Apps anatomy → variant requirements | `research/03-apps-anatomy-variants.md` | Existing app wiring; minimal template spec per variant; tauri delta | evidence |
| L4 | Governance gates census | `research/04-governance-gates.md` | Gate × mechanism table; labs scoping entries; deletion-side gate effects | evidence |
| L5 | Deletion prior art and requirements | `research/05-deletion-prior-art.md` | Six deletion case studies; live residue; delete-package phases/refusals/changeset policy | evidence |
| L6 | Goals-packet conventions | `research/06-goals-packet-conventions.md` | Packet contract this scaffold follows | meta |

**How these inform implementation:** L2 §19 + L5 §7 enumerate the
registration surfaces that become `RegistrationSurface` schema rows (P0).
L5 §9 is the delete-package command spec (P1). L1 §2.4/§4 fixes the variant
work to "add vite + service AppKinds, don't rebuild the scaffolder" (P2).
L4 fixes the exact gate-scoping entries for the one-time labs PR (P2).

## 2. Upstream repositories & licenses (first-wave lab ports, SPEC D13)

| Repo (local checkout) | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `~/YeeBois/dev/trustgraph/ts` | verify in P2 from the checkout's LICENSE | reference-only until verified | Workbench UI shell as the first lab (P2 acceptance proof) |
| `~/YeeBois/workstation_apps/cognee` | verify before porting | reference-only until verified | Knowledge-pipeline service shape; stresses service variant + per-lab storage |
| `~/YeeBois/dev/effect-ontology` | verify before porting | reference-only until verified | Effect-native ontology patterns |
| `~/YeeBois/workstation_apps/semantica` | verify before porting | reference-only until verified | Effect-port candidate |

License rules are load-bearing: copyleft ⇒ clean-room only; permissive ⇒
port with attribution; missing/unverified ⇒ reference only. Verify each
LICENSE from the local checkout (and upstream origin) before any code
moves into a lab.

## 3. External research sources

None — all six lanes are in-repo archaeology over the live checkout and
git history. No external URLs were mined; do not invent any.

## 4. In-repo capability references

| Brick | Path | Mark |
|-------|------|------|
| create-package command + templates (nextjs/tauri AppKinds exist) | `packages/tooling/tool/cli/src/commands/CreatePackage/**` | extend |
| `syncTsconfigAtRoot` reconstructive sync (derived-config inverse) | `packages/tooling/tool/cli/src/commands/TsconfigSync/**` | reuse |
| Identity registration (add-only today) | `.../CreatePackage/internal/IdentityRegistration.ts` | extend (add remove + orphan listing) |
| Identity registry lint (missing-only today) | `.../commands/Lint/IdentityRegistry.ts` | extend (orphan detection) |
| Dependency graph utilities | `packages/tooling/library/repo-utils/src/{DependencyIndex,Graph,Dependencies,UniqueDeps}.ts` | reuse (invert edges for `dependentsOf`) |
| Architecture `ensure-absent-path` guarded delete | `.../commands/Architecture/**` (OperationPlanExecution) | reuse pattern |
| Purge artifact list | `.../commands/Purge.command.ts` | reuse (pre-rm artifact sweep) |
| Prior deletion recipe | `goals/speed-loop/research/r3-package-deletions.md` | reuse + amendments in L5 §11 |
| `RegistrationSurface` geometry schema | home decided in P0 | NET-NEW |
| DeletePackage command | `.../commands/DeletePackage/**` | NET-NEW |
| Lab manifest schema + `beep labs list` | home decided in P2 | NET-NEW |
| vite + service AppKind templates | `.../CreatePackage/templates/` | NET-NEW (vite clones tauri-minus-rust) |

## 5. Cross-links & provenance

- SPEC Decision Log D1–D14 — operator-ratified interview outcomes (locked).
- `goals/speed-loop/research/r3-package-deletions.md` — prior in-repo
  deletion research; L5 §11 field-tests and amends it.
- Live acceptance fixture: PR #680 deletion residue on the 2026-08-13 tree
  (L5 §0, Appendix A) — delete-package doctor must fail on it; P1 fixes it.
- Related packets: `goals/honest-repo-signal` (retired-changesets pattern),
  `goals/knowledge-surface-automation` (goals bootstrap remains
  unimplemented — out of scope here).
