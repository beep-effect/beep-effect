# Effect Cluster Host Spec

## Objective

Make Effect Cluster on Postgres a host the monorepo can run a slice on: Alchemy beta.87, the library fixes as root patches, the conformance suite as a package, a local swarm recipe.

The exploration ran its prototype on a two-runner Effect Cluster with Postgres on a local Docker
swarm six times; `explorations/model-first-slices/BRIEF.md` ("What the host guarantees") and `explorations/model-first-slices/DECISIONS.md` (D37 to D55, D61, D62)
hold what was found. This goal gives the monorepo the same host: the pins, the fixes, the suite
that proves the guarantees, and the recipe to run it.

## Non-Goals

- Retiring `@beep/alchemy-postgres`, or moving vault-sync off it (D5, D53). Both wait for an Alchemy release that carries the fixes.
- Cloud deployment. The first host is Postgres on a Docker swarm on one machine (D5, D37).
- Building any context. The suite runs against small test models of its own until `authority-context` lands.
- Posting anything upstream. Issues, comments and pull requests on `alchemy-run/alchemy` go out only on the operator's say-so (D54, D62).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- The root `package.json` (catalog, `patchedDependencies`), `patches/` and `bun.lock`.
- A conformance package created with `bun run beep create-package`, holding the in-memory and the cluster cases.
- A local swarm recipe: the stack definition, one command to deploy, run and tear down, and a runbook under `docs/runbooks/`.
- Deployment descriptors as data and the generated cluster entry modules for one app pool (D13, D40).
- `packages/drivers/alchemy-postgres` and `packages/documents`, only as far as the bump to beta.87 requires.

## Constraints

- The fixes ride as root patches and leave when an Alchemy release has them (D61). Their source is `scratchpad/model-first-slices/patches/` (as run on the cluster against beta.87) and `scratchpad/model-first-slices/notes/upstream/` (rebased onto upstream main with tests, in `rebased/`).
- A ledger in this packet maps every root patch to its upstream thread and its removal condition. The threads as of 2026-11-18 are in `scratchpad/model-first-slices/notes/upstream/SENT.md`.
- Vault-sync and `@beep/alchemy-postgres` stay green through the bump. The root is on beta.86 with one patch, and the platform driver was written against the beta.85 contract.
- The suite asserts upstream's ten Domain cases and the four host guarantees: no acknowledged write is overwritten (D41); a runner that lost its shard cannot commit (D45, D49); reactions resume within one lease after a runner dies (D42); a write to a frozen runner completes or fails within the caller's retry budget and is never stored twice (D55). Backup and restore by `pg_dump` is a case.
- Constants the guarantees depend on (the lease, the message poll, Effect's shard-lock expiry and lock numbering) are pinned by canary tests against the installed sources, as the prototype does.
- A runner whose pool is not named for it fails at start. A connection pooler that rewrites the session name makes every commit refused; the runbook says so.
- A swarm run on a workstation is local only: `docker swarm init --advertise-addr 127.0.0.1`, no published host port (the driver runs inside the stack's network), resources created only by the stack, no prune of any kind, and a teardown checked against a Docker baseline recorded before the run.
- No heavy local run starts above a 5-minute load of 128, and one heavy proof runs at a time.

## Acceptance Criteria

- [ ] The root catalog pins Alchemy 2.0.0-beta.87 with `@alchemy.run/effect-cluster`, the root patches carry the fixes, `bun install --frozen-lockfile` is clean, and the existing vault-sync and `@beep/alchemy-postgres` tests pass.
- [ ] The conformance package's in-memory cases run in hosted CI. Each fix has a case that fails without its patch.
- [ ] One documented command deploys a two-runner swarm, runs upstream's ten cases and the four guarantees with backup and restore, and tears down to the recorded Docker baseline.
- [ ] The points the exploration never observed on a cluster are observed or recorded as findings with a decision file: the startup guard failing a misnamed runner, the refusal on an unnamed pool, and the frozen-runner case as rewritten for D55.
- [ ] Deployment descriptors are data, and the cluster entry modules for one app pool are generated from them with a `--check` drift mode.
- [ ] The patch ledger and the runbook exist, and `bun run beep quality package-verify` passes for every touched package.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/effect-cluster-host/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/effect-cluster-host/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/effect-cluster-host` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add effect-cluster-host --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug effect-cluster-host`; add a `kind: decision` file there, never edit this block._

### The library fixes ride as root patches until an Alchemy release has them, 2026-11-17

Operator ruling: explorations/model-first-slices/DECISIONS.md D61. The host guarantees hold only with the fixes, and the first slice is meant to run on the host the standard names. Each patch leaves when a release carries its fix; the patch ledger in this packet records the upstream thread and the removal condition for each.

Lane explore/model-first-slices

Reverse: Remove the root patches and keep new slices in memory or on the repo-owned platform until upstream ships

### The repo-owned Postgres platform stays until upstream ships the fixes, 2026-11-17

Operator ruling: explorations/model-first-slices/DECISIONS.md D53 (with D5 and D41). A pass on carried patches meets the exploration's graduation gate and does not retire the platform. Retirement is the gated candidate retire-alchemy-postgres in explorations/model-first-slices/MAP.md.

Lane explore/model-first-slices

Reverse: Retire @beep/alchemy-postgres on the patched host

### Seeded from the model-first-slices exploration, 2026-11-17

What this host must guarantee was found in six swarm sessions and settled in explorations/model-first-slices/DECISIONS.md: D5, D13, D37 to D42, D45, D49, D53 to D55, D61 and D62. The phase notes are explorations/model-first-slices/research/13 to 20 and the upstream check is explorations/model-first-slices/research/22. They are linked, not copied.

Lane explore/model-first-slices

Reverse: Reopen explorations/model-first-slices at decompose and re-seed this spec from the changed brief

### Nothing is posted upstream without the operator's say-so, 2026-11-17

Operator rulings: explorations/model-first-slices/DECISIONS.md D54 and D62. Four comments and two issues were posted on 2026-11-18; the pull request for the frozen-runner fix is held until a maintainer answers. The record is scratchpad/model-first-slices/notes/upstream/SENT.md.

Lane explore/model-first-slices

Reverse: Let the goal open upstream issues and pull requests on its own judgement

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
