# model-first-slices

A standalone prototype of the model-first slices design, reworked to
`explorations/model-first-slices/DECISIONS.md` through phase 9 (phase 4 was the last in-memory phase; phase 5 ran it on Effect Cluster; phase 6 patched two library defects locally and ran it again; phase 7 put `bun run check` on the Effect build of the compiler and applied the owner's review; phase 8 ran the suite on the swarm against the phase 7 code; phase 9 built the rulings on its three failures, D41 to D43, and ran it again):
file grammar, contract packages, the authority context, re-admission at each hop, the `runs`
context, approval as an authenticated command, the Reasoner evaluation contract, an integration fact
through an outbox and an inbox, a projection rebuild with no side effects, stored-format
compatibility (saga activity results included), idempotency keys scoped by org, deployment
descriptors, a web package on generated bindings, a proof inventory (`PROOFS.md`), and a
conformance suite run against the stack on a local Docker swarm (`notes/phase-5.md`, `notes/phase-6.md`). Three
bounded contexts (Party,
authority, runs), each split by dependency closure into `contract`, `model` and `host` packages, on
`@alchemy.run/domain` 2.0.0-beta.87 and effect 4.1.4. Stories run each model alone; the Api tests
run all three on one `Domain.InMemory`. The app is type-checked only.

Phase notes: `FINDINGS.md` (phase 1), `notes/phase-2.md`, `notes/phase-3.md`, `notes/phase-4.md`,
`notes/phase-5.md` (the cluster run, the conformance table and the D16 gate), `notes/phase-6.md` (the library patches, the
conformance table before and after, the D38 overwrite), `notes/phase-7.md` (the Effect build of the compiler, the
diagnostics before and after, lifecycle unions and `Option`s, stored-format changes, the review saga fix, and the
findings left failing), `notes/phase-8.md` (the swarm run of the phase 7 code: bundles, the conformance table beside
phase 6, stored forms and a restore across code versions, the D5 verdict), `notes/phase-9.md` (the commit version check and its
safety per host, the recovery case and its bound, the publisher on claim events with a second stream generation, the
conformance table beside phase 8, the D5 verdict). Every invariant and its checker: `PROOFS.md`
(generated).

This directory is not part of the monorepo's bun workspace. It has its own `package.json` (with
`workspaces`), `bun.lock` and `node_modules`, and the monorepo's `scratchpad/tsconfig.json` excludes it.

## Layout

