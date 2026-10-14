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
| `review-verdict-envelope` (promised now) | One cross-producer review envelope: `ReviewItem` / `SourceRef` / `VerdictRow` schema, `ReviewQueue` + `VerdictProjector` services (claim findings → `ClaimDisposition`), and the S1–S8 spike set that gates the pane | none (spikes need non-client test files and operator access to the attorney PC) | `@beep/law-practice-domain` (values/ beside `PatentDocument/`), `@beep/epistemic-domain` `ClaimDisposition`, `@beep/law-practice-use-cases` service pattern (`PatentClaimCandidate`); schema itself NET-NEW |
| Amendment → `goals/practice-claude-mod` (owner applies) | Review-queue phase: `/review` pane, band count, Right/Wrong/Note with undo and lock writing `VerdictRow` (D8 path), Box passages via `$.mcp.call`, "Open in Box", "Ask about this" via `$.prompt.fill`; D9 widened to Box read tools + `$.prompt.fill` | `review-verdict-envelope` P1 schema; spikes S1 + S3 pass | `practice-claude-mod` D6–D10 (plugin skeleton, delivery, verdict JSONL, app-local schema) |
| Gated: `drawing-review-pins` | Artifact `customAnchors` pins for drawing markup | Gate: S7 passes **and** the attorney keeps sending flattened markup the T2 matcher cannot read | artifact `comments` + `db` capabilities (RESEARCH §Surface capabilities) |
| Gated: `draft-review-in-word` | Drafts reviewed in Claude for Word, not the queue | Gate: the one-hour Word check shows practice-kg or Box reachable from its sidebar | NET-NEW (external product) |
| Gated: mod side chat | `$.model.fork` side conversation with a saved record | Gate: the attorney asks for saved side answers | `practice-claude-mod` engine |

## Sequencing

1. `review-verdict-envelope` P0. Ask the attorney the one-app question, then run the spikes:
   - S1 and S3 first (go/no-go);
   - then S2, S4, S6 and S8;
   - the Word check at any point.
2. `review-verdict-envelope` P1 schema and P2 services + projector. Spike S5, the verdict round
   trip, is the verify.
3. Deliver the amendment to the `practice-claude-mod` owner. It is written once S1 and S3 pass, or
   rewritten as the row-only fallback if S1 fails.
4. claim-element-graph's first goal emits `claim-finding` ReviewItems instead of standalone tool
   output.

## First Vertical Slice

One `claim-finding` ReviewItem fixture travels end to end in tests:
1. it is decoded;
2. it is queued;
3. a `wrong` verdict with a note is written to the append-only log;
4. it is undone, which creates a superseding revision;
5. it is re-judged `right`;
6. the log is locked;
7. it is projected to a `ClaimDisposition` with `status: active`.

On the attorney's PC, a throwaway sample mod (not the firm plugin) proves the pane renders in the
Desktop Code tab, and that a Box test file's passage arrives through `$.mcp.call`.

## Open Risks Inherited From The Brief

- Windows Desktop pane placement and painting are unproven (S1 is the go/no-go).
- The Box connector from a mod is unproven (S3).
- Desktop page images depend on an Svg path (S2).
- Selection inside a pane may be unavailable (S4).
- The early-access mod API may drift; pin the version.
- `$.store` races and the 100,000-character tree cap.
- Spikes on the attorney's PC need operator access and non-client files.
