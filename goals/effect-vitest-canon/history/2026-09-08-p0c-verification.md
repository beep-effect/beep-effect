# P0c verification

Status: complete. Pinned full package verification and final command proof pass.

## Source handoff

The requested Codex CLI lane completed successfully after the documented xhigh
escalation. Its final answer points to [the lane report](lanes/p0c-detector.md).
The report records predicates, syntax-only limits, review closures and commands.
No source writer was live when package verification began. The orchestrator
captured SHA-256 maps for 17 affected source/test files before and after the run.
The maps match; their canonical JSON digest is
`40a1d3f9de177d6d27e58acd3ab280d7b918cba6922c24452d8f5e095d8176a9`.

## Scope and artifact audit

The orchestrator independently compared the command-produced census, baseline,
and all package row files after handoff:

- 1,072 files: 967 tests and 105 support modules, owned by 139 workspaces.
- All 1,043 P0a paths remain, with identical owner/kind assignments.
- Additions are three detector tests and 26 generated declarations: two schema
  declarations under `dist/internal/test/` and 24 repo-cli declarations under
  `dist/test/`. D9's literal support glob includes those paths. The repo-cli
  build accounts for the increase from the lane's 1,048-path handoff census.
- Every census byte count and physical line count matches the current file.
  Empty files count as zero lines; a terminal newline adds no phantom line.
- 5,012 findings with 5,012 unique IDs. The 121 JSONL files have exactly the
  same complete records as the baseline, with no missing or extra rows.
- The three new detector tests have no mechanical findings. Two native platform
  filesystem imports remain explicitly classified as EV010 judgment candidates.

The final private receipt is `p0c-post-package-artifact-audit.json` in the packet's
cache. It also proves that only the census changed after the package build;
the baseline and all 121 package row files match the source handoff exactly.
The generated baseline is not a claim that all candidates are confirmed defects;
the four-lens judgment work remains P1.

## Command and focused proof

The final lane report records the following on the handed-off source:

| Check | Result |
| --- | --- |
| Exact combined census/baseline/rows writer, twice | Exit 0; process walls 8.61 and 8.43 seconds; identical artifacts. |
| Exact default ratchet | Exit 0; introduced 0, resolved 0; process wall 8.34 seconds. |
| Temporary new-instance probe | Default exits 1 for exactly one added runtime boundary; the owned probe was removed and default returns clean. |
| Focused tests | Five files; 55 passed and 186 intentionally unselected; exit 0. |
| Independent rule probes | 15/15 pass without weakening their expectations. |
| Persistence and discovery | Stale owned rows removed, unrelated JSONL retained, actual discovery exact, Drizzle EV007 3/3. |
| Direct Effect tsgo | Exit 0 with no diagnostics. |
| Changed-file Biome | 17 files checked; exit 0; no fixes. |
| Package docgen | 229 modules and 1,530 examples; typecheck and generation pass. |

Earlier sandbox `EPERM` and git-fixture exit 128 results remain environment
diagnostics, not accepted package proof. The orchestrator's full package run
exercises the package's complete audit, including the existing test suite.

## Full package verification

Exact command:

```bash
bun run beep quality package-verify @beep/repo-cli
```

The first orchestrator run exited 0 in 376.068 seconds: audit 358.0 seconds,
docgen 16.2 seconds. The source hashes remained stable. Live executable paths
show that this run used Bun 1.4.2 after the workstation's mutable `latest` alias
changed; the repository continues to pin 1.4.1. This is a green supplemental
result, recorded without attributing it to the pinned environment.

The second run selected installed Bun 1.4.1 through a command-scoped PATH, with
Node v24.20.0 recorded at launch. No workstation setting or repository pin was
changed. It exited 0 in 369.342 seconds: audit 351.3 seconds, docgen 16.2 seconds.
Live process executable checks confirmed the pinned runtime through the test
workers. All 17 source/test hashes remained stable.

After that gate, the orchestrator ran the exact combined writer twice and the
exact default ratchet under Bun 1.4.1. Both writers exited 0 in 7.230 and 7.395
seconds; the default exited 0 in 7.616 seconds with introduced 0 / resolved 0.
All three discovered 1,072 files and 5,012 findings. The two complete exports
are byte-identical, and source hashes still match package-verification output.
These are full CLI process-wall measurements, including startup and artifact I/O.
Private receipts: `p0c-package-verify-pinned-status.json`,
`p0c-final-command-proof.json`, and their adjacent command logs.

## Next gate

P0c is complete. P0d must supply the complete pinned graph and graph-backed
hints with coverage and pin-mismatch tests. Charters, instrumented tests,
filesystem conformance, Grok review, PR readiness and Benjamin's ratification
remain later gates. No staging, commit, push or PR was part of this phase.

After the phase status update, `bun run beep goals doctor` and
`bun run beep goals index` both exit 0 under Bun 1.4.1. Doctor reports 177 packets,
zero new/inherited blocking findings, and the same four unrelated advisories.
The goal launcher remains 2,788 characters.
