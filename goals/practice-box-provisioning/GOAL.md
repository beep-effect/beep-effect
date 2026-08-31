# GOAL: Provision the practice Box tenant from versioned code

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `@beep/box` exposes the provisioning manager surface (reads first;
collaborations, webhooks, Box Sign requests) within its type budget, and an
Effect-native desired-state reconciler turns a versioned intent document into
a schema-validated dry-run plan artifact against the live tenant — then, with
the operator present, applies the starter client/matter tree under the
dedicated service identity with the attorney collaborated at client-folder
level.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/practice-box-provisioning/README.md`
- `goals/practice-box-provisioning/SPEC.md`
- `goals/practice-box-provisioning/PLAN.md`
- `goals/practice-box-provisioning/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, the schema-first and
effect-first skills, and the source exploration's decision log
(`explorations/practice-office-provisioning/DECISIONS.md` — binding). The
richest implementation reference is
`explorations/practice-office-provisioning/research/r4-provisioning-code-shape.md`.

Scope:

- In: `packages/drivers/box` (demand manifest, regeneration, tests); a
  NET-NEW reconciler package (home confirmed via `bun run beep architecture`,
  scaffolded via `bun run beep create-package`); this packet's docs/evidence.
- Out: SharePoint anything; Pulumi; metadata/retention mutations on the
  Business plan (surface `BlockedByEntitlement` instead); pruning/deleting
  live resources; Box Sign request workflows (gated sibling candidate);
  historical population.

Workflow:

1. P0: verify CCG platform-app approval on Business; repair Box SDK version
   provenance; pick the package home; record the Box quote table.
2. Schema → service contract → implementation, in that order. Dry-run is the
   default mode and performs no mutation; apply rechecks preconditions and
   fails closed on drift.
3. Reads before mutations in the driver; regenerate + remeasure the type
   budget after every demand-manifest change.
4. Keep client/matter names, tokens, and signing keys out of tracked
   artifacts — the repo is public.
5. Run `bun run beep quality package-verify @beep/box` (and the reconciler
   package's verify) before handing back.
6. At P4 Close, write the reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (driver surface in budget;
      dry-run plan proof with `BlockedByEntitlement` rows and repeat-run
      identity; operator-attended apply with all-`Noop` re-plan).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/practice-box-provisioning/GOAL.md)" -le 4000
jq . goals/practice-box-provisioning/ops/manifest.json
git diff --check -- goals/practice-box-provisioning
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. Never mutate the
live tenant outside the operator-attended P2 apply.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
