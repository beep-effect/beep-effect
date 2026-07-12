# Backlog — out-of-scope discoveries

Findings outside the campaign scope (non-frontend, spikes, repo-wide debt)
recorded here instead of being fixed in-loop.

| id | round | lane | summary | suggested owner/route |
|---|---|---|---|---|
| B-001 | 1 | code-chat | Assistant turns carry no link to the prompt they answer (`parentTurnId: none`), so version/sibling detection cannot pair an answer with its question. Cannot be fixed by reusing `parentTurnId`: that field now means *supersedes* (an edit's replacement removes the turn it points at). Needs a distinct `answersTurnId` on Turn + timeline, i.e. a workspace-domain change. | workspace domain + ThreadStore + timeline projection |
| B-002 | 1 | code-ontology | SPARQL executes synchronously inside `Effect.try`, so a pathological query cannot be interrupted and monopolizes the sidecar thread (F-001-28). A real fix runs Oxigraph in a terminable worker with a deadline; a timeout alone abandons the result without stopping the work. | oxigraph driver: worker isolation |
| B-003 | 1 | lane-c | Nested markdown lists flatten in BOTH pipelines (F-001-47): the assistant block schema models list items as inline children only, with no recursive list node. Needs a schema + both renderers. | agents-domain AssistantBlock + StreamingBlocks + codec |
