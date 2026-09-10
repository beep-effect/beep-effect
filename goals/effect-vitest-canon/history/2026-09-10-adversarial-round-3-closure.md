# Third adversarial round: findings closed

Status: all four review findings are fixed. P0f is complete. P0g local and
hosted PR closeout is in progress; Benjamin retains the ratification and merge gate.

The third Grok review completed the required implementation, test, graph,
charter and packet reading plus 20 complete sampled test files. Nineteen
samples were new; one intentional repeat covered EV008. Root checked 245
successful read slices against the immutable corpus, with no mismatches.
Supporting upstream material was read at the specific API ranges needed,
not claimed as full-body coverage of every archived file.

| Finding | Repair | Proof |
| --- | --- | --- |
| P0F-R3-001 | Inspect applied Effect.scoped references in method and functional pipes and fnUntraced interceptors. Only the final stage of an ordinary test callback's complete returned body is mechanical; shorter, helper, shared, unknown-tail and generator-return lifetimes remain judgment. | Positive and negative fixture matrix; executed health, Tika and Tauri samples; full row reconciliation. |
| P0F-R3-002 | Resolve same-file immutable curried provideScopedLayer and Effect.provide aliases at their actual application site. Preserve lexical shadowing, exact import provenance and pure-stub exclusions. | Named and aliased imports, shadowing, stubs, nested layers and Tika interceptor regressions. |
| P0F-R3-003 | Route EV005 to neutral readme.exit judgment guidance, preserving success/failure and Boolean/payload distinctions. | All 27 existing EV005 payloads change only the four approved policy fields; failure and Boolean regressions remain tested. |
| P0F-R3-004 | Correct flake-charter coordinates against immutable rc.113 d3b837aee836f35d625d55205f7d6e61305fc198. | it.live method166/export195, flakyTest internal357, Effect.as2459, forkChild8533 and Fiber.join304 verified at the pin. |

The fully reconciled inventory contains 8,138 open rows: 7,748 unchanged full
payloads, 27 approved EV005 policy transitions and 363 additions, with no
removals or exception transfers. Additions comprise 211 provider judgments
and 152 scope findings: five complete-body candidates and 147 judgments.
All 1,110 paths remain (1,000 tests, 110 support modules), including 29
generated declarations. The source-repair fixtures introduce no live rows.

The original 207 scanner cases remain; the final focused group has 234 scanner
cases plus 54 Knowledge cases. All 447 prior assertion sites remain, with
446 unchanged and one expected-primitive string corrected for R3-003. New
coverage cases exercise nested layer inputs, malformed canonical JSON and
Unicode token-offset handling without lowering a coverage floor.

The unchanged runner retains its Node22, Node24 and Bun behavioral proofs
and passing scoped Node22 coverage. Installed Effect and @effect/vitest are
rc.113; main's Vitest4.1.11 is outside the adapter's declared Vitest5 peer
range. Exercised compatibility is established separately from that peer claim.

Performance evidence retains every rejected observation. Initial adopted
8,138-row commands take 10.690s/10.548s/10.659s. The first optimized normal
cohort takes 10.284s/10.494s/10.512s. A diagnostic candidate using the wrong
rc.113 Array.filterMap API lost 211 rows and was rejected, never adopted.
Root's failed prerequisite script launched no scanner and is retained as an
orchestration failure. No result is normalized for workstation load.

Final source passes all 288 focused cases and full CLI package verification
in 420.944 seconds (audit 403.7s, docgen 15.5s). Root checked 623 handoff
artifacts, six external evidence inputs and all 6,539 source/runtime hashes,
with no drift. The worker exited successfully. The final ordinary timing
cohort passes at 9.563s, 9.630s and 9.926s; complete evidence and earlier
failures are in history/2026-09-10-r3-performance.md.

The aggregate cheap-gates tier passes in 98.964 seconds, with no policy
baseline changes. The final scoped Node22 coverage run passes in 880.138 seconds: 181 files,
3,656 passing tests and five existing skips. All 33 tasks succeed. Knowledge
branch coverage is 95.60% against its 95.31% floor; detector function coverage
is 98.12% against 97.63%. Baseline bytes and all source inputs remain unchanged.
Exact-head full Yeet and hosted checks remain P0g gates. The superseded b721
full verification ended intentionally with exit130 and never established
aggregate green.

P0g requires Benjamin's ratification and merge before P1; P2 requires the
subsequent inventory acknowledgement. PR #1067 remains open.
