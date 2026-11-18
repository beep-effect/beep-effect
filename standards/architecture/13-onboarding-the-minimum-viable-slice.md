# 13 — Onboarding the minimum viable slice

The fastest way into the architecture: the smallest legal model-first slice, the first fact another context reads, and a 60-second guide to reading any slice path. Decision numbers cite `explorations/model-first-slices/DECISIONS.md`.

## 1. Before a legal slice: the scratchpad lane

Not every idea deserves slice packages on day one. Experiments may start in
`scratchpad/` or, for repo-local internal tooling trials, under an explicitly
temporary `packages/_internal/*` package.

The scratchpad lane is not product architecture:

- no product slice may import from `scratchpad/`
- no public package export may point at `scratchpad/`
- experiments carry a promotion/removal note before they become durable
- promoted experiments must re-enter through the smallest legal slice shape
  below, not by keeping scratchpad topology

Use the scratchpad lane to learn. Use slice packages to commit.

## 2. The smallest legal slice

A slice is a bounded context with one `Domain.Model`, shipped as packages that
each hold one dependency closure. The smallest legal slice is three packages:
`contract`, `model` and `host`. `web` joins when the context has a screen. The
drawing names the files of a `notes` context with a single `Note` aggregate and
one view. It does not draw the package manifests' other fields, the README or
the tsconfig files.

```txt
packages/notes/
  contract/                         @beep/notes-contract
    src/
      Note/
        Note.id.ts                  the branded NoteId
        CreateNote.command.ts       CreateNote, the NoteCreated event it records, its private rejection
        RenameNote.command.ts       RenameNote, NoteRenamed, NoteArchived rejection
        NoteSummary.read.ts         the view's read contract, declared a second time for clients
      Notes.catalog.ts              the aggregate-free catalog the client Api is declared over
      Notes.capabilities.ts         the operations a grant can name
      NotesApi.contract.ts          Domain.Api over the catalog: the typed client
    test/
      Contract.imports.test.ts      the closure reaches no model, host or handler
    package.json                    exact exports, one per entry point
  model/                            @beep/notes-model
    src/
      Note/
        Note.aggregate.ts           state union, decide, evolve, reply
        NoteSummary.view.ts         the read model
        NoteSummary.handler.ts      its implementation
      Notes.model.ts                the context's Domain.Model
      Notes.handlers.ts             generated from the Model, checked for drift, never edited
      Notes.ports.ts                the ports union and the purity assertion
      NotesApi.api.ts               the model's Api, the one the contract is compared with
    test/
      Notes.story.test.ts           stories on Domain.InMemory, one per behaviour
      Api.parity.test.ts            the contract Api's group equals the model Api's
    package.json
  host/                             @beep/notes-host
    src/
      NotesApi.http.ts              the HTTP surface, with an explicit expose list
      Adapters.ts                   every port implementation as one Layer (none yet)
      Host.ts                       hosts the Model on the platform it is given
      Notes.cluster.ts              what the context runs on a pool
      Notes.descriptor.ts           the deployment descriptor, as data
    package.json
```

What each file owns, in one or two sentences:

- `Note.id.ts` — the branded id. Every package names a note through it.
- `CreateNote.command.ts` — a complete decision record: the command, the events
  it records and the rejections only it returns. The command names its events
  and rejections before any `decide` exists.
- `NoteSummary.read.ts` — the read contract a client subscribes to. It repeats
  the view's read side until upstream splits the Api from the model.
- `Notes.catalog.ts` / `NotesApi.contract.ts` — the client Api is a
  `Domain.Api` over a catalog that holds commands, read contracts and queries
  and no aggregate, so a browser or another context imports the typed client
  without the write model.
- `Note.aggregate.ts` — the consistency boundary. Rules live in `decide`; time
  arrives as an argument, never from a clock. The aggregate does not type-check
  until it handles every event and rejection its commands declare.
- `NoteSummary.handler.ts` — the implementation beside its declaration. The
  generated `Notes.handlers.ts` collects every handler the Model needs.
- `Notes.ports.ts` — the type that fails when a handler requires a service the
  model never declared. This context has no port yet, so it asserts none
  leaked.
- `Host.ts`, `Notes.cluster.ts`, `Notes.descriptor.ts` — the host is the only
  package that knows how the context runs. The descriptor names the Model and
  its processes; an app composes descriptors onto pools and generates the
  cluster entry modules.

> The contract has no Layer and no aggregate. The model has Layers only for its
> handlers and declares every outside service as a port. The host is the only
> package that resolves a driver.

The stories run on `Domain.InMemory` with the model alone: no host, no
database. A story fails on any event, rejection or external call it does not
account for, and coverage counts the declared outcomes that executed.

`bun run beep architecture` generates this shape through
`bun run beep create-package`. Do not hand-author the packages.

