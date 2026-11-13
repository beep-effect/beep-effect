# model-first-slices

A standalone prototype of the "model-first slices" design: one bounded context
(Party) on `@alchemy.run/domain` 2.0.0-beta.87, split by runtime closure into a
kernel, a model package, a host package and an app. Results and every place the
design's sketches disagreed with the library are in [FINDINGS.md](FINDINGS.md).

This directory is not part of the monorepo's bun workspace. It has its own
`package.json` (with `workspaces`), `bun.lock` and `node_modules`, and the
monorepo's `scratchpad/tsconfig.json` excludes it.

## Layout

```
shared/kernel   @proto/kernel      Ids, Actor, CurrentActor.context, Session.middleware (declaration),
                                   NotAMember.rejection, Audience (Domain.Annotations augmentation)
party/model     @proto/party       the Party Domain.Model; depends on @alchemy.run/domain, effect, @proto/kernel
  src/Claim/      Claim aggregate, rules, four commands, ClaimReview view (+ .live)
  src/Party/      Party aggregate, two commands, EffectiveParty view (+ .live), MergeOnSameParty policy (+ .live)
  src/Review/     Reasoner external system, ReviewAssist saga (+ .live), ReviewOnAssertion policy (+ .live)
  src/Directory/  PartyDirectory store port + memory twin, projection (+ .live), FindParties query (+ .live)
  src/Evidence/   ContactSource external system (used only by the host's poller)
  src/            Party.model.ts, Handlers.ts (PartyHandlers, PartyPorts, purity assertion), ReviewerApi, IntakeApi
  test/           Party.story.test.ts, Party.verify.test.ts
party/host      @proto/party-host  fixture adapters, Session live half, hostParty(platform),
                                   MailboxPoller singleton (+ .live), ReviewerApi over HTTP
  test/           ReviewerApi.test.ts (in-process client over hostParty(Domain.InMemory))
apps/practice   @proto/practice    Cluster.ts (Docker database + swarm pool), entry modules,
                                   PracticeApi (Docker.Service), alchemy.run.ts. Type-checked only.
```

## Commands

Run from this directory. Bun is resolved through mise shims, never `zsh -ic`.

```sh
export PATH="$HOME/.local/share/mise/shims:$PATH"

bun install                 # standalone: writes ./bun.lock and ./node_modules only
bun run check               # tsc --noEmit -p for kernel, model, host, app (TypeScript 7.1 native)
bun run test                # vitest run in party/model, then party/host (one worker each)

# one package at a time
./node_modules/.bin/tsc --noEmit -p party/model
(cd party/model && ../../node_modules/.bin/vitest run)
(cd party/host && ../../node_modules/.bin/vitest run)
```

Do not run `alchemy deploy` or `alchemy dev` here: the stack would create a
Docker swarm database and runners.
