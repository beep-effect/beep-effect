# Inbox

Zero-friction idea queue. One bullet per idea — a sentence, a link, a "what
if". No structure required; do not organize this file.

`/explore` triages it: each bullet becomes a new packet, attaches to an
existing packet's `CAPTURE.md`, or is struck through with a word of why.

## Queue

- TTL→Effect-Schema codegen pipeline (WebStorm scratches `ontology/`:
  parseTtl → buildJsonSchema → emitIrisModule + parseConceptSchemes) — three
  findings from the 2026-07-31 identity-iri-fold review before it graduates
  into a `packages/ontology-store` package: (1) `JsonSchemaRef`/`JsonSchemaAnyOf`
  carry synthetic `type: "$ref"`/`type: "anyOf"` discriminators that make the
  emitted document invalid JSON Schema 2020-12 unless stripped at
  serialization; (2) `emitIrisModule` hand-rolls `namedNode` namespace records
  that should mint through the identity `CoreVocab` registry/`rebase` instead;
  (3) the pipeline's range-resolution table and the identity-iri-fold's AST
  datatype/object inference are the same decision table in opposite directions
  — consider one shared range-policy module so import and export lanes cannot
  diverge.
- **agent-config-canonicalization** — one semantic manifest (tool → artifact,
  execution scope, lifecycle/TTL, capabilities, principal, profiles) compiled
  into Claude/Codex/Grok/t3code/Docker-MCP vendor configs, replacing
  hand-synchronized `.mcp.json` + `config.toml` + settings sprawl; fail-closed
  compilation (an adapter that can't express a constraint errors instead of
  widening authority). Operator-captured 2026-08-29 during the basic-memory +
  codegraph removal campaign (#881, #884): stripping two servers required
  touching five independent config surfaces per harness — several undocumented
  (a Claude-format `.mcp.json` compatibility loader in the ChatGPT-embedded
  app-server, Grok's Cursor-config import, Codex prompt-hooks) — and the 47
  tracked `.mcp.json` copies across clones had drifted into 3 content hashes.
