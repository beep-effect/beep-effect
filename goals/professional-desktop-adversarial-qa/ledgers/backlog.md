# Backlog — out-of-scope discoveries

Findings outside the campaign scope (non-frontend, spikes, repo-wide debt)
recorded here instead of being fixed in-loop.

| id | round | lane | summary | suggested owner/route |
|---|---|---|---|---|
| B-001 | 1 | code-chat | Assistant turns carry no link to the prompt they answer (`parentTurnId: none`), so version/sibling detection cannot pair an answer with its question. Cannot be fixed by reusing `parentTurnId`: that field now means *supersedes* (an edit's replacement removes the turn it points at). Needs a distinct `answersTurnId` on Turn + timeline, i.e. a workspace-domain change. | workspace domain + ThreadStore + timeline projection |
| B-002 | 1 | code-ontology | SPARQL executes synchronously inside `Effect.try`, so a pathological query cannot be interrupted and monopolizes the sidecar thread (F-001-28). A real fix runs Oxigraph in a terminable worker with a deadline; a timeout alone abandons the result without stopping the work. | oxigraph driver: worker isolation |
| B-003 | 1 | lane-c | Nested markdown lists flatten in BOTH pipelines (F-001-47): the assistant block schema models list items as inline children only, with no recursive list node. Needs a schema + both renderers. | agents-domain AssistantBlock + StreamingBlocks + codec |

## F-001-47 — nested lists cannot be represented at all (domain change)

Reported as "nested lists flatten in both the streaming and persisted pipelines",
which reads like two renderer bugs. It is neither. The assistant's wire contract has
no nesting to lose:

```ts
export class ListItem extends S.Class<ListItem>($I`ListItem`)({
  children: S.Array(InlineNode),   // inline content only
})
```

A list item holds inline nodes and nothing else, so a nested list is unrepresentable
before it reaches any renderer. Both pipelines are faithfully rendering everything they
are given.

Fixing it means changing the domain: `ListItem` must carry blocks (or nested items)
recursively, which propagates to the model's forced-tool schema, the streaming block
renderer, the `@beep/md` codec, and the Lexical codec. The turn codec already keeps
`Tool.Strict` **false** because the block union exceeds the provider's grammar
compilation — adding recursion to that schema is exactly the direction that makes it
worse, and risks the model's compliance with the tool surface.

That is a deliberate domain decision with a provider-behaviour risk attached, not a
defect to patch mid-loop. It needs its own change, with the tool-schema behaviour
verified against the live model before it lands.

## F-001-28 — SPARQL cannot be cancelled, and a timeout would be a lie (needs a worker boundary)

`Oxigraph.sparql.ts` executes the query with a **synchronous** call:

```ts
Effect.try({ try: () => store.query(request.query, { use_default_graph_as_union: true }) })
```

Wrapping a blocking call in an Effect does not make it interruptible. JavaScript cannot
preempt a synchronous call, so `Effect.timeout` would not fire until `store.query`
had already returned — it would report a timeout for a query that had just finished,
while the engine stayed blocked for exactly as long as it was always going to. Adding
one would make the panel *look* protected while changing nothing, which is worse than
the honest absence of a bound.

The existing safeguards bound the RESULT (an injected `LIMIT`, `maxResultCount`), not
the WORK. A pathological pattern — an unbounded cartesian join — still costs whatever
it costs before the first row exists to be limited.

Cancelling it for real means moving the engine onto a boundary that can be killed: a
worker (as the graph projection already does) or a child process, so a runaway query
can be terminated rather than waited out. That is an architectural change to the
ontology server, not a patch, and it should be done deliberately — with the worker's
own startup cost measured against the query latencies it is protecting.

## F-002-10 — a stopped turn is described in prose, not recorded as an outcome (domain change)

An interrupted or failed turn is persisted as ordinary assistant content:

```ts
const STOPPED_NOTE = "(stopped)" as const;
const FAILED_NOTE = "(failed)" as const;
```

This was the right fix for the bug it solved — before it, an unfinished turn persisted
*nothing*, which left an unanswered prompt in the conversation and made the next
question get answered as if it were the abandoned one. Recording the marker closed
that hole, and it is worth keeping until something better replaces it.

But it says with prose what should be said with structure. A model that literally writes
"(stopped)" produces a turn indistinguishable from one the user interrupted, and nothing
downstream can tell them apart: no consumer branches on the marker — the UI renders it
as text, because text is all it is.

Doing it properly means an `outcome` on the `Turn` aggregate (`completed | stopped |
failed`), which reaches the domain schema, a database migration for the persisted rows,
the RPC contract, and the renderer that would finally have something to render *as* a
stopped turn rather than a message that happens to say so. That is a schema change with
a migration attached, and it should be designed rather than patched in behind a QA loop.
