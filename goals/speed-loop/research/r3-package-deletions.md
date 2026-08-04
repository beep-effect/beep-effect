# Package deletion candidates — follow-up PR research

Date: 2026-08-04  
Scope: read-only audit of `packages/**` and `apps/**`; no build, install, or network activity.

## Executive verdict

Eight workspaces are deletion candidates on the present import graph, in this
order: `@beep/acp`, `@beep/pacer`, `@beep/discord`, `@beep/tailscale`,
`@beep/courtlistener`, `@beep/dol`, `@beep/federal-register`, and
`@beep/protobuf`. All eight have zero production and zero test consumers in
the requested `packages/**` + `apps/**` scan [E1]. `@beep/acp` is the clearest
first PR: it has 30 tracked files, no consumers, and an estimated historical
uncached sweep cost of 30.485 s [E1–E4].

Deleting all eight removes 124 tracked files and an estimated 125.056 s
(2.08 min) of serial task work from one uncached full sweep [E3–E4]. This is a
task-time sum, not a prediction that a parallel Turbo wall clock falls by the
same amount [E4]. It is also deliberately an upper-biased historical estimate:
the requested census was captured before the same branch's `MimeType` fix,
which reduced the measured `@beep/xai` check from 17.94 s to 0.488 s without
materially changing instantiation counts [E5]. Re-run the census after deletion
before claiming a current wall-clock win.

The other zero-import packages are **not** deletion recommendations. The scan
intentionally misses root-script invocation, non-`src` Storybook globs,
`infra/**`, and standalone host entrypoints. Those exclusions explain several
false-zero packages, and packet/docs evidence explicitly retains others
[E6–E13].

## Evidence and method

- **E1 — consumer audit.** Enumerate the 130 non-fixture manifests under
  `packages/**` and `apps/**`; enumerate tracked JS/TS files with
  `git ls-files packages apps`; recognize static imports, side-effect imports,
  re-exports, `require()`, and dynamic `import()` whose specifier is exactly a
  package name or subpath; map each hit to its owning manifest; exclude the
  package itself and classify files under `test`, `tests`, `__tests__`,
  `*.test.*`, and `*.spec.*` as test hits. The root workspace declaration is
  `package.json:440-544`; the exhaustive results are reproduced below.
- **E2 — reachability.** Starting with all five app manifests, traverse only
  production import edges. Apps are app-reachable by definition. A package
  with production consumers but no path from an app is reported using the
  prompt's `driver-with-no-product-use` label even when it is tooling rather
  than literally a driver. No package landed in `test-only-consumer` [E1].
- **E3 — compiler cost.** `goals/quality-speedup/research/data/census-results.tsv:1-130`
  supplies `check_s` and `instantiations`. Its documented method is a sequential
  per-package `src` overlay and a single lightly-loaded run, with check time
  explicitly an estimate ±10% (`goals/quality-speedup/research/instantiation-census.md:3-14`).
- **E4 — task cost.** For each exact `#lint`, `#test`, `#build`, and `#docgen`
  task, take the median `duration_ms` among `MISS` rows in
  `goals/quality-speedup/research/data/fleet-turbo-task-timings.tsv:1-16008`.
  The fleet contains 16,007 executions from 199 summaries across 11 clones
  (`goals/quality-speedup/research/quality-time-inventory.md:3-14`), and Turbo
  summaries are the repository's one real per-task timing source
  (`goals/quality-speedup/research/quality-time-inventory.md:27-34`). `Sweep`
  below is `census check_s + L + T + B + D`; it excludes coverage,
  integration/property/type-test, root orchestration, and downstream work.
- **E5 — staleness correction.** The branch later removed the `MimeType`
  check-time bomb; the before/after probe and `@beep/xai` measurement are at
  `goals/quality-speedup/research/instantiation-census.md:150-173`.
