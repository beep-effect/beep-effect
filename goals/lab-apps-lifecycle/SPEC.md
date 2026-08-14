# Lab Apps Lifecycle Spec

## Objective

Two observable capabilities, standing on one substrate:

1. **Lab apps.** `bun run beep create-package <name> --type app --app-kind
   <nextjs|vite|service> --lab` (final flag shape decided in P2) mints a
   fully law-abiding experimental app under `apps/labs/<name>` — portless
   dev script, identity composer, workspace membership, tsconfig project
   wiring, schema-validated lab manifest — and `beep labs list` (NET-NEW)
   enumerates every lab with its disposition.
2. **Complete deletion.** `bun run beep delete-package <name-or-path>`
   removes any leaf workspace package or app and prunes every registration
   surface it occupies, ending with a green `--check`/doctor pass that
   proves zero residue. Labs are the trivially safe case; the command is
   general.

Both are driven by a schema-first **registration geometry** model: a
declared inventory of every surface a package touches, which
`create-package` interprets forward, `delete-package` inverts, and a
`doctor` mode diffs against the live tree (residue detection).

## Problem & Appetite

**Problem.** Real experiments (ports of trustgraph/ts, cognee,
effect-ontology, semantica) have no legal home: `scratchpad/` escapes the
repo laws that make an experiment a faithful proving ground, while a real
app under `apps/` costs full registration ceremony to create and a
hand-authored mega-commit to delete — and every historical hand deletion
leaked residue that is still on the tree today
(`research/05-deletion-prior-art.md` §0, Appendix A).

**Appetite.** One packet, seven phases, each implement phase its own PR
through yeet. This is tooling + one new app family root; it must not grow
into CI-topology or architecture-command redesign (stop conditions).

## Non-Goals

- Production apps: nothing under `apps/` outside `apps/labs/*` changes
  behavior or registration in this packet.
- No relaxation of any code law anywhere: schema-first, effect-first,
  import boundaries, portless dev-server law, identity registration all
  hold for labs (D2). Exemptions are ceremony-only and path-scoped.
- No `beep goals bootstrap` implementation, no architecture-command
  (`beep architecture`) redesign, no new package *family* — labs are apps,
  not a fifth family (`research/01-create-package-anatomy.md` §7).
- No slice retirement automation: deleting a slice with a live
  shared-kernel promotion record stays a human, doctrine-11 process the
  command refuses and points at.
- No cascade deletion outside `apps/labs/*` in this packet (deferred; see
  `research/05-deletion-prior-art.md` §3.2 for the eventual policy).
- No promotion command (`beep labs promote`) — v1 ships a documented
  runbook only (D10).
- Deleting git history, rewriting research packets, or editing fleet
  timing TSVs to erase deleted names (historical records stay).

## Source Hierarchy

1. Operator objective and the ratified Decision Log below (D1–D14).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (schema-first-development,
   effect-first-development, yeet).
