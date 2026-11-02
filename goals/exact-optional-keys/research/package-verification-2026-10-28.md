# Package verification, 2026-10-28

The implementation merge `93ed4b751e9f0d6ea1d453762839877dcbf19c14` touches
25 registered workspace packages. Each received the default command below,
serially, with no `--quick` option. The lint-rules package was checked again
after the reviewed direct-parameter regression fix.

```sh
bun run beep quality package-verify <package>
```

| Package | Exit | Audit | Docgen | Total seconds |
| --- | --- | --- | --- | --- |
| `@beep/api-transport` | 0 | ok 6.8s | ok 2.8s | 11.4 |
| `@beep/commands` | 0 | ok 11.9s | ok 2.7s | 16.2 |
| `@beep/config-file` | 0 | ok 19.0s | ok 3.7s | 24.4 |
| `@beep/duckdb` | 0 | ok 12.8s | ok 3.0s | 17.5 |
| `@beep/ffmpeg` | 0 | ok 9.8s | ok 3.3s | 14.9 |
| `@beep/github` | 0 | ok 14.7s | ok 4.2s | 20.6 |
| `@beep/github-reporting` | 0 | ok 11.4s | ok 4.1s | 17.8 |
| `@beep/infra` | 0 | ok 11.6s | ok 15.0s | 29.2 |
| `@beep/jsonl` | 0 | ok 13.9s | ok 4.2s | 19.8 |
| `@beep/lexical-schema` | 0 | ok 9.2s | ok 9.7s | 20.8 |
| `@beep/lint-rules` | 0 | ok 26.6s | ok 2.6s | not sampled |
| `@beep/markdown` | 0 | ok 21.6s | ok 4.2s | 27.7 |
| `@beep/memfs` | 0 | ok 21.2s | ok 2.7s | 25.8 |
| `@beep/oip-web` | 0 | ok 16.5s | skip | 18.3 |
| `@beep/package-json` | 0 | ok 20.6s | ok 5.5s | 28.1 |
| `@beep/pandoc-ast` | 0 | ok 10.7s | ok 7.9s | 20.5 |
| `@beep/professional-desktop` | 0 | ok 22.8s | ok 22.9s | 48.2 |
| `@beep/qa-capture` | 0 | ok 8.5s | ok 4.0s | 14.2 |
| `@beep/repo-cli` | 1 | fail 1335.3s | ok 43.4s | 1380.4 |
| `@beep/repo-configs` | 0 | ok 7.1s | ok 4.2s | 12.9 |
| `@beep/repo-utils` | 0 | ok 12.1s | ok 6.6s | 20.4 |
| `@beep/schema` | 0 | ok 7.0s | ok 4.7s | 13.2 |
| `@beep/schema-org` | 0 | ok 11.8s | ok 2.2s | 15.7 |
| `@beep/scratchpad` | 1 | skip | fail 5.1s | 6.9 |
| `@beep/yaml` | 0 | ok 56.6s | ok 2.8s | 60.9 |

23 commands passed. The two remaining results are attributed below, under the
active goal's allowance for reproduced unrelated failures. These are retained
failed results, not green package-verification claims.

## Repo CLI: ambient cache environment

The full audit reached its tests after build and typecheck. Its result was
7,930 tests passed, six failed and three skipped across 377 files. Docgen passed.
The six failures are in unchanged `ci-lane.test.ts`, `docgen.test.ts`, and
`quality-tasks.test.ts`: expected bare commands were wrapped in `op run`, with
an extra cache-session probe. `EnvConfig.ts`, `TurboCache.ts` and all three
test files match `origin/main` exactly. This goal changes no cache or credential
implementation.

A focused replay reproduced all six failures. Unsetting the Turbo variables
and disabling dotenv only on the initial runner did not remove them. An
explicit local-only environment did: all six passed across the three files,
with 431 unrelated tests skipped. The control used blank values for
`TURBO_API`, `TURBO_TOKEN`, and `TURBO_TEAM`, `TURBO_CACHE=local:rw`, and
`BEEP_TURBO_HOST_CACHE_DISABLED=true`, then ran Bun with `--no-env-file`.
No secret value was read, copied or changed for this control.

The focused test selection was:

```text
skips the lane when Turbo|runs the whole lane when|discovers scoped docgen through native Turbo|executes full docgen through direct Turbo|skips the full JSDoc metadata|keeps running repo-wide root lint policy
```

The raw full-suite failure is retained as environment-dependent evidence.
Its six failing assertions have a passing isolated replay; the original
7,930 passing tests are not described as a second full-suite run.

## Scratchpad: reproduced inherited documentation backlog

The default verifier skips audit for this workspace and fails docgen on
443 existing missing documentation annotations. The identical default command
was also run on clean `main` at `ed0c4ec45e7beaed152ca811489ca1030d4b8879`.
The diagnostic sets match exactly: 443 in each, zero added and zero removed.
Scratchpad source has no diff from `origin/main`.

Examples include `effected/cli/ui/CliUi.ts:1` missing `@since` and
`effected/runner/Paths.ts:101` missing an example. The packet already records
the inherited scratchpad gate and its assigned disposition in
[OPPORTUNITIES.md](./OPPORTUNITIES.md). This report retains that baseline failure;
it adds no suppression, baseline update or expiring waiver.

## EF-40 fixture enforcement

The final lint-rules full audit and docgen passed. With only the EF-40 plugin
and no built-in recommended rules, the real Biome CLI returned:

| Fixture | Exit | Plugin errors | Other errors |
| --- | --- | --- | --- |
| Invalid | 1 | 32 | 0 |
| Allowed | 0 | 0 | 0 |

The rule source SHA-256 is
`9cf66aa559efe6d140e77931c75afa436ccfbaa6812c9965f6ffb2816df83176`.

## Hosted and completion evidence

All 33 hosted checks passed at published head `d92846e9cb`. The final precision
and evidence update must obtain its own hosted readiness before merging.
The detached `--until-ready` monitor emits a status snapshot; the classic
`beep yeet monitor` route additionally writes the declared `verdict.json`.
After final readiness, run that classic monitor, verify its accepted head and
`mergeReady` facts, retain its unmodified artifacts in the owning clone, and
only then merge and run completion refresh.

## Historical census reconciliation

The final rule was also replayed against the historical TS tree at `c9035c45e7`.
All 8,301 tracked TS/TSX files under the goal roots were exported; Biome processed
8,298 under its scanner limits and reported exactly 440 plugin errors. Those
match all 440 codemod sites, including their member-token columns and facets,
with zero missing, extra or unparsed references. Actual ripgrep reports 448
references on 446 matching lines; eight enumerated comments or strings are
excluded, leaving the same 440 sites. See
[detection-reconciliation-2026-10-28.jsonc](./detection-reconciliation-2026-10-28.jsonc).
