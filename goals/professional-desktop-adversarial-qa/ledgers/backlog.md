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