- **E6 — generated/config surfaces.** Package membership is repeated in
  `package.json:440-544`, `syncpack.config.ts:42-109`, root aliases such as
  `tsconfig.json:383-807`, and project references such as
  `tsconfig.packages.json:38-110,150-220`. `tsconfig-sync` plans package
  references and docgen config from the workspace graph
  (`packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.service.ts:120-148`).
- **E7 — identity/catalog surfaces.** Every workspace has a composer in
  `packages/foundation/modeling/identity/src/packages.ts:1-58`; `@beep/acp` is
  specifically at `:944-958`, with shape assertions at
  `packages/foundation/modeling/identity/test/shape-stable.test.ts:47-64,188-202`.
  The identity lint enforces workspace completeness
  (`packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry.ts:228-270`).
- **E8 — generic Turbo/docgen behavior.** Turbo defines generic task rules,
  not package-specific registrations; `docgen` is inherited through the
  workspace graph (`turbo.json:157-171,207-211`). Package removal therefore
  removes its task nodes once workspace/config references are gone.
- **E9 — retained products.** `@beep/form` is a completed-retained package with
  29 Storybook play tests (`goals/form/README.md:3-18`); the Storybook glob is
  a documented non-import consumer (`knip.jsonc:93-105`). `@beep/pandoc-ast`
  is completed-retained and part of the document interchange architecture
  (`goals/pandoc-ast-foundation/README.md:3-25`). `@beep/shared-tables` is
  explicitly Active (`packages/shared/AGENTS.md:24-34,58-68`).
- **E10 — retained future work.** `@beep/onepassword-cli` is a locked retained
  driver to be bound by server/app adapters
  (`explorations/ingestion-security-secret-governance/DECISIONS.md:65-90`).
  `@beep/openclaw` has a live `infra/**` consumer and an active goal
  (`infra/src/OpenClaw.ts:45-66`; `goals/openclaw-workstation-agent/README.md:3-15`).
  `@beep/ontology` is explicitly retained by the ontology roadmap
  (`goals/INDEX.md:104-107`), and the architecture-lab client facade is part of
  the canonical slice's required client experience
  (`goals/canonical-slice-factory/SPEC.md:102`).
- **E11 — standalone MCP hosts.** The portfolio explicitly records completed
  Gov Legal, M365, NLP, and USPTO MCP deliverables (`goals/INDEX.md:83,96-99,127`).
  Their zero-import status is expected for host roots, not proof of dead code.
- **E12 — government placeholders.** The delivery packet says Federal Register,
  DOL, and CourtListener resume only when product-pulled
  (`goals/gov-legal-data-driver-delivery/README.md:14-19`); their source exports
  only package-version metadata (`packages/drivers/courtlistener/src/index.ts:1-39`,
  `packages/drivers/dol/src/index.ts:1-39`,
  `packages/drivers/federal-register/src/index.ts:1-39`). This makes deletion
  cheap and consistent with YAGNI, but the follow-up must preserve the packet
  history so they can be recreated when pulled.
- **E13 — planned provider/connectivity risk.** Agent-chat research identifies
  ACP, xAI, and Venice as available connectivity/provider bricks
  (`explorations/agent-chat-interface/RESEARCH.md:173-181`). Tailscale/OpenClaw
  command behavior was deliberately hardened
  (`goals/effect-child-process-hardening/SPEC.md:42-66`). These are real future-
  use signals, so candidate verdicts are current-state calls, not assertions
  that the concepts will never be needed.
- **E14 — packet-name scan.** `goals/INDEX.md:1-139` is the generated inventory
  of all 112 packets. It has no ACP, PACER, Discord-driver, Tailscale-driver, or
  Protobuf-driver packet. Related concepts in prose are called out separately
  in E10–E13; absence of a dedicated packet is not treated as absence of all
  future interest.
- **E15 — non-import liveness.** `@beep/repo-cli` declares the `beep-cli` binary
  (`packages/tooling/tool/cli/package.json:1-20`); `@beep/db-admin` migrations
  are inputs to the desktop bundle (`apps/professional-desktop/turbo.json:6-11`,
  `apps/professional-desktop/scripts/sync-migration-bundle.ts:60-110`); and
  Biome loads `@beep/lint-rules` by file path
  (`biome.jsonc:9-15,218-231`). These are concrete false-zero mechanisms.

