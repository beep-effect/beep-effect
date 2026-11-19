# Phase 15: queries, and no free strings left (2026-11-18)

In process only. No swarm, deploy or container this phase. `bun run check` exits 0, `bun run test`
passes 263 tests, 110 of 110 declared outcomes execute, and `bun run generated:check` passes.

## Queries

- **`RunState` is the runs slice's first `Domain.Query`** (`runs/contract/src/Run/RunState.read.ts`,
  `runs/model/src/Run/RunState.query.ts`, `RunState.handler.ts`). It answers a run's status and, once
  it completed, its outcome: never the stored state. It is on `RunsApi`, `RunsContract` and the
  catalog.
  - The status is the existing `RunStatus` set, not a second list of state tags.
  - Only someone who takes part in the run's session may read it. `SessionRuns` and `RunState`
    share one rule, `requireInSession`, and one rejection, `NotInSession`.
  - It waits on `SessionRuns`, because the handler reads that view to check the caller. A run whose
    session the view has not caught up with is refused, not shown.
  - A run nobody requested reads as `unrequested`.
- **`FindParties` has a cursor schema.** `DirectoryCursor` sits beside the store port (base64url
  JSON that carries its order). Both stores issue and read cursors through it; a cursor the store
  did not issue is refused with `InvalidCursor` (400), held as a law against both stores.
- **One declaration, two places.** The contract exports `FindPartiesParts` and
  `FindPartiesAnnotations`; the contract's and the model's query spread them and differ only in
  `waitsFor`.
- **The web binding forwards `after`** and takes one receipt or a list for `atLeast`.

### A rebuild keeps read-your-own-write (owner's ruling, 2026-11-18)

While a newer directory generation is building, `PartyDirectoryStore.apply` forwards each of its
writes to the active generation, under the active generation's own positions: what the active
generation already applied is refused there, and what it has not seen lands in both. A search that
waited for a write finds it before the switch as after it. In Postgres both writes are one
transaction.

- **Held by** a law against both stores (the active generation ends complete whatever part of the
  history it had, a replay changes nothing, the switch changes nothing a search finds) and a
  rebuild story in `party/model/test/Rebuild.test.ts` (a party registered while generation 1
  builds is found before the switch). Both fail with forwarding switched off.
- **Limit.** One change is applied to two generations, so it must mean the same row in both. A
  generation that changes what a change means cannot be built beside the one it replaces this way.
- **A flaky law was fixed on the way.** The partial-name search law cut names by UTF-16 unit, so it
  could search for half of a surrogate pair, which is not text a search takes. It cuts by
  character now, and upper-cases only when that is the same text in another case.

### Not done, and why

- **The `/runs-state` route stays** (`runs/host/src/Runs.cluster.ts`). Cluster conformance cases
  read the stored JSON form through it, and they were not run. To retire it: read through
  `RunState` as the intake human (the reviewer is not in the session), change tag comparisons to
  statuses (`awaiting-approval`), and give the stored-forms case a direct database read, because
  `RunState` reads a withdrawn run as `cancelled`.
- **Empty search still lists every party of the org** (owner: is listing a use case?).

## Ids and text

No bare `S.String` is left in a contract, a model or a host, except `ClusterWiring.module` (a module
specifier). Each former free string is one of four things.

- **An id or key.** `FactId` is the twelfth branded id, used by the fact envelope, fact causes,
  generation entries and both `ClaimDecided` versions. Its formula is written once:
  `ClaimDecided.factIdOf(claim)`. Step names, version labels, reservations, sessions and receipt
  keys are `IdText`; write streams are `StreamId`.
- **Prose.** `Text` (`@proto/kernel/Measure`): well-formed Unicode with no NUL, the two things JSON
  over UTF-8 and a Postgres `text` column do not keep. Purposes, reasons, rationales, quotes,
  outcomes, descriptions.
- **One of a few.** `RunEndedStatus` in the party model (it imports no runs contract);
  `MergeRefusal.Readmission.reason` is the kernel's literal.
- **Its own rule.** `PartyName` (text, not empty, no surrounding whitespace, at most 200),
  `DirectoryText` (the same, empty allowed), `IdentifierValue`, `ProposalDigest` (what
  `proposalDigest` writes).

### The published fact was re-pinned a second time

`ClaimDecided.v1.schema.json` and `.v2.schema.json` changed by one line each: `factId` refers to the
`IdTextCheck` definition instead of a bare string. Done under the owner's phase 14 ruling for ids
(tighten and re-pin): the only fact id any producer wrote is `<claim>:decided`, which the pattern
accepts, so no stored fact stops reading.

### Behaviour that changed

- **The fixture mailbox was broken since phase 14** (`FixtureContactSource`). It built claim ids as
  `mailbox/msg-1`, and ids refuse `/`. It now writes `mailbox:msg-1`; a host property holds it.
- **An old stored merge-refusal line** whose detail is outside today's sets reads as `Vetoed` with
  the whole line as its reason. The one stored line reads as before.
- **A "run ended" report with a status that is not an ended one** reaches Party as a refused run.
  The runs adapter never sends one.

## Not verified

- Anything only a cluster run shows, including the HTTP 400 for a bad cursor end to end.
- Case-insensitive search across stores for letters outside ASCII: PGlite folds them as the
  in-memory store does; a Postgres with the `C` locale folds ASCII only.
- JSDoc examples are not compiled here (the prototype has no docgen).