3. `standards/ARCHITECTURE.md` and `standards/architecture/*` (esp.
   `07-non-slice-families.md`, `11-evolution-and-deprecation.md`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/CreatePackage/**` — vite +
  service app kinds, lab parent/flag, lab manifest emission, retired-name
  guard.
- `packages/tooling/tool/cli/src/commands/DeletePackage/**` (NET-NEW) —
  command, dependents scan, plan/apply/check, doctor.
- A NET-NEW geometry module (home decided in P0; candidate: a new
  internal module under `packages/tooling/tool/cli/src/commands/` or
  `@beep/repo-utils`) — `RegistrationSurface` schema + `dependentsOf`.
- `packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry.ts` —
  orphan-composer detection (extras currently invisible).
- `packages/tooling/tool/cli/src/commands/CreatePackage/internal/IdentityRegistration.ts`
  — `removeIdentityPackageRegistration`.
- Root `package.json` — one-time `apps/labs/*` workspace glob (D5).
- Gate configs needing a one-time labs scoping entry (exact set ratified in
  P0 from `research/04-governance-gates.md` §2): deprecated-API lint
  shards, knip, docgen scan globs, coverage collector filter,
  changeset-status wrapper.
- `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` +
  `.../Quality/Tasks.ts` — required-lane `--filter=!./apps/labs/**`,
  non-required labs lane, Lint Policy law/ceremony step scoping.
- `.../commands/Qa/Qa.session.ts` (`portlessUrlForApp`) — labs hostname
  segment support.
- `apps/labs/*` — new root; first labs land here in P2/P4 verification.
- `standards/architecture/GLOSSARY.md` ("lab app") and, if the P2 review
  agrees the bar is met, a `standards/architecture/DECISIONS.md` entry for
  the labs root + zero-root-churn registration (D5, D14).
- `docs/` runbook for lab promotion (D10).
- `.changeset/*` + `standards/changesets.retired-packages.json` — deletion
  changeset policy (`research/05-deletion-prior-art.md` §5.2).

## Constraints

- **Zero-root-churn (D5) is a hard requirement:** after the one-time
  glob/scoping PR, creating or deleting a lab touches no shared config
  file by hand — workspace membership via the `apps/labs/*` glob,
  derived configs via reconstructive `beep tsconfig-sync`, everything
  else via the geometry model. Three known holdouts must be resolved in
  P0/P2 design (`research/04-governance-gates.md` §6): (1)
  `tsconfig.packages.json` enumerated project references — TS refs have
  no glob, so either tsconfig-sync excludes `apps/labs/**` from root
  refs or the churn is accepted as generated-only; (2) the changesets
  ignore list is name-based, not glob-capable — wrap `changeset:status`
  to drop `apps/labs/**` diffs rather than growing a per-lab name list;
  (3) the identity composer file, unless the labs segment is generated
  keyed off the glob.
- **Required checks stay frozen at 16 contexts:** labs become
  non-blocking via `--filter=!./apps/labs/**` on the required turbo
  lanes (Check, Lint, Test Unit/Integration, Coverage) plus a NEW
  non-required labs lane that builds/typechecks `apps/labs/**` — this
  filter is mandatory because first-wave labs import foundation packages
  and would otherwise fail required lanes on every upstream PR as turbo
  dependents. Lint Policy (unscoped, one context) splits internally: law
  steps keep `apps/labs/**`, ceremony steps (docgen check, jsdoc lanes)
  exclude it. Lab law violations cannot wedge that shared lane: they are
  gated at the lab's own PR exactly like any package's, and a lab that
  turns red under a later rule-tightening is fixed, inventoried, or simply
  deleted — delete-package is the cheap escape valve that makes keeping
  labs under full law affordable. Never add a labs context to ruleset
  10240248 (`research/04-governance-gates.md` §5).
- **Geometry is the single prune list (D6):** `delete-package` must not
  hand-maintain a parallel checklist; every surface it prunes is declared
  in the `RegistrationSurface` schema, and `doctor` diffs that
  declaration against the live tree.
- **Reuse the reconstructive spine:** derived-config inversion is
  `syncTsconfigAtRoot({ mode: "sync" })` — do NOT grow `ConfigUpdater`
  remove-APIs and do NOT build on `TsMorphIntegrationService`
  (`research/01-create-package-anatomy.md` §8).
- **Refuse-by-default:** production/test dependents, published packages,
  protected slugs (`identity`, `schema`, `utils`, `types`, `repo-cli`,
  `repo-utils`, `repo-configs`), slices with live promotion records, and
  name-reuse collisions all refuse per
  `research/05-deletion-prior-art.md` §9.4. `--force` never overrides
  dependents.
- **Baselines regenerate, never hand-edit:** coverage baseline uses the
  replacement writer (not merge); JSDoc inventory regenerates BOTH
  `.jsonc` and `.md`; `.beep/ci` mirrors are invalidated
  (`research/05-deletion-prior-art.md` §7).
- **Lab code laws (D2):** generated lab code satisfies typecheck,
  lint-policy, schema-first/effect-first rules, and portless
  (`http://<name>.labs.beep.localhost:1355`, D1). Service variant uses
  `effect/unstable/httpapi` — never `node:http`.
- **Lab manifest is a schema** (D9): LiteralKit disposition
  `active | promote | expired`; decoded, never hand-parsed.
- **Identity (D8):** labs register real composers under a mechanically
  identifiable labs segment (design in P0/P2 — today the registry is a
  flat slug list, so the segment mechanism is a P0 design deliverable);
  deletion removes exactly those entries.
- **Per-lab storage (D12):** labs that need Postgres declare a
  lab-namespaced schema in their manifest; `delete-package`'s data phase
  drops it only behind an explicit destructive-consent flag (e.g.
  `--drop-data`), after verifying the schema name is uniquely derived from
  and owned by the target lab, and never against a non-local connection
  without a further explicit override — absent consent it prints the
  manual drop step instead. Labs never add to `packages/*/tables`.
- Keep changes focused; no unrelated refactors or formatting churn.

## Acceptance Criteria

Track A — delete-package:

- [ ] Doctor's acceptance fixture is synthetic and reproducible: a P1 test
      constructs the residue classes catalogued from the PR #680 deletions
      (`research/05-deletion-prior-art.md` §0, Appendix A) — stale
      committed inventory rows, an orphan pending changeset, a leftover
      identity composer, an untracked artifact dir — and asserts
      `delete-package --check` reports each one. Ambient tree state is
      never the fixture (review-verified 2026-08-13: the live #680 residue
      was machine-local and has since been cleaned); any matching residue
      found at P1 time is swept in that PR as a bonus, not relied on.
- [ ] Deleting a freshly minted zero-consumer package leaves: no tracked or
      untracked files under its path, no workspace entry, no identity
      composer or shape-test row, no tsconfig/syncpack rows, no lockfile
      records, regenerated baselines, a `{}` deletion changeset (non-lab
      targets only — deletions under `apps/labs/**` skip the changeset via
      the path-aware status wrapper, consistent with D2's ceremony
      exemption), and a green verify battery (`tsconfig-sync --check`, `lint
      identity-registry`, `quality changeset-graph`, `fallow boundaries
      --check`, exact-name `rg` sweep).
- [ ] The command refuses each hard-refuse case in
      `research/05-deletion-prior-art.md` §9.4 with the dependents cascade
      printed.
- [ ] Identity-registry lint gains orphan-composer detection.

Track B — labs:

- [ ] `apps/labs/*` glob + path-scoped gate entries land in one PR; after
      it, lab create/delete touches zero shared config files by hand.
- [ ] `create-package` mints nextjs, vite, and service labs that pass
      `beep:check`, `beep:lint`, and `beep:test` out of the box, serve on
      `<name>.labs.beep.localhost:1355` (frontend variants), and carry a
      valid lab manifest.
- [ ] `beep labs list` renders every lab with disposition from decoded
      manifests.
- [ ] Round-trip proof: scaffold a throwaway vite lab → typecheck +
      portless serve → `delete-package` it → doctor green, worktree clean
      (First Vertical Slice below).
- [ ] The first real lab (trustgraph/ts workbench shell, D13) is scaffolded
      on the substrate and typechecks (porting its internals is NOT gated
      here — the scaffold proof is).
- [ ] Tauri lab variant lands in P3 on the same AppKind abstraction with a
      recorded toolchain/CI spike outcome.
- [ ] `standards/architecture/GLOSSARY.md` gains "lab app".

## First Vertical Slice

Scaffold a throwaway vite lab `round-trip-probe` under `apps/labs/*` → prove
typecheck + portless dev serve → `beep delete-package round-trip-probe` →
prove `--check`/doctor green and `git status` clean apart from intended
edits. This slice exercises glob membership, identity add/remove,
tsconfig-sync reconstruction, lockfile refresh, and baseline regeneration
in one loop. It is the P4 gate and the smallest honest proof of the whole
packet.

## Decision Log (operator-ratified 2026-08-13, locked)

| # | Decision | Choice |
| --- | --- | --- |
| D1 | Naming | `apps/labs/*`; glossary term "lab app"; portless `<name>.labs.beep.localhost`; NOT "experiments" (doctrine-11 collision). Command stays `beep delete-package`. |
| D2 | Law posture | Code laws full (typecheck, lint-policy, schema-first/effect-first, import boundaries, portless). Ceremony exempt by path-scoped construction: docgen coverage, coverage ratchet, changesets, storybook. Lab CI lanes not required-check blockers. |
| D3 | Delete scope | General command, any workspace package/app; refuses on reverse dependencies (leaf-only guard); slice packages defer to doctrine-11 retirement. |
| D4 | Variants v1 | nextjs + vite + service (pure Effect `effect/unstable/httpapi` server). Tauri = phase 2 (P3) with a toolchain/CI spike, landing as a variant on the same AppKind abstraction. |
| D5 | Registration | Zero-root-churn hard requirement: one-time `apps/labs/*` glob + path-scoped gate entries; afterward create/delete touches no shared config by hand. |
| D6 | Substrate | Registration geometry as schema (`RegistrationSurface`); create = forward interpreter, delete = inverse, doctor = declared-vs-actual diff / residue detection. |
| D7 | Doctor rollout | Tool first (on-demand + delete post-verify); CI/yeet gate is a follow-on decision after it runs quiet. |
| D8 | Identity | Labs DO register identity composers, under a mechanically identifiable labs segment; delete prunes exactly that segment. |
| D9 | Lifecycle | Schema-validated lab manifest (purpose, created, disposition `active\|promote\|expired`) + `beep labs list`. No TTL/CI nagging. |
| D10 | Promotion | Documented runbook v1 (move + full registration + ceremony onboarding, identity kept); `beep labs promote` is a stretch goal only. |
| D11 | Packet shape | One packet, phased census→delete→labs→tauri; split tripwire if either track grows a second primary. |
| D12 | Storage | Per-lab Postgres schema declared in the manifest, dropped by delete's data phase; labs never touch `packages/*/tables`; pglite/in-memory trivially allowed. |
| D13 | First wave | trustgraph/ts workbench (P2 acceptance proof), effect-ontology, cognee, semantica. Sources under `~/YeeBois/dev` and `~/YeeBois/workstation_apps`. |
| D14 | Retirement class | Labs are pre-v1 (Stack Installer DECISIONS waiver pattern): same-PR consumer migration, no sunset window; a DECISIONS entry only when a lab promoted a shared export. |

Research amendments adopted with the decisions (from the fan-out, not
re-decided): nextjs/tauri app kinds already exist — v1 adds vite +
service, not a new scaffolder (`research/01` §2.4); create-package must
consult `standards/changesets.retired-packages.json` and refuse name
reuse without `--reuse-retired-name` (`research/05` §5.2); deletion
changeset default is delete-dedicated-files + `{}` note, retirement list
last resort (`research/05` §5.2).

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/lab-apps-lifecycle/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/lab-apps-lifecycle/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/lab-apps-lifecycle` | Passes |
| Goals gates | `bun run beep goals doctor` + `bun run beep goals index --check` | No new blockers |
| Round-trip slice | First Vertical Slice commands | Doctor green, clean tree |
| Delete verify battery | `beep tsconfig-sync --check`; `beep lint identity-registry`; `beep quality changeset-graph`; `beep fallow boundaries --check`; exact-name `rg` sweep | All green post-delete |

## Stop Conditions

- A lab variant would require relaxing a code law rather than a
  path-scoped ceremony exemption.
- delete-package cannot name a closed, testable surface set without a live
  inventory (geometry schema stops being the single source).
- Zero-root-churn proves impossible for a shared surface and the fallback
  is per-lab hand edits to shared config.
- Either track absorbs unrelated create-package, architecture-command, or
  CI-topology redesign work.
- Verification requires unnamed credentials, cost, destructive side
  effects outside the target lab, or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