## Ranked zero-consumer table

Every row has `0p/0t` consumers under E1. Cost format is:
`sweep s; check s / instantiations; L/T/B/D median-miss ms; tracked files`.
All numeric cells derive from E3–E4.

| Rank | Package | Consumers / class | Per-sweep cost | Risk | Verdict |
| ---: | --- | --- | --- | --- | --- |
| 1 | `@beep/repo-cli` | 0p/0t; zero-consumer | 153.738; 22.557 / 20,480,006; 2744/113951/1491/12995; 484 | Root `beep-cli` binary and root scripts are out-of-scan [E15]. | **keep** |
| 2 | `@beep/db-admin` | 0p/0t; zero-consumer | 38.182; 20.334 / 4,980,615; 2807/3016/263/11762; 48 | Desktop migration-bundle input; import count is the wrong liveness signal [E15]. | **keep** |
| 3 | `@beep/acp` | 0p/0t; zero-consumer | 30.485; 18.767 / 2,146,182; 2773/3624/336/4985; 30 | Mentioned by agent-chat research but has no implemented consumer [E13]. Operator explicitly identifies it as unused. | **candidate** |
| 4 | `@beep/shared-tables` | 0p/0t; zero-consumer | 29.652; 18.267 / 2,338,750; 2805/2427/194/5959; 22 | Shared package law marks it Active [E9]. | **keep** |
| 5 | `@beep/venice-ai` | 0p/0t; zero-consumer | 29.276; 17.716 / 2,066,983; 2786/2735.5/2300/3739; 17 | Planned provider brick and consumer of retained `openai-compat` [E13]. | **keep** |
| 6 | `@beep/xai` | 0p/0t; zero-consumer | 28.247; 17.939 / 2,027,392; 2760/2981/255/4312; 19 | Planned provider brick; also the only post-fix check remeasurement [E5,E13]. | **keep** |
| 7 | `@beep/pandoc-ast` | 0p/0t; zero-consumer | 28.007; 17.300 / 2,169,300; 2697.5/3960.5/255/3794; 22 | Completed-retained document interchange foundation [E9]. | **keep** |
| 8 | `@beep/gov-legal-mcp` | 0p/0t; zero-consumer | 27.977; 18.297 / 2,177,639; 2754/2794/216/3916; 22 | Completed standalone host; root semantics are out-of-scan [E11]. | **keep** |
| 9 | `@beep/nlp-mcp` | 0p/0t; zero-consumer | 27.709; 17.286 / 2,914,101; 2758/2989/256/4420; 23 | Completed standalone host [E11]. | **keep** |
| 10 | `@beep/m365-mcp` | 0p/0t; zero-consumer | 27.691; 17.842 / 2,157,875; 2776/2616/202/4255; 16 | Completed standalone host [E11]. | **keep** |
| 11 | `@beep/uspto-mcp` | 0p/0t; zero-consumer | 27.434; 17.933 / 1,905,271; 2703.5/2596.5/207/3994; 18 | Completed standalone host [E11]. | **keep** |
| 12 | `@beep/pacer` | 0p/0t; zero-consumer | 27.203; 17.808 / 1,914,933; 2811.5/2915.5/227/3441; 24 | No product consumer or dedicated packet found; substantial tests mean recreation is costlier than a stub [E1,E14]. | **candidate** |
| 13 | `@beep/discord` | 0p/0t; zero-consumer | 27.120; 18.095 / 1,746,422; 2699/2402/196/3728; 13 | OpenClaw names Discord as its v1 channel, but current infra does not import this driver [E10,E13]. | **candidate** |
| 14 | `@beep/form` | 0p/0t; zero-consumer | 26.983; 17.710 / 2,198,569; 2732/2411.5/112.5/4017; 87 | Storybook consumes stories outside `src`; completed-retained [E9]. | **keep** |
| 15 | `@beep/ontology` | 0p/0t; zero-consumer | 26.958; 17.293 / 1,913,454; 2810/2907.5/244/3703; 26 | Retained ontology foundation and future bridge [E10]. | **keep** |
| 16 | `@beep/openclaw` | 0p/0t; zero-consumer | 26.799; 17.369 / 1,893,292; 2801/2672/239.5/3717; 35 | Live `infra/**` consumer excluded by request; active goal [E10]. | **keep** |
| 17 | `@beep/ai-sync` | 0p/0t; zero-consumer | 26.724; 17.863 / 1,821,358; 2763/2519/226/3353; 24 | Root script invokes its package-local CLI (`package.json:364`). | **keep** |
| 18 | `@beep/architecture-lab-client` | 0p/0t; zero-consumer | 26.624; 18.151 / 2,040,145; 2735/2402/192/3144; 14 | Canonical-slice proof requires a client facade [E10]. | **keep** |
| 19 | `@beep/tailscale` | 0p/0t; zero-consumer | 26.241; 17.766 / 1,745,318; 2798/2351.5/184/3141; 16 | Recent hardening proves intentional ownership, but no current caller remains [E13]. | **candidate** |
| 20 | `@beep/onepassword-cli` | 0p/0t; zero-consumer | 26.069; 17.011 / 1,744,216; 2801/2440/200/3617; 13 | Locked as the first 1Password provider driver [E10]. | **keep** |
| 21 | `@beep/lint-rules` | 0p/0t; zero-consumer | 10.264; 0.084 / 369,845; 2769.5/7357/53/—; 33 | Biome loads its Grit rules by file path, outside the requested import graph [E15]. | **keep** |
| 22 | `@beep/courtlistener` | 0p/0t; zero-consumer | 3.675; 0.000 / 0; 2839/695.5/140.5/—; 10 | Version-only placeholder; packet says wait for product pull [E12]. | **candidate** |
| 23 | `@beep/dol` | 0p/0t; zero-consumer | 3.575; 0.000 / 0; 2764/668.5/143/—; 10 | Version-only placeholder; packet says wait for product pull [E12]. | **candidate** |
| 24 | `@beep/federal-register` | 0p/0t; zero-consumer | 3.542; 0.000 / 0; 2748/652.5/141.5/—; 10 | Version-only placeholder; packet says wait for product pull [E12]. | **candidate** |
| 25 | `@beep/protobuf` | 0p/0t; zero-consumer | 3.215; 0.000 / 0; 2783/290/142/—; 11 | Only exports `VERSION`; no dedicated packet or consumer found (`packages/drivers/protobuf/src/index.ts:1-20`; E1,E14). | **candidate** |

