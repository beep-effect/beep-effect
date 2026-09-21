# @beep/architecture-lab-client P1 digest

### @beep/architecture-lab-client

1 complete assigned census files; 4 rows, 1 minor review items and 3 info coverage rows. Every lens has 1 file rows.

Pure injected transport returns Effects; no layer acquisition or remote request. No isolated rebuild duration or speedup is established.

**packages/architecture-lab/client/test/WorkItemClient.test.ts**

- resource: **L-RES-NONE**, lines 1–40, info. Transport methods are explicit pure Effect stubs; no client socket, HTTP layer or remote server is acquired.
- flake: **L-FLAKE-NONE**, lines 1–40, info. One local created value and pure stubs are independent of clocks and suite state.
- property: **L-PROP-04**, lines 26–37, minor. All six single-item transport stubs return the same value; the get assertion cannot detect invoking the wrong method or dropping its query. Retain the existing version and Option.none assertions. Use distinguishable transport outcomes and capture the exact get query so the current get scenario fails if another method is called or its id is changed. Preserve the real makeWorkItemClient facade; no private API or HTTP acquisition is needed. Production presently forwards methods directly, so this is an oracle gap rather than a known facade defect.
- observability: **L-OBS-NONE**, lines 1–40, info. The delegation name overstates the observed contract, addressed by the property oracle finding rather than extra logging.

Retained timing: 2 passed registrations, reporter total 4268.6533203125 ms; whole command 4.622221568999976 seconds. This is the accepted configured Node baseline, not a new execution or package/coverage proof. Hosted history maps zero observations to this package; that is not proof of no failures.

P2 order: scope and subject boundaries, assertion oracles, property registration with all floors/deadlines preserved, cause-supported flake work, then observability. No flakyTest proposal is supported. Root has accepted these P1 inventory rows; P2 remains gated.


Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