```
shared/kernel          @proto/kernel              language only: ids, the Invocation, provenance, the grant-check language
  Ids.ts                                          OrgId, PrincipalId, RunId, GrantId, CapabilityId, DelegationId
  Invocation.ts                                   Invocation, Provenance (what events carry), carry, extend, operatorOf, runOf;
                                                  causes include a `Fact` hop
  Fact.ts, RequestKey.ts                          FactEnvelope and inboxKey (D11); requestKey, command ids from the org,
                                                  operation and a SHA-256 request fingerprint (D14, D36)
  Deployment.ts                                   DeploymentDescriptor: models, processes, facts published and consumed (D13)
  Capability.ts                                   ResourceScope, GrantTerms, CapabilityGrant, Capability, covers, allows, widens
  CurrentInvocation.context.ts                    the request context, requireGrant
  MissingGrant / ReadmissionRefused .rejection.ts, Session.middleware.ts
shared/contract-kit    @proto/contract-kit        interim (D9): a model-shaped catalog for Domain.Api, a query wait stand-in
shared/tooling         @proto/tooling             handler registry generator, generated-file check, import-graph walker, RPC
                                                  parity, root-construction scan, primary-export law, fact retirement (D34),
                                                  the vitest setup that records executed command outcomes

party/contract         @proto/party-contract      what browsers and other contexts import; no aggregate, no handler
  Claim/ Party/ Directory/                        ids, commands (incl. ApproveProposal, RequestReview, AddEvidence), events,
                                                  rejections, read contracts (.read.ts), the proposal digest
  Facts/                                          ClaimDecided.fact.ts (published, versions 1 and 2), PartyFactsFeed gateway
  Party.capabilities.ts, Party.catalog.ts, *Api.contract.ts
party/model            @proto/party-model         the Party Domain.Model
  Authority.external.ts                           port: re-admit a provenance for the next hop
  Claim/ Party/ Directory/ Evidence/              aggregates, views, the merge policy, the directory projection (by
                                                  generation, over a sink that owns its checkpoints), rebuild switch, query
  Facts/                                          PartyFacts stream (the outbox) and the ClaimFacts projection writing it
  Review/                                         ReviewRuns and Reasoner ports, the ReviewOnRequest policy, the
                                                  ReviewAssist executor saga (keyed by run, follows continuations, ends
                                                  cleanly when the claim is decided; its activity schemas declared, D35)
  Party.model.ts, Party.handlers.ts (generated), Party.ports.ts, ReviewerApi / IntakeApi / AgentApi .api.ts
party/host             @proto/party-host          adapters (authority and runs ports over their gateways; fixture,
                                                  recording and replay Reasoners over a schema'd tape; the fact feed),
                                                  the mailbox poller, ReviewerApi over HTTP, hostParty, Party.descriptor
party/web              @proto/party-web           React over Effect Atom; imports the contract only (D12)
  Bindings.ts, Party.bindings.ts (generated)      typed command outcomes with ids, view subscriptions with revisions and
                                                  reconnect, read-after-write; the atom runtime (Party.runtime.ts)
  Directory/FindParties.screen.tsx                a plain screen: one query, one command
  Claim/ClaimReview.{machine,controller,screen}   a machine-backed screen correlating on command id, receipt and revision

authority/contract     @proto/authority-contract  Grant, Delegation (incl. DelegateFurther) and Accountability commands;
                                                  AuthorityGateway (readmit, grantRun); AuthorityContract
authority/model        @proto/authority-model     Grant, Delegation, Accountability; HolderGrants and RunDelegations indexes;
                                                  ExpireAtDeadline and OpenOnDelegate policies; AuthorityApi
authority/host         @proto/authority-host      the trusted boundary (admit, readmit), Session.adapter.ts, the gateway's
                                                  live half, FixtureCredential, hostAuthority, Authority.descriptor

runs/contract          @proto/runs-contract       AgentRun commands and events, SessionRuns read contract, RunsGateway
                                                  (request, report), RunsContract
runs/model             @proto/runs-model          AgentRun (lifecycle, budget ledger, lineage, history bound); GrantOnRequest,
                                                  OpenChildOnRequest, ContinueAtBound, ResumeParent policies; SessionRuns
                                                  view; RunsApi
runs/host              @proto/runs-host           RunsGateway's live half (follows continuations), the ClaimDecided inbox
                                                  and its store, the authority port adapter, hostRuns, Runs.descriptor

apps/practice          @proto/practice            Deployment.ts (the composed descriptors, checked for fact retirement),
                                                  Cluster.ts (Docker database + swarm pool), hand-written entry modules
                                                  for each model, gateways, Session and poller; PracticeApi; alchemy.run.ts
conformance            @proto/conformance         upstream's Domain conformance model, app and cases (vendored at
                                                  33c10dd), the two-runners slot (D38), the prototype's own cases
                                                  and backup/restore, run against a deployed stack only; an in-memory
                                                  host for the drain-lease test (bun run test)
patches/                                          the local @alchemy.run/domain patch (phase 6)
scripts/, proofs/                                 proofs.ts renders PROOFS.md from proofs/Proofs.data.ts; outcomes.ts
                                                  checks executed outcomes against proofs/Outcomes.allow.ts
```

