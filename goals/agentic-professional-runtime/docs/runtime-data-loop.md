# Runtime Data Loop Proof

## Purpose

This document defines the first concrete end-to-end proof for the Agentic
Professional Runtime. It turns the broad product thesis into a traceable local
scenario that can later become package tests and implementation work.

The proof answers one question:

Can an incoming professional email become evidence-backed candidate work,
approval-gated client communication, and a bounded SDK context packet without a
vertical product importing from the other vertical?

## Canonical V1 Scenarios

| Product | Scenario | Fixture |
|---|---|---|
| Law practice | Existing client asks for help preparing a provisional patent filing before a public demo. | `fixtures/runtime-data-loop/law-patent-intake` |
| Wealth management | Existing client asks for cash planning help before a dated payment need. | `fixtures/runtime-data-loop/wealth-cash-request` |

Both scenarios start with a normalized incoming email. They do not depend on
raw MIME parsing, a real email provider, a real LLM call, or private data.

## Trace

The v1 proof traces the same runtime loop twice:

1. Seed organization, user, workspace, agent, and minimal vertical context.
2. Ingest one normalized incoming email artifact with stable source spans.
3. Create a thread/turn and activity record for the ingest operation.
4. Run a deterministic fixture agent against the email and seed context.
5. Produce candidate claims, candidate tasks, and one client-facing draft.
6. Attach evidence spans and provenance to every candidate output.
7. Create one pending approval gate for the candidate output set.
8. Expose an evidence-bounded context packet through the SDK contract.

The first implementation may execute the trace with deterministic fixture
snapshots. A real model adapter can be introduced later behind the same
candidate-write contract.

## Candidate Outputs

Every agent-produced output remains candidate state in v1:

- candidate claims capture professional assertions that need review
- candidate tasks capture proposed work with due dates, owners, and evidence
- candidate drafts capture client-facing email text for human approval
- approval gates record the reviewer, requested actions, and evidence context
- context packets expose bounded work context to SDK clients

Accepted truth is outside the first deterministic fixture. The fixture proves
that proposed truth is shaped, evidenced, and reviewable before promotion.

## Evidence Rules

Each expected output must cite stable span IDs from the input email body.
Whole-artifact evidence is not enough for this proof.

The source body uses markers such as:

```md
[span:law-email-001-s3]
We are planning to show the prototype publicly on June 12, 2026.
```

Expected snapshots cite those spans by ID. The fixture validator fails if a
snapshot references a span that does not exist in the source body.

## SDK Boundary

The proof treats the internal Effect/TypeScript SDK as the canonical client
contract. Claude Desktop, OpenClaw, MCP, and the native app will wrap or consume
that contract later.

The v1 SDK surface must support:

- reading an evidence-bounded context packet
- proposing candidate claims
- proposing candidate tasks
- proposing candidate draft artifacts
- proposing approval gates

The SDK must not expose direct authoritative agent writes for regulated work in
v1.

## Success Criteria

The runtime data loop is specified when:

- both fixture scenarios have seed state, normalized email input, body spans,
  and expected output snapshots
- every expected claim, task, draft, approval gate, and context packet cites
  source evidence
- the slice map names which slice owns each concept in the trace
- the SDK contract names the read and candidate-write boundary
- the approval policy makes human review mandatory for candidate outputs

## Explicit Non-Goals

- raw `.eml` parsing
- real email or calendar connector execution
- real LLM extraction in this paired deterministic fixture loop
- direct authoritative agent writes
- external email sending
- calendar event creation
- full package scaffolding
- multi-machine sync
