# Instance

- id: `codegen-kit-cli-mode`
- file:line: `packages/tooling/library/codegen-kit/src/CodegenKit.cli.ts:42`
- symbol: `CodegenKit.cli`
- members: `check`, `refresh`
- evidence: E2/E4 at `CodegenKit.cli.ts:32,45-48` — check plus refresh is
  rejected, check selects the offline drift path, and refresh is legal only on
  the write path.

# Current shape

The CLI adapter parses `check` and `refresh`, rejects the combined pair, then
passes a literal write/check mode plus the raw refresh boolean into the public
`CodegenKit.run` service. That service signature can still represent the same
illegal check-plus-refresh state.

# Cardinality gap

Four boolean pairs are representable. Three generation modes are legal:
`write`, `write-refresh`, and `check`. Refresh implies the write phase.

# Target schema

Add a named exported `CodegenRunMode` LiteralKit in `CodegenKit.models.ts`
with `write`, `write-refresh`, and `check`. Change `CodegenKit.run` atomically
to accept that literal. Derive whether fetching and extra rendering use refresh
from the single mode, then exhaustively choose write versus drift behavior.
The CLI retains its two raw flags only at the parser boundary and preserves
`CodegenGenerateError` for the exact conflict before constructing the literal.

# Migration inventory

- `CodegenKit.models.ts` and package barrel — add the annotated LiteralKit,
  type, and derived guards/matcher in the existing model owner.
- `CodegenKit.cli.ts:24-49` — preserve flags and typed conflict, resolve once,
  and call `kit.run(config, mode)` without a refresh boolean.
- `CodegenKit.service.ts:413-463` — change the public run signature, derive
  refresh once from mode, and keep fetch/render/write/drift ordering unchanged.
- `CodegenKit.test.ts:457,489,555` — migrate direct service consumers to the
  same literal values and add `write-refresh` plus three-mode behavior.
- `packages/drivers/govinfo/test/Govinfo.generated.test.ts:70` — retain the
  generated-drift oracle's direct `kit.run(generateConfig, "check")` call under
  the literal-mode signature.
- Whole-source and barrel search found no other `kit.run` consumer or existing
  generation-mode owner beyond the listed package and driver tests.

# Guard-deletion accounting

Delete the application-carried `(mode, refresh)` invalid combination and all
downstream interpretation of those two fields as separate state. The CLI
conflict remains a boundary error, but no illegal service call is typeable.

# Encoded-side impact

None. This is an atomic decoded TypeScript API migration. CLI spellings,
generated modules, cached specification JSON, drift reports, and error text
remain byte-compatible.

# Test impact

Table-test the three legal modes, the CLI combined-flag failure, offline check,
refresh fetch, write output, and drift behavior. Tests continue importing via
`@beep/codegen-kit`. Run full `@beep/codegen-kit` package verification and a
patch changeset unless the package is explicitly ignored.

# Risk and sequencing

Land in Tier 1E as internal tooling-domain work. The public decoded service
shape changes atomically with all in-repo consumers; no compatibility alias is
needed because search found no additional supported caller.