Every package's `exports` lists exact entry points. Declarations are `<Module>/<Noun>.<kind>.ts`;
implementations are `.handler.ts` (model, cluster class) or `.adapter.ts` (a port, a gateway, or the
middleware's server half). A context reaches another only through its contract: a product model
declares its own port (`*.external.ts`), and its host adapts it to the other context's gateway.

## How authority moves

A credential is admitted once at the boundary (`authority/host`), which builds the root
invocation. Every event records only its provenance: root, on whose behalf, grant ids and the
causal chain. A policy or saga that acts later asks the authority context, through its own port, to
re-admit that provenance for its hop; it gets back an invocation built from the grants still in
force, or a refusal, which it records. An agent run acts under a delegation its requester gave it
at request, narrowed, and only while a human answers for it.

## What the tests prove

- `party/contract`, `runs/contract`: each contract's module graph reaches no model, host,
  aggregate or handler; the same walk from the model does. The published fact's schema is pinned
  by frozen snapshots and carries no private field.
- `party/model`:
  - re-admission at each hop, with refusals recorded rather than dropped (a revoked grant, a
    lapsed re-admission, a veto);
  - a review run opened under a narrowed delegation that proposes and completes on a human
    approval;
  - approval refused when agent-rooted or relayed, and refused when stale;
  - a second review is a second run, and budget exhaustion means no Reasoner call;
  - a run's delegation revoked mid-run is recorded, at the proposal and (phase 7) before any report hop: reserve,
    settle, step, release, exhaust or the wait; a continued run is followed, and a decision made mid-assessment
    ends the executor cleanly;
  - two saga versions side by side across a redeploy, and stored activity results converting on
    read (D35);
  - the fact published for a direct decision, an approval and a retraction, and none for a
    rejected command, built from the decision event alone (phase 9, D43); a decision stored before
    its event carried a scope takes it from what generation 1 published, or else from the claim's
    state and the event;
  - the published streams match their pins: the deployed publisher passes, a bumped one fails
    (`StreamPins.test.ts`, phase 9);
  - the directory sink refusing stale and replayed changes (Astra's counterexample), a crash
    between sink write and checkpoint, and a rebuild that serves the old generation until it
    switches, with zero side effects;
  - phase 2's stored events, state, receipt, saga payload and provenance decoding and replaying
    through today's declarations, with bytes unchanged;
  - the grant checks, `Domain.verify`, the registry, and parity of the contract Apis.
- `authority/model`: issuing, narrowing and delegating grants (a delegation never widens), a run
  delegating further, a scheduled expiry, revocation, accountability for runs and their children.
- `runs/model`: a run granted at request or rejected, the budget ledger (no double spend), a child
  with a share and a narrower grant that resumes its parent when it finishes (refused mid-run included),
  continuation at the history bound with the session's chain, completion releasing reservations, a run refused
  mid-run giving back its reservations, a request withdrawn before its grant, conclusion from a fact, the
  library's idempotency behaviour pinned (including its two hazards), stored formats (phase 6's requested and
  cancelled-before-grant states included), `Domain.verify`, registry, parity.
- `runs/host`, with the real authority host: the gateway following a continuation (a carried
  reservation settles there), a hop refused after the grant is revoked and recorded without re-admission, the
  inbox (duplicate delivery, crash before the checkpoint, version 1 beside version 2), and the request-key guard.
  `party/host` (phase 9): the fact feed serves the closed generation, then generation 2 after it, each position once
  by any page size.
- `authority/host`: through the real Session, agent admission and refusal, revocation dropping a
  delegation; re-admission never adds a grant and refuses when all lapse; `grantRun`; only the
  boundary builds roots (source scan).
- `party/host`, with three models on one `Domain.InMemory` behind the real boundary:
  - a review run proposing under its delegation only;
  - a toolkit derived from `AgentApi` under the run's grant (granted, ungranted, out of scope);
  - approval through the Session deciding the claim, and the runs inbox concluding the run from
    Party's fact; a claim accepted directly concludes it too; an agent-rooted approval is refused;
  - views carrying no grant terms;
  - the contract client;
  - the merged-hosts hazard;
  - the Reasoner contract across fixture, recording and replay adapters.

- `party/web`: the claim review machine's stories (Astra's counterexample, late and duplicate
  replies, stale reconnects, committed versus caught up, unknown outcome retried under the same
  id); the generated bindings against the hosted Party (typed outcomes, read-after-write,
  subscription revisions, reconnect, the controller approving end to end); a render per screen
  under happy-dom with fake clients; the import closure with its predict-exception list. What a
  browser shows is left to browser QA.
- `apps/practice`: the composed descriptors publish every fact version they consume; dropping one
  fails; unconsumed versions are reported retirable (D34).
- `shared/tooling` and the root: every role file has one designated primary export; every declared
  command outcome is executed by some test, or listed with a reason (`bun run outcomes`); the stream-pin
  check fails on a bumped version, a changed source set, another writer, a reopened closed generation, an
  unpinned or a dropped stream, and passes a new generation opened the right way (phase 9).
- `conformance` (in memory, phase 6): on an in-process Durable Object host with a `TestClock`, an
  outbox drain and a projection drain whose lease a dead instance left are taken over once the
  lease expires, and a backstop comes back once per lease while live drains keep it. This fails on
  the unpatched library (see "Library patches"). Phase 9: two in-process runners on one instance, the
  first deciding on version 0 while the second commits version 1; the first's commit is refused and
  its retry lands at version 2, where the unpatched library lost the second write. The recovery case's
  bound is checked against the library's lease and the cluster's message poll in the installed sources.

## Commands

Run from this directory. Bun is resolved through mise shims, never `zsh -ic`.

```sh
export PATH="$HOME/.local/share/mise/shims:$PATH"

bun install                 # standalone: writes ./bun.lock and ./node_modules only
bun run check               # the Effect build of tsrs (effect-tsgo tsrs -p) over all 17 projects, monorepo rules
bun run test                # vitest in every package with tests (one worker each), then the outcome check
bun run handlers            # regenerate the three models' handler registries
bun run handlers:check      # fail if any registry drifted
bun run bindings            # regenerate party/web/src/Party.bindings.ts from the contract
bun run proofs              # regenerate PROOFS.md from proofs/Proofs.data.ts
bun run generated:check     # registries, bindings and PROOFS.md all match their generators
bun run outcomes            # declared command outcomes the last test run did not execute

# one package at a time
./node_modules/.bin/effect-tsgo tsrs -p runs/model
(cd runs/model && ../../node_modules/.bin/vitest run)
```

## Compiler (phase 7)

`bun run check` runs `effect-tsgo tsrs -p <project>` (@effect/tsgo 0.68.1, tsrs 0.24.0-ts7.1.0-beta, the
monorepo's pins) over the fifteen packages, `conformance/upstream` and `scripts/`. Every project inherits the
Effect language service rules from the monorepo's `tsconfig.base.json` unchanged. The exception is
`conformance/upstream`: it holds upstream's vendored conformance files, byte for byte, and is checked for
TypeScript errors only. `shared/tooling/test/Compiler.guard.test.ts` guards the wiring with three checks:

- **Version.** The installed compiler matches the monorepo's pins, and `--version` names the Effect build.
- **Canary.** `shared/tooling/canary` fails under the Effect build with one Effect-only finding, and passes
  under stock `tsrs`.
- **One directive.** The only inline diagnostics directive in the prototype is the generated front's
  `strictEffectProvide:off`, on its deploy-time `Effect.provide(Database)`: an Alchemy class entry point.
  `scripts/entries.ts` emits it with its reason, owner and exit.

`bun run check` exits 0 with no finding. Three patterns from `notes/phase-7.md` keep it there:

- **Rejections** are `S.TaggedError` classes with `$I.annote` identities, built with `X.make(...)`, as the
  monorepo's documents slice declares them.
- **Library values typed `any` or `unknown`** (the derived toolkit, the Durable Object stub) are narrowed
  once, beside their use, to the types the library actually builds.
- **Every `Layer` that outlives the effect that built it** is built into the caller's scope.

`@beep/identity` (service keys, through `shared/kernel/src/Identity.ts`) and `@beep/schema` (`LiteralKit`) are
`link:` dev dependencies onto the monorepo's own packages. They resolve to source and need the monorepo's
`bun install` for their dependencies.

## Library patches (phases 6 and 9)

`@alchemy.run/domain` 2.0.0-beta.87 is patched in this workspace only, through `patchedDependencies`
in `package.json` and `patches/@alchemy.run%2Fdomain@2.0.0-beta.87.patch` (`bun install` applies
it). The patch changes both the package's `src` (resolved under the `bun` condition: the front's
bundle and the CLI) and its built `lib` (the default condition: the runners' Node bundle and the
tests under vitest):

1. A drain that finds its lease held comes back just after the lease expires, so rows left by a
   drain whose runner died are delivered (`DurableObjects.ts`).
2. On a runner, a call from a fiber the model's Layer started (a poller) goes through the cluster
   instead of a gateway with an empty URL (`EffectCluster/index.ts`).
3. Phase 9 (D41): a commit checks, first in its transaction, that the stored version is the one
   `decide` was given; when it moved, nothing is written and the call fails with `CommitConflict`,
   which the caller retries under the same command id. On Effect Cluster the transaction first takes
   the instance's advisory lock, so two runners' commits on one instance serialize
   (`DurableObjects.ts`, `EffectCluster/index.ts`).

The same fixes as diffs against upstream at 33c10dd, with pull request text, are in
`notes/upstream/` (`01` to `03`), with a proposal for leases that follow shard ownership (`04`), an
issue for a rebuilt projection's dropped stream appends (`05`), and one for Effect Cluster's backfill
listing nothing (`06`, found in phase 9, not patched); nothing is filed upstream (D44).
`notes/phase-6.md` and `notes/phase-9.md` have the details.

## Cluster stage and conformance (phases 5, 6, 8 and 9)

Only with the owner's approval: the stack creates Docker swarm services for Postgres (with a
volume), a pool of two runners and the front, on one overlay network. Since phase 6 the front
publishes no host port: the conformance driver runs as a one-shot swarm service on the stack's
network. Run the CLI on Bun; under Node it fails importing the stack (`notes/phase-5.md`).

```sh
docker swarm init --advertise-addr 127.0.0.1      # once, if the node is not in a swarm
bun run entries                                   # regenerate apps/practice/generated/ from the descriptors
(cd apps/practice && bun run deploy)              # alchemy deploy --stage mfs-conformance (local state)

# The driver: the runner image (it has Node), on the stack's network, with this directory, the
# repository's tsconfig.base.json, its packages/ and node_modules/ (the linked @beep/* sources and
# their dependencies, read-only, since phase 8) and the Docker socket and CLI mounted (cases kill,
# pause and exec into this stack's containers), as the invoking user.
NET=$(docker network ls --format '{{.Name}}' --filter name=practice-practicenetwork-mfs-conformance)
IMG=$(docker service inspect practice-mfs-conformance-default --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
FRONT=$(docker service ls --format '{{.Name}}' --filter name=practice-practicefront-mfs-conformance)
PG=$(docker service ls --format '{{.Name}}' --filter name=practice-practicepostgres-mfs-conformance)
docker service create --detach --no-resolve-image --name mfs-driver --network "$NET" \
  --restart-condition none --user "$(id -u):$(id -g)" --group "$(stat -c %g /var/run/docker.sock)" \
  --mount type=bind,src=$PWD,dst=$PWD \
  --mount type=bind,src=$PWD/../../tsconfig.base.json,dst=$PWD/../../tsconfig.base.json,readonly \
  --mount type=bind,src=$PWD/../../packages,dst=$PWD/../../packages,readonly \
  --mount type=bind,src=$PWD/../../node_modules,dst=$PWD/../../node_modules,readonly \
  --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
  --mount type=bind,src=/usr/bin/docker,dst=/usr/bin/docker,readonly \
  --env HOME=/tmp --env CONFORMANCE_URL=http://$FRONT:3000 --env POSTGRES_SERVICE=$PG \
  --env EVIDENCE_FILE=$PWD/evidence.log --workdir $PWD/conformance --entrypoint sh "$IMG" \
  -c "node ../node_modules/vitest/vitest.mjs run --config vitest.config.ts > $PWD/driver.txt 2>&1"
docker service ps mfs-driver                      # until Complete; then read driver.txt
docker service rm mfs-driver
```

Pass `test/Upstream.conformance.ts`, `test/Own.conformance.ts` or a `-t` filter after
`vitest.config.ts` to run part of the suite. Three cases hold a row lock from a Postgres session of
their own (`holdLock` in `conformance/test/Stack.ts`) to place a fault exactly: a projection crash
between the sink write and the checkpoint, a revocation between two hops of a running chain, and a
runner paused inside its commit.

Backup and restore is two halves around manual steps: `RESTORE_PHASE=before` (seeds and records
to `RESTORE_FILE`), freeze the runner and front containers with `docker pause` the moment the record
lands (phase 8: scaling to 0 lets a runner finish the hold's 4 s expiry during its graceful stop, so
the dump would hold no pending work), `pg_dump -Fc` inside the Postgres container, unpause, destroy,
deploy, scale to 0, `pg_restore --clean --if-exists`, scale back, then `RESTORE_PHASE=after`, each half
through the driver with those variables added.

`test/StoredForms.conformance.ts` (phase 8) writes runs and a session view in phase 6's stored forms
straight into the cluster's storage, then sends a command and reads the view. With
`RESTORE_PHASE=across` and `RESTORE_FILE` set to phase 6's restore record, its second case reads a
stack restored from phase 6's dump under today's code (phase 8 failed it on the facts stream; phase 9's
result is in `notes/phase-9.md`).

Teardown, always: `(cd apps/practice && bun run destroy)`, check that no `practice-*` or driver
service, container, network, volume or image remains, remove the image the deploy pulled by digest
(`postgres:17-alpine@sha256:…`, when the node already had another `postgres:17-alpine`),
`docker swarm leave --force`, remove `docker_gwbridge`, and delete `apps/practice/.alchemy/`.
Builds add to Docker's build cache, which this procedure does not prune. `probes/` holds the earlier probes against the pre-rework layout; their paths are stale.