## Ranked near-zero / no-app-reach table

These packages have one or two production consumers but no production-import
path from an app. They are retained because each edge belongs to a standalone
host or repo-tool product. Cost format and derivation are identical to the
previous table [E1–E4].

| Rank | Package | Production consumers | Per-sweep cost | Risk | Verdict |
| ---: | --- | --- | --- | --- | --- |
| 1 | `@beep/repo-ai-metrics` | 1: `repo-cli` | 33.194; 18.183 / 2,292,180; 2813/6970/380/4848; 33 | Root tooling chain. | **keep** |
| 2 | `@beep/repo-utils` | 2: `repo-cli`, `repo-docgen` | 32.426; 18.455 / 3,446,334; 2756/3842/401/6972; 109 | Shared repo-tool substrate. | **keep** |
| 3 | `@beep/qa-capture` | 1: `repo-cli` | 30.238; 20.006 / 2,044,277; 2886/2645/272/4429; 30 | Required by browser-QA tooling. | **keep** |
| 4 | `@beep/nlp-processing` | 2: `nlp-mcp`, `wink` | 29.938; 17.687 / 2,352,741; 2777/2686/323/6465; 63 | Standalone NLP host chain [E11]. | **keep** |
| 5 | `@beep/repo-docgen` | 1: `repo-cli` | 29.366; 18.230 / 3,203,383; 2776.5/3201.5/286/4872; 32 | Root docgen implementation [E6,E8]. | **keep** |
| 6 | `@beep/wink` | 2: `nlp-mcp`, `nlp-processing` | 28.564; 18.030 / 2,472,559; 2753/3203/277/4301; 34 | Standalone NLP host chain [E11]. | **keep** |
| 7 | `@beep/govinfo` | 1: `gov-legal-mcp` | 28.142; 18.307 / 1,981,557; 2787/2884.5/227/3936; 41 | Completed government host chain [E11–E12]. | **keep** |
| 8 | `@beep/runpod` | 1: `repo-cli` | 27.302; 17.660 / 1,895,871; 2777/2891/262/3712; 21 | Repo docgen/worker tool dependency. | **keep** |
| 9 | `@beep/ecfr` | 1: `gov-legal-mcp` | 27.134; 17.854 / 1,811,396; 2800.5/2701.5/228/3550; 17 | Product-pulled completed government driver [E12]. | **keep** |
| 10 | `@beep/m365` | 1: `m365-mcp` | 27.058; 17.887 / 1,934,196; 2764/2601.5/226/3579; 16 | Completed standalone M365 host chain [E11]. | **keep** |
| 11 | `@beep/ffmpeg` | 2: `qa-capture`, `repo-cli` | 26.875; 17.934 / 1,853,222; 2839/2556/263.5/3283; 19 | Repo/QA tool consumers. | **keep** |
| 12 | `@beep/firecrawl` | 1: `repo-cli` | 26.847; 17.848 / 1,944,709; 2691/2540.5/252/3516; 18 | Repo corpus/tool consumer. | **keep** |
| 13 | `@beep/face-detection` | 1: `repo-cli` | 26.845; 18.159 / 1,757,251; 2736/2473/214/3263; 10 | Repo files-tool consumer. | **keep** |
| 14 | `@beep/exiftool` | 1: `repo-cli` | 26.797; 17.905 / 1,777,256; 2747/2440/206/3499; 17 | QA provenance/tool consumer. | **keep** |
| 15 | `@beep/test-utils` | 1 prod: `repo-cli`; 95 test consumers | 26.781; 17.830 / 1,758,969; 2847/2378/213/3513; 21 | Core test substrate; “near-zero” is misleading. | **keep** |
| 16 | `@beep/chalk` | 2: `repo-cli`, `repo-docgen` | 26.472; 17.520 / 1,812,320; 2798/2424/235/3495; 20 | Repo-tool UI dependency. | **keep** |
| 17 | `@beep/uspto` | 2: `repo-cli`, `uspto-mcp` | 26.384; 17.770 / 1,759,278; 2774/2505/206/3129; 14 | Completed standalone USPTO host chain [E11]. | **keep** |
| 18 | `@beep/phoenix` | 2: `repo-ai-metrics`, `repo-cli` | 26.298; 17.488 / 1,771,763; 2676/2564/215/3355; 14 | Repo metrics/tool consumers. | **keep** |
| 19 | `@beep/openai-compat` | 2: `venice-ai`, `xai` | 26.276; 17.296 / 1,875,843; 2760/2624/218/3378; 15 | Retained provider substrate [E13]. | **keep** |
| 20 | `@beep/obs` | 1: `repo-cli` | 25.961; 16.981 / 1,814,752; 2767/2326/211/3676; 18 | Browser-QA recording tool consumer. | **keep** |
| 21 | `@beep/fc-runs` | 1 prod: `test-utils`; 4 test consumers | 5.641; 0.003 / 1,333; 2821/680/147/1990; 12 | Property-test control substrate. | **keep** |

