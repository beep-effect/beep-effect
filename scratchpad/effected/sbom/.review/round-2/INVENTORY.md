# sbom — round-2 merged inventory

Seats read: `grok.md` (0 findings), `sol.md` (1), and `fable.md` (0; Grok 4.7 medium fallback seat), plus `BRIEF.md` and `BRIEF.grok3.md`. No part-N subdirectories are present. Reviewed commit: `60fcfb5ebcdc26765a66cc1f13afc88adcb05d11`. Counts after deduplication: **Required 1 · Backlog 0 · Codemod 0 · Rejected 0 · Groups 1**.

Binding inputs: the entire operator revision block, including “Operator rulings, 2026-10-09” and “Grilling, 2026-10-09 (later)”, D1–D20, §12.4–12.5 and §14 of `scratchpad/EFFECTED_PORT_GOAL.md`. The briefs' blanket green-gate/S3 statement is a seat premise, not fresh verification; this merge follows the instruction to defer docs, JSDoc, coverage and vitest-canon findings. None were submitted in this round. The required finding cites a schema-modeling obligation not enforced by those gates.

The live checkout is on `@lab/effected-2`; no branch change was made. The cited source is unchanged from the reviewed commit. The round-1 inventory's r5 covered eight named input/configuration interfaces; the remaining anonymous serializer configuration was outside that record. No closed round-1 findings are carried forward. `standards/effect-laws.allowlist.jsonc` currently contains **zero entries for `scratchpad/effected/sbom/**`**, so there are no `allow-<n>` findings to add. No seat alleges an unforced upstream change requiring restoration or requests law-forced deviation bookkeeping.

Group g1 owns only `scratchpad/effected/sbom/InTotoStatement.ts`. `Sbom.ts` supplies an existing schema-derived type and needs no edit. The fix requires no test-file edits: retain the existing compact-default and explicit-indentation assertions in `scratchpad/test/sbom/InTotoStatement.test.ts` and the serialization property in `scratchpad/test/sbom/InTotoStatement.property.test.ts`. The group assigns no root manifests, lockfiles, repository configuration, ledger or README Port notes. No implementation, tests, audits or bookkeeping commands were run for this merge.

## Required

### sol-2-1

- file: scratchpad/effected/sbom/InTotoStatement.ts:520
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D5/D11; D9/§14 behavior preservation.
- evidence: At the reviewed commit and in the current source, `toJson` declares `options?: { readonly space?: number | undefined }`. `Sbom.ts:74–85` already defines the identity-annotated `SbomJsonOptions` schema with `space: S.optional(S.Finite)` and derives `export type SbomJsonOptions = typeof SbomJsonOptions.Type`. Its decoded type represents the same optional numeric property, including explicit undefined. EF-33 requires deriving runtime types from schemas instead of maintaining parallel property-shape models; the schema-first contract explicitly covers configuration payloads. Round-1 r5 did not include this anonymous shape, and the brief's green gates leave this modeling obligation unenforced.
- failure: The public statement serializer maintains a second configuration model independent of the existing schema-derived JSON options type, allowing their type contracts to drift.
- fix: Add `import type { SbomJsonOptions } from "./Sbom.ts";` and change the signature to `toJson(options?: SbomJsonOptions): string`. Preserve `options?.space ?? 0`, the current codec/validation boundary, wire key order and all upstream serializer assertions. Do not decode options at this boundary or change the statement's default indentation to the SBOM serializer's default. The import is erased at runtime; no `Sbom.ts`, export, test, README or ledger edit is necessary.
- seats: sol-2-1

## Backlog

None.

## Handled by the deviation codemod

None. This round submitted no record-only findings for law-forced changes; round-1 codemod records remain with that inventory.

## Rejected

None. The sole submitted finding has concrete source evidence, a cited D11 standard, a demonstrated modeling gap beyond the green gates, and a behavior-preserving fix consistent with the operator rulings.
