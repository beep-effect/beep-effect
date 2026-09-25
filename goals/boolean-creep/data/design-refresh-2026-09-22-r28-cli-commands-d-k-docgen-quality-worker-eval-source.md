# Local worker eval P2 audit

Source `0be1f13d62fa00cb65e34ff69ec99043380f8d81`.

## Input hashes
- `input-inventory.jsonl`: `5ab42622406dec216b20f7153faaf3c06c0ce5424c3f44d2a9603fe071969785`
- `input-design.md`: `0ea03e8d2485f4eb2fd3e1a1d723145af456a180fe16f48ba126a9ab6d05c217`
- `input-decisions.md`: `e85016058ca6000aa1309eaa7a737566ba1ddef4141509df0b39c693ff4306d9`
- `packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts`: `82bf3a01d28acb09f53b9c5dc3355b742eb96f232c392681ac2204587b319c0e`
- `packages/tooling/tool/cli/src/commands/Docgen/internal/Targets.ts`: `865708cb04238a53da299299217a45baff39cc622ca72b21420c3c13b8f56eb1`
- `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.scope.ts`: `d7eeed37b99368b54768247362602fc33107f97a296b44bf714e8076ee4bdd58`
- `packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerEval.ts`: `4614d9f3603d0e3e0575c63f33f9a2688525acbdaf74593e22b923c41f954b06`
- `packages/tooling/tool/cli/test/docgen.test.ts`: `e677cf160d7ce07fee29f7b2650543ff319ed90e65e7071f880dcb40c5e5128b`

## Findings
8/3 operation retained, source error869 after fs and pure reasoning normalization, before negative limit/model/files/workspace. Public raw helper broader compatibility explicitly retained. Shared schema/resolver coordinated with Runpod agent. Updated exact existing CLI test3701 onward; no blanket success-matrix claim.

## Verification scope
Graft call/definitions10hits2symbols2files; scope/cap12hits5symbols4files; test metadata9hits. Source branches, packet conversion and fixture read. Eight headings and8tuple3legal assertions pass. No canonical/product edits, worker/provider/process launch, runtime/package proof or P3 credit. Graft83,387 tokens saved.

## Output hashes
- `proposed-design.md`: `948e3f2482b35edbe802b5bc4bf342ef1e9a0ab8c52d3d7ed26729c7081177ac`
- `proposed-row.json`: `6eb97584228ada67f4cc27c487d657aefc568cd46d0d2b86c059a740a999a860`
- `finite-projection.json`: `d6149649852295de45790e8d8ae17b9ab8a9755f85ea167bd72cfe52e3852402`
