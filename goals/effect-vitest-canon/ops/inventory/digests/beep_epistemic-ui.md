# @beep/epistemic-ui P1 digest

Root-reviewed and accepted P1 source inventory. P2 remains gated.

3 complete files; 12 open judgment rows: 2 minor review items and 10 info coverage-only rows. Native-boundary guidance is not a demonstrated defect.

| Lens | Review | Coverage | Total |
| --- | ---: | ---: | ---: |
| resource | 0 | 3 | 3 |
| flake | 1 | 2 | 3 |
| property | 0 | 3 | 3 |
| observability | 1 | 2 | 3 |

Detailed review items:

- `packages/epistemic/ui/test/ContradictionTriageView.test.tsx:438` — L-FLAKE-05: beforeAll overwrites HTMLElement.prototype.scrollIntoView with vi.fn without restoring its prior descriptor. Register teardown restoring the original descriptor (or deleting the own property if absent), preserving serial DOM tests, act flushing and every callback assertion. This is leaked test-environment state and a source-level isolation risk; no cross-worker or hosted flake is established. TestClock is not a replacement for React microtasks.
- `packages/epistemic/ui/test/ContradictionTriageView.test.tsx:432` — L-OBS-01: The queue-query property retains only _tag from native arbitrary results. Preserve production-schema encode/decode equivalence and fcRuns(25), while retaining formatted counterexample/replay and named registration. Keep separate UI redaction of private transport diagnostics; test diagnostics must not expose real provider credentials.

Ten highest-count files (all tie at four rows; sorted by path, coverage included):

- `packages/epistemic/ui/test/ContradictionTriagePanel.test.tsx`: 4 rows, 0 review items.
- `packages/epistemic/ui/test/ContradictionTriageView.test.tsx`: 4 rows, 2 review items.
- `packages/epistemic/ui/test/EvidenceSourcePanel.test.tsx`: 4 rows, 0 review items.

The two client-rendered test files create fresh DOM roots/containers and unmount/remove them after each test. The panel supplies explicit temporal failures through RegistryProvider; the view uses controlled callbacks and predecoded schema fixtures, including portal UI. EvidenceSourcePanel uses static server markup. There is no database/filesystem/RPC acquisition to replace with MemoryFileSystem. Preserve React act/microtask behavior; TestClock cannot substitute for that scheduler. The prototype patch finding concerns restoring test-environment state, not a reproduced cross-worker race. No fixture rebuild optimization is measured.

Retained first attempt: 13 passed, all three assigned files represented, command 8.372718 seconds, exit 0. Reporter SHA256 `c9198f5aa3a0516b511076ccfefdfd4ccfd75e5e0d92267942b9dd7d2fd0dba9`. ContradictionTriageView took 1077.987 ms, EvidenceSourcePanel 13.751 ms and ContradictionTriagePanel 11.339 ms. This is Node/jsdom/static rendering, not a browser interaction or production coverage proof. No mapped hosted observation was found; absence of mapped data is not absence of historical or rare failures.

The campaign completed 139 first attempts: 132 full-file-representation baselines, four configured subsets, three failures (CIops, Effect Drizzle, QA Capture). Recorded P1 runtime is Node 22.22.3/Bun 1.4.2/Vitest 4.1.11 with rc113; no supported-peer claim is inferred. Hosted scope is 527 failed runs with 21 unavailable logs and one unresolved cause. No tests, timings, browser, AWS/provider calls or secrets were executed/resolved here.

Proposed internal P2 order remains scope, assertions, property, flake, observability. Preserve React scheduling, DOM cleanup and callback assertions before assertion migration. Preserve exact payloads and matcher polarity for tagged candidates; plain extracted values remain under D5. Preserve fcRuns(25) and the existing round-trip law while improving failure diagnostics. Address the source-proven environment-state risks without retries or timeout changes. Benjamin must acknowledge the complete inventory after Grok review before P2; later implementation requires package/runtime proof.

Root verified all sealed inputs, outputs and full source receipts, then passed combined strict inventory validation. Full P1 remains incomplete.

Evidence: [timing index](../timings/baseline-index.json), [configured subsets](../timings/configured-subsets.json), and [hosted history](../hosted-history-summary.json).
