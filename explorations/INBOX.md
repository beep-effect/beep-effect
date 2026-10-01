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
- **CI and local-gate determinism** — six gates that disagree between the
  workstation and hosted CI, or between lanes, captured during the
  effect-schema-parity close (operator decision 2026-10-01: record now, fix
  later). Friction receipts in
  `goals/effect-schema-parity/research/OPPORTUNITIES.md`. (1) The
  `@beep/repo-cli` `test/root-tasks-turbo-inputs.test.ts` Git-fixture
  `--affected` case fails on the workstation in every lane (it returns four
  root tasks) and passes hosted. (2) The `@beep/agents-client`
  `test/run-turn-reconciliation.test.ts` idle-sweep case is a real-clock timing
  flake (1 ms idle timeout against a 20 ms sleep). (3) Local `turbo check` hits
  a location-less TS2589 on `@beep/box`, `@beep/ui` or `@beep/xai` `#build` at
  random. (4) `apps/storybook` fails package-test-typecheck on main ("no
  package-owned test files"). (5) The generated schema catalog and other
  tracked inventories drift between lane merges: the catalog was about 1,087
  entries stale before P5 regenerated it, and six more entries (repo-cli
  AgentEffectiveness, LaneTimings and Quality schemas from later merges) were
  stale again by the follow-up PR, which regenerated them; nothing gates the
  drift on main. (6) `detectGithubJobShapeClass` classifies runner loss only
  when every step is null, so `yeet monitor` misses mid-job Spot evictions
  (evidence: run 36763005302).
