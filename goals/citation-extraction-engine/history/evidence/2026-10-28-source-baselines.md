# Exact-pin source baselines — 2026-10-28

Scope: P0 acquisition, executable upstream baselines, and assertion discovery.
No target parity claim, terminal extension disposition, or P0 completion.

The user explicitly authorized both frozen-lockfile donor installs and suites
in this goal chat on 2026-10-28. Runs used detached, isolated worktrees under
`~/.cache/beep/citation-extraction-engine/`; the original reference checkouts
were preserved. No lockfile or upstream source code was edited.

## Pins, licenses, tools and results

- Official eyecite: commit
  `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
  `a35a58fac03400f71a93a93485b77f1d56f2b02f`. CPython 3.11.15:
  52 methods, `OK`; clean before/after.
- eyecite-ts: commit `34133d03143ea65861f48a5ed0eb32c931581666`,
  tree `f1243d0723cea1e53a5263ef67c9e066230729fc`. Node 24.22.1,
  pnpm 10.6.5, Vitest 4.0.18. Isolated npm-config rerun:
  323 files passed; 4,844 tests passed, 10 skipped, 8 todo.
- eyecite-js: commit `53a49f2412da668aaf262e5f92584c2c3781043b`,
  tree `521fc394d7130f9b21e206d2bf236ffebcca932c`. Bun 1.4.4:
  423 passed, 0 failed, 2,146 expectations, 29 files; clean before/after.

The shared official reference had advanced to another commit. It was not reset.
The required pin was still available locally, so a detached worktree restored
the specified oracle and tree. Exact-pin validation precedes the new audit.

### Commands

```sh
cd "$EYECITE_ORACLE_ROOT"
uv run --python 3.11 python -m unittest discover -s tests -p 'test_*.py'

cd "$EYECITE_TS_ROOT"
pnpm install --frozen-lockfile
pnpm test -- --run
NPM_CONFIG_USERCONFIG=/dev/null NPM_CONFIG_IGNORE_SCRIPTS=true pnpm test -- --run

cd "$EYECITE_JS_ROOT"
bun install --frozen-lockfile
bun test
```

The first eyecite-ts test command passed 4,841 tests but failed its published
tarball test setup with npm `EALLOWSCRIPTS`: workstation user configuration
contains an `allow-scripts` option that npm 12 rejects for project installs.
The rerun suppresses that user config for this process and disables npm install
scripts. It changes no workstation configuration, donor source, or lockfile.
The packaging tests then execute successfully, accounting for the three
additional passing tests. Skipped/todo tests are not claimed as proved.

The donor build regenerates tracked `llms.txt` in its isolated worktree. This
is the only tracked post-run change; it is retained as evidence and is neither
copied back to the shared reference nor treated as a source modification.
Any later regeneration must start from a fresh clean pin or account for it.

### SHA-256

- Official `LICENSE`:
  `db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772`
- eyecite-ts `LICENSE`:
  `4035b4eb4428ec60e5e02ed53b546ae17b3cd3c039ad42f61611ef8f389d6264`
- eyecite-ts `pnpm-lock.yaml`:
  `bc48a7e3a4ee02128b8c656889e4e24ce2c003bc16273cefe4801c478ac1b7c3`
- eyecite-js `LICENSE`:
  `91cde2e1ec770d3a7a0b769fbf344de33588312b994ff4219f0e75d7fa6db025`
- eyecite-js `bun.lock`:
  `a4789b18815600b0fdb2a6c5a851ade5b023623abc25186d1d8a194e65de15a9`

Sanitized command logs are archived in `history/evidence/logs/`; raw logs
remain local beside the detached worktrees. The portable discovery artifact
includes source-file, license and exporter hashes.
This baseline receipt alone does not prove individual extension behavior.

## Independent source/runtime discovery

`ops/audit-oracle.py` walks the pinned Python AST independently of unittest
execution, then instruments unittest and mock assertion calls in the
unmodified suite.
The committed `oracle-discovery.json` records:

- 4 public operations;
- 39 model declarations and 152 helper/function declarations;
- 52 unittest methods;
- 66 static assertion declarations expanded into 1,583 runtime events;
- zero unobserved static assertion declarations;
- 28 regex declaration candidates, pending semantic family classification;
- one external upstream fixture; and
- commit/tree, per-file SHA-256, license SHA-256, and exporter SHA-256.

Reproduce from the feature checkout using the pin's Python environment:

```sh
"$EYECITE_ORACLE_ROOT/.venv/bin/python" \
  goals/citation-extraction-engine/ops/audit-oracle.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" \
  --output goals/citation-extraction-engine/history/evidence/oracle-discovery.json
```

The report deliberately counts assertion events, not semantic cases. A fixture
may run against three tokenizers, assert several fields, or call an assertion
helper. Case normalization must identify these relationships explicitly before
creating `canonical-cases.json`. Regex candidates are not yet exhaustive regex
families. No runtime expectation or implementation proof is invented to turn
these discovery rows into terminal accounting rows.

## Portable discovery validation

The test-only `CitationOracleDiscovery` schema exports through
`@beep/law-practice-use-cases/test`. It decodes the retained evidence with
Effect Schema JSON codecs and checks unique identities, source-content hash
references, declaration/event coverage, and method counts. The packet command
also verifies the retained exporter SHA-256 against `ops/audit-oracle.py`.

```sh
bun run goals/citation-extraction-engine/ops/check-discovery.ts
bun run --cwd packages/law-practice/use-cases test -- \
  test/CitationOracleDiscovery.test.ts test/CitationPrerequisites.test.ts
bun run beep quality package-verify @beep/law-practice-use-cases
```

Observed: 342 source rows, 52 methods, 1,583 assertion events; eight focused
consumer/discovery tests passed. Negative controls reject wrong pins/licenses,
unknown row kinds, malformed hashes, duplicate source/event rows, missing or
unobserved declarations, inconsistent file hashes/event IDs/method counts,
and failed or skipped upstream runs. Full package audit and docgen pass.

A second independent execution of the same discovery tool produced
byte-identical JSON (`cmp` exited zero). This validates deterministic discovery
output. It does not establish the semantic case expansions, normalized stage
outputs, regex families, or target-test proofs required by `citation:parity-check`.
That strict parity checker and its separate negative controls remain to build.
