# @beep/ontology-ui P1 four-lens digest

One complete census test file, four file/lens pairs, four open info no-findings rows. No additional human review proposal. This does not clear the two existing mechanical resource judgments or prove absence of all defects.

| Lens | Reviews | NONE | Severity |
|---|---:|---:|---|
| resource | 0 | 1 | info |
| flake | 0 | 1 | info |
| property | 0 | 1 | info |
| observability | 0 | 1 | info |

## Full source and lens evidence

`packages/ontology/ui/test/Session.workbench.test.ts`: owner `@beep/ontology-ui`, kind `test`, full one-based read 1–194, 6,871 bytes, SHA256 `44147b99a8007b17015190a3306ffbccef3311b3a3e77b549dbaca5c0b25c3d8`.

### resource — L-RES-NONE

No additional change required by this lens: Pure toolbar/event helpers and in-process structural inference/tree projection acquire no browser, HTTP, SQL, native FileSystem or renderer. The private provideScopedLayer definition at31-34 and call192 are already EV003/EV002 candidates. Actual OntologyReasonerLive is Layer.succeed at Session.reasoner.ts956-961; its name does not establish native acquisition or costly rebuild. Existing Effect.scoped closes Layer.build on failure. Preserve real inference and wrapper context/error semantics during Root adjudication; no additional lifetime finding or MemoryFS substitution is justified.

### flake — L-FLAKE-NONE

No additional change required by this lens: All toolbar and event assertions are synchronous fixed inputs. The one Effect case awaits actual reasoner inference then computes its own snapshot and tree. Maps/sets in Session.tree.ts68-118 are invocation-local. No sleeps, retries, detached fibers, mutable scenario shared between cases, provider calls or native scheduling are involved. A retained pass is not general race proof, but no additional nondeterminism trigger is supported here.

### property — L-PROP-NONE

No additional change required by this lens: Seven toolbar cases preserve no-session gating, neutral/Saved/Dirty badges and each independent busy/disabled state. The hierarchy case asserts three inferred quads, inferred graph identity, both transitive parent IRIs, deduplicated tree IDs and exactly one expected descendant; the last witness prevents an empty tree from satisfying uniqueness vacuously. Keep all operands and the real reasoner, snapshot and RDF schema. This finite regression does not claim exhaustive arbitrary graph/cycle or Boolean-combination coverage; no concrete new law failure or floor loss was established.

### observability — L-OBS-NONE

No additional change required by this lens: Named toolbar-state cases identify each failing action/badge contract; the hierarchy case has exact quad-count/graph/parent and duplicate-ID checks. O.getOrThrow fails if the required resource is missing instead of conditionally skipping assertions. No swallowed cause, unnamed wait, logger replacement or watchdog exists. The word renders denotes a tree view-model result here, not browser rendering; no DOM/accessibility/gesture execution is claimed. Later runner adoption must preserve the Effect test environment and all ordinary assertions.

## Layer topology and boundaries

Eight ordinary cases call pure presentation/event helpers. The ninth case obtains the actual OntologyReasoner from a private scoped Layer.build wrapper, computes real structural inference, then builds the snapshot and tree view-model. OntologyReasonerLive is Layer.succeed at Session.reasoner.ts956–961; no native acquisition or expensive setup is established by the Live name. The wrapper closes its scope on completion/failure. EV002 at192 and EV003 at32 remain open for Root policy adjudication; no duplicate human wrapper finding is added. Future simplification must preserve exact context/error/cleanup semantics and actual inference, without replacing the subject by a fixture result.

Mutable tree maps/sets are local to each ontologyTreeItemsFor call. No shared registry, DOM mount, browser renderer, HTTP client, database, subprocess or native filesystem is acquired by the tested paths. MemoryFileSystem is not a relevant replacement. The ChangeEvent is a structural fixture, not a fired browser event. Imported UI modules do not turn these helper assertions into rendered UI proof. One layer build is visible; there is no measured rebuild cost or predicted saving.

## Retained timing and hosted history

The accepted configured Node command baseline captured at 2026-09-11T23:51:25.529833+00:00 reports nine passed registrations and this one source file. Whole-command wall time: 7.6222554759997365 seconds. Reporter total: 7063.5107421875 ms, defined as max file end minus reporter start; file duration: 9.5107421875 ms. These are distinct overlapping intervals, not additive setup measurements. No host-load adjustment or rerun occurred. Raw reporter SHA256 `ea41a173febc3b737d6b36cba3a05fdf8896842dccebe39521b47c79b81f26ae`.

Command was the retained package-cwd `bunx vitest run --reporter=json --outputFile=<absolute raw path>`, Node22.22.3, Bun1.4.2, Vitest4.1.11. Context preserves exact source/head binding and runtime receipts; rc113 declares a Vitest5 peer range, and the existing compatibility qualification is retained. Complete file representation is not full package/compiler/coverage proof.

Hosted summary has two coverage-ratchet observations in one job at historical head c28de8636cb543686926e50f1f538387d281acab (2026-08-27). These are not two test failures, unique flakes or a current-source race cause. No raw hosted collection or network request was made.

Global retained context: 139 first attempts, 132 full-file baselines, four configured subsets, three failures (CIops, Effect Drizzle and QA Capture). The hosted scope covers 527 failed runs and includes 21 unavailable logs and one unresolved cause. Graph-3d and Ontology client browser files remain excluded from their configured Node cohorts, not executed or reported skipped. No optional gate was enabled.

## Top files (one available, not padded to ten)

| File | Human review rows |
|---|---:|
| packages/ontology/ui/test/Session.workbench.test.ts | 0 |

## P2 order and uncertainty

Scope first: adjudicate the existing private-wrapper candidates without assuming a Layer.succeed value allocates native resources. Then preserve all exact assertions and polarity, followed by meaningful property work if new evidence justifies it, flake work only for a concrete source of nondeterminism, and observability adoption preserving TestEnv. No generated-property floor exists in this file to lower, and no blanket demand for additional random tests is inferred from finite examples.

The tests do not establish browser rendering/accessibility, exhaustive graph-cycle behavior, all toolbar Boolean combinations, absence of races or repository-wide coverage. Those limits do not fabricate a finding in this bounded inventory. No test or source was changed. Root accepted these P1 rows after source/artifact verification and combined strict validation; P2 remains gated.

Evidence: [timing index](../timings/baseline-index.json) and [hosted history](../hosted-history-summary.json). Full P1 completeness, Grok review and Benjamin’s acknowledgement remain required before P2.
