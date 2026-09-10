# Cache Qualification Protocol

## The unit under test

A cache qualification is the tuple:

`computation identity x reuse layer x environment profile x cache epoch`.

Task names alone are too broad. `@beep/schema#check` on a local linked
worktree, the same computation on an Ubuntu hosted runner, and a Yeet lane
receipt that happens to include it are separate claims. The ledger starts from
the compact default in [`cache-qualification.json`](./cache-qualification.json)
and expands against [`task-census.json`](./task-census.json).

## State machine

| State | Meaning | Allowed next states |
| --- | --- | --- |
| `unassessed` | Present in the census; no safety conclusion. | `excluded`, `candidate` |
| `excluded` | Current boundary is ineligible with a recorded reason. | `candidate` after decomposition or changed evidence |
| `candidate` | Contract and experiment plan are complete enough to execute. | `shadow`, `excluded` |
| `shadow` | Normal execution remains authoritative while a hypothetical hit is compared. | `qualified`, `excluded`, `suspended` |
| `qualified` | Evidence supports reuse only within the named profile/epoch. | `suspended` or requalification |
| `suspended` | A prior qualification is invalidated or contradicted. | `candidate` after remediation |

An existing `cache: true`, an omitted field that defaults to caching, a remote
hit line, or a restored `.turbo/cache` archive changes none of these states.

## Contract worksheet per computation

Before experiments, record:

1. exact command and nested subprocess graph;
2. all semantic file, environment, toolchain, platform, service, time, locale,
   random, network, and repository-state inputs;
3. declared and observed files created, modified, deleted, or read outside the
   declared input set;
4. stdout/stderr and summary behavior, including redaction requirements;
5. exit code and any external verdict that must remain fresh;
6. concurrency assumptions and shared directories;
7. supported producer and consumer profiles;
8. the lowest pure computation boundary if the wrapper mixes pure work with a
   volatile verdict or mutation.

## Required experiment matrix

For every supported profile:

- Run three isolated fresh/fresh pairs from distinct roots and compare exit
  status, normalized output trees, terminal logs, and declared receipts.
- Run three isolated fresh/remote-hit pairs. Confirm the hit at the wire/server
  layer; an Actions archive hit or task-level recomputation is insufficient.
- Perturb one semantic input class at a time and require an invalidation or a
  documented proof that it is semantically irrelevant.
- Perturb non-semantic orchestration inputs and require hash stability plus
  observational equivalence.
- Run supported concurrent combinations and prove no shared-path collision,
  race-dependent output, lock leakage, or cross-job contamination.
- Capture logs and telemetry with synthetic canary secrets and fail if a token,
  secret, sensitive path, or unbounded artifact content appears.
- Where cross-root reuse is claimed, replay from another linked worktree. Where
  cross-runner reuse is claimed, cover every producer/consumer direction.
- Repeat under exact stable Turbo. Run the exact published canary in an
  isolated, non-production namespace and record a separate verdict.

Promotion additionally requires at least ten representative shadow decisions
and zero unexplained divergence. Normal execution remains authoritative during
shadow mode.

## Mandatory negative tests

- missing, changed, or undeclared root and child `turbo.json` inputs;
- lockfile, runtime version, package-manager version, config, and generated
  alias changes;
- omitted package scripts versus configured dry-run nodes;
- changed environment variables, wildcard families, absent variables, locale,
  timezone, clock, randomness, and seed/run-count settings;
- absolute root embedded in `.tsbuildinfo`, source maps, manifests, or logs;
- concurrent coverage/report directories and shared generated outputs;
- remote `401`, `403`, `404`, `429`, `5xx`, timeout, truncated body, malformed
  metadata, missing signature tag, invalid signature tag, and body corruption;
- same bearer against another tenant selector;
- read token attempting `PUT`, direct writer invocation, and write token
  downgrade/misrouting;
- Actions archive restored while the Turbo entry is invalid or missing;
- branch-local `heavy.yml` differing from the resolved reusable workflow SHA;
- required hosted job startup/status even when every pure prerequisite hits.

## Family-specific starting hypotheses

- `lint` and `check` are likely early candidates once root/child config inputs
  and log safety are proven.
- `build` needs cross-root `.tsbuildinfo`, framework output, source-map, and
  platform/toolchain scrutiny before broad sharing.
- `test` and property tests require time/random/network/open-handle inspection;
  property seed and run count are explicit invalidation dimensions.
- `audit` should normally decompose into its lowest pure children instead of
  replaying the composite wrapper.
- `docgen` needs repeat-run, permuted discovery-order, guarded-write, and dirty
  worktree tests.
- coverage should separate shard computation, report materialization,
  aggregation, ratchet comparison, and hosted verdict.
- integrations and Storybook tests should cache only hermetic prerequisites;
  service/browser availability and the final verdict stay fresh.
- fixers, code generation, and persistent servers are not cached in their
  current form. A separate no-write `check` computation can be designed and
  qualified independently.

## Evidence bundle

Compact git evidence should include the computation contract, exact client and
backend versions, profile/epoch, input perturbation table, normalized digests,
wire verdict, divergence count, and reviewer disposition. Raw archives,
profiles, packet captures, and full logs remain bounded CI artifacts with a
retention policy and content-safety check.

Qualification is revoked when the command, relevant config, child config,
toolchain, environment profile, backend contract, signature epoch, or a
must-fail fixture changes. Upgrades re-enter `candidate`; they never inherit a
green state by version proximity.
