# Turborepo Task and Quality Census

Snapshot: Beep `f56748290df89c5a07743fa7e2c8bc5da1fff51a`, Turbo `2.10.12`,
2026-09-04. The reconstructable machine-readable census is
[`task-census.json`](./task-census.json).

## Headline counts

| Surface | Count | Meaning |
| --- | ---: | --- |
| Declared workspaces | 142 | Exact result of `turbo query ls`; nested fixture manifests are excluded. |
| Root task definitions | 21 | Twenty generic families plus `@beep/api-docs#build`. |
| Generic configured dry-run nodes | 2,840 | `142 x 20`; not an execution count. |
| Executable workspace scripts | 1,503 | A matching script key exists in the workspace manifest. |
| Production child Turbo configs | 5 | Inputs, outputs, or dependencies change; none adds a cache decision. |
| Fixture Turbo configs | 1 | Proof-epoch test fixture, not production policy. |

Turbo's dry plan creates a task node even when the package has no corresponding
script. `transit` is the decisive counterexample: the dry plan produces 142
nodes, but zero workspace manifests define a `transit` script and a real
summary contains no executed task. Any qualification projection must join the
Turbo graph to package-script presence rather than count dry nodes.

## Root task families

| Task | Cache declaration | Executable scripts | Initial audit disposition |
| --- | --- | ---: | --- |
| `build` | explicit `true` | 140 | High-value candidate; outputs and portability unproven. |
| `lint` | explicit `true` | 140 | Strong candidate; config/input and log-safety proof required. |
| `audit` | explicit `true` | 139 | High-risk composite; invokes several task classes and has broad outputs. |
| `docgen` | explicit `true` | 132 | Candidate only after deterministic-output and mutation-boundary proof. |
| `check` | omitted, Turbo default | 140 | Candidate; omission has no recorded qualification provenance. |
| `test` | omitted, Turbo default | 140 | Candidate per package/profile; randomness, time, logs, and hidden I/O require proof. |
| `test:property` | omitted, Turbo default | 96 | High-risk candidate; seed/run-count invalidation must be demonstrated. |
| `storybook:build` | omitted, Turbo default | 1 | Candidate; browser/build inputs and portable outputs require proof. |
| `transit` | omitted, Turbo default | 0 | Dependency-graph label, not an executable computation at this snapshot. |
| `package-test-typecheck` | explicit `false` | 140 | Digest seam exists; adoption is owned by `time-to-certainty`. |
| `coverage` | explicit `false` | 134 | Current aggregate is unsafe to assume reusable; lower pure shards may qualify. |
| `test:integration` | explicit `false` | 90 | Current wrapper crosses external/secret-bearing boundaries; pure prerequisites may split. |
| `test:integration:parallel` | explicit `false` | 24 | Same boundary plus concurrency-isolation proof. |
| `test:integration:serial` | explicit `false` | 3 | Same boundary; serial execution does not imply determinism. |
| `lint:fix` | explicit `false` | 139 | Exclude current mutating command; cache the check, never the fixer. |
| `codegen` | explicit `false` | 34 | Exclude current mutator; a separate check/projection computation may qualify. |
| `dev` | explicit `false`, persistent | 8 | Exclude persistent service. |
| `storybook` | explicit `false`, persistent | 1 | Exclude persistent service. |
| `storybook:start` | explicit `false`, persistent | 1 | Exclude persistent service. |
| `test:storybook` | explicit `false` | 1 | Current browser/service verdict remains fresh; pure build prerequisite is separate. |

Configured cache state is evidence about production posture, not qualification.
In particular, artifact-producing tasks can be disabled (`coverage` and
`package-test-typecheck`), while an outputless task can currently use Turbo's
default cache (`check`).

## `turbo.json` audit findings

1. The schema URL is still versioned as `v2-10-2`, while the installed and
   locked client is `2.10.12`. The generated schema shipped with the exact
   client must become validation authority before changing any options.
2. The root omits `cacheDir`. Current Turbo intentionally shares the main
   worktree's cache with linked worktrees in this mode. Restored output bytes
   may still contain absolute paths, so sharing is a feature to qualify rather
   than a portability guarantee.
3. The root enables `affectedUsingTaskInputs`, `filterUsingTasks`, and
   `globalConfiguration`. Current stable also exposes `errorsOnlyShowHash`,
   `githubActionsRemoteBaseRefFallback`, `longerSignatureKey`,
   `strictTaskEntrypointSelection`, `watchUsingTaskInputs`, and experimental
   workspace/observability flags. Each relevant flag needs an isolated
   experiment; none is adopted by this packet.
4. `build` and `audit` capture broad framework output families plus
   `**/node_modules/.tmp/*.tsbuildinfo`. Those compiler artifacts require
   cross-root and cross-runner-class replay tests because byte-for-byte restore
   can preserve absolute paths.
