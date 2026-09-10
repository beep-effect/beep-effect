# PR1067 CLI Fallow patch preparation

Private patch preparation only. Live source and the 108-test suite remain frozen for Root's proofs. No tests, compiler, package checks or canonical writes are authorized in this lane.

## Proposed patch

`~/.cache/beep/effect-vitest-canon/pr1067-resume/cli-fallow-patch/proposal.patch` targets only `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestDetectors.ts`. Full preimage and proposed postimage are `before.ts` and `after.ts`. **No live source was changed.**

Extract the existing unresolved imported-wrapper predicate into one private same-file helper, `isUnresolvedImportedWrapper`, at proposed line 590. Existing Syntax binding/provenance helpers were inspected: they do not expose this precise no-local-definition plus imported-identifier conjunction. Reuse remains `imports.resolveBinding`, `Node.isImportDeclaration` and the existing Option operations; no imports, exports, schemas, caches or role files are added.

Branch preservation:

- Wrapper-name/canonical-name/resource-definition eligibility and their short-circuit order are unchanged. Root-test/whole-body gating remains subsequent and unchanged.
- Once eligible, the resource-definition check still occurs at the same point and emits the same definite EV003 payload. Resource traversal is neither cached anew nor deduplicated/reordered.
- Only the false branch calls the extracted predicate: definition absent first, identifier check second, lexical resolution third. Nonidentifiers and present definitions still avoid resolution. The same resolver instance/cache is used.
- Only a true predicate emits the unchanged judgment EV003 payload, including `unresolved-resource-wrapper`; false emits nothing. Push order, node/file/owner/symbol, confidence/default construction and complete occurrence identity inputs remain unchanged.
- Context is the existing plain object returned by `inspectContext`; passing it adds no traversal or state. `semantic-integrity.json` mechanically reverses this extraction and proves exact equality with the complete preimage, alongside the unchanged predicate operand text/order. This is source-equivalence evidence, not runtime differential proof.

## Isolated assessment and limits

Native Fallow on the private complete-source copy reports **detectResourceWrapper CC8/cognitive7**, down from hosted CC10/cognitive8. At the hosted 40% estimate, its CRAP formula gives **21.824**, below 30. This is conditional arithmetic, not a new full-graph result. The new predicate has two short-circuit decisions and no isolated health finding. The isolated run exits **1**: without the repository test/dependency graph it assigns the detector coverage `none` and CRAP72. Root must verify actual integrated coverage/health after applying; no gate is declared passed here.

The earlier reporting-body extraction is retained under `rejected-reporting-seam/`: it produced a new helper at CRAP30 with no coverage estimate and was rejected in favor of the smaller predicate seam. Both isolated runs are retained. No test, compiler, full check, Git or network command ran. Graft cards were searched read-only; no matching card was found and no refreshing Graft CLI was invoked. Targeted source fallback supplied the exact live spans.

Root should review the patch against the preimage, apply only after frozen proofs join, then request the existing 108-test/compiler/lint and full-graph health validation. No assertions or tests change in this proposal. Integration, package proofs, canonical acceptance and publication remain Root-owned.

## Identities

- Live preimage: `010b42e1e534a02b3f4f9285cb003c60f5451ddecd515fb9e6c8b8569fb1e084`
- Proposed complete postimage: `182eeb4b7623ba62ed26c032b531a6671be2ba9b5787aa8c55cb2cf0d7109bd4`
- Live terminal: `010b42e1e534a02b3f4f9285cb003c60f5451ddecd515fb9e6c8b8569fb1e084`

Exact native command/exit is in `receipt.json`; stderr and native output are retained. `manifest.json` hashes every private artifact and this report (excluding the manifest itself). Terminal checked inputs match; unexpected drift is empty.
