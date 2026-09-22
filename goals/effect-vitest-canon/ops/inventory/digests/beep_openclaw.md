# @beep/openclaw — P1 source audit digest

P1 source inventory reviewed by Root; P2 remains gated.

Reviewed 9 assigned census files in full, producing 36 rows: 9 review rows and 27 file-specific coverage rows. Lens counts: {'resource': 9, 'flake': 9, 'property': 9, 'observability': 9}. Severity counts: {'info': 27, 'minor': 8, 'major': 1}. Every row remains open judgment; coverage is not an action.

Highest-count files (all tie at four rows; source order, maximum ten):

- `packages/drivers/openclaw/test/Openclaw.equivalence.test.ts`: 4 rows, 0 review rows; full lines 1–60.
- `packages/drivers/openclaw/test/Openclaw.models.test.ts`: 4 rows, 0 review rows; full lines 1–452.
- `packages/drivers/openclaw/test/OpenclawCli.service.test.ts`: 4 rows, 3 review rows; full lines 1–603.
- `packages/drivers/openclaw/test/OpenclawIntent.models.test.ts`: 4 rows, 0 review rows; full lines 1–301.
- `packages/drivers/openclaw/test/OpenclawProbe.service.test.ts`: 4 rows, 1 review rows; full lines 1–120.
- `packages/drivers/openclaw/test/OpenclawRender.test.ts`: 4 rows, 0 review rows; full lines 1–356.
- `packages/drivers/openclaw/test/OpenclawSystemd.service.test.ts`: 4 rows, 2 review rows; full lines 1–178.
- `packages/drivers/openclaw/test/fixtures/golden-intent.expected.ts`: 4 rows, 0 review rows; full lines 1–223.
- `packages/drivers/openclaw/test/integration/OpenclawBinary.acceptance.test.ts`: 4 rows, 3 review rows; full lines 1–387.

Layer topology: CLI tests have six unnamed layer blocks: two Layer.effect service constructors fed pure fake spawners and four Layer.succeed runner-backed services. Systemd has four pure runner-backed blocks. The HTTP probe uses an in-test pure HttpClient double. Integration shares one NodeServices + CLI + workbench layer with a ten-minute acquisition/cleanup budget; subprocess collection has shorter scopes, and workbench temp directories have scoped cleanup. Staging caches intentionally outlive the block. No container, live daemon or provider was acquired by this audit.

Preserve real process spawning, child-visible files, executable bits and native paths in the integration subject; MemoryFS cannot replace them. Unit fixture URLs and op:// references are data. The recorder isolation rows in resource and flake are two lens views of the same two issues, not four independent defects. The shared config is concurrent; global last-request arrays are unsafe under overlapping invocations, although this audit did not reproduce a race. The integration driver uses Effect.timeout inside TestEnv without advancing TestClock; prove live deadline/cancellation ownership without resetting a shared deterministic clock.

The coordinator has only a wrong-skill negative despite five independent acceptance predicates; add isolated schema-valid negative components while retaining native integration validation. Current fake handle tests inspect forceKillAfter=2000 but do not prove execution of kill/escalation. Existing golden JSON/hash, redacted diagnostics, native it.prop floors and tagged secret references must remain. A ten-minute layer timeout does not extend body limits (120/240 seconds). Staging needs redacted last-stage context, not payload logging.

Completed Root baseline: `accepted-node-command-baseline`, 65 registered/passed cases, zero failed in that attempt, command 10.115894086 seconds; reporter span 9610.607666 ms. These are different measurements. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11; command from package cwd: `bunx vitest run --reporter=json --outputFile=<absolute private report>`. No timing was rerun. The package baseline represents every assigned test file; support fixtures are not counted as registered cases. The retained reporter includes all four binary integration cases, despite the source header saying integration-lane-only. Shared include covers test/**/*.test.{ts,tsx}; do not describe those cases as excluded or unexecuted. Cache warmth and child Node runtime were not independently measured in this audit. Campaign collection is complete: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets and three failures. A single pass is neither coverage/package proof nor evidence that rare races are absent.

Hosted history: 3 coverage-ratchet observations in 1 job, retained in the hosted history summary. OpenClaw observations concern Openclaw.errors.ts production function/line/statement coverage (83.33/93.33/93.33 below 100). These are not named failing tests or unique flakes, and no introduced/inherited source attribution is inferred. The completed campaign covers 527 failed runs but 21 relevant logs are unavailable and one cause remains unresolved. No absence-of-failures claim follows.

Proposed P2 order remains scope → assertions → property → flake → observability. Preserve exact assertion payloads and floors; first settle ownership/native boundaries, then mechanical assertion guidance, the concrete property gaps, falsifiable scheduling/deadline evidence and opt-in diagnostics. P2 is not authorized. The 90 inherited-main ratchet additions are untouched.

All source/read/row and strict decoder evidence is private beside this digest. Effect/adapter rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198; Vitest 4.1.11 remains the explicitly accepted runtime, not a claim of satisfying the adapter Vitest 5 peer declaration. Root alone judges acceptance and future proof.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
