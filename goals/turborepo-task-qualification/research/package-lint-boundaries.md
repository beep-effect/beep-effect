# Package lint dispatcher boundaries

Source review at `0dca998780` covers 140 deprecated-API, 140 law and 135 JSDoc
package command sites in the retained nested inventory. It does not execute
these commands, establish read/write closure, or qualify their results.

## Shared package ESLint launcher

`Lint.command.ts` resolves `--package` relative to the invoking cwd, rejects
paths outside the repository, and passes a normalized repository-relative
selection to the root-installed `node_modules/.bin/eslint`. Execution cwd and
`--config` are explicitly the repository root and its `eslint.config.mjs`.
The package worker does not use the separate root shard runner's binary fallback
or cache-directory arguments. It supplies neither `--fix` nor `--cache`.
That is a statement about argv, not proof that downstream code cannot write.

The worker inherits environment and stdio. It overrides `BEEP_ESLINT_PROFILE`
and preserves `NODE_OPTIONS`, adding an 8 GiB heap setting only if no maximum
heap option is already present. Runtime resolution, ambient Node options and
installed config/plugin/parser bytes therefore need an explicit candidate
contract; the source path alone does not identify the runtime. The launcher
fails on nonzero ESLint exit. Its inherited diagnostic streams have no local
capture-safety or byte-bound guarantee in this dispatcher.

## Profile-specific interpretation

| Package mode | Selection and verdict boundary |
| --- | --- |
| Deprecated APIs | Selects `DeprecatedApisESLintConfig`; enables `@typescript-eslint/no-deprecated` as an error. The parser's project service has explicit default-project exceptions and a root `tsconfig.json` fallback. Config presence, imported types and installed declarations can affect results beyond the requested package's own files. Labs selections add unmatched-pattern tolerance. |
| JSDoc | Selects `DocsESLintConfig`; adds `--max-warnings=0` and `--no-warn-ignored`. Shared config applies different plugin/rule sets to tooling source, barrels and the broader TypeScript surface. A warning can fail the invocation, and ignored membership affects what is examined. |

The root ESLint config supplies additional global ignores and rejects unknown
profile values. Its import graph, shared profile configs and plugin rule
implementations must be included in semantic review. No diagnostic safety or
purity conclusion follows from the absence of `--fix`.

Root-only JSDoc discovers non-workspace files and excludes workspace directories.
Root deprecated-API dispatch reads CI/full/base selection and the sweep policy,
then chooses an affected/full root route or shards. These root invocations are
separate boundaries and are not covered by the 275 package ESLint sites here.

## Package law worker

The law worker prefers package `tsconfig.test.json`, falling back to its
`tsconfig.json`, and discovers sorted package `**/*.{ts,tsx}` files while
excluding dependency/build/cache/coverage and declaration paths. It requests a
single package-syntax project and shares it among the law implementations.
The intended syntax-only project avoids loading dependency source; this review
does not independently establish the filesystem read closure of that service.

Package-test-imports applies only under `packages/`. An empty source set skips
four law scans, retaining the applicable package-test-imports inspection. That
branch is not evidence of a full successful scan.

Terse-effect options default to no writes, and the package caller does not
request writes. Its findings are deliberately advisory in the package report.
Native-runtime, frozen-grant-set and effect-fn use strict-check mode; package
import findings also fail. The dispatcher reports findings and exits on a
strict failure. Finding count alone therefore cannot substitute for the
profile's verdict interpretation. Native-runtime additionally consumes the
Effect law allowlist through its rule helper; shared standards and rule data
remain inputs even for a package-scoped scan.

## Remaining candidate evidence

Required work includes selected-file/config-presence perturbations, full
runtime/config/plugin/rule/allowlist identity, inherited environment analysis,
cross-root behavior, diagnostic capture and actual writes. Root selectors and
external process verdicts retain their existing owners. This source review
refines 415 dispatcher sites while leaving the seven operational census
obligations and all lifecycle states unchanged.