## Cumulative candidate saving

Candidates are accumulated in the ranked order below. Figures use the
historical E3 + E4 estimate and therefore must not be presented as post-fix
measured wall time [E5].

| Top N | Added package | Cumulative task-time saving | Tracked files removed |
| ---: | --- | ---: | ---: |
| 1 | `@beep/acp` | 30.485 s (0.51 min) | 30 |
| 2 | `@beep/pacer` | 57.688 s (0.96 min) | 54 |
| 3 | `@beep/discord` | 84.808 s (1.41 min) | 67 |
| 4 | `@beep/tailscale` | 111.049 s (1.85 min) | 83 |
| 5 | `@beep/courtlistener` | 114.724 s (1.91 min) | 93 |
| 6 | `@beep/dol` | 118.299 s (1.97 min) | 103 |
| 7 | `@beep/federal-register` | 121.841 s (2.03 min) | 113 |
| 8 | `@beep/protobuf` | 125.056 s (2.08 min) | 124 |

## Exhaustive 130-workspace classification

Notation is `package (production-consumer count p / test-consumer count t)`.
The lists below are the complete E1/E2 output; apps appear as app-reachable even
though nothing imports an app package.

### Zero-consumer (25)

`@beep/acp (0p/0t)`, `@beep/ai-sync (0p/0t)`,
`@beep/architecture-lab-client (0p/0t)`, `@beep/courtlistener (0p/0t)`,
`@beep/db-admin (0p/0t)`, `@beep/discord (0p/0t)`, `@beep/dol (0p/0t)`,
`@beep/federal-register (0p/0t)`, `@beep/form (0p/0t)`,
`@beep/gov-legal-mcp (0p/0t)`, `@beep/lint-rules (0p/0t)`,
`@beep/m365-mcp (0p/0t)`, `@beep/nlp-mcp (0p/0t)`,
`@beep/onepassword-cli (0p/0t)`, `@beep/ontology (0p/0t)`,
`@beep/openclaw (0p/0t)`, `@beep/pacer (0p/0t)`,
`@beep/pandoc-ast (0p/0t)`, `@beep/protobuf (0p/0t)`,
`@beep/repo-cli (0p/0t)`, `@beep/shared-tables (0p/0t)`,
`@beep/tailscale (0p/0t)`, `@beep/uspto-mcp (0p/0t)`,
`@beep/venice-ai (0p/0t)`, `@beep/xai (0p/0t)` [E1].

