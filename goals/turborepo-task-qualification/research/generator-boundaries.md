# Nested generator boundaries

Source review at `9480eaf486`, 2026-09-15. This supplement classifies all six
workspace manifests whose `generate` script is `bun run scripts/generate.ts`.
It does not execute generators, establish complete transitive inputs, or change
cache eligibility. The generator census request attaches this review to the
existing source population and planner snapshots.
The runtime boundary receipt binds the reviewed sources and this document.

| Workspace | Observed input and output boundary |
| --- | --- |
| `@beep/acp` | CodegenKit consumes cached schema and metadata JSON for release v0.11.3; its extra renderer fetches metadata through the same refresh-aware service. Writes schema and metadata modules under `src/_generated`. Explicit refresh addresses upstream release URLs and rewrites the local specification caches. |
| `@beep/runpod` | CodegenKit reads local OpenAPI JSON and a JSON patch, applies configured transforms and a package-specific operations renderer, and writes model/operation modules under `src/_generated`. The extra renderer's transitive inputs remain a separate review obligation. |
| `@beep/ecfr` | CodegenKit reads local Swagger JSON and writes the generated HttpApi module. Generator configuration, transforms, formatter and tool identity participate even though the primary specification is local. |
| `@beep/govinfo` | CodegenKit normally reads local `openapi.json`; explicit refresh fetches the configured API document, checks its version pin and rewrites that cache. It writes the generated HttpApi module. A version pin alone does not bind response bytes. |
| `@beep/box` | A custom generator searches ancestor directories for installed `box-node-sdk`, reads SDK declarations and handwritten source roots, and uses the admitted manager/operation surface. It writes model/operation modules and emits generation diagnostics. Installed SDK resolution and contents are inputs beyond the package source tree. |
| `@beep/gov-legal-mcp` | A custom generator reads package version and imported production tool-name collision data, writes a collision report and version module, and logs the output paths. The imported collision-data computation remains part of the transitive input boundary. |

## Shared CodegenKit modes

`runGenerateCli` defaults to write mode. `--check` chooses drift comparison;
`--refresh` selects remote refresh, and combining the two flags is rejected.
The service normally reads the configured file/cache; refresh performs HTTP,
validates the remote pin, writes the cached JSON and formats it before reading
it back. Module rendering and formatting occur before write/check branching.

Formatting invokes a repository-relative installed Biome executable with
inherited stderr. Content formatting supplies stdin plus a synthetic path
inside CodegenKit, so formatter configuration, executable bytes, diagnostics
and path interpretation need their own qualification evidence. Explicit file
formatting uses `--write` against the refreshed cache.

Check mode reads current generated files. When drift exists, diagnostic
rendering creates a scoped temporary file inside CodegenKit's source directory,
writes generated content to it, and invokes external `diff` with path labels.
Its temporary file is scoped for cleanup. Thus offline check mode is not a
claim of zero writes, zero subprocesses or path-independent logs. Failure,
cleanup, concurrent diff staging and capture safety have not been exercised by
this review.

The custom Box and government MCP generators do not use the shared CLI in their
reviewed entrypoints. Shared `--check`/`--refresh` behavior must not be inferred
for them. All six remain unqualified here; mutation, comparison, remote refresh
and enclosing audit verdicts remain distinct computation boundaries.

## Package-specific renderer inputs

Runpod's operations renderer fetches `config.source` through the supplied
CodegenKit service with the same refresh flag, decodes the imported patch JSON,
applies it, and separately decodes both original and patched documents. The
original document supplies advisory enums; the patched document supplies the
operation table. Therefore a contract retaining only patched operation output
would omit a source dependency used by the renderer. The renderer returns
source text to CodegenKit for formatting and writing; it does not call Runpod
API operations as part of this reviewed generation path.

The government MCP production report is constructed from four literal
source/operation candidates in `ToolNames.ts`. It normalizes names, detects
normalized and final-name collisions, sorts rows and renders canonical JSON.
SHA-256 contributes truncated-name suffixes. This reviewed report construction
does not query the government APIs represented by those names. Its source,
normalization/runtime behavior and canonical serialization remain inputs; the
entrypoint separately reads package metadata and performs file writes.

These reviews resolve the two previously unidentified package-specific input
sources. They do not prove runtime determinism, complete dependency closure or
capture equivalence, and do not remove the census's runtime obligations.
