# Instance

- id: `docgen-runpod-cleanup-outcome`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerRunpodEval.ts:170`
- symbol: `DocgenQualityWorkerRunpodEvalCleanup`
- members: `keepPod`, `deleteStatus`, `stopStatus`, `error`
- evidence: E4/E1 at `QualityWorkerRunpodEval.ts:739-797` — debug keep skips both operations; cleanup runs stop then delete independently and derives error presence from their Results.

# Current shape

The nested cleanup class stores three-value stop/delete statuses, duration, nullable error, and keepPod (`QualityWorkerRunpodEval.ts:109-114,170-183`). `cleanupSkipped` supplies an initialization fallback; the release action either records debug keep or calls stop then delete regardless of the first result, derives both statuses independently, and joins errors in stop-then-delete order (`QualityWorkerRunpodEval.ts:725-797`). The result is nested in the Runpod wrapper report, affects recommendation at 966-980, and is encoded to stable JSON and written by the command (`QualityWorkerRunpodEval.ts:231-253,1165-1184,1190-1300`; `Docgen.command.ts:1070-1085`).

# Cardinality gap

keepPod (2) × delete status (3) × stop status (3) × error presence (2) represents 36 tuples. Five are legitimate:

| kind | keepPod | stop | delete | error |
| --- | --- | --- | --- | --- |
| `kept` | true | skipped-debug-keep | skipped-debug-keep | null |
| `cleaned` | false | completed | completed | null |
| `stop-failed` | false | failed | completed | string |
| `delete-failed` | false | completed | failed | string |
| `stop-and-delete-failed` | false | failed | failed | string |

Stop and delete outcomes remain independent. Error is null exactly for kept or both completed. `cleanupSkipped(false)` is an internal pre-acquisition fallback with both failed and a message; the successful acquire/use/release result overwrites it. Its tuple has the same field combination as the fifth row and remains an internal lifecycle sentinel; it does not add a sixth encoded state.

# Target schema

Keep `DocgenQualityWorkerRunpodEvalCleanupStatus` as the owner of the exact encoded status literals. Define five annotated cleanup cases discriminated by `kind`, with duration common and required error only on failure cases. The kept case carries no operation result payload; the four run cases carry exact stop/delete outcomes. Combine through `S.toTaggedUnion("kind")`.

Keep a private encoded cleanup schema with current property names, order, status literals, nullable error, and keepPod. A fallible `S.decodeTo` transform accepts the five legitimate tuples and encodes the exact inverse.

# Migration inventory

- `QualityWorkerRunpodEval.ts:109-183` — retain the status LiteralKit and replace the decoded cleanup bag with five cases plus compatibility transform.
- `QualityWorkerRunpodEval.ts:725-797` — preserve `cleanupSkipped`, keep behavior, unconditional stop-then-delete attempts, independent Results, and error joining order; construct one case after both operations.
- `QualityWorkerRunpodEval.ts:966-980` — match the cleanup case for recommendation without changing cleanup-first precedence over OTLP failure.
- `QualityWorkerRunpodEval.ts:1100-1184` — preserve acquire/use/release and Ref fallback behavior.
- `QualityWorkerRunpodEval.ts:1190-1300` and `Docgen.command.ts:1070-1085` — preserve wrapper JSON schema/version and file/stdout behavior.
- `test/docgen.test.ts:3531-3660` plus focused codec tests — retain synthetic Runpod Layer tests only; make no remote calls.

# Guard-deletion accounting

Delete decoded keepPod/status/error correlation checks and the recommendation’s pairwise completed comparison. Replace them with case matching. Keep both Result values and failure checks until after both operations run because they preserve independent outcomes and ordered error text. Keep `keepPod` as an input option; remove it only from decoded cleanup state.

# Encoded-side impact

Tier 2 persisted JSON compatibility. For all five cases, compare old/new canonical `encode(decode(fullWrapperReport))`, preserving `deleteStatus`, `durationMs`, `error`, `keepPod`, `stopStatus`, key order, wrapper schema version, recommendation, and runtime fields. Test nonempty synthetic error strings only. Reject the other 31 tuples. Preserve the initial both-failed fallback encoding and keep error ordering `stop: ...; delete: ...`.

# Test impact

Use a fake Runpod service to cover kept, both completed, stop-only failure, delete-only failure, and both failures; assert stop is attempted before delete and delete still runs after stop failure. Add 31 invalid codec rows, full-wrapper byte comparisons, cleanup recommendation precedence, and no-network guarantees. Retain missing-create-id recovery and explicit confirmation tests.

# Risk and sequencing

Tier 2 after `docgen-quality-package-outcome`. The greatest risk is accidentally making delete contingent on stop success; preserve the original two independent calls and error order. No real Runpod API call is part of validation.
