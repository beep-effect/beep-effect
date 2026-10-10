# T3 integration final local verification

Historical local snapshot observed 2026-10-09 before initial T3 publication. The table binds those checks and sources; it does not describe current PR status. Corrective head27c8b24596 is now published, with final packet/head hosted gates pending.

| Check | Result |
| --- | --- |
| Final `@beep/repo-cli` package verification | Passed: full audit 812.1 seconds; docgen 24.8 seconds |
| Final `@beep/t3-code` package verification | Passed: full audit 19.8 seconds; docgen 2.4 seconds; ten focused tests |
| Identity registration package verification | Passed, including 115 tests and docgen |
| Messaging regressions | 57 Bun cases; nine Node attachment cases; source/test type checks passed |
| Full repository docgen | Passed: 141 tasks and aggregation after the existing SDK preparation command |
| Canonical final cheap gates | 15 passed; only inherited Effect-Vitest golden-test EV015 failed |
| Independent review | Initial implementation, crossed driver/CLI, inbound scope guard, cohesion refactor and final helper delta: zero remaining actionable findings in their reviewed scopes |
| Packet checks | Explore stream checks, reflection-artifact validation, goal doctor and diff hygiene passed |
| Commit hooks | Secret scan, typos, JSDoc, Biome and commit-message validation passed |

The inherited failure is `packages/epistemic/use-cases/test/ContradictionDetection.golden.test.ts:126`, also present on fetched main `45f334e3c2`. Its owning lane must repair it once on main. This lane does not baseline or duplicate that fix. Merge main once after the repair, regenerate conflicting reviewed configuration through its canonical writer, then run Yeet publication and exact-head hosted checks/review/window gates.

Final attached service SHA256: `67114b1635604b7f43400a9ae3d39b264f0c8e09151dbf7951b5578ac135dca6`. The final type-import ordering emits byte-identical JavaScript to the live refactor source. Final driver service SHA256: `933a5f13539586081714b139a98c7b2089f8a8090b2f3dc5774fa3e485d75d0a`. Its header-helper repair has independent absent/present-session parity and full package proof.

The [complete hardened proof](T3-INTEGRATION-QUALIFICATION.json) and [interrupted refactor reconciliation](T3-REFACTOR-RECONCILIATION.json) retain their exact source boundaries. Four final-refactor ACKs and both reports do not erase two reverse ambiguity holds after interruption. No message was replayed. Existing app conversations remain; the experiment's external credentials were revoked. Always-on operation and attachment to separate first-party desktop apps remain unqualified.

## Advancing-main integration follow-up

The above cheap-gate failure and instruction to integrate main are historical.
Main repair 6513e85d2c is now imported by merge commit 5868dc8218. See the frozen
[T3 main integration receipt](T3-MAIN-INTEGRATION.md). The post-integration cheap
gate completed with 14 pass/two attributed inherited reds; no earlier package or cheap-gate result is promoted to the
merged head. Publication, exact-head hosted checks/review/window and merge remain
required. The scoped T3 reflection is recorded, with operative execution still
active until the prospective merged-main declaration earns its exact-head gate.

## Prospective final packet declaration

The scoped reflection and completed-retained lifecycle declaration are included
in the final same-PR metadata wave. They describe merged main only; execution
remains active until that final head passes required hosted/review/window gates
and actually merges. No successful current hosted coverage/docgen/ratchet result
or lane retirement is inferred from these local proofs.