5. `audit` combines build, check, tests, integrations, and lint through package
   wrappers, declares a large secret-related environment surface, and caches a
   broad output set. The lowest pure child computation is the safer
   qualification unit.
6. `test` passes admission/session paths through without hashing them. That can
   be correct when they affect orchestration only, but it requires a negative
   test proving they cannot alter test semantics or emitted logs.
7. The five production child configs change the effective task hash. Any proof
   epoch or Actions-cache key that covers only root `turbo.json` is incomplete
   as a standalone policy identity, even though Turbo's own task hash may still
   invalidate correctly.
8. The cache transports terminal output as part of task results. Every
   candidate therefore needs a log-safety capture, not just an output-tree
   comparison.

## Hosted quality inventory

The source registry contains 25 hosted descriptors: 23 `beep ci lane`
identifiers plus `dependency-review` and `pr-size`, which are CI-native. The 23
replayable identifiers are:

`build`, `check`, `codegen`, `commitlint`, `coverage`, `desktop-ipc`, `docgen`,
`doctest`, `ecosystem`, `fallow`, `jsdoc-ratchet`, `knip`, `labs`, `lint`,
`lint-policy`, `nix`, `property`, `repo-sanity`, `sast`, `secrets`, `security`,
`test-integration`, and `test-unit`.

The registry's hand-maintained `required` field is not hosted authority: it
currently calls JSDoc Ratchet optional while the active lane-economics packet
records that it joined the live required set. Requiredness must come from a
fresh ruleset/run receipt owned by that packet.

The principal workflows implement the intended authorization split:

- trusted pushes use local and remote read/write;
- same-repository pull requests use local read/write plus remote read-only;
- forks use local read/write only;
- the protected warmer is a distinct trusted writer.

GitHub Actions transport of `.turbo/cache` is a separate reuse layer. It is a
pool transport, not proof that any restored entry is valid. Two current seams
need explicit remediation design:

- the composite action's own save occurs during setup; most callers add a
  post-lane save, but push Build can still save only pre-lane fallback state;
- its key hashes root `turbo.json`, root `package.json`, and `bun.lock`, but not
  the five production child Turbo configs.

Finally, [`check.yml`](../../../.github/workflows/check.yml) calls reusable
Heavy from `beep-effect/beep-effect/.github/workflows/heavy.yml@main`. A branch
edit to local `heavy.yml` is proposed configuration, not evidence about the
definition a PR run actually executed. Hosted proof must record the resolved
workflow SHA.

## Existing reuse layers that must remain distinct

| Layer | Current identity | What it may prove | Owner/boundary |
| --- | --- | --- | --- |
| Turbo task result | Turbo task hash + environment/cache policy | Replay of declared task outputs and logs | This exploration may qualify and later configure it. |
| Actions `.turbo/cache` transport | Archive key + restore prefixes | Availability of a local Turbo cache pool | Never a task-validity verdict. |
| Quality `LaneProofReuse` | Lane, command, whole virtual tree, head/base, environment | Local reuse of an exact successful lane record | Existing production mechanism; live advisory/security lanes excluded. |
| Yeet full-proof state | Branch/base/head/commit/diff/tier/steps | Exact durable reuse before publish | Does not satisfy hosted required checks. |
| `ProofLedger` | Per-lane input/command/profile/epoch digest | Intended successor exact-digest proof reuse | Implemented but not production-wired; owned by `time-to-certainty`. |

The optimization program should connect these layers with correlated receipts,
not collapse them into one `cacheable` flag.

## Qualification consequence

All 1,503 executable scripts begin `unassessed` for every reuse layer and
environment profile, regardless of today's Turbo flag. The compact default and
family exceptions are in [`cache-qualification.json`](./cache-qualification.json).
No task becomes `qualified` until the experiment matrix in
[`cache-qualification.md`](./cache-qualification.md) passes.

## Primary repo evidence

- [`turbo.json`](../../../turbo.json)
- [`setup-monorepo-ci/action.yml`](../../../.github/actions/setup-monorepo-ci/action.yml)
- [`check.yml`](../../../.github/workflows/check.yml)
- [`heavy.yml`](../../../.github/workflows/heavy.yml)
- [`cache-warm.yml`](../../../.github/workflows/cache-warm.yml)
- [`CiLane.ts`](../../../packages/tooling/tool/cli/src/commands/Ci/CiLane.ts)
- [`LaneProofReuse.ts`](../../../packages/tooling/tool/cli/src/commands/Quality/internal/LaneProofReuse.ts)
- [`ProofLedger.ts`](../../../packages/tooling/tool/cli/src/commands/Yeet/internal/ProofLedger.ts)
