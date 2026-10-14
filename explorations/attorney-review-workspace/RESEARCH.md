# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## External Landscape (2026-10-14)

Method: six research facets, one skeptic per facet, and a synthesis.
- **Facets:**
  - mods
  - artifacts and Claude Docs
  - built-in desktop features
  - Box rendering
  - a post-mortem of earlier attempts
  - the legal AI landscape
- **Skeptics:** each re-checked its facet's key claims against the source. 29 were confirmed and
  13 partly wrong; none was refuted.
- **Full write-up:** [research/SYNTHESIS-2026-10-14.md](./research/SYNTHESIS-2026-10-14.md), with
  per-facet summaries and every verdict and correction in
  [research/FACET-VERDICTS-2026-10-14.md](./research/FACET-VERDICTS-2026-10-14.md).

### What earlier attempts teach (the ergonomic bar)

The evidence asks for less than the capture's feature list. Requirements R1–R11 are in the
synthesis §2, each tied to a cited packet, decision or session record. The ones that dominate:
- **R1 One surface.** Every attempt that failed spread across several apps, or used a long deck of
  questions. The quickest exchange happened in the app the attorney already uses.
- **R2 Machine first, few items, one at a time.** Ruling S15 retired the sitting app; agents
  evaluate and only unresolved items reach the attorney (`goals/practice-kg-mcp/SPEC.md` D-29).
  Identification review is capped at about 20 hard cases
  (`goals/practice-document-identification/SPEC.md` D8, D16).
- **R4 The answer first, then only the sources needed, with the passage highlighted.** Box links
  must open for this viewer.
- **R7 Capture the verdict where the item lives.** It must be structured, append-only and lockable,
  and must not depend on the operator relaying it.
- **R9 Markup must arrive structured.** Flattened PDF ink forced a pixel-coverage matcher
  (`goals/design-figure-review-loop/SPEC.md` T2).

### Surface capabilities (verified unless marked)

The full matrix, with a source for every cell, is in the synthesis §3. Highlights:
- **Mods** draw in the terminal and the Desktop Code tab.
  - Desktop elements: Box, Text (with background-color spans), Button, Input, Select, Svg, Link,
    Code, Markdown, Client. `Image` and `Raster` are terminal-only.
  - Panes share one slot as tabs. `$.mcp.call` shows no permission prompt and can return image
    blocks. `$.http.fetch` returns text only.
  - **UNVERIFIED:** how the Desktop Code tab places and paints a mod pane on Windows, and whether an
    Svg-wrapped PNG paints.
- **Artifacts:**
  - Comments can be anchored to a selected range, or pinned to a canvas with `customAnchors`.
  - Comments reach Claude only through a watching main-loop session with auto-replies armed.
  - Only the owner and non-view-only members of the same organization can comment.
  - The `db` capability holds verdicts. The `mcp` capability runs connectors with the viewer's
    credentials, and declaring it bars public sharing.
  - The Code-tab artifact pane lists only the artifacts this session published.
- **Claude Docs:** comment threads anchored on 3–6 words; a comment sent to Claude becomes a turn;
  tabs; enum chips; organization sharing; export. No custom code, and placement in the Code tab is
  undocumented.
- **Desktop built-ins:**
  - side chat (Ctrl+;, reads the main thread, not saved);
  - draggable and pop-out panes;
  - split view;
  - PDF, image and HTML paths open in the Browser pane;
  - the Browser pane uses a clean profile, with an optional Keep cookies;
  - `claude-cli://` deep links open a terminal, not the desktop app.
- **Box:**
  - `get_preview_page` returns one PNG per page; `get_file_content` returns extracted text.
  - Connector comments are whole-file, up to 1,000 characters, with no anchor.
  - Box Preview annotations have **no public read API**; only `ANNOTATIONV2_*` events exist. Markup
    made in Box cannot be read back.
- **Landscape:** Claude for Word is generally available on paid plans, with tracked changes and
  replies in comment threads. Whether it reaches practice-kg or Box from its sidebar is UNVERIFIED.

### Candidate architectures (synthesis §4)

| | Spine | Strength | Fatal risk |
| --- | --- | --- | --- |
| A | Mod-pane review queue, a phase of `practice-claude-mod` | One surface; verdicts recorded on the answer itself; keyboard queue | Desktop pane placement and painting on Windows is unproven (spike S1) |
| B | Artifact review page with comments flowing to the session | Real anchored annotation; pins on drawings | Organization comment model, needs a live watching session, a second surface |
| C | One Claude Doc per review batch | Familiar document review, export | No code or figures, a second surface |
| D | Box annotations plus a mod band | Full fidelity | Box markup cannot be read back (fails R7, R9) |

The synthesis recommends A as the spine, with D as A's "Open in Box" escape hatch. B is gated to
drawing review (spike S7), and C is used only for draft text if the operator chooses Docs over Word.
It defines seven spikes (S1–S7); S1, pane placement on Windows, and S3, Box through `$.mcp.call`,
are the go/no-go gates.

## In-Repo Capability Inventory (2026-10-14)

| Brick | Where | Use |
| --- | --- | --- |
| `practice-claude-mod` goal (one plugin: plain-language tool rows, Right/Wrong verdict rows, matter band, timer, firm skills) | `goals/practice-claude-mod` (PR #1711), decisions D1–D12 on `explorations/claude-mods-law-practice` | extend: the workspace is most likely a phase of this plugin |
| Verdict JSONL (D8) and app-local schema (D10) | `practice-claude-mod` decisions | reuse as the write path |
| `ClaimDisposition` (active / rejected / superseded, reason, resolvedBy) | `packages/epistemic/domain/src/entities/ClaimDisposition/` | projection target for claim findings |
| Claim-check findings and their surface decision | `explorations/claim-element-graph/DECISIONS.md` (finding-surface, verdict-storage) | first producer of review items |
| Practice MCP read tools | `packages/law-practice/use-cases/src/PracticeKg.tools.ts` (11 closed-world read tools) | data source for review items |
| Box driver and generated models | `packages/drivers/box` (`Box.models.gen.ts`: annotation events only) | Box reads; confirms there is no annotation read path |
| Lawyer-facing defaults (2026-10-09) | operator ruling, applied in the practice-kg sitting packets | the text and page rules every surface follows |

NOT FOUND:
- a cross-producer `ReviewItem` / `VerdictRow` schema;
- a projector from verdicts to `ClaimDisposition`;
- a review queue;
- a Box text or page renderer for a pane;
- an anchored source selector (W3C TextQuoteSelector shape).

## Constraints Discovered (2026-10-14)

- **Sibling conflict.** `practice-claude-mod` D8 stores verdicts as local JSONL, while
  `claim-element-graph` chose `ClaimDisposition`. One envelope with one projection must reconcile
  them.
- **Mod permission envelope.** `practice-claude-mod` D9 allows only `$.ui`, `$.command`,
  `$.state`/`$.store`, `$.clock`, `$.mcp.call` (practice-kg reads) and `$.fs`. Reading Box or
  drafting a prompt needs a deliberate widening.
- **No silent writes.** `$.mcp.call` raises no permission prompt, so any write the mod makes needs
  its own confirmation.
- **Windows.** WSL Desktop sessions load no plugins, `Image` needs a kitty-class terminal, and
  pane painting is unproven.
- **Public repo.** Spikes use non-client test files only. Client PDFs uploaded as artifact assets
  would reach everyone the artifact is shared with.
