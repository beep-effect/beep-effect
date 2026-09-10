# Instance

- id: `docgen-quality-package-outcome`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.schemas.ts:486`
- symbol: `DocgenQualityPackageReport`
- members: `timedOut`, `status`, `error`
- evidence: E3/E1 at `Quality.service.ts:267-309` — success, timeout, and failure writers emit three correlated triples.

# Current shape

The persisted package report stores package identity, the shared completed/partial/failed status, duration, nullable error, timedOut, counts, subjects, reviews, and summary (`Quality.schemas.ts:457-502`). `analyzePackageQuality` writes completed/false/null, partial/true/message, or failed/false/message (`Quality.service.ts:267-309`). Reports are nested in `DocgenQualityReport`, encoded by `generateQualityJson`, printed or written by the command, and later decoded by worker eval (`Quality.schemas.ts:543-571`, `Quality.render.ts:48-56`, `Docgen.command.ts:760-818`, `QualityWorkerEval.ts:38,1129-1159`).

# Cardinality gap

Two error-presence states times three status literals times timedOut represent 12 tuples. Three are legitimate: completed/false/null, partial/true/string, and failed/false/string.

# Target schema

Reuse `DocgenQualityPackageStatus` as the owner of the three encoded literals. Define three annotated package report cases discriminated by `status`: completed has no decoded error, partial requires timeout error, and failed requires failure error. Each retains all common report payload. Combine through `S.toTaggedUnion("status")`.

Keep a private encoded package schema with exact current names, nullable error, timedOut, order, and enclosing report layout. A fallible `S.decodeTo` transform accepts the three legitimate triples and encodes their exact inverse.

# Migration inventory

- `Quality.schemas.ts:148-181,457-571` — retain the LiteralKit owner, add three cases and legacy compatibility transform, and preserve enclosing report schema/version.
- `Quality.service.ts:92-116,218-309` — construct one case at the completed, timeout, and failure boundaries; preserve late timeout detection and exact error precedence.
- `Quality.service.ts:350-390` — retain package aggregation, remediation counts, and ordering.
- `Quality.render.ts:48-130` and `Docgen.command.ts:760-825` — preserve JSON/Markdown output, output destination, and check-after-emission behavior.
- `QualityWorkerEval.ts:38,525-540,1129-1159` and `Targets.ts:280-290` — decode prior quality JSON through the compatibility codec.
- `test/docgen.test.ts:1820-3100,3420-3525` — update decoded assertions and add byte compatibility rows.

# Guard-deletion accounting

Delete decoded `timedOut`, nullable error, and correlation code from package report construction/reading. Match status for timeout/failure payload. Keep the collector and post-finalization budget checks because they choose the case; keep `qualityReportHasBlockingFindings`, which concerns review findings rather than package execution outcome.

# Encoded-side impact

Tier 2 JSON compatibility. For completed, partial, and failed reports, compare old/new canonical `encode(decode(fullReportJson))`, preserving status literals, timedOut boolean, null/string error, all neighbor keys, arrays, schemaVersion 2, property order, and pretty formatting. Preserve stdout versus file behavior and worker-eval decoding of saved quality reports. Reject the other nine triples because no writer or documented consumer assigns them meaning.

# Test impact

Add three full-report codec fixtures and nine invalid triple cases. Retain zero-millisecond timeout, completed reports, thrown collection/finalization failure, partial candidates, JSON output file/stdout, worker-eval saved-report decode, Markdown rendering, remediation counts, and check failure after output.

# Risk and sequencing

Tier 2 after the three Docgen Tier 1 migrations. Keep package report separate from `PackageSubjectCandidateResult`: they share literal names but the package report owns a failed outcome. Preserve timeout-over-completed precedence and failure conversion.
