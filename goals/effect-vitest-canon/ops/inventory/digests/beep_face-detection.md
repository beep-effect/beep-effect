# @beep/face-detection: four-lens source inventory

| Lens | Rows |
|---|---:|
| resource | 3 |
| flake | 3 |
| property | 3 |
| observability | 3 |

3 files; 0 review items and 12 coverage rows. Severity counts: info 12.


## Top files by human row count

- `packages/drivers/face-detection/test/FaceDetection.equivalence.test.ts`: 4 rows; full read 1–36 (test).
- `packages/drivers/face-detection/test/FaceDetection.service.test.ts`: 4 rows; full read 1–266 (test).
- `packages/drivers/face-detection/test/OnnxRuntimeInstall.test.ts`: 4 rows; full read 1–176 (test).

## Layer topology and native boundaries

Face service uses one pure fake Layer.succeed for two workflows; it never loads a model. The real service withDetector uses acquireUseRelease for an ONNX session (FaceDetection.service.ts:887-901), but that native session lifecycle is outside these fake workflows. OnnxRuntimeInstall has one NodeServices block and seven test-scoped temp fixtures; it reads installed install-utils.js and executes it in a VM. Only HTTPS responses, temp root and timestamp are controlled. Installed script uses native fs.mkdtempSync, writeFileSync and renameSync (132-196). MemoryFileSystem cannot replace this subject without also bypassing the real upstream installer. No rebuild savings or inference/model coverage are established.

## Findings

No additional actionable judgment beyond existing mechanical candidates. File-specific NONE rows retain the source evidence and limitations.

## Retained timing and history

14 registrations, statuses {'passed': 14}, exit 0; whole command 7.070447s; reporter span 6607.755ms. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. Head `662823dd960367046ba7d73dd8fd25d15782865a`; reporter SHA256 `19b6ded6629143a852e84147aa234c1ab121e3f53f8cc4bdb5c53ec0ab8fe7a3`. Exact command shape: `bunx vitest run --reporter=json --outputFile=<private absolute raw report>`, package cwd. Root accepted that configured Node cohort, not a new proof from this audit.

Slowest reported files:

- `packages/drivers/face-detection/test/FaceDetection.service.test.ts`: 45.755ms, 6 tests.
- `packages/drivers/face-detection/test/OnnxRuntimeInstall.test.ts`: 36.441ms, 7 tests.
- `packages/drivers/face-detection/test/FaceDetection.equivalence.test.ts`: 1.799ms, 1 tests.

Hosted history: 0 mapped observation rows across 0 jobs; categories {}.

## P2 order and uncertainty

Scope/isolation and native boundaries first; assertion-family corrections next, preserving payload/cause, operand, polarity and every count. Then native property registration retaining current fcRuns floors (20/25/50 where present), seeds, generators and invalid-boundary cases; flake work only with supported causes; safe observability last. Do not transfer old exceptions or replace a native subject to make a test green. All proposal statuses remain open; P2 remains gated.

Campaign timing facts remain 139 attempts, 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d browser file was absent, not skipped. The failed effect-drizzle Bun.sqlite collection remains a failed Node cohort; no substituted driver or fabricated timing. Hosted 527 failed runs include 21 unavailable logs and one unresolved cause; observations are not unique flakes. Zero mapped history is not proof of no failures. A passing configured run proves neither race freedom nor coverage/full package verification. rc113 adapter with Vitest4.1.11 remains outside its declared Vitest5 peer range; compatibility is receipt-bound. No package tests, services or benchmarks were run here.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
