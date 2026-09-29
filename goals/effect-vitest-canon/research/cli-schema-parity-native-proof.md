# Schema parity codemod native filesystem judgment

Main commit `7cc0aa9b33` introduced a platform provenance finding in
`schema-parity-codemod.test.ts`. The current branch reproduces it after merging
main at `4985b3d49e`.

The two command integration tests write a tsconfig and source modules to scoped
native temporary directories. `runSchemaParityCodemod` invokes
`createRepoTsMorphProject`, whose `new Project()` reads compiler options from
its native filesystem, then loads candidate source files by path. Substituting
only Effect MemoryFileSystem would disconnect the fixture from this compiler.
The pure planning tests already use ts-morph in-memory projects.

Record exactly this EV010 import as a reasoned native integration exception;
retain the scoped directory cleanup, write output, facet count, staging residue
and dry-run preservation assertions. No production or test source changes.
No existing baseline findings are removed or refreshed.

On the merged branch with CI enabled, Node passes all 23 tests in 10.43 seconds
and Bun passes all 23 in 6.40 seconds. These timings include shared workstation
load and are not a performance comparison. This is fixture justification and
focused runtime evidence, not full branch readiness.
