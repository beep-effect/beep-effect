# R34 ontology worker scope and locator audit

Frozen HEAD d99e4e073de5139552a97ee588117af59b8251c0 / main 339da1562a2ed52f73a0a693c176fc52cca9ccb6 rechecked. Private P2/source audit only; no canonical/source/ref changes, implementation, tests or P3 claim.

## Disposition

Withdraw `r2-domains-ontology-graph-worker-requeue-latches` from current inventory for recall-scope ineligibility. Preserve its historical row and complete design. Do not recategorize as D1/D2, invalidate its historical 12/5 relation, or implement its proposed schema under this campaign. No replacement qualified design is appropriate.

The complete mounted callback is Session.atoms.ts:1781–1977. Its immediate locals are WorkerCtor (global Worker constructor,1782); worker: Option<Worker>1791; previousProjection: Option<OntologyGraphProjection>1792; lastProjectionRequest: Option<WorkerCommand>1793; requeuedAfterFailure:Boolean1794. Remaining direct locals are callable helpers: disarmWatchdog1799, armWatchdog1806, terminateWorker1819, resetFailedWorker1824, failWorkerCause1834, makeWorker1842, currentWorker1890, dispatchWorkerCommand1900, requeueLastProjectionRequest1917. Nested nextWorker is a Worker handle; received and encoded are Results; request command is a tagged command. None supplies another Boolean member. The subscribe options `{immediate:true}`1968 is a separate object, not a sibling state member. Predicate expression results and unrelated module atoms cannot be borrowed into this closure. Thus the complete owner contains exactly one actual Boolean before any minimal E3/E4 cluster analysis.

## Preserved relation and current locators

The Option's full five-kind public WorkerCommand domain remains parseTurtle/diffDatasets/computeSnapshot/projectGraph/applyGraphDelta (worker-protocol.ts24–30). None plus five command arms times one Boolean yields12 representable alternatives. Private writes still produce the five historical supported states: None/false, projectGraph/false-or-true, applyGraphDelta/false-or-true. This factual relation survives; it is insufficient to pass the separate Boolean-owner recall net.

Initialize request/flag1793–1794. Graph success resets flag1862 and1868 while retaining command. Guard1918 precedes Option match1922–1930, and true write1926 occurs only in Some branch before watchdog1927 and dispatch1928. Fresh constructors are applyGraphDelta1943–1949 and projectGraph1954–1958; paired writes1961–1962 precede watchdog/dispatch1964–1965. Finalizer1971–1976 disarms, clears boundary/failure slots and terminates; no retry state reset is added. The old design anchored the exported declaration at1779; current exported declaration is1781, not worker-handle1791. All old design/migration/compatibility statements remain historical proposals; locator correction does not readmit an out-of-net owner.

The atom's public mounting consumers remain Session.graph.tsx51, Session.atoms.test.ts206/207,289/290,319/320 and worker-command-encode-failure.test.ts71/72. No returned or serialized retry-state interface is introduced. Worker command encoding and callback error handling remain unchanged. These consumers do not supply additional co-carried Boolean locals.

## Separate D1 atom pair

Retain `r2-domains-ontology-auto-open-and-inferred-atoms` as D1; correct anchor2985 to2997 only. ontologyInferredViewAtom is a Boolean workbenchState(false) at897; ontologyAutoOpenAttemptedAtom is a distinct module-level Boolean workbenchState(false) at2997. Inferred-view setter2651 writes supplied enabled Boolean before its subsequent failure-prone work and never changes the auto-open latch. Bootstrap3035–3038 reads/sets only the attempt latch before checking existing session/path3039. No cross-guard forces inferred state or retry budget. Both false initially, inferred can be enabled before auto-open mount, and after auto-open marks true inferred can remain false or become true. This actual sibling Boolean atom pair remains independent4/4. It is not part of the private graph bridge closure.

## Evidence and limits

Historical row and design bytes and complete current source/consumers are copied under inputs/ and bound in input-bindings.json. No test runtime was necessary for this static scope disposition. Parent integration remains separate. Graft discovery saved approximately67,276tokens (~$0.04) across two calls.

## Output bindings

- `~/.cache/beep/boolean-creep/refresh-2026-09-25/r34-ontology-worker/historical-rows.json`: `82c7e825b77eb882f6505915ac6071534263497b4693a402dac8c037d6768e88`
- `~/.cache/beep/boolean-creep/refresh-2026-09-25/r34-ontology-worker/proposed-d1-row.json`: `12fe5cac11cd0ce1132600ba5ab5da8ced2025642dee5f3e18de2b800f8917ea`
- `~/.cache/beep/boolean-creep/refresh-2026-09-25/r34-ontology-worker/disposition.json`: `878130e9c74f43003f23f487cee283b3738555493aa9eeede87500bf7c98c74a`
- `~/.cache/beep/boolean-creep/refresh-2026-09-25/r34-ontology-worker/input-bindings.json`: `49f8431b3382691b584a9d3db7bf41b34f134edd58064fd9b8ade7ca9a6596b8`
