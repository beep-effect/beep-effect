# T3 hosted triage at 77fd55b858

The completed [Check run](https://github.com/beep-effect/beep-effect/actions/runs/38007697861)
was read at the exact PR #1571 head `77fd55b858`. Review closure reports zero
unresolved or actionable follow-up threads. That read is a dated observation,
not a waiver of the required fresh pre-merge read.

## Owned findings

- Root zero-warning ESLint rejects two bare package names in the T3 barrel
  JSDoc. The comment-only repair replaces them with plain transport prose;
  focused ESLint and full driver audit/docgen pass (17.3s and 2.3s).
- Node coverage fails the real SQLite writer-lock runtime test with `ambiguous`
  instead of `delivered`. A reproduction with Node, Bun and `python3` available
  but no `python` produces the same failure: the fixture's undeclared executable
  fails before the intended lock exercise. The corrective fixture uses the
  existing process runtime and explicit lock/release synchronization. Production
  retry behavior is unchanged; final focused verification is recorded below.

The second finding overlaps the test-portability portion of [#1587](https://github.com/beep-effect/beep-effect/issues/1587).
The other items in that issue are not claimed fixed.

## Inherited and environment attribution

| Hosted lane | Exact observation | Attribution / remaining action |
| --- | --- | --- |
| Repo Sanity | Changeset graph rejects private workspace release notes in `effected-allowlist-drop.md` and `jsonl-effect-first.md` | Files match integrated main; arrived through #1592. Shared-main owner repair, no local waiver |
| Test Unit A | Four documents-domain exact-wire fixtures omit new audit fields | Tests match integrated main; audit schema expansion from #1593 needs owner fixture reconciliation |
| Test Unit B | Eleven law-practice-tables converter/column fixtures omit new audit fields | Tests match integrated main; same #1593 owner repair |
| Coverage | Repeats inherited entity fixture failures plus the owned real-lock failure above | Fix the owned fixture here; no measured coverage-regression pass is claimed |
| Heavy / Docgen | Scratchpad `/v` regular expression example compiled at ES2022 | Exact fix landed in #1597 and is integrated through `91c9bf69e2`; fresh hosted proof still required |
| JSDoc Ratchet | Inventory generation fails before a findings report; wrapper masks the underlying exception | Same failure on main `320cedc` in job `114080589463`; generator/wrapper source matches main. Underlying exception remains unknown |
| Heavy / Lint Policy | Three inherited manifests lack doctest entries; main's language-service profile and 119 scratchpad files violate tsgo policy; 31 inline-schema diagnostics across 23 main-identical files; existing Accounts/PracticeKg inventories; two law-practice fixture project-service errors | Retain shared-main ownership. T3's two root TSDoc warnings are separately repaired above |
| Vercel deployments | Build rate limit | Allowed rate-limit exception only; no paid upgrade |

Secret Scanning, Security, SAST, Build, Check, Test Integration, Doctest,
Property Laws, both CLI unit partitions, package lint partitions and the other
successful checks retain their actual green outcomes on this head. In particular,
the old container pull failure and Node `bun:` import failure did not recur.
No failing job was blindly rerun or labelled successful.

## Delivery boundary

The branch remains under the existing Yeet publication and exact-head hosted
review/window gates. Inherited inventory/source repairs stay with their owners.
The earlier complete live T3 receipt and interrupted refactor receipt are
unchanged; this corrective wave changes a documentation comment and a test
fixture, not the attached production transport or grants.

## Corrective local verification

- Node coverage with `python` absent from PATH: four runtime cases passed in
  13.55s. The fixture reproducer failed before the repair under the same condition.
- Bun with the same restricted PATH: four runtime cases passed in 3.52s.
- Fixture type check, canonical test type check, focused Biome and root Oxlint:
  passed. CLI package verification `--quick` passed lint (3.7s) and check (7.4s).
  The quick scope is justified by test/fixture-only changes and the explicit
  Node/Bun execution above; production source and exported documentation did not
  change. The earlier full CLI audit remains separately source-bound evidence.
- Independent review: zero actionable findings on runtime test SHA256
  `bb863a61d85515bd27652527c9843604f055c060ec2a55da90741462be150b63`
  and fixture SHA256
  `63fe34553324fc9dab1e348b606d8bc03b328b278612f94f118a2948ab069899`.
- T3 full package audit/docgen and zero-warning ESLint passed for the comment
  repair. Configuration sync, cache policy, goal doctor, reflection validation
  and diff hygiene also passed after main integration.

These checks validate the corrective diff locally. They are not a successful
fresh hosted coverage run, and inherited unit fixtures still need their owners.

## Final publication detector repair

The final packet publish at `934a73fa3b` detected one additional owned EV002
statement fingerprint in the edited runtime test. Replacing broad context
capture/provision with explicit `Scope` and `ChildProcessSpawner` injection
removes that finding without changing the lock fixture or inventory.

- Focused membership: five current rows against six baseline rows, zero
  introduced and one resolved. The other five fingerprints are unchanged.
- Node coverage with `python` absent: four of four pass (12.23s). Bun with the
  same PATH: four of four pass (2.25s). Canonical test type check and root Oxlint
  pass; CLI quick verification passes lint (4.2s) and check (7.4s).
- Independent review: zero actionable findings on runtime test SHA256
  `5fc9d0be1ba9fcbd1893bdd6c89468874dd7b1a311d9177b1cc11f2d8447eec9`.
  Fixture SHA256 remains
  `63fe34553324fc9dab1e348b606d8bc03b328b278612f94f118a2948ab069899`.
- Child ownership, real lock acquisition/release, rollback, exit-zero check,
  single submission, single contention event and delivered-state assertions
  are retained. Production behavior and previous live T3 receipts are unchanged.

This supersedes only the runtime test's local proof above. Fresh hosted outcomes
and the shared-main blockers remain separate gates.

## Later hosted review: exact completion with a queued successor

Review [4236011886](https://github.com/beep-effect/beep-effect/pull/1571#discussion_r4236011886)
identified a P1 availability defect: after the exact submitted run completes,
a different queued run may already be active. The blanket active-run rejection
incorrectly made that successful delivery ambiguous and fenced subsequent mail.

The repair rejects only contradictory active status for the exact submitted run.
It preserves exact-run completion/provider/model checks, host configuration and
identity checks, participant ACK, one submission and no replay. A positive
fixture covers a different active successor; a negative fixture retains rejection
when the exact completed run is also reported active.

- Attached service SHA256:
  `3af807fa01d0d3cf97e4b9916324314d415cc0a9b2c808607d95fb0a795fdd99`.
- Attached test SHA256:
  `d1f3dcaed814b0fac3163120071977f1f0acd6d8c23e6a1a8ab918b8e26ad559`.
- Eleven focused cases pass under Bun (1.40s) and Node V8 coverage (9.36s).
  CLI quick lint/check pass; the affected Effect-Vitest row is unchanged, with
  zero introduced findings. Independent source-bound review finds zero issues.
- The full test type check exposed an additional runtime-fixture error channel;
  the correction and direct compiler proof are recorded below.

This is deterministic qualification of the new source, not another live model
run. Preserve the original complete live receipt and the two interrupted reverse
ambiguity holds. No old message is replayed or cleared.

Four later-round P2 threads are answered and resolved with tracked acceptance:
reflection/status/revocation wording in [#1581](https://github.com/beep-effect/beep-effect/issues/1581),
and completion after attached lease expiry in [#1603](https://github.com/beep-effect/beep-effect/issues/1603).
The latter remains fail-closed but can terminate the worker; its scoped follow-up
must preserve claim fencing and one native submission.

The `7e54626755` CI run reproduced the inherited eleven law-practice audit-field
fixture failures (job `114108772083`). Remaining work was cancelled because the
P1 repair requires a new head. Lint's aggregate failure reports cancelled shards;
that cancellation does not establish a source regression.

### Correction to the earlier test-typecheck claim

The earlier `package-test-typecheck` exit-zero result proved that its report
was written, not that the captured compiler passed. The report contained
TS2375/377003: filesystem/process `PlatformError` escaped the fixture's
`complete` implementation. This supersedes the earlier test-compiler-pass claim.
The final proof must use direct TSGo and inspect its actual exit code. Runtime
execution, package source checks and their recorded timings remain separate.

Final runtime fixture SHA256 is
`24488b59120bcd789a520421b34068343e97550a80eafeb784c2850239917946`.
Its typed wrapper converts only fixture `PlatformError` into `RouterError`,
preserving lock-timeout errors, assertion defects and all cleanup/delivery
assertions. Independent review found zero actionable findings. Direct full CLI
test TSGo exits zero. The four runtime cases pass with Python absent under Node
coverage (11.49s) and Bun (2.20s); CLI quick lint/check pass (3.6s/7.2s), as do
root Oxlint and diff hygiene. The quick package scope is supported by the small
postcheck change, the eleven attached regressions, four runtime regressions and
direct full test compilation. Earlier full package/live proofs retain their
original source binding; final hosted readiness remains unproved.
