
## 2026-10-14 — admission environment

- Task: build dependency dists before package checking.
- Evidence: `beep-heavy -- bunx turbo run build --filter='@beep/repo-utils^...'`
  exited 1: user scope bus environment was absent.
- Prevention: inject `XDG_RUNTIME_DIR` and `DBUS_SESSION_BUS_ADDRESS` into lane launches.
  The installed wrapper also forwards a literal `--` as the command; invoke without
  that separator after inspecting its implementation.

## 2026-10-14 — native transport runtime and stale virtual text

- Task: execute the new scoped native parser in repository test/research entrypoints.
- Evidence: Bun execution fails in upstream `SyncRpcChannel` at `stdout._handle.fd`.
  Node Vitest loads the fixture successfully. Reopening a virtual filename also
  returned its earlier source text despite a changed-file notification.
- Prevention: document the sync API's Node runtime requirement; run only native
  parser test files on Node and retain the other tests on Bun. The script model's
  `ImplScriptDefault` describes implementation text as stamped only when missing;
  generated task-facing wrappers stay managed by `package-scripts --write`.
  Give each virtual parse a distinct path and retain regression assertions for
  both source versions in the same scope.

## 2026-10-14 — first package verification failures

- repo-configs audit: introduced TS1543 on native package.json import under NodeNext;
  add the required JSON import attribute and rerun the package gate.
- Native package declarations differ from classic helper names: use
  `isStringLiteralLikeNode`, validated against ast/is.generated.d.ts.

## 2026-10-14 — fresh SDK dist and research helper parity

- Root check initially failed only in unchanged infra dependency sources with
  TS1295/TS1287. The fresh worktree had not prepared `@pulumi/gharunners`; the
  existing `bun run infra:prepare-gha-runners` succeeded, and the root rerun's
  266 Turbo tasks and Effect rule checks passed. That existing third-party SDK
  preparation still uses TS6; dependency exit belongs to the other program lanes.
- Facet census hit helper-name differences (`isParameterDeclaration` and
  `isStringLiteralLikeNode`) and absent already-retired concept source files.
  Validate all callable AST exports against declarations and preserve the old
  missing-source behavior by parsing empty text for those concept files.
- A broad census initially retained all native snapshots. Clone syntax trees
  through upstream `getSynthesizedDeepClone` within per-file scopes; retain the
  pure-JS trees for counting and release native handles immediately.

## 2026-10-14 — repair-wave compiler law

- Task: replace the synchronous executable probe with the Effect process spawner.
- Evidence: dependency build and the first repo-utils/effect-drizzle audits reported
  TS377047 (`effectFnOpportunity`) on the resolver's zero-argument callback.
- Attribution: introduced by repair wave 1; replaced the callback with named
  `Effect.fn("TsNativeApi.resolveExecutable")` before rerunning the affected checks.
- Prevention: use named Effect functions for generator-backed callbacks at authoring time.

## 2026-10-14 — hosted docgen metadata preflight

- Task: run `docgen:local --base origin/main` for hosted parity.
- Evidence: the existing lockfile diff forces `--full`; the full preflight reported
  missing module-fileoverview `@since` in both new TsNativeApi source files, despite
  their package audit/docgen passing. Added package documentation with `@since 0.0.0`.
- Attribution: introduced in the original Lane D implementation; repaired in wave 1.
- Prevention: package docgen acceptance should also run the hosted metadata preflight.

## 2026-10-14 — full docgen infra dependency blocker

- Task: rerun full docgen after repairing Lane D module metadata.
- Evidence: `docgen:local --base origin/main --full` exited 1 after 78 successful
  Turbo tasks. `@beep/infra` examples compile vendor `@pulumi/gharunners` source:
  TS1205 (type reexports), TS1294 (non-erasable syntax), TS4114 (missing override).
- Attribution: unrelated infra/vendor surface; infra has no diff against origin/main.
  Lane D package audits/docgen pass. Orchestrator owns consolidated infra remediation.
- Prevention: qualify vendor source entrypoints against docgen's strict example
  settings, separately from preparing their runtime dists; retain the exact log in
  the repair-wave evidence directory rather than weakening compiler checks here.

## 2026-10-14 — session ledger write restriction

- Task: write the closeout session note through the canonical command.
- Evidence: `beep session note --state open` exited 1 without a diagnostic in the managed filesystem profile.
- Prevention: investigate the silent failure; the session-ledger destination is outside
  this lane's writable roots. Authorize that root in lane launches if required;
  the lane packet and orchestrator-cache report retain the handoff in this session.

## 2026-10-14 — canonical NodeServices layers retain EV010 findings

- Task: repair Lane D wave 2 without refreshing the effect-vitest baseline.
- Evidence: both Node suites pass 7/7; canonical shared layers eliminate EV002/EV004.
  `emitPlatformFinding` unconditionally emits EV010 for NodeServices imports; the
  detector parity tests explicitly require that finding for root/subpath imports.
- Attribution: detector policy limitation; NodeServices is required for the real
  native compiler process and fixture access. Replacing it with a memory filesystem
  would change the integration subject. Timed shared layers leave two EV010 rows.
- Prevention: distinguish platform services owned by a canonical shared test layer
  from opaque platform provenance, with a qualified native integration disposition.
  This lane preserves the baseline and does not broaden the repair into detector code.
