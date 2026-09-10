# Design: r28-tooling-library-observability-deployment-remote-fields

## Current shape

Current P2 design for `r28-tooling-library-observability-deployment-remote-fields`. The bounded R28 correction confirms qualification; independent P3 and merged packet ratification remain pending. Integration evidence: `data/r28-observability-integration.json`. Source: HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, origin/main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`.

`packages/tooling/library/ai-metrics/src/install.ts:934–939` declares the private `deploymentRemoteFields` function. Its actual returned object, typed `Pick<AiMetricsInstallPlanStep, "mutatesHost" | "requiresRemote">`, contains two Boolean values produced by the identical comparison with `AiMetricsDeployTarget.Enum.dankserver`. This is an eligible returned data carrier; the function itself is not a Boolean member. `AiMetricsDeployTarget` already provides the complete `local` / `dankserver` LiteralKit in `src/models.ts:49–53`.

The only invocation is `makeInstallPlanSteps` at `install.ts:964`. There are exactly three property reads: storage-step `mutatesHost` at `:977`, storage-step `requiresRemote` at `:979`, and forwarder-step `requiresRemote` at `:1047`. The forwarder sets its own `mutatesHost: false` at `:1045`. Thus the returned pair and the broader `AiMetricsInstallPlanStep` are distinct carriers.

## Cardinality gap

The returned Boolean pair represents four tuples and produces exactly two:

| Deployment target | mutatesHost | requiresRemote |
| --- | --- | --- |
| `local` | false | false |
| `dankserver` | true | true |

Both targets are supported by the public install contract: `AiMetricsInstallInput` defaults to local at `install.ts:193`; `test/install.test.ts:95–108` calls the local planner and round-trips its JSON; the explicit dankserver input at `test/install.test.ts:65–74` exercises the remote planner. The source comparison proves the exact pair for each input; these tests were inspected, not executed in this audit.

This 4/2 proof must not narrow `AiMetricsInstallPlanStep`. In particular, dankserver backend planning (`:990–992`), forwarder (`:1045–1047`), OTLP export (`:1070–1072`), and health (`:1133–1135`) intentionally use `(false,true)`. The existing `ai-metrics-install-plan-step` D1 record remains separate.

## Target schema

Reuse the existing `AiMetricsDeployTarget` LiteralKit as the authority. Delete `deploymentRemoteFields` and its paired `Pick` return annotation. At its sole call site, derive one local Boolean with the existing schema-generated guard:

```ts
const requiresRemote = AiMetricsDeployTarget.is.dankserver(spec.target);
```

Use that same value for the three reads listed above, including the storage step's `mutatesHost` field. Retain `mutatesHost: false` on the forwarder step. This is the tersest equivalent derivation: the target is already a schema-backed literal, and the consumer only needs its remote projection. Do not add a second local/remote vocabulary, a wrapper class, a new tagged union, an Option, a public schema, or a boundary codec.

The inventory target taxonomy is `literalkit` because the existing deploy-target LiteralKit is the authoritative two-state domain. Removing a redundant private Boolean pair does not require inventing another stored state value.

## Migration inventory

| Source location | Required migration |
| --- | --- |
| `install.ts:934–939` | Delete paired-return helper and its `Pick` type. |
| `install.ts:964` | Replace helper result with the single schema-derived Boolean above. |
| `install.ts:977,979,1047` | Replace the three property reads with that local value. |
| `install.ts:990–992,1045,1070–1072,1133–1135` | Preserve independent plan-step assignments and all `(false,true)` operations. |
| `install.ts:1366–1385` | Public planner still assembles the same complete plan; no signature change. |
| `install.ts:1436,1563` | Doctor and dry-run apply still receive that unchanged plan. |
| `src/index.ts:147`; `package.json:19–23` | Public install barrel and wildcard export remain compatible; private helper is not exported. |

Graft's incoming closure named `makeInstallPlanSteps` and downstream install-module importers (`compose`, `derived-storage`, `forwarder`, `retention`, `otlp`, `scorecard`). Exhaustive source occurrence searches found only the invocation and three property reads above. Module-level edges describe exposure, not additional consumers of the private pair. No downstream package needs a source migration if plan values remain identical.

## Guard-deletion accounting

- Remove one redundant returned carrier, its helper, and its paired return annotation.
- Replace two identical raw equality expressions with one existing LiteralKit guard evaluation.
- Replace three property accesses with the single local value.
- Delete zero validity guards or error paths: none currently defend this private pair.
- Add zero custom predicates, codecs, or new validation branches. Preserve every conditional selecting commands, URLs, secrets, and plan-step behavior.

## Encoded-side impact

Tier 1, derived/internal carrier. The private return object is never encoded. `AiMetricsInstallPlanStep` and `AiMetricsInstallPlan` remain the same public schemas; the final JSON still has both `mutatesHost` and `requiresRemote`. No key, Boolean, default, omission, order, command string, secret-reference handling, target value, or remote prerequisite changes. The plan's existing JSON codec remains the only relevant encoding path, exercised by `test/install.test.ts:95–108`.

## Test impact

During implementation, extend the existing planner tests to assert the storage and forwarder flags for both `local` and `dankserver`. Assert the remote forwarder remains `(false,true)` while remote storage is `(true,true)`; this catches accidental narrowing of the broader step. Preserve the existing JSON round-trip and remote command URL test. No private-helper test or new property generator is necessary for one reused literal guard. Run the package's required verification only during implementation; no package command or test ran for this provisional design.

## Risk

The main risk is applying the returned-pair invariant to every install step. A second risk is changing the existing meaning of `mutatesHost` while consolidating its derivation. The migration is deliberately confined to the current helper's three reads. This designed qualification has no source implementation or independent P3 approval. The original report and provisional remain unchanged; the integration receipt binds their hashes.