### Test-only-consumer (0)

None [E1].

### Driver-with-no-product-use (21)

`@beep/chalk (2p/1t)`, `@beep/ecfr (1p/1t)`, `@beep/exiftool (1p/1t)`,
`@beep/face-detection (1p/0t)`, `@beep/fc-runs (1p/4t)`,
`@beep/ffmpeg (2p/2t)`, `@beep/firecrawl (1p/1t)`, `@beep/govinfo (1p/1t)`,
`@beep/m365 (1p/1t)`, `@beep/nlp-processing (2p/2t)`, `@beep/obs (1p/0t)`,
`@beep/openai-compat (2p/0t)`, `@beep/phoenix (2p/1t)`,
`@beep/qa-capture (1p/1t)`, `@beep/repo-ai-metrics (1p/1t)`,
`@beep/repo-docgen (1p/1t)`, `@beep/repo-utils (2p/1t)`,
`@beep/runpod (1p/1t)`, `@beep/test-utils (1p/95t)`,
`@beep/uspto (2p/1t)`, `@beep/wink (2p/1t)` [E1–E2].

### App-reachable (84)

`@beep/agents-client (2p/2t)`, `@beep/agents-domain (5p/5t)`,
`@beep/agents-server (1p/1t)`, `@beep/agents-tables (1p/0t)`,
`@beep/agents-use-cases (3p/3t)`, `@beep/ai-provider-cli (1p/1t)`,
`@beep/anthropic (3p/2t)`, `@beep/api-transport (4p/3t)`,
`@beep/architecture-lab-config (3p/2t)`, `@beep/architecture-lab-domain (6p/5t)`,
`@beep/architecture-lab-proof (0p/0t)`, `@beep/architecture-lab-server (1p/1t)`,
`@beep/architecture-lab-tables (2p/0t)`, `@beep/architecture-lab-ui (1p/0t)`,
`@beep/architecture-lab-use-cases (3p/2t)`, `@beep/box (2p/1t)`,
`@beep/colors (3p/2t)`, `@beep/cosmos (2p/0t)`, `@beep/data (2p/1t)`,
`@beep/doc-text (2p/1t)`, `@beep/dock (2p/2t)`, `@beep/dock-react (1p/1t)`,
`@beep/documents-domain (4p/4t)`, `@beep/documents-server (1p/0t)`,
`@beep/documents-tables (2p/1t)`, `@beep/documents-use-cases (2p/2t)`,
`@beep/drizzle (6p/0t)`, `@beep/duckdb (4p/2t)`, `@beep/editor (1p/1t)`,
`@beep/epistemic-client (2p/1t)`, `@beep/epistemic-config (2p/2t)`,
`@beep/epistemic-domain (8p/9t)`, `@beep/epistemic-server (2p/1t)`,
`@beep/epistemic-tables (4p/4t)`, `@beep/epistemic-ui (1p/0t)`,
`@beep/epistemic-use-cases (6p/4t)`, `@beep/file-processing (15p/10t)`,
`@beep/graph-3d (2p/0t)`, `@beep/html (1p/0t)`, `@beep/hubspot (1p/0t)`,
`@beep/identity (113p/10t)`, `@beep/langextract (2p/1t)`,
`@beep/law-practice-domain (3p/1t)`, `@beep/law-practice-server (1p/0t)`,
`@beep/law-practice-tables (1p/1t)`, `@beep/law-practice-use-cases (1p/1t)`,
`@beep/lexical-schema (2p/2t)`, `@beep/libpff (2p/0t)`,
`@beep/mcp-kit (10p/6t)`, `@beep/md (11p/10t)`, `@beep/n3 (1p/0t)`,
`@beep/nlp (4p/4t)`, `@beep/observability (8p/0t)`, `@beep/oip-web (0p/0t)`,
`@beep/ontology-client (2p/0t)`, `@beep/ontology-config (2p/1t)`,
`@beep/ontology-domain (5p/5t)`, `@beep/ontology-server (1p/0t)`,
`@beep/ontology-ui (1p/0t)`, `@beep/ontology-use-cases (4p/4t)`,
`@beep/oxigraph (1p/1t)`, `@beep/pglite (3p/2t)`, `@beep/postgres (7p/7t)`,
`@beep/practice-kg-mcp (0p/0t)`, `@beep/pretext (2p/2t)`,
`@beep/professional-desktop (0p/0t)`, `@beep/provenance (10p/7t)`,
`@beep/rdf (13p/11t)`, `@beep/rdf-canonize (1p/2t)`,
`@beep/repo-configs (2p/0t)`, `@beep/sanity (1p/0t)`,
`@beep/schema (107p/56t)`, `@beep/semantic-web (6p/7t)`,
`@beep/shacl (1p/1t)`, `@beep/shared-domain (19p/16t)`,
`@beep/storybook (0p/0t)`, `@beep/tika (2p/0t)`, `@beep/types (3p/3t)`,
`@beep/ui (7p/2t)`, `@beep/utils (91p/51t)`,
`@beep/workspace-domain (5p/3t)`, `@beep/workspace-server (1p/1t)`,
`@beep/workspace-tables (2p/1t)`, `@beep/workspace-use-cases (3p/3t)` [E1–E2].

