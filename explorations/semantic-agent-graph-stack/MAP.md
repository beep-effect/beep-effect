# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `outbox-draft-basis` (promised now) | An outbox draft records the Graph items it rested on, and a draft whose basis changed is reported and flagged before the attorney sends it. | Merged slices 0 to 2 of `m365-agent-outbox`. Shares files with its slice 3. | Pattern: `packages/drivers/m365-mcp/src/OutboxSendGuard.ts`. Audit record: `packages/drivers/m365-mcp/src/OutboxAuditLog.ts`. Reads and the category write: `getEvent`, `getMessage`, `listMessages`, `updateMessageCategories` in `packages/drivers/m365/src/M365.service.ts`. Test world: `packages/drivers/m365-mcp/test/OutboxWorld.fixture.ts`. Reason word: `ClaimEvidenceReviewStatus.Stale` in `@beep/epistemics`. NET-NEW: the pin and report schemas, the pure comparison, the `check_drafts` tool. |
| `outbox-bound-send` (gated) | Agent sending returns as one immutable request built from the checked draft and the rechecked basis. | `outbox-draft-basis`. Gate: the operator decides agents may send again. | The refusal it replaces: `version-unbound` in `packages/drivers/m365-mcp/src/OutboxHandlers.ts`. The condition is written in `packages/drivers/m365-mcp/README.md`. NET-NEW: the immutable send request. |
| `claim-basis-pins` (gated) | The pin shape moves to a shared contract and a pin may point at an epistemic claim. | Gate: a second consumer exists and the claims layer of `text-knowledge-stack-rebuild` has landed. | `readAsOf` and `readLatest` on `EdgeAuthority` (`packages/epistemic/use-cases/src/EdgeAuthority`). Promotion rules: `standards/architecture/02-shared-kernel.md`. |
| `task-context-view` (gated) | A context view for one actor, purpose and time that also returns what was missing. | Gate: the matched-budget grounding pilot proposed by `research-intake-2026-11` reports, and `belief-view-engine` resumes. | `goals/belief-view-engine`. NET-NEW: the sufficiency result. |

## Sequencing

`outbox-draft-basis` is the only bet. It is small, it sits inside one
driver, and it does not wait for the rebuild.

The three gated candidates stay here as re-entry points. A fired gate
reopens this exploration at decompose; none of them spawns a goal directly.
`outbox-bound-send` comes first if its gate fires, because the pins it needs
will already exist. `claim-basis-pins` is where the wider idea in the
research (a corrected claim reaches a later action) returns, once there is a
second consumer to justify a shared contract. `task-context-view` is last
and may never fire.

## First Vertical Slice

One event pin, end to end, in the stub world:

1. `create_draft` is called with one event pin. The server reads the event,
   computes the digest and writes the pin into the `draft-created` record.
2. The stub world moves the event's start.
3. `get_draft` returns `pinned-stale` with `Changed` for that pin.
4. A second case edits only the event's reminder, and `get_draft` returns
   `pinned-current`. This is the case a `changeKey` pin would get wrong.

Verified by handler tests over `OutboxWorld` and a property test of the
pure comparison. The category mark and `check_drafts` follow in the second
pull request, after the tenant proof that a draft category does not reach
recipients.

## Open Risks Inherited From The Brief

- A draft category may travel with sent mail; prove it on the tenant before
  writing a mark, and drop the mark if it does.
- `changeKey` changes on every edit; the pin compares a digest of named
  fields.
- Recurring events: a series master is refused as a pin in the first slice.
- Start and end must be canonicalized with their time zone before hashing.
- The message pin is cut if "a newer message exists" needs more than one
  list call.
- `draft-created` records written before this goal must decode with an
  empty basis.
- `m365-agent-outbox` slice 3 edits the same files; sequence around it and
  define what a draft update does to its basis.
