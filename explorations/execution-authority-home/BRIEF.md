# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

The professional-desktop sidecar decides every governed MCP tool call and
outbound publish before it runs. It records each decision, including denials,
in a hash-chained, append-only ledger. All of that code still lives in the
epistemic slice: the grant, grant-set, verdict and record values; the
`ExecutionLedger` port and its Drizzle adapter; `GovernedTierGate`;
`GovernedEgress`; and the whole of `@beep/epistemic-config`.

The 2026-10-21 architecture decision called these values "not epistemics" and
promised them their own home in a separate change. That change never happened.

Until it does, two things are blocked or muddied:

- The epistemic slice can't be grilled on its own direction, because half of it
  isn't epistemics. That grill decides between A (the claim store every slice
  writes to) and B (split into reusable infrastructure).
- The governed result, the ontology Session, can't say which decision allowed
  each change.

The research (`research/provenance-placement-ddd.md`) settled the modeling
question:

- Provenance of a result attaches to the result.
- A decision that precedes or gates a result, and may never produce one, is a
  record of its own.

## Appetite

Small, bounded, and mostly mechanical. Three pieces, each one PR:

1. **The move.** About 4.6k lines relocate unchanged into a new
   `execution-authority` slice, in one atomic PR with no re-export shims. It
   includes the forward table rename and the env-key rename. No behavior
   changes: the same bound addresses, ledger rows and hash bytes.
2. **The link.** Ontology Session change-journal entries gain an
   `authorizedBy` decision IRI next to the existing `OntologyChangeActor`. This
   is a small PR in ontology plus one wiring line in the desktop.
3. **The anchor.** Anchoring the chain tip outside the store is a separate goal
   (`agent-execution-record-anchoring`), sequenced after the link. It is not
   shaped here.

If the move turns out to need behavior changes, they go back to this brief as
a decision. They are not absorbed into the move PR.

## Solution Sketch

```text
Agent ── MCP call ──▶ GovernedTierGate / GovernedEgress   (@beep/execution-authority-server)
                         │ 1. append decision (before the effect)
                         ▼
                 decision stream: execution_authority_decision / _outcome
                 append-only · session-keyed · denials included · hash-chained
                         │ 2. allowed → effect runs
                         ▼
         ontology Session change-journal entry
           actor:        urn:beep:desktop-mcp-client:…   (exists today)
           authorizedBy: urn:beep:execution-authority:decision:<id>   (piece 2)
```

New slice packages, all created with `bun run beep create-package`:

| Package | Holds | Domain kind |
| --- | --- | --- |
| `@beep/execution-authority-domain` | `ExecutionGrant`, `GrantSet`, `ExecutionVerdict` | values: no identity |
| | `ExecutionDecisionRecord`, `ExecutionOutcomeRecord` | entities: chained by index, referenced by id |
| `@beep/execution-authority-use-cases` | `ExecutionLedger` port and errors | |
| `@beep/execution-authority-server` | ledger Drizzle adapter, `GovernedTierGate`, `GovernedEgress` | |
| `@beep/execution-authority-tables` | decision and outcome tables plus converters | |
| `@beep/execution-authority-config` | allowlist, policy revision, audience resolution; keys `EXECUTION_AUTHORITY_*` | |

These packages are classified by domain kind from the first commit, applying
the party-domain lesson from #2829: a record referenced by id is an entity even
though it is immutable.

Seams to cut, from RESEARCH §1:

- the `CanonicalJson` alias, which keeps importing `canonicalDetectionJson`
  from `@beep/epistemics`;
- the domain, use-cases and tables barrels;
- `EpistemicServerDrizzleLive`, which drops the ledger, while the desktop's
  `runtime/Layer.ts` composes the new ledger layer;
- `DbSchema`, plus a db-admin target for the new tables package;
- `OptionalDefect`, which needs a copy or a neutral home;
- three mixed test files, each split by subject.

Repointed consumers:

- five desktop files and one db-admin file import directly;
- four reach the code through aggregates;
- five tooling pins, including `FROZEN_GRANT_SET_DEFINING_MODULE`;
- the mcp-kit and api-transport README port-inversion records.

`@beep/epistemic-config` is retired and recorded in
`changesets.retired-packages.json`.

## Rabbit Holes

- **Hash bytes.** The `epistemic-execution-decision/v1`,
  `epistemic-execution-outcome/v1` and `epistemic-grant-set/v1` labels stay
  byte-identical. So do `canonicalDetectionJson` and the manual projections.
  Acceptance replays an existing chain recorded before the move, so a passing
  test list alone doesn't count as proof (lesson from the
  `agent-execution-authority` reflection).
- **Rename migration.** Rename the tables, constraints, triggers and the guard
  function in one forward migration, with a tested down-migration. Pin the new
  names with the existing `information_schema` test, and run the migration
  against a PGlite database seeded with pre-move rows.
- **Behavior proof beyond tests.** The reflection records a harness extraction
  that silently rebound a server to every network interface. The move's
  acceptance diffs the bound address, ledger row counts and column pins, not
  just test names.
- **`OptionalDefect`.** The helper is shared with epistemic use-cases. Moving
  it would make one slice import another, so it needs a decision: copy it with
  a note, or find a neutral home. Check for an existing helper before writing
  one.
- **Stale operator env.** After the key rename, an old `EPISTEMIC_*` env leaves
  the allowlist empty, which unregisters the publish tool. That fails closed,
  but operators may not notice. The PR body and `.env.example` say so.
- **Domain-kind and identity paths.** Schema identifiers change with the move.
  No test or persisted value pins an execution identifier (RESEARCH §6), so
  nothing needs migrating, but `ValueSchemaIdentifiers.test.ts` must stay green
  for the epistemic modules that remain.

## No-Gos

- No change to hash labels, canonical JSON, or ledger row semantics.
- No tip anchoring in this work.
- No foundation or capability extraction of the gate or chain mechanism until a
  second consumer exists (the re-entry gate in MAP).
- No re-export shims or deprecation aliases from epistemic packages.
- No change to the epistemic slice's claim, edge, contradiction or retention
  code. Its own direction is the next grill.
- No new governed sinks, grant kinds or policy features.