## Mechanical deletion recipe

### Shared recipe for every candidate

1. Delete the package directory. There are no `packages/**` or `apps/**`
   production/test importers to rewrite for any candidate [E1].
2. Remove its workspace path from `package.json`, then run the repository's
   config synchronizer so `tsconfig.json`, `tsconfig.packages.json`, and
   `syncpack.config.ts` lose aliases/references/manifest entries [E6]. Inspect
   the diff rather than hand-editing generated ordering.
3. Remove the package slug from `generatedComposers`, its exported `$…Id`
   composer, and its shape-stability entries in `@beep/identity`; then run the
   identity-registry check [E7]. Some older packages lack shape-test entries;
   use `rg` instead of assuming all three locations exist.
4. Regenerate `bun.lock`. No root catalog version is removed merely because a
   workspace disappears: first prove the third-party dependency has no other
   manifest consumer.
5. Regenerate/repair package-derived artifacts: coverage and test-typecheck
   baselines; Fallow boundaries + provenance/health; JSDoc JSON/Markdown
   inventory; schema catalog; and schema-first inventory. `@beep/acp` has live
   entries in all of these families (E6–E8); the small stubs generally have
   fewer entries, so use exact `rg` after directory deletion.
6. Delete any package-generated `docs/**` or aggregate rows and run bounded
   docgen. No `turbo.json` edit is expected because its task rules are generic
   [E8].
