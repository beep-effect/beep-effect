# T3 integration cache posture review

Reviewed 2026-10-09 with GPT-6.1-Sol at medium effort. This records configuration review, not cache reuse qualification or a live provider result.

The canonical executable census and `beep quality cache-policy` identify exactly 15 blocking computations:

| Subject | Computations | Reviewed change |
| --- | --- | --- |
| Root | `//#lint:policy-fingerprint` | Generated inputs add only `packages/drivers/t3-code/package.json` and `packages/drivers/t3-code/src/**`. Command, environment, outputs and cache flag remain unchanged. The Turbo source digest changes accordingly. |
| Repo CLI | `build`, `check`, `doctest`, `lint:deprecated-apis`, `test`, `test:property` | Each adds the corresponding T3 `build` or `transit` dependency because the CLI now imports the typed T3 driver. Commands and effective task configurations are unchanged. |
| T3 driver | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` | Newly generated package tasks inherit the existing root Turbo configuration without a package override. |

The T3 tasks execute local compilation, type checks, documentation, lint or synthetic HTTP protocol tests. They do not invoke the live T3 application, launch provider inference, mint credentials or require live OAuth. The driver tests supply synthetic redacted credentials to their local fixture. This observation does not qualify arbitrary future test implementations.

The build task retains the root output collection; docgen retains `.beep/docgen/**`, `.jsdoc-loop/generated-docs/**` and `docs/**`; the other six tasks declare no outputs. Deprecated API lint retains `NODE_OPTIONS`; test retains `BEEP_FC_NUM_RUNS` and `BEEP_FC_SEED` plus the existing `BEEP_CREATE_PACKAGE_BUN_ARGS_FILE` and `GITHUB_STEP_SUMMARY` passthrough keys. Other reviewed T3 tasks have no environment or passthrough keys. Root input inheritance retains existing `.env` patterns; no new secret-bearing environment key is added.

The canonical baseline writer records whole executable projections for the three reviewed subjects: `//`, `@beep/repo-cli` and `@beep/t3-code`. It therefore also records the corresponding noncached CLI dependency edges (`audit`, `coverage`, `package-test-typecheck`) and noncached or graph-only T3 rows. Those records do not enable caching. All other subjects must remain structurally unchanged.

Preserve the existing qualification scope, profile, epoch and qualification ledger. Do not promote T3 tasks into that scope. Record only the reviewed legacy posture using `beep cache baseline --request` with an exact previous baseline digest and these three explicit subjects. Configuration review and cache correctness qualification remain separate.
