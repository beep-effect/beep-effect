### sol-2-1
- file: scratchpad/test/walker/Descend.test.ts:63
- class: test   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` §11.1 (“no timeout raised”), §11.2 and §16; `goals/effect-vitest-canon/SPEC.md` D6.   evidence: Comparing the specified commit with the pinned oracle shows 26 added `{ timeout: "30 seconds" }` layer options: 15 in `Descend.test.ts`, 3 in `Expand.test.ts`, and 8 in `Walker.test.ts` (examples at `Expand.test.ts:46` and `Walker.test.ts:316`). The oracle supplies no timeout at these sites. Installed `@effect/vitest` forwards this option to Vitest’s layer setup/cleanup hooks; Vitest’s Node default is 10,000 ms, and the committed walker configuration supplies no override. The walker ledger records no exception authorizing this increase. Passing gates do not enforce the oracle’s original hook limits.
- failure: Fixture setup or cleanup taking between 10 and 30 seconds now passes where the original limit would fail. These changes weaken the retained suites’ timing contract and violate the explicit prohibition on raising timeouts. They affect layer hooks, not individual test-body timeouts.
- fix: Remove the added 30-second layer options from the three retained oracle test files, restoring the default hook limits. If that exposes a failure, repair its cause within the existing limit.

### sol-2-2
- file: scratchpad/effected/walker/README.md:95
- class: docs   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D2 and §10.3 require additions to be listed under *Port notes → Added exports*.   evidence: That subsection says `None.` At the reviewed commit, `index.ts:22–27` exports runtime values for `DescendResult`, `UnreadableDirectory`, `CompileAndExpandOptions`, and `AscendOptions`; the pinned oracle’s corresponding declarations export these four names only as types. The README’s schema-first deviation entry acknowledges the new runtime schemas but does not identify their added export kinds. The green gates have therefore missed this documentation mismatch.
- failure: The port’s required export inventory incorrectly reports no additions, concealing four newly available runtime schema APIs from readers comparing the lab surface with upstream. This concerns documentation of the accepted schema additions.
- fix: Replace `None.` with the four names and state that each gains a runtime schema value while retaining its upstream type export.

REQUIRED: 2
BACKLOG: 0