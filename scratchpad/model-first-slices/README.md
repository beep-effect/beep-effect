# model-first-slices

A standalone prototype of the model-first slices design, reworked to
`explorations/model-first-slices/DECISIONS.md` through phase 5 (phase 4 was the last in-memory phase; phase 5 ran it on Effect Cluster):
file grammar, contract packages, the authority context, re-admission at each hop, the `runs`
context, approval as an authenticated command, the Reasoner evaluation contract, an integration fact
through an outbox and an inbox, a projection rebuild with no side effects, stored-format
compatibility (saga activity results included), idempotency keys scoped by org, deployment
descriptors, a web package on generated bindings, a proof inventory (`PROOFS.md`), and a
conformance suite run against the stack on a local Docker swarm (`notes/phase-5.md`). Three
bounded contexts (Party,
authority, runs), each split by dependency closure into `contract`, `model` and `host` packages, on
`@alchemy.run/domain` 2.0.0-beta.87 and effect 4.1.4. Stories run each model alone; the Api tests
run all three on one `Domain.InMemory`. The app is type-checked only.

Phase notes: `FINDINGS.md` (phase 1), `notes/phase-2.md`, `notes/phase-3.md`, `notes/phase-4.md`,
`notes/phase-5.md` (the cluster run, the conformance table and the D16 gate). Every invariant and its checker: `PROOFS.md` (generated).

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
                                                  and backup/restore, run against a deployed stack only
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
  - a run's delegation revoked mid-run is recorded, a continued run is followed, and a decision
    made mid-assessment ends the executor cleanly;
  - two saga versions side by side across a redeploy, and stored activity results converting on
    read (D35);
  - the fact published for a direct decision, an approval and a retraction, and none for a
    rejected command;
  - the directory sink refusing stale and replayed changes (Astra's counterexample), a crash
    between sink write and checkpoint, and a rebuild that serves the old generation until it
    switches, with zero side effects;
  - phase 2's stored events, state, receipt, saga payload and provenance decoding and replaying
    through today's declarations, with bytes unchanged;
  - the grant checks, `Domain.verify`, the registry, and parity of the contract Apis.
- `authority/model`: issuing, narrowing and delegating grants (a delegation never widens), a run
  delegating further, a scheduled expiry, revocation, accountability for runs and their children.
- `runs/model`: a run granted at request or rejected, the budget ledger (no double spend), a child
  with a share and a narrower grant that resumes its parent when it finishes, continuation at the
  history bound with the session's chain, completion releasing reservations, conclusion from a
  fact, the library's idempotency behaviour pinned (including its two hazards), stored formats,
  `Domain.verify`, registry, parity.
- `runs/host`, with the real authority host: the gateway following a continuation (a carried
  reservation settles there), the inbox (duplicate delivery, crash before the checkpoint, version 1
  beside version 2), and the request-key guard.
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
  command outcome is executed by some test, or listed with a reason (`bun run outcomes`).

## Commands

Run from this directory. Bun is resolved through mise shims, never `zsh -ic`.

```sh
export PATH="$HOME/.local/share/mise/shims:$PATH"

bun install                 # standalone: writes ./bun.lock and ./node_modules only
bun run check               # tsc --noEmit -p for the fourteen packages and scripts/ (TypeScript 7.1 native)
bun run test                # vitest in every package with tests (one worker each), then the outcome check
bun run handlers            # regenerate the three models' handler registries
bun run handlers:check      # fail if any registry drifted
bun run bindings            # regenerate party/web/src/Party.bindings.ts from the contract
bun run proofs              # regenerate PROOFS.md from proofs/Proofs.data.ts
bun run generated:check     # registries, bindings and PROOFS.md all match their generators
bun run outcomes            # declared command outcomes the last test run did not execute

# one package at a time
./node_modules/.bin/tsc --noEmit -p runs/model
(cd runs/model && ../../node_modules/.bin/vitest run)
```

## Cluster stage and conformance (phase 5)

Only with the owner's approval: the stack creates a Docker swarm service for Postgres (with a
volume), a pool of two runners and a front on host port 18640 (swarm ingress publishes it on all
interfaces). Run the CLI on Bun; under Node it fails importing the stack (`notes/phase-5.md`).

```sh
docker swarm init --advertise-addr 127.0.0.1      # once, if the node is not in a swarm
bun run entries                                   # regenerate apps/practice/generated/ from the descriptors
(cd apps/practice && bun run deploy)              # alchemy deploy --stage mfs-conformance (local state)
export CONFORMANCE_URL=http://127.0.0.1:18640
export POSTGRES_SERVICE=$(docker service ls --format '{{.Name}}' | grep practicepostgres-mfs-conformance)
export EVIDENCE_FILE=$PWD/evidence.log
(cd conformance && ../node_modules/.bin/vitest run --config vitest.config.ts test/Upstream.conformance.ts)
(cd conformance && ../node_modules/.bin/vitest run --config vitest.config.ts test/Own.conformance.ts)
```

Backup and restore is two halves around manual steps: `RESTORE_PHASE=before` (seeds and records
to `RESTORE_FILE`), scale the runner and front services to 0, `pg_dump -Fc` inside the Postgres
container, destroy, deploy, scale to 0, `pg_restore --clean --if-exists`, scale back, then
`RESTORE_PHASE=after`. `bun run conformance` runs whatever cases match.

Teardown, always: `(cd apps/practice && bun run destroy)`, check that no `practice-*` service,
container, network, volume or image remains, `docker swarm leave --force`, remove base images that
were pulled for the run, and delete `apps/practice/.alchemy/`. `probes/` holds the earlier probes against the pre-rework layout; their paths are stale.
