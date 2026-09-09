# Run-3 synthetic admission scenario — PR-1 implementation report

Implemented and committed. The required Stage B handoff at
`~/.cache/beep/ciops-synthetic-root` is **blocked by target provisioning**.
The exact export command correctly refused the non-empty target, which contains
managed-sandbox read-only `.agents/`, `.codex/`, and `.git/` directories. No
`READY`, `scenario.json`, admission files, or checkout journals were written there.
A complete, verified **review export** is preserved inside this worktree at
`~/YeeBois/projects/beep-effect8-worktrees/ciops-synthetic-fixture/.beep/synthetic-fixture-proof/export-final`. It is not a completed handoff at the requested path.

## Committed deliverable

- Branch: `feat/ciops-synthetic-admission-fixture`.
- Base: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`.
- Commit: `97f3b5579443c6ea102c46398ba90d14496e3ad4`.
- Message: `feat(repo-cli): add the synthetic admission eviction scenario spec`.
- Only committed path: `packages/tooling/tool/cli/test/quality-scheduler-synthetic-scenario.test.ts` (470 added lines; one `it`).
- Spec SHA-256: `d411cc141e357283df105ec19ad491c1fbba19a17e8e64b44edb99de3fce8cac`.
- Read the complete lane brief, repo `AGENTS.md`, and the requested DECISIONS
  sections (Rulings 1–21) before implementation.
- No scheduler source changes, no edits to the existing `quality-scheduler.test.ts`,
  no edits to `explorations/` in this worktree, no push, and no PR.
- The pre-existing `.claude/settings.json` change remains unstaged and uncommitted.
- Local commit signing was disabled for these commit invocations only because the
  configured SSH signer is the Desktop 1Password program. No signing configuration
  was edited and no Desktop unlock/sign-in flow was requested. Commit hooks ran.
  The initial local commit message had a literal escape; it was corrected in the
  final local commit above with a message file. The spec bytes did not change.

## Asserted event multiset and chains

| Journal tag | Count | Schema version |
| --- | ---: | --- |
| `admission-enqueued` | 2 | v3 |
| `admission-admitted` | 1 | v1 (current admitted event class) |
| `admission-withdrawn` | 1 | v3 |
| `admission-lease-evicted` | 1 | v3 |
| `admission-ticket-evicted` | 1 | v3 |
| `admission-released` | 1 | v3 |

Seven rows total, decoded by `AdmissionJournalEvent` and checked with its guards.
Each chain is asserted by its actual nonce:

- Contender A: `admission-enqueued → admission-admitted → admission-released`.
- Contender B: `admission-enqueued → admission-withdrawn`.
- Dead lease: `admission-lease-evicted` only.
- Dead ticket: `admission-ticket-evicted` only.

Protocol v2 with eviction on is published before admission. The capacity is three
tokens and each contender weighs three tokens, so exactly one fits. A's deferred
signal establishes admission; B's durable enqueue row establishes its waiting
state before interruption. B never executes its admitted body. Its withdrawn row
mirrors enqueue identity and has neither `weightTokens` nor `reason` on the wire.

Each fixture has a separate checkout root, branch, attempt UUID, and nonce. A
same-source process-start mismatch is asserted dead before writing the fixtures;
the real eviction and termination writers produce the resulting rows. The lease
eviction retains checkout, branch, and the fixture heartbeat, with reason
`owner-dead-or-reused`; the ticket reason is `queued-submitter-death`. Each fixture
checkout gets exactly one `attempt-terminated` row with its own attempt UUID.
The second reap changes neither admission nor attempt journals. Claims are empty
and all coordination directories are empty after release; no lock files or lock
sidecars remain. Active contender directory observations exclude the scheduler's
atomic `.tmp-` heartbeat files, following the existing helper; final cleanup
observations are unfiltered.

## Export behavior and retained review copy

The switch is read through Effect `Config` before installing the test configuration
override. It reads the same `BEEP_CIOPS_SYNTHETIC_ROOT` environment variable without
triggering the repository's process-environment diagnostics. Unset or empty means
no external export. Every ordinary test also checks the exporter inside the scoped
temporary root, including refusal to overwrite its completed test export.

The copy allows only `journal.ndjson`, `protocol.json`, the four requested admission
directories, and the three labeled checkout run trees. It omits lock paths and
preserves empty directories. It hashes its own source bytes through
`fileURLToPath(import.meta.url)` at execution time. `READY` is an empty file written
last. A separate read-only inspection verified the final review copy's source hash,
seven raw rows, chains, protocol, two attempt journals, absence of lock paths, and
that READY's timestamp is at least as new as every exported file.

A's `runs/` directory is an empty receipt: `withQualityAdmission` emits admission
rows but does not emit normal attempt-started/finished rows. Those belong to the
higher-level Yeet handler. Both dead fixture journals are real termination-writer
output; no normal A attempt rows were fabricated.

Review export root (READY present):
`~/YeeBois/projects/beep-effect8-worktrees/ciops-synthetic-fixture/.beep/synthetic-fixture-proof/export-final`

```text
READY
admission/
admission/claims/
admission/journal.ndjson
admission/leases/
admission/protocol.json
admission/quarantine/
admission/queue/
checkouts/
checkouts/contender-a/
checkouts/contender-a/.beep/
checkouts/contender-a/.beep/yeet/
checkouts/contender-a/.beep/yeet/runs/
checkouts/dead-lease/
checkouts/dead-lease/.beep/
checkouts/dead-lease/.beep/yeet/
checkouts/dead-lease/.beep/yeet/runs/
checkouts/dead-lease/.beep/yeet/runs/feat_synthetic-dead-lease-f004a5320ab9/
checkouts/dead-lease/.beep/yeet/runs/feat_synthetic-dead-lease-f004a5320ab9/attempts.ndjson
checkouts/dead-ticket/
checkouts/dead-ticket/.beep/
checkouts/dead-ticket/.beep/yeet/
checkouts/dead-ticket/.beep/yeet/runs/
checkouts/dead-ticket/.beep/yeet/runs/feat_synthetic-dead-ticket-7e2dab5a5a8b/
checkouts/dead-ticket/.beep/yeet/runs/feat_synthetic-dead-ticket-7e2dab5a5a8b/attempts.ndjson
scenario.json
```

The requested handoff root remains:

```text
~/.cache/beep/ciops-synthetic-root/
  .agents/  [read-only sandbox entry]
  .codex/   [read-only sandbox entry]
  .git/     [read-only sandbox entry]
  [no READY or exported payload]
