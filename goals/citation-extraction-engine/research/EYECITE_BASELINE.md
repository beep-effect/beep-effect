# Official Eyecite Baseline

Captured: 2026-07-29

## Normative source

- Repository: `https://github.com/freelawproject/eyecite`
- Detached commit: `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`
- Git tree: `a35a58fac03400f71a93a93485b77f1d56f2b02f`
- Upstream version: `2.7.6`
- Upstream commit date: `2025-10-03T13:23:57-04:00`
- License: BSD-2-Clause
- Local reference:
  `/home/elpresidank/YeeBois/research/law_stuff/repos/eyecite`

The checkout was cloned from the official repository and checked out detached.
It is research/oracle state outside this repository and is not a build or
runtime dependency.

## Public baseline

`eyecite/__init__.py` exports:

1. `annotate_citations`
2. `get_citations`
3. `clean_text`
4. `resolve_citations`

The pinned source contains nine implementation modules plus
`test_factories.py`, nine `test_*.py` modules, one text asset, and 52 unittest
methods. Several unittest methods hold large parameter/fixture tables, so 52 is
not the future parity-case count. Each independently asserted tuple/subtest must
become its own case-level ledger row.

## Executable oracle proof

Command:

```sh
uv run --python 3.11 python -m unittest discover -s tests -p 'test_*.py'
```

Observed environment/result:

- CPython `3.11.15`
- 18 packages installed from the pinned lock/source metadata
- `Ran 52 tests in 10.670s`
- `OK`
- The checkout remained at the pinned detached commit.

The suite emits repeated “Unknown overlap case” diagnostics during known
fixtures and still exits successfully. Preserve those fixture outcomes; do not
silence a differing TypeScript result by treating the diagnostic text itself as
the oracle.

## Python 3.12 environment finding

The same command without `--python 3.11` selected CPython `3.12.13` and failed
before tests:

- pinned dependency: `pyahocorasick==2.0.0`
- failure: native extension declares `typedef char bool`
- host compiler treats `bool` as a C23 keyword

This is an environment/bootstrap incompatibility, not a failed eyecite test.
Oracle generation is therefore pinned to Python 3.11 for this goal. Changing
the dependency lock or treating Python 3.12 output as a different oracle
requires an explicit baseline decision.

## Comparison references

### eyecite-ts

- Commit: `34133d03143ea65861f48a5ed0eb32c931581666`
- Tree: `f1243d0723cea1e53a5263ef67c9e066230729fc`
- Version: `0.34.2`
- License: MIT
- Observed inventory: 334 files below `tests/` and 3,789 textual `it(`/`test(`
  declarations.
- Baseline attempt: `pnpm test -- --run`.
- Result: environment-blocked in `pretest`; the checkout has no `node_modules`,
  so `tsx scripts/generate-reporters-data.ts` was not found and no assertions
  ran.

### eyecite-js

- Commit: `53a49f2412da668aaf262e5f92584c2c3781043b`
- Tree: `521fc394d7130f9b21e206d2bf236ffebcca932c`
- Version: `2.7.6-alpha.28`
- License: BSD-2-Clause
- Observed inventory: 31 test files and 423 textual test declarations.
- Baseline attempt: `bun test`.
- Result: 53 tests across 29 files were discovered; 28 dependency-free tests
  passed and 25 files failed during import because package dependency
  `domhandler` is not installed. This is not a green or meaningful red source
  baseline.

Neither port is normative merely because it has more tests or features.
No dependencies were installed during this packet pass. P0 must provision the
pinned lockfiles with explicit authorization, rerun both suites, inventory
unique failures/capabilities, and apply the extension gates before
implementation.

## Drift policy

Current upstream `main`, releases after this commit, and later local clone pulls
do not change this goal's oracle. A future drift update must:

1. identify the new commit and license/data changes;
2. regenerate capability and case inventories;
3. classify behavior changes;
4. update normalized fixtures and hashes; and
5. pass the same differential and safety gates.
