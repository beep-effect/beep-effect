# Docgen computation boundary

Source review at `0dca998780`. The retained census has 133 executable `docgen`
nodes, all with inherited caching enabled and none qualified by this review.
The nested inventory contains 132 docgen terminal sites plus the repo-docgen
package's direct `src/bin.ts` site. The installed root `docgen` link resolves
to the repo-docgen binary, matching its manifest bin declaration.

## Configuration and inputs

The binary reads its module version and runs the CLI. CLI arguments override
optional docgen configuration, which overrides defaults; package metadata still
supplies the project name and homepage fallback. Configuration selects source
and output directories, inclusion/exclusion, rendering options, enforcement,
parser options, example compiler options and compiler executable. Referenced
TSConfig files and installed compiler/parser/renderer dependencies are inputs.
Example options additionally force TypeScript-extension imports, disable unused
local/parameter checks, and include node/bun types.

Discovery, parsing and checking operate on the selected modules. Examples marked
`skip-type-checking` are omitted from typechecking while remaining documentation.
Thus displayed example text does not prove that each fence was compiled.

## Execution, outputs and failure behavior

Example checking first removes the example output directory, extracts examples,
and, when any exist, writes example files and their generated tsconfig. It runs
the configured compiler with `--noEmit --project <examples-config>` from the
package cwd. Compiler stdout/stderr are collected into a string without an
explicit byte cap in this helper. A nonzero compiler exit fails with the
captured diagnostics. No examples is a logged branch without compiler execution.
The trailing example cleanup is sequential, not an ensuring finalizer, so a
failure before it can leave example artifacts.

Markdown generation and module/example validation execute concurrently. Markdown
writing deletes matching existing generated module pages, then writes rendered
outputs. Individual files marked non-overwritable are preserved when already
present. Existing output state can therefore affect results, and a failed
validation can coexist with partially changed docs. Atomic publication and
failure cleanup are not established by the current source review.

The full workflow writes `.beep/docgen/proof.json` only after both branches
succeed. The proof records current input/output fingerprints, tool version and
`generatedAt` from `DateTime.now`. A nonempty focused include skips proof writing.
The timestamp is an explicit clock-dependent output; a matching Markdown tree
alone cannot establish equality of all full-run outputs. Existing proof ownership
must remain separate from a narrower future rendering candidate. A successful
binary also performs its explicit process-exit teardown.

The reviewed control flow typechecks examples; its JSDoc mentions optional Bun
execution, but no such step appears in the examined program/typeCheckExamples
path. Runtime-execution claims must follow the implementation, not that comment.

## Qualification implications

The inherited cache flags are not qualifications. This review does not change
133 legacy settings, claim a demonstrated stale replay, or replace the docgen
proof owner. Candidate work would need complete source/config/runtime identity,
output-state controls, failure/capture bounds, full versus focused mode identity,
clock treatment, cross-root behavior and concurrent-output evidence. The current
real pilot remains identity lint, not a broad docgen activation.