```

## scenario.json from the final review export

This is the actual generated manifest for the final committed spec hash, not a
manifest from the blocked required target.

```json
{
  "producer": {
    "path": "packages/tooling/tool/cli/test/quality-scheduler-synthetic-scenario.test.ts",
    "sha256": "d411cc141e357283df105ec19ad491c1fbba19a17e8e64b44edb99de3fce8cac"
  },
  "steps": [
    "Publish protocol v2 with eviction on under the runtime-root test override.",
    "Admit contender A with an attemptId, checkout root, and branch into the only slot; hold its lease.",
    "Wait for contender B to enqueue behind A, then interrupt B while waiting.",
    "Write synthetic dead-owner lease and ticket fixtures with distinct checkout roots and attemptIds.",
    "Reap both fixtures through the real eviction and attempt-termination writers; acknowledge all claims.",
    "Finish A, assert the complete per-nonce chains, then reap again to prove idempotence and lock cleanup."
  ],
  "capturedAt": "2026-09-09T04:47:12.708Z",
  "expected": {
    "tags": {
      "admission-enqueued": 2,
      "admission-admitted": 1,
      "admission-withdrawn": 1,
      "admission-lease-evicted": 1,
      "admission-ticket-evicted": 1,
      "admission-released": 1
    },
    "chains": [
      {
        "label": "contender-a",
        "nonce": "ed64ee55-a396-43ec-a2d2-bcacf41a354e",
        "tags": [
          "admission-enqueued",
          "admission-admitted",
          "admission-released"
        ]
      },
      {
        "label": "contender-b",
        "nonce": "6e3c1666-37c8-41b0-8353-b075e8b07287",
        "tags": [
          "admission-enqueued",
          "admission-withdrawn"
        ]
      },
      {
        "label": "dead-lease",
        "nonce": "synthetic-dead-lease",
        "tags": [
          "admission-lease-evicted"
        ]
      },
      {
        "label": "dead-ticket",
        "nonce": "synthetic-dead-ticket",
        "tags": [
          "admission-ticket-evicted"
        ]
      }
    ]
  }
}
```

## Verification commands, verdicts, and attribution

Commands ran from the worktree root unless a package directory is specified.
`<spec>` below denotes `packages/tooling/tool/cli/test/quality-scheduler-synthetic-scenario.test.ts`.
Logs are retained under `.beep/synthetic-fixture-proof/` in this worktree.

| Command | Verdict and attribution |
| --- | --- |
| `bunx vitest run <spec>` | Final spec passes. After correcting the active-heartbeat observation race, five consecutive repetitions also passed; `vitest-repeat-1.log` through `vitest-repeat-5.log`. Earlier introduced errors and their fixes are recorded below. |
| `BEEP_CIOPS_SYNTHETIC_ROOT=~/.cache/beep/ciops-synthetic-root bunx vitest run <spec>` | **FAIL, environment-only target provisioning**. Assertions completed, then the required non-empty-target refusal fired. Exact message: `BEEP_CIOPS_SYNTHETIC_ROOT must be empty; refusing to overwrite a non-empty export target.` `export.log`. |
| `BEEP_CIOPS_SYNTHETIC_ROOT=.beep/synthetic-fixture-proof/export-preview bunx vitest run <spec>` | PASS for an intermediate version. Preserved as an earlier development receipt; its hash is stale and it is not the final review export. `export-preview.log`. |
| `BEEP_CIOPS_SYNTHETIC_ROOT=.beep/synthetic-fixture-proof/export-final bunx vitest run <spec>` | PASS for the final source hash above. Initial attempt caught the active-heartbeat observation race before writing any target bytes; corrected attempt produced the complete review export. `export-final.log`. |
| `bun run beep quality package-verify @beep/repo-cli --quick` | PASS: lint and source check. Run twice; final quick run reported lint 2.8s and check 9.9s. `package-verify-quick.log`, `package-verify-quick-final.log`. |
| `bun run beep quality package-verify @beep/repo-cli` | **FAIL**: audit 351.2s; docgen PASS 17.1s. Dependency builds and repo-cli build/check passed. Package tests: 162 files passed, 2 failed; 3,153 tests passed, 27 failed. Attribution below. `package-verify-full.log`. |
| `bunx oxlint --quiet --disable-nested-config <spec>` | PASS, including module-scope Schema decoder/guard policy. Final `oxlint.log` is empty. |
| `bunx biome check --write <spec>` and `bunx biome check <spec>` | PASS on final source. Latest run applied no fixes. No Biome suppression remains. `biome.log`. |
| `bun run package-test-typecheck` in `packages/tooling/tool/cli` | PASS on final source: `.turbo/package-test-typecheck-result.json` has `exitCode: 0` and empty diagnostics. The task's shell exit alone is insufficient: earlier executions returned zero while the artifact reported introduced type/law errors, which were fixed. `test-typecheck.log`. |
| `git diff --check` and `git diff --cached --check` | PASS. Only the requested spec was staged by path. |
| Read-only Python artifact inspection | PASS: final spec/manifest hash match; raw tag counts and nonce chains match; protocol v2/on; exactly two attempt-journal files; READY empty and last; no lock paths. |
| Commit hooks | PASS: gitleaks (no leaks), typos, Biome, and commitlint. Message correction re-ran commitlint successfully. |

The full audit failures were in unchanged specs:

- **Environment-only:** 26 `yeet.test.ts` cases failed with `EROFS` when their
  fixtures accessed the protected host runtime root. The new scenario uses the
  runtime-root test override and does not have this failure.
- **Inherited/environment-sensitive:** the unchanged `tmpfs-reap.test.ts` case
  `distinguishes a live file descriptor from a live working-directory reference`
  observed `refCount: 0`. This lane has not established whether the underlying
  cause is proc visibility or a pre-existing test assumption; no scheduler/source
  fix was attempted.
- The audit short-circuited after the package test phase, before its Python and
  remaining lint phases. Quick lint and the separate full docgen step did pass.
- The full audit ran before the final test-only typing/configuration and active
  directory-observation corrections. Final spec runtime/type/lint and export proof
  were refreshed afterward. The known broad local failures were not rerun or
  repaired, following the brief's instruction to report local reds.
- The generated P0 audit row was acknowledged with:
  `bun run beep yeet inbox ack local-shard-9ba7e2294ca8 --wontfix --reason "Outside the authorized spec-only lane: 26 existing Yeet tests fail EROFS in the managed sandbox and the unchanged tmpfs-reap live-FD test fails its refCount assertion. Full audit failure is reported in the lane report; scheduler source changes are prohibited."`
  The acknowledgement succeeded (`inbox-ack.log`). It records the scoped disposition;
  it does not change the audit verdict or claim the failures are fixed.

Hosted CI remains the proof of record. No hosted checks were requested or observed,
because this lane must not push or open a PR.

## Deviations and open handoff question

1. **Required export location not delivered.** Its protected sandbox entries make
   it non-empty on each invocation. The strict refusal contract is unchanged; no
   entry was ignored, removed, or overwritten. The operator was asked to provision
   the exact target empty and writable. No response or environment change was
   available at report time. Once provisioned, run the exact export command above
   from this committed worktree and refresh this report with that target's manifest.
2. **Review copy retained in the worktree.** This additional ignored artifact keeps
   the result concrete and reviewable while the required target is blocked. It must
   not be mistaken for a completed Stage B handoff at the requested path.
3. The same-source dead/reused identity fixture, empty A run receipt, Config switch,
   and internal exporter regression checks are implementation details described
   above. They preserve the specified scheduler behavior and one-spec scope.
4. The commit is local and unsigned as described above. The existing global signer
   configuration and pre-existing settings change are preserved.

No code-design questions remain. The outstanding operational requirement is an
empty, writable exact export target; the full hosted proof belongs to publication
and review by the steward.

## Friction receipts captured during the lane

The following is the chronological working ledger. Final behavior and verdicts
above supersede intermediate implementation choices (including the subsequently
removed Biome suppression).


- Initial `graft grep` returned `no graph — run graft build first`; started the deterministic build. Provisioning the graph when creating the lane would avoid this delay.
- `.repos/effect` is absent in this worktree; the existing shared reference is available through the main checkout. Provisioning the local symlink avoids the discovery detour.
- The required export target `~/.cache/beep/ciops-synthetic-root` already contains read-only `.agents/`, `.codex/`, and `.git/` directories installed by the managed sandbox. The brief requires refusal for any non-empty target; these entries must be preserved. An actually empty writable target would avoid this export blocker.

The pre-existing `.claude/settings.json` change is outside this lane and will remain uncommitted.

- The added internal export regression exposed an introduced Effect helper-name error, `isNonEmptyArray is not a function`. Corrected to the Effect v4 reference symbol `A.isArrayNonEmpty`; the focused test now passes. Exercising the exporter even when the switch is unset prevented an untested export branch.
- The exact requested export command completed the scenario assertions and then correctly failed with `BEEP_CIOPS_SYNTHETIC_ROOT must be empty; refusing to overwrite a non-empty export target.` Attribution: environment-only target provisioning. No exported bytes or READY marker were written. Asked the operator whether the exact target can be made empty while continuing verification.
- The direct-only export variable initially raised Biome `noUndeclaredEnvVars`; added a local explanatory suppression because the brief limits PR-1 to the spec and exports must run through direct Vitest rather than cached Turbo tasks.

- Full package verification completed: dependency build and repo-cli build/check passed, docgen passed, and the package test phase reported 27 failures across two unchanged specs. Twenty-six `yeet.test.ts` cases hit `EROFS` against the host runtime root (environment-only); `tmpfs-reap.test.ts` could not observe its expected live file descriptor (inherited/environment-sensitive, no stronger causal claim). Audit stopped before Python and remaining lint phases. The P0 audit row was acknowledged `--wontfix` with the scoped brief and exact failure classes; this is an acknowledgement, not a passing audit.
- The separate package test typecheck exposed introduced errors that normal Vitest and the source-only quick check did not cover: Effect environment diagnostics, partial-record typing, and passing a schema decoder with an optional second argument directly to `Effect.forEach`. Fixed by reading the export switch with `Config` before the runtime configuration override, reusing the existing `Bun.env` PATH pattern, counting each expected tag plus total row count, and adapting the decoder callback. The final typecheck result artifact has `exitCode: 0` and empty diagnostics. The task command itself exits zero even when its result artifact contains errors, so the artifact was inspected explicitly.
- An initial extra typecheck launch used an incorrect relative log redirection; the shell rejected the path before running verification. Corrected the redirection and used the package-owned task. A non-blocking mise tracked-config warning reports a read-only state directory (environment-only).

- An export run exposed an introduced race in active-directory assertions: an atomic heartbeat temporary file could inflate A's lease directory count. Reused the existing scheduler spec's `.tmp-` filtering for active contender observations only; post-release cleanup still reads every entry without filtering. The corrected export passed; a five-run repetition check is in progress.