## 3. Adding the first fact another context reads

A second context (`tasks`) needs to attach tasks to notes. It needs `NoteId` to
reference a note and a signal that a note now exists. Nothing moves to
`shared/*`; the `notes` context publishes, and `tasks` reads.

In `notes`:

```txt
packages/notes/
  contract/src/Facts/
    NoteOpened.fact.ts              NoteOpenedV1: the fact other contexts may rely on
    NotesFacts.gateway.ts           the feed a consumer reads
  model/src/Facts/
    NoteOpenings.projection.ts      reads Note events directly; writes the published stream
    NoteOpenings.handler.ts
    NotesFacts.stream.ts            generation 1, open
    StreamPins.ts                   the stream pinned to its writer, generation and sources
  host/src/Facts/
    NotesFactsFeed.adapter.ts       serves the stream as a feed
```

In `tasks`:

```txt
packages/tasks/
  host/src/Inbox/
    NoteOpened.inbox.ts             keyed by producer, fact id and version; sends tasks' own command
  host/src/Tasks.descriptor.ts      declares that tasks consumes NoteOpened version 1
```

`tasks` imports `NoteId` and `NoteOpened` from `@beep/notes-contract` and
nothing from the notes model or host. The fact is not `NoteCreated`: that event
rebuilds the note's state and stays private, so notes can refactor it freely.
The fact carries only what other contexts may depend on for years, and an
independent reviewer reads whether each field belongs there.

From here the rules of `10-cross-slice-coordination.md` apply: a change to the
fact is a new version, version 1 retires only when no deployment descriptor
consumes it, and the publishing projection is never rebuilt in place.

## 4. Reading a slice path: a 60-second guide

Decode this illustrative path piece by piece:

`packages/<context>/model/src/<Module>/<Noun>.<kind>.ts`, read with
`<context>` = `party`, `<Module>` = `Claim`, `<Noun>` = `ClaimReview` and
`<kind>` = `handler`:

- `packages/` — the monorepo packages root.
- `party/` — the bounded context.
- `model/` — the dependency closure: the write and reaction model.
- `src/Claim/` — the Module: the claim's consistency boundary and what reads it.
- `ClaimReview.handler.ts` — the kind: the implementation of the `ClaimReview`
  view declared in `ClaimReview.view.ts` beside it.

From the path alone you know: this file implements a read model of claims in
the party context, needs only the ports the model declares, and runs unchanged
in memory and on a cluster.

### Common suffixes

| Package | Suffix | Allowed contents |
|---------|--------|------------------|
| contract | `.command.ts` | a command, the events it records, the rejections only it returns |
| contract | `.read.ts` | a view's or query's read contract |
| contract | `.fact.ts` | a published integration fact and its versions |
| contract | `.contract.ts` | a client `Domain.Api` over the catalog |
| model | `.aggregate.ts` | state union, `decide`, `evolve`, `reply` |
| model | `.view.ts`, `.policy.ts`, `.saga.ts`, `.projection.ts`, `.query.ts` | a block declaration |
| model | `.handler.ts` | the implementation of the declaration beside it |
| model | `.external.ts`, `.store.ts` | a port |
| host | `.adapter.ts` | a port implementation over a driver or another context's contract |
| host | `.inbox.ts` | a consumer's inbox |
| web | `.screen.tsx` | a React screen over generated bindings |
| web | `.machine.ts`, `.controller.ts` | a screen's pure state machine and the code that runs its intents |

The full vocabulary is in `standards/ARCHITECTURE.md`, "File Grammar". If a
path matches none of these suffixes, it is a violation of the role topology,
and the role-suffix checker reports it.

### Reading a legacy slice

Legacy seven-package slices use `packages/<slice>/<package>/src/<Concept>/<Concept>.<role>.ts`,
for example `packages/<slice>/server/src/<Concept>/<Concept>.http-handlers.ts`:
the slice, its server adapter package, the concept folder and the role file.
Their roles (`.model.ts`, `.errors.ts`, `.policy.ts`, `.behavior.ts`,
`.commands.ts`, `.queries.ts`, `.ports.ts`, `.service.ts`, `.repo.ts`,
`.http-handlers.ts`, `.event-handlers.ts`) are listed in
`standards/ARCHITECTURE.md`, "Role Suffixes". They stay legal until each
slice's own migration; no new slice is built on them.

## Next reading

- `01-hexagonal-vertical-slices.md` — the architectural rationale for slice-shaped packages with hexagonal boundaries.
- `10-cross-slice-coordination.md` — integration facts, published streams and synchronous calls between contexts.
- `08-testing.md` — the testing story for slice-local Layers and cross-slice contracts.
- `02-shared-kernel.md` — what does and does not belong in `shared`; the shared kernel stays language only.
