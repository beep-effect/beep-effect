# 13 — Onboarding the minimum viable slice

The fastest way into the architecture: the smallest legal slice, the smallest legal cross-slice promotion, and a 60-second guide to reading any slice path.

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

A legal slice can be three packages and ~15 files. The example below is a `notes` slice with a single `Note` aggregate. No `client`, no `tables`, no `config`, no `ui` — those are added when there is a real reason, never pre-emptively.

```txt
packages/notes/
  domain/
    src/
      aggregates/Note/
        Note.model.ts        # schema-first class: identity + shape + tiny Effect.fn behavior
        Note.errors.ts       # actionable domain errors (S.TaggedError)
        index.ts             # public exports for the Note aggregate
      index.ts               # package barrel
  use-cases/
    src/
      Note/
        Note.commands.ts     # command schemas (intent shapes only)
        Note.queries.ts      # query schemas (read-side intent shapes)
        Note.ports.ts        # port interfaces, e.g. NoteRepository (Context.Tag)
        Note.service.ts      # use-case service composing ports + domain
      public/                # client-safe re-exports: commands, queries, errors
      server/                # server-only re-exports: ports, service interfaces
    package.json             # exports map: ".", "./public", "./server", "./test"
  server/
    src/
      Note/
        Note.repo.ts         # NoteRepository live implementation
        Note.http-handlers.ts # HTTP wiring for the Note concept
      Layer.ts               # composes the slice's live Layer
    package.json             # exports map: ".", "./layer", "./test"
```

What each file owns, in one or two sentences:

- `Note.model.ts` — the schema-first class. Identity, shape, and small pure behavior live here; nothing that needs a Layer.
- `Note.errors.ts` — classes extending `S.TaggedError` for failure modes the use-cases and server may raise.
- `Note.commands.ts` / `Note.queries.ts` — schemas for intent. They describe what the caller is asking for, not how it is executed.
- `Note.ports.ts` — port declarations only. The use-cases package defines what a `NoteRepository` looks like; it does not implement one.
- `Note.service.ts` — the use-case service. It depends on ports and domain values, and is the only thing the server-side Layer needs to wire.
- `Note.repo.ts` — the live `NoteRepository`. Implementation lives in `server` because adapters are server-side.
- `Note.http-handlers.ts` — HTTP wiring: schema-validated request decoding into use-case calls.
- `server/src/Layer.ts` — composes the slice's live `Layer`, exported through the package's `./layer` subpath.

> `domain` has no `Layer` because it has no live services. `use-cases` defines ports but never implements them. `server` is the only package that knows how the slice runs.

The slice's tests run with the slice's `Layer` only — no app-wide composition, no driver indirection. That is the whole point of slice-local Layers (see `05-layer-composition.md`).

## 3. Adding the first cross-slice export

A second slice (`tasks`) needs to attach tasks to notes. It needs `NoteId` to
reference a note and a `NoteCreated` event to react to new notes. The `notes`
slice owner promotes both into future `shared/use-cases`. One PR. One promotion
record per export. The package is created only if it does not already exist; it
does not exist today because nothing has met that bar.

After promotion, the exports land at canonical paths under `shared/use-cases`:

```txt
packages/shared/use-cases/src/
  notes/
    NoteId.ts                # value-object schema, driver-neutral
    events/NoteCreated.ts    # event schema, contract-only
  public/                    # re-exports: NoteId, NoteCreated
```

Both are published from the future `@beep/shared-use-cases/public` subpath. The `tasks` slice imports them as:

```txt
import { NoteId } from "@beep/shared-use-cases/public"
import { NoteCreated } from "@beep/shared-use-cases/public"
```

Direct imports into `packages/notes/*` from another slice are forbidden. The canonical subpath is the only legal route.

The promotion record (one per export) is appended to the new or existing `shared/use-cases` package README, using the schema in `02-shared-kernel.md` Appendix:

> ### Promotion record: NoteId
>
> - **Date promoted:** 2026-04-30
> - **Shared product semantics:** the durable identity of a note as a referenceable product entity across slices.
> - **Current consumers:** `@beep/notes-use-cases`, `@beep/tasks-use-cases`.
> - **Rejected homes:**
>   - Owning slice — `tasks` cannot import directly from `notes`; cross-slice imports across slice packages are forbidden.
>   - Foundation — `NoteId` encodes a product concept, not a domain-agnostic identity primitive.
> - **Surface:** `NoteId` (branded schema + decoder), published from `@beep/shared-use-cases/public`.
> - **Runtime limits:** contract-only.
> - **Coupling acceptors:** `notes` owner and `tasks` owner sign-off on PR #482.
> - **Removal trigger:** remove when `tasks` no longer needs to reference notes by id.

> ### Promotion record: NoteCreated
>
> - **Date promoted:** 2026-04-30
> - **Shared product semantics:** the cross-slice signal that a new note exists and may be subscribed to by other slices.
> - **Current consumers:** `@beep/notes-server` (publisher), `@beep/tasks-use-cases` (subscriber).
> - **Rejected homes:**
>   - Owning slice — `tasks` cannot subscribe to events declared inside `packages/notes`; the event contract must be reachable through the kernel.
>   - Foundation — the event encodes product semantics specific to notes.
> - **Surface:** `NoteCreated` (event schema), published from `@beep/shared-use-cases/public`.
> - **Runtime limits:** contract-only.
> - **Coupling acceptors:** `notes` owner and `tasks` owner sign-off on PR #482.
> - **Removal trigger:** remove when no slice subscribes to `NoteCreated` outside `notes`.

That is the entire ceremony: one PR, two records, one canonical subpath.

## 4. Reading a slice path: a 60-second guide

Decode this path piece-by-piece:

`packages/iam/server/src/Membership/Membership.http-handlers.ts`

- `packages/` — the monorepo packages root.
- `iam/` — the slice name (the bounded context).
- `server/` — the slice-family layer: server-side adapters and Layer composition.
- `src/Membership/` — the concept folder for the `Membership` aggregate.
- `Membership.http-handlers.ts` — the role file: HTTP-handler implementations for the `Membership` concept, in the server layer.

From the path alone you know: this file is HTTP wiring for membership operations, lives in the iam slice's server adapter, and composes ports declared in `packages/iam/use-cases/src/Membership/Membership.ports.ts`.

### Common role suffixes

| Suffix              | Allowed contents                                                            |
|---------------------|-----------------------------------------------------------------------------|
| `.model.ts`         | schema-first class, identity + shape, occasional small `Effect.fn` methods. |
| `.errors.ts`        | Classes extending `S.TaggedError`.                                         |
| `.policy.ts`        | pure decision rules (functions, not services).                              |
| `.behavior.ts`      | pure transitions (`Effect.fn` returning typed failures).                    |
| `.commands.ts`      | command schemas (intent shapes).                                            |
| `.queries.ts`       | query schemas (read-side intent shapes).                                    |
| `.ports.ts`         | port service interfaces (`Context.Tag` declarations).                       |
| `.service.ts`       | use-case service composing ports + domain.                                  |
| `.repo.ts`          | port implementation (server side).                                          |
| `.http-handlers.ts` | HTTP handler implementations (server side).                                 |
| `.event-handlers.ts`| event handler implementations (server side).                                |

If a path doesn't match any of these suffixes, it's either a non-canonical helper or a violation of the role topology. The hard-check lane in `07-non-slice-families.md` is where repo tooling enforces these rules.

## Next reading

- `01-hexagonal-vertical-slices.md` — the architectural rationale for slice-shaped packages with hexagonal boundaries.
- `08-testing.md` — the testing story for slice-local Layers and cross-slice contracts.
- `02-shared-kernel.md` — the full promotion record schema and what does and does not belong in `shared`.
