# spdx round-3 merged inventory

Seats read: `grok.md` (no findings), `sol.md` (one finding), and `fable.md` (no findings; grok-4.7 medium fallback seat), with `BRIEF.md` and `BRIEF.grok3.md`. There are no part-N reports. Review snapshot: `3ad7b305790c7f0903f6d55766c55186745ba2d1`. Live checkout: `@lab/effected-2`, HEAD `576451bec24c6452dc359a863b5c99e4f7888fef`; the requested branch was `@lab/effected`. No branch change was made.

Counts: Required 1; Backlog 0; Codemod 0; Rejected 0; Groups 1. The single seat finding is accounted for, with no duplicates. `standards/effect-laws.allowlist.jsonc` contains zero entries for `scratchpad/effected/spdx/**`, so there are no `allow-<n>` findings.

Classification follows the entire operator revision block, including the 2026-10-09 rulings and later grilling, D1-D20, sections 12.5 and 14, and this task's narrower write permissions. The brief's green-gate statement is seat context, not a fresh verification result. Source inspection confirms the named schema-first obligation is unmet despite legal TypeScript declarations. The round-2 required encoded-type defect is already fixed and is not repeated. Its backlog and codemod records remain in that round's inventory; neither no-findings seat reopens them.

Read-only `git log --format=%h:%s -- scratchpad/effected/spdx/internal/parser.ts` exposes the squashed progress commit `7929b1f529`; its file diff already contains the two raw type declarations. The `a955556fb3` effected-port laws commit has no diff for this file. No finding alleges an unforced upstream divergence, and no upstream restoration is assigned. This finding requests a schema-first repair, not recording a law-forced deviation. Any resulting export or deviation bookkeeping remains centrally owned.

Group `g1` owns only `scratchpad/effected/spdx/internal/parser.ts`. This fix adds schema backing without changing parser construction or its consumers. No existing source consumer or upstream test line must be rewritten, so `tests` is empty. Existing `scratchpad/test/spdx/internal/parser.coverage.test.ts`, `scratchpad/test/spdx/internal/parser.property.test.ts`, `scratchpad/test/spdx/SpdxExpression.test.ts`, and `scratchpad/test/spdx/oracle.int.test.ts` are validation inputs, not assigned write surfaces. The future fixer should use the module audit gate; every Vitest invocation must pass `--maxWorkers=2`, with one Vitest run at a time and any module-wide coverage run through `beep-heavy --slot-only`. No tests or gates were run for this read-only merge.

## Required

### sol-3-1 - Raw parser domain unions lack schema backing

- file: scratchpad/effected/spdx/internal/parser.ts:48-50 and :66-70; consumed by scratchpad/effected/spdx/SpdxExpression.ts:311-334
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12b and EF-33; D5 and D11. EF-12b requires named, reused or matched intermediate domain concepts to be modeled as schemas; EF-33 requires schema-derived domain types where Schema can express their shapes.
- evidence: `RawSimpleLicense` is a handwritten union of license and license-reference records. `RawExpression` separately declares WITH, AND and OR variants with recursive children. The parser imports only `License` and `LicenseException`, with no schema definitions for either raw model. `materializeSimple` consumes `RawSimpleLicense`, and `materialize` exhaustively matches `RawExpression.kind`. The public AST schemas use `_tag` and schema-class representations, so they cannot supply these `kind`-tagged plain-object contracts. The current source retains the declarations reported by Sol. Compilation and the cited green gates permit these legal types; this is an evidenced modeling obligation they missed, rather than a repeated enforced diagnostic.
- failure: The named parser-to-materializer domain contract is defined independently of Schema. Its variants and WITH's simple-expression operand restriction cannot be derived from corresponding raw-model schemas for guards or arbitraries. No runtime divergence is alleged. The record concerns missing schema models, not JSDoc, coverage or Vitest-canon work, and no accepted deviation authorizes the omission.
- fix: In `internal/parser.ts`, define IdentityComposer-annotated plain-object schemas for the existing license and license-reference variants and derive `RawSimpleLicense` from their union. Compose WITH, AND and OR into a recursive raw-expression schema using `S.suspend`, keeping only the explicit recursive type anchor TypeScript needs. Derive all nonrecursive shapes from schemas. Preserve every existing `kind` tag and field, including the required `documentRef: string | undefined` property and WITH's restriction to `RawSimpleLicense`. Keep definitions independent of `SpdxExpression.ts`; preserve plain-object parser output, accepted inputs, undefined-on-failure behavior, recursion limits and control flow. Do not add per-node decoding or class construction, broaden WITH operands, rewrite upstream assertions, or change barrel exports merely to expose these internal schemas. No test-file edits are required for this definition-only repair; validate with the existing parser, expression and oracle suites. Leave ledger and README Port-notes recording to the central deviation codemod.
- seats: sol-3-1

## Backlog

None. No round-3 seat raises docs, JSDoc, coverage, Vitest-canon, out-of-scope changes or another item outside D11.

## Handled by the deviation codemod

None. No round-3 finding merely asks to record identity keys, finite numbers, tagged errors, added exports or native-runtime replacements. This does not reopen or duplicate the round-2 codemod record.

## Rejected

None. The sole finding has concrete source evidence, a cited binding standard and a behavior-preserving fix. It neither contradicts an operator ruling nor repeats an obligation shown to be enforced by a green gate.
