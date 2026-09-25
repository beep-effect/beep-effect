# Person reference P2 refresh audit

Source HEAD: `0be1f13d62fa00cb65e34ff69ec99043380f8d81`. Private proposal only; no canonical or product edits.

## Exact input bindings
- Private `inventory-before.jsonl`: `46b954087cab523cdbe80ac0bbb434706803e5f7c95bcbc2b02a8277b1d7d412`
- Private `design-before.md`: `0ec9cabb88bb6829149fa86dced825ca3e64261254821d749482f4de1d8aefd5`
- Private `row-before.json`: `b5d6f2def493d4bccae93058efcc4b2b55a5c46c778be6fc19c219aa06167a3a`
- `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.schemas.ts`: `2fd505c8179cbf84c77819d027290157e573d3e74ebaff069211799b11c02059`
- `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.ts`: `5e3dc5ec1d7776e63d7bb6a7fb19954074d08510bddbed8a9d3a10144cbed7f8`
- `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.worker-service.ts`: `d0b73f79a59a31c7c36dacd555ff5756c1b01c6601a53ed0cfd27e5afe0ec60a`
- `packages/tooling/tool/cli/src/commands/Files/Files.schemas.ts`: `cafa371c7f0efaee48583d9c9037e2dbcd14abc7840af4f8fbac9dd62cfa9ec0`
- `packages/tooling/tool/cli/src/commands/Files/index.ts`: `e31b73393da5626f90dac1d587fb0a67018f9df1d66e998dee950d262d51d4d5`
- `packages/tooling/tool/cli/python/photo-face/beep_photo_face/worker.py`: `db31d4c86b6773a099142bea2518cdddd9082be03d4bf3780f4f1572a184dae0`
- `packages/tooling/tool/cli/test/files-command.test.ts`: `f03b91aabb614e65e515ab7fd63aceecb611e69dd78b46a33bb623cbb6d74fea`
- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`

## Revision findings

Source verified again at HEAD `0be1f13d62fa00cb65e34ff69ec99043380f8d81` after reboot/main advance. Every source and immutable private input binding above is byte-identical to the prior audit. The saved actual Python producer probe reproduced its prior result exactly.

The c46dc347 proposal is rejected and archived privately. It retained the coherence guards and added a late decoder; the replacement removes the accepted score/reason predicates and rejected missing-reason predicate at the existing per-reference phase. Path and independent count checks remain. Refined reference values flow through ValidatedWorkerReferences and validateWorkerSemantics into the report, with no second later conversion.

The original accepted OR has a single error message for count/score/reason failures, so independent count-first then schema decoding preserves that diagnostic. Exact aligner-reason count checking cannot fire when the reason is missing. Newly constrained rejected score tuples intentionally fail before later reference/entry/summary checks; no blanket invalid-input ordering equivalence is claimed.

Finite projection enumeration independently confirms 28 total, seven legal, 15 already rejected by old score/reason checks and six newly rejected. This is arithmetic design evidence, not an implemented schema test. Mandatory future tests must establish structured schema-issue mapping, omission rejection (before field stripping), complete payload round trips and the explicit diagnostic precedence matrix.

No product/canonical files changed; no implementation, package verification or independent P3 claimed.

## Outputs
- Private `proposed-design.md`: `24559c16d01a944d01f648721fd81e67b75bfc63d64422c2fbe36117a6021462`
- Private `proposed-row.json`: `b0d6ff3c8b12314dbb3c60be1378bda4edba6058c8b4e48946bc7fd577787e8d`
- Private `probe.py`: `b0bd14fe18c002e6751f2d24fc645b0f59b1de1e76387de1a3a0a83fa51a019e`
- Private `probe-results.json`: `776be3689c3e8b8cfae1492b48a8be8a2ef77fba630c8d73cc488ede26d96ed2`
- Private `revision-projections.json`: `a73ae6800e1217f8ee09493b882d6a88226b5352c050965e092d599502020d66`

Graft this revision: one successful retrieval, estimated 29,669 tokens saved; one overly specific no-hit query.
