# Amendment proposal for `goals/practice-claude-mod`: review-queue phase

From: [`attorney-review-workspace`](../README.md) (graduated 2026-10-14).
To: the `practice-claude-mod` owner, who applies it in their own packet
([handoff ruling](../DECISIONS.md)). This exploration does not edit that packet.

## Why

Earlier attorney reviews used separate pages and apps and confused the attorney
([RESEARCH.md](../RESEARCH.md), R1–R11). The rulings put every attorney review in one place: a
queue in the plugin he already runs. The plugin already plans verdict rows on answers (D8) and a
matter band. The review queue is the same verdict capture applied to items other producers
generate.

## What changes in `practice-claude-mod`

### 1. A new phase after the first slice (rows + verdicts)

| Phase | Goal | Exit criteria |
| --- | --- | --- |
| P1b Review queue | The `/review` command opens a pane listing open `ReviewItem`s. Each item is shown one at a time with: <ul><li>the plain answer or finding;</li><li>a plain label (for example "examiner rejection" or "incomplete");</li><li>the source passage with the key words highlighted;</li><li>the location ("page 3, lines 12–18").</li></ul> Controls: Right / Wrong / Note, with undo, and Lock at the end. The band shows "N to review". "Open in Box" loads the document in the desktop Browser pane. "Ask about this" drafts a question into his prompt with `$.prompt.fill`. Tab or the arrow keys move through the queue. | On the operator machine and the attorney's Windows PC, using non-client test items: <ul><li>three `ReviewItem` kinds render;</li><li>verdicts write `VerdictRow`s;</li><li>undo writes a superseding revision;</li><li>lock closes the current batch: further writes to that <code>batchId</code> are refused, and a new batch accepts verdicts;</li><li>"Open in Box" opens the Browser pane;</li><li>no Box write is possible.</li></ul> |

**Entry gate:** `goals/review-verdict-envelope` spike **S1** passes (a pane paints and is usable in the
Desktop Code tab), and its **P1** schema is merged. **S3** gates only the Box text read
(`get_file_content` through `$.mcp.call`). Page images are optional. If the text read fails, producers
embed the passage text in `SourceRef.quote`, and the pane renders the item with no Box call.

### 2. Verdict rows adopt the shared envelope

D8's verdict JSONL rows become `VerdictRow`s from `@beep/law-practice-domain` (import the domain
subpath only, per the bundle-growth rabbit hole):
- `itemId`;
- `batchId`, for the review sitting or queue run;
- `verdict`: `right | wrong | partly`;
- an optional `note`;
- `revision`;
- `recordedAt`, the time the attorney pressed (required; the projector derives `resolvedAt` from
  it);
- an optional `lockedAt`.

Rows are append-only, so undo is a superseding revision. A lock closes one batch; the next
review starts a new `batchId` in the same log. A `kg-answer` `ReviewItem` wraps the answer
row the existing Right/Wrong controls already target, so one log serves both the per-answer controls
and the queue. D10's app-local schema is promoted out at the point D10 already names: the projector
in `review-verdict-envelope` is the second consumer.

### 3. D9 widens for this phase only

Add to the release-check envelope:
- `$.mcp.call` on the Box connector's **read** tools, `get_file_content` and `get_preview_page`;
- `$.prompt.fill`.

Still excluded:
- Box writes: comments, metadata, shared links;
- `$.prompt.submit`;
- `$.model.*`;
- `$.process`, `$.http.fetch` and `$.env`.

`claude plugin validate` must list exactly the widened envelope.

### 4. Non-goals added

- No annotation workspace, no artifact or Doc review surface, no tailnet review pages.
- No Box writes from review. Box comments are whole-file, unanchored, visible to every collaborator,
  and `$.mcp.call` raises no permission prompt.
- No mod-owned side chat. The built-in Ctrl+; serves until he asks for a saved record.
- Drawings get whole-sheet verdicts in the queue. Pins on an artifact are a gated re-entry point.

## If S1 fails

Without a usable pane on his Windows Desktop Code tab, P1b shrinks to Right / Wrong / Note controls
on the rendered rows, plus a `/review next` command that prints the next item into the transcript.
`attorney-review-workspace` reopens at decompose before any second surface is considered.

## Open items for the owner

- Where the queue reads `ReviewItem`s from on his PC: a practice-kg read tool (recommended, matching
  claim-element-graph's finding-surface decision) or a local file drop.
- Which of the plugin's existing acceptance items absorb the "Saved" toast and undo, which the
  first slice already needs.