7. Prove absence with the E1 import audit plus exact-name/path searches, then
   run the normal package/config/identity and Yeet verification lanes in the
   implementation PR. This research did not execute them.

### Candidate-specific deltas

| Package | Delete | Special cleanup / preservation |
| --- | --- | --- |
| `@beep/acp` | `packages/drivers/acp/**` | Remove root aliases for `.`, `agent`, `client`, `errors`, `protocol`, `rpc`, `schema`, and `terminal` (`tsconfig.json:383,798-807`); remove `$AcpId` and both shape-test entries [E7]; delete its schema-first exceptions and generated schema catalog rows. Preserve `explorations/agent-chat-interface/**` as history and change any prose that falsely says the driver still exists [E13]. |
| `@beep/pacer` | `packages/drivers/pacer/**` | Remove root alias/reference/workspace/syncpack/identity entries. Remove PACER's coverage/test-typecheck baseline rows. Preserve government/legal packet references as future-source history; do not rewrite general PACER/RECAP prose as though the external source vanished. |
| `@beep/discord` | `packages/drivers/discord/**` | Remove root alias/reference/workspace/syncpack/identity entries and its baseline/inventory rows. Before merge, amend the active OpenClaw packet to say Discord transport is implemented without this wrapper or remains future work; its v1-channel commitment is the main risk [E13]. |
| `@beep/tailscale` | `packages/drivers/tailscale/**` | Remove root alias/reference/workspace/syncpack/identity entries and baselines. Keep the completed child-process-hardening record; update only claims that the package currently exists. Confirm active operational Tailscale actions call the CLI/infra directly rather than importing this package [E13]. |
| `@beep/courtlistener` | `packages/drivers/courtlistener/**` | Remove the generic config/identity/baseline entries. Keep the product-pull decision and source research; change package-present statements to “recreate when pulled” [E12]. |
| `@beep/dol` | `packages/drivers/dol/**` | Same as CourtListener. Preserve DOL API research and unresolved auth facts; only the version-only scaffold is deleted [E12]. |
| `@beep/federal-register` | `packages/drivers/federal-register/**` | Same as CourtListener. Preserve Federal Register research; only the version-only scaffold is deleted [E12]. |
| `@beep/protobuf` | `packages/drivers/protobuf/**` | Remove generic config/identity/baseline entries. Do **not** remove protobuf-related third-party catalog entries or OTLP prose without a separate consumer audit; this workspace itself only exports `VERSION` (`packages/drivers/protobuf/src/index.ts:1-20`). |

## Recommended PR slicing

1. Delete `@beep/acp` alone first. It is the operator-named target, has the
   largest candidate cost, and exercises every mechanical cleanup family.
2. Delete the four pure placeholders (`protobuf`, `courtlistener`, `dol`,
   `federal-register`) together. Their combined historical saving is only
   14.007 s, but the diff is almost entirely registry/catalog removal [E3–E4,E12].
3. Decide the three implemented-but-unused drivers (`pacer`, `discord`,
   `tailscale`) separately with packet owners. They account for 80.564 s of the
   historical estimate but carry the highest recreation/future-work risk
   [E12–E13].

This ordering keeps the first follow-up small and falsifiable while preserving
the option to stop after ACP if the generated-catalog churn proves larger than
the measured benefit.
