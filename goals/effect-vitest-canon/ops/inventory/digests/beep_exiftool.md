# @beep/exiftool: four-lens source inventory

| Lens | Rows |
|---|---:|
| resource | 4 |
| flake | 4 |
| property | 4 |
| observability | 4 |

4 files; 2 review items and 14 coverage rows. Severity counts: info 14, minor 1, major 1.


## Top files by human row count

- `packages/drivers/exiftool/test/Exiftool.equivalence.test.ts`: 4 rows; full read 1–19 (test).
- `packages/drivers/exiftool/test/Exiftool.models.test.ts`: 4 rows; full read 1–281 (test).
- `packages/drivers/exiftool/test/Exiftool.service.test.ts`: 4 rows; full read 1–339 (test).
- `packages/drivers/exiftool/test/integration/Exiftool.live.test.ts`: 4 rows; full read 1–178 (test).

## Layer topology and native boundaries

The six service cases each build a layer that stages one scoped Exiftool config file (Exiftool.service.ts:386-399). Five cases own temp directories. Fake process writes use the same FileSystem interface as the subject, so MemoryFileSystem can serve this synthetic cohort after preserving staging/rename/rollback assertions. The three live cases build separate native layers and run version checks; real PNG/GIF interoperability and process exits require native paths and the actual binary. Scoped config reuse may reduce setup, but no isolated build-cost measurement supports a numerical speedup. Do not share mutable command captures.

## Findings

- `L-RES-04` minor, `packages/drivers/exiftool/test/Exiftool.service.test.ts:56–110`: Fake spawner writes staged bytes through FileSystem; native NodeServices is not needed to exercise these synthetic write/rollback paths. During D14 migration use fresh MemoryFileSystem fixtures for the fake-spawner service cohort, retaining command order, failed-exit code, staged/original bytes and empty-staging checks. Keep the real PNG/GIF integration native; do not share commands arrays.
- `L-FLAKE-06` major, `packages/drivers/exiftool/test/integration/Exiftool.live.test.ts:28–35`: exiftoolAvailable maps every typed version error to false, so nonzero version exits also become successful skip notices. Distinguish verified binary absence from other version failures without catch-all success. Preserve all three registrations, native calls and assertions; report unavailable execution explicitly. Do not retry, increase timeouts or turn a nonzero process result into passing native evidence.

## Retained timing and history

17 registrations, statuses {'passed': 17}, exit 0; whole command 7.473398s; reporter span 6532.051ms. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. Head `662823dd960367046ba7d73dd8fd25d15782865a`; reporter SHA256 `7dad002a5fa040eca4229a0552dbe3c38a958a15f240e89e7257370a849e6921`. Exact command shape: `bunx vitest run --reporter=json --outputFile=<private absolute raw report>`, package cwd. Root accepted that configured Node cohort, not a new proof from this audit.

Slowest reported files:

- `packages/drivers/exiftool/test/integration/Exiftool.live.test.ts`: 244.051ms, 3 tests.
- `packages/drivers/exiftool/test/Exiftool.models.test.ts`: 36.961ms, 7 tests.
- `packages/drivers/exiftool/test/Exiftool.service.test.ts`: 22.883ms, 6 tests.
- `packages/drivers/exiftool/test/Exiftool.equivalence.test.ts`: 1.626ms, 1 tests.

Hosted history: 0 mapped observation rows across 0 jobs; categories {}.

All three live-named cases are reported passed, but each can return a skip notice before assertions. Names/durations alone do not prove the binary path executed; no raw log claim resolves that ambiguity here.

## P2 order and uncertainty

Scope/isolation and native boundaries first; assertion-family corrections next, preserving payload/cause, operand, polarity and every count. Then native property registration retaining current fcRuns floors (20/25/50 where present), seeds, generators and invalid-boundary cases; flake work only with supported causes; safe observability last. Do not transfer old exceptions or replace a native subject to make a test green. All proposal statuses remain open; P2 remains gated.

Campaign timing facts remain 139 attempts, 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d browser file was absent, not skipped. The failed effect-drizzle Bun.sqlite collection remains a failed Node cohort; no substituted driver or fabricated timing. Hosted 527 failed runs include 21 unavailable logs and one unresolved cause; observations are not unique flakes. Zero mapped history is not proof of no failures. A passing configured run proves neither race freedom nor coverage/full package verification. rc113 adapter with Vitest4.1.11 remains outside its declared Vitest5 peer range; compatibility is receipt-bound. No package tests, services or benchmarks were run here.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
