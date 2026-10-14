## Facet: mods

A Claude Code mod can be the single review surface in the attorney's Claude Code: a pane docked beside the transcript, with plain-language rows and verdict controls inside the transcript itself. Every source here is from Claude Code 2.1.295 or the public mods docs. A pane can draw Box, Text (with background-colour highlighted spans), Button, Input (one line), Select, Link, Code, Markdown (links can raise a press event) and Client. The Desktop Code tab also gets Svg. Only the terminal gets Image and Raster, so a raster image of a Box page reaches the desktop only as a PNG wrapped in an Svg (validates, painting UNVERIFIED) or as an https link. A pane has no PDF element. Several panes share one slot: one shows and the others become tabs. Panes are resizable (the user's dragged size wins). The docs describe dock-versus-above-the-prompt placement for the terminal only; how the Desktop seats a pane, and whether it can tile with the Desktop's own diff, file or artifact panes, is UNVERIFIED. A pane can be interactive: presses, typed input and picks call the mod's own handlers. The pane can also read the user's text selection, put text in the prompt box, submit a prompt (optionally as the user's own words), or ask a side question over the transcript with $.model.fork, or with no history via $.model.complete. A mod can open other surfaces only indirectly: a Link (on the desktop only https or http://localhost), $.tool.call on a tool such as Artifact (it goes through the permission check), or $.mcp.call. Whether $.mcp.call can reach the Desktop's own pane tools (ccd_view show_pane) is UNVERIFIED. For Box, $.mcp.call can call the claude.ai Box connector's get_preview_page, which returns a page as PNG. $.http.fetch returns text only, capped at 4 MiB and 30 s, so it is unsuitable for binary downloads. Version floors: terminal 2.1.287, Desktop Code tab 2.1.286; the attorney's 2.1.295 meets every floor used here except the 2.1.296 HEAD-request exemption. On Windows the docs mention only that CLAUDE_CODE_PLUGIN_DIRS separates paths with ';', that audio clips do not play, and that WSL sessions in the Desktop load no plugins. Pane painting on Windows is unproven. A scratchpad spike (not committed, Claude Code 2.1.299) mounted a review pane with highlighted Text, a link-pressing Markdown, Input, Select and Button, plus an Svg wrapping a PNG for the desktop and an Image PNG for the terminal. It passed `claude plugin test` on both surfaces; the test kit checks the tree against each surface's rules but never paints it. The practice-claude-mod goal already supplies the plugin skeleton, delivery path, verdict JSONL rows and Right/Wrong controls, the matter band and the release checks. A review workspace should extend that goal rather than start a new app, but it needs calls that goal's D9 envelope forbids.

**Skeptic verdicts:**
- confirmed: The Desktop element table is Box, Text, Button, Input, Select, Svg, Link, Code, Markdown, Client. Image and Raster are terminal-only.
- confirmed: Several open panes share one slot: the surface shows one and the rest become tabs.
- partly-wrong: A pane docks beside the transcript in a fullscreen terminal at 110 columns or more, and sits inline above the prompt otherwise. A size the user drags or keys wins over the mod's request.
  - Correction: The rule as stated holds only for an asked open: one made in answer to a command or prompt the person entered, or a Button, Input or Select they used. An unasked open, such as one from a timer or session.start, is not drawn at all below 144 terminal columns. That floor drops to 110 for a pane id the person has opened before and not closed by hand. Below the floor `$.ui.open` resolves `{ isPlaced: false, reason }`. The same result comes back in a session whose attached surfaces place no panes, such as an older desktop. Outside fullscreen (the main-screen layout) the pane sits inline at any width. The size-precedence part is correct: the person's dragged or keyed size wins, and the dock ignores `rows` while the inline block ignores `columns`. How the Desktop Code tab seats a pane is a per-surface `placement` value. The sources do not say it docks, so that part is UNVERIFIED.
- confirmed: $.ui.selection works in the desktop by asking the attached clients that answer selection reads.
- confirmed: $.model.fork answers one tool-less question over the session's own transcript. $.prompt.submit starts a turn of its own once the session is idle, and asUser sends the text as the user's own words.
- confirmed: $.http.fetch returns the body as text, at most 4 MiB, within 30 s and 5 redirects.
- confirmed: $.mcp.call calls a connected server's tool with the engine's credentials and shows no permission prompt; results include image content blocks.

## Facet: artifacts-docs

An artifact page could serve as the one review surface for every work-product type (FACET: Artifacts and Claude Docs). The case rests on the artifact-capabilities runtime contract 0.2.77, the ArtifactComments tool schema, the Claude Docs guide topics, and the desktop ccd_view/ccd_window tool schemas.

The `comments` capability ties the page's own text selections to the claude.ai comment store. `openComposer({range})` turns the selected text into the thread's quoted excerpt. `customAnchors` lets the page place comment pins itself on content the shell cannot anchor to, such as canvas scenes, which is how pdf.js pages would get pins. `sendToClaude` posts a comment and brings Claude into that thread. A watching Claude Code session (ArtifactComments `watch`) then wakes and replies in the thread. That gives inline chat, with conditions: the thread must be sent to Claude by an editor, auto-replies must be armed, and only a main-loop session holds a watch, never a subagent.

Other capabilities cover the rest of the requested features:
- `db`: durable shared verdict and notes records that Claude reads and writes through ArtifactData.
- `user`: who is viewing.
- `room`: live presence.
- `sample`: a side chat that spends the viewer's own Claude usage.
- `assets`: storage for uploaded PDFs and images.
- `mcp`: calls the viewer's claude.ai connectors, Box included. The Box connector can return page PNGs (`get_preview_page`) or markdown text (`get_file_content`). Its raw download URL points at a Box host, which the page's content security policy (CSP) almost certainly blocks.

Sharing and plans limit all of this. Writing comments and db rows, and sending to Claude, are limited to the owner, editors, and, on Team or Enterprise plans, organization members who are not view-only. Public-link and email-invited visitors get `null` for `comments`. Declaring `mcp` bars public sharing. `host:` local MCP servers, the route to the practice-kg server, answer only in the Claude app and only for the artifact's owner.

In the desktop Code tab, artifacts show in an "artifact" side pane beside the transcript. Any side pane can sit in a pop-out window of its own. Split view is for sessions, not artifacts. The pane is documented as listing "the artifacts this session published". Whether the attorney's own session can open an artifact owned by another account in that pane is UNVERIFIED.

A Claude Doc is a lighter alternative. It has native comment threads anchored on quoted words, and a comment sent to Claude arrives as its own `[Artifact comment sent to Claude]` turn. It also has tabs, dropdown status columns for verdicts, uploaded images and charts, Share within the organization (view, comment or edit), and Export to Word, PDF or Markdown. It cannot run custom page code, so it cannot host a PDF viewer. A Doc fits text-centric reviews such as office-action analyses and draft text. A capability-bearing artifact fits drawing and source-document reviews. Neither runs inside Claude Desktop chat; both run in claude.ai and the Code tab.

**Skeptic verdicts:**
- partly-wrong: A page can turn a text selection into a comment whose quoted excerpt is that selection, and can place its own pins on canvas content (e.g. pdf.js pages).
  - Correction: Selection-to-excerpt holds only when the Range fits the platform's span bounds; an oversized or unusual selection quietly falls back to the enclosing element. On canvas content the page does not draw its own pins. With customAnchors the page invents opaque anchor strings, does its own hit-testing and reports where each pin goes, and the shell draws the pin there ('The page draws no pins of its own'). Invented canvas anchors need the full form {comments:{customAnchors:true}}, which asks the viewer for consent. Combined with composer_only, compose takes only domAnchor paths. pdf.js was not tested.
- partly-wrong: Comments reach Claude only through 'Send to Claude' by an editor, and a Claude Code session is woken only if it watches the artifact with auto-replies armed.
  - Correction: A writer can activate a thread for Claude in two ways: replying with Send to Claude, or mentioning @claude in the thread. Activation decides whether Claude can reply and resolve, and whether a watching session wakes. It does not decide whether Claude can see a comment: ArtifactComments action 'read' returns all threads, plain ones included, when the user asks. The wake condition is correct: a sent comment wakes the session only while that artifact's watch row says auto-replies armed, and only a main-loop session (not a subagent, teammate or print session) holds a watch. canSendToClaude values are available / writers_only / no_session / off, and sendToClaude is for editors only.
- confirmed: Box sources can be rendered in an artifact as page images or markdown via the mcp capability, but not as raw PDF fetched from a Box download URL.
  - Correction: No correction needed. Caveats: get_preview_page takes {fileId, page} and returns a PNG, but its description tells the calling model to use it only when a get_file_preview widget context is present, which is a usage instruction rather than a schema limit. get_file_content prefers markdown, falls back to extracted text, and errors while representations are pending. get_download_url links also expire after 60 seconds and are single-use bearer secrets. No live call was made.
- confirmed: Declaring mcp bars public sharing, and host (local) MCP servers such as a local practice-kg server work only in the Claude app and only for the artifact's owner.
  - Correction: No correction needed. One nuance: Claude's own artifact servers (kind 'artifact', e.g. artifacts_data) 'never bar public sharing'. The bar applies to the declared connector manifest. A host server must also be connected with the same name in the viewer's Claude app, and the app may ask the viewer to confirm a call that is not annotated read-only.
- confirmed: The desktop app shows artifacts in an 'artifact' side pane of the session that published them; side panes can be popped out; split view applies to sessions.
  - Correction: No correction needed. show_pane acts only while the session is on screen. A pane already in its own window is left where it is.
- confirmed: Claude Docs support comment threads anchored on quoted words, comments sent to Claude as their own turn, tabs, dropdown enums, image/CSV uploads, org sharing (view/comment/edit) and Export to Word/PDF/Markdown.
  - Correction: No correction needed. Details: a comment anchor is 3-6 exact words. Export covers only the open tab and may be missing for view-only users. Export also offers a copy to Google Docs or Notion. Sharing outside the organization or by public link is available only 'where offered'. Uploads reach the doc through the doc's artifact asset store as blobs.
- partly-wrong: Writing comments and db rows from a page is limited to owner, editors and (Team/Enterprise) non-view-only org members; public-link and email-invited visitors get null for comments.
  - Correction: 'Editors' needs splitting by capability. comments (full form): only the owner, plus org members on a Team/Enterprise-style plan whose sharing level is not view-only. Everyone else gets null from use('comments'), including an email-invited person even at editor level. db: the owner; an email-invited editor (where offered, and only while the artifact is not also shared by public link); and non-view-only org members. Outside viewers never write. Under default rules, writes also require 'interact' (Contributor) level or above, and per-path rules can change that.

## Facet: desktop-builtins

Official docs (code.claude.com, fetched 2026-10-14) show that the Claude desktop app's Code tab already has most of the review surfaces the operator described, all in one window. Several of them are built for code review, though, and the attorney would hit friction with them.

What you get without building anything:
(1) Side chat (Ctrl+; on Windows, or /btw). It asks a question using the session's context without adding to the main conversation. It works in local, SSH and WSL sessions and is not saved to disk.
(2) Split view. Ctrl+click a session in the sidebar to show two sessions side by side.
(3) A drag-and-drop pane layout: chat, diff, browser, terminal, file, plan, tasks and subagent. Panes can be popped out into their own window and docked back.
(4) The Browser pane renders local HTML, PDF, image and video files when you click their path in the chat. The file pane only edits text.
(5) The Browser pane is a tabbed browser you can sign in to (including popup sign-in). It has a "Keep cookies" option but uses a clean profile with none of your saved logins.
(6) Line comments in the diff view, sent in a batch with Ctrl+Enter. They are aimed at code diffs.
(7) Artifacts are published to claude.ai. Org teammates can comment on them, and Claude can read and reply to threads sent to it.
(8) Deep links: claude-cli://open opens a terminal session (not the desktop app) with a pre-filled prompt. claude://code/new opens the desktop app's new-session page, but it is documented only with SSH parameters.
(9) Branching a session is documented for the CLI (/branch, --fork-session). There is no documented fork control in the desktop app.

What is not documented:
- A "Reply" button or a "Start a side chat" action on selected transcript text in the Code tab. A GitHub feature request for Reply in Code Desktop (#70628) was closed as completed on 2026-08-25, and a user-written request (#55772) describes an "Attach selection as context" right-click item in Claude Code on Windows. Neither is in the official docs, so both are UNVERIFIED.
- Whether Box's own web annotations (highlight, comment, draw) work inside the Browser pane. Box documents them for its web app, but no Claude doc says Box works in the pane. UNVERIFIED.
- How a mod's Pane fits into the desktop app's dockable pane system. The mods docs say mod panes, bands and replaced rows draw in the Code tab (Image and Raster are terminal-only; Svg is desktop-only). They do not say whether a mod pane can be dragged, popped out or docked like the built-in panes. UNVERIFIED.

Net assessment: for a non-engineer, a single desktop window can hold the chat, a Browser pane showing the Box file (or the local PDF), and a side chat. That is the "one place" built from existing features. The friction: a dense, code-oriented interface; the Box sign-in has to be done separately in the clean-profile pane; side chats disappear when the app closes; the diff comments are only for code; and there is no documented way to capture a structured verdict without a mod.

**Skeptic verdicts:**
- confirmed: Side chat opens with Ctrl+; on Windows or /btw, reads the main thread, writes nothing back, works in local/SSH/WSL sessions, and is not saved to disk.
- confirmed: The Code tab has draggable, resizable panes (chat, diff, browser, terminal, file, plan, tasks, subagent) that can be popped out into a separate window and docked back.
- confirmed: Two sessions can be viewed side by side with Ctrl+click in the sidebar.
- confirmed: PDF, image, HTML and video paths clicked in chat open in the Browser pane, not the file pane.
- confirmed: The Browser pane allows sign-in (including popup sign-in) and can keep cookies across restarts, but uses a clean profile with none of the user's saved logins.
- confirmed: claude-cli://open opens a terminal window, not the desktop app. Prompts are pre-filled and never sent automatically. The Windows handler lives in HKCU\Software\Classes\claude-cli.
- partly-wrong: The desktop app has its own claude://code/new link, documented only for opening SSH sessions (ssh_host required).
  - Correction: The docs describe claude://code/new as a link that 'opens Desktop's new-session page, and it can name an SSH connection'. ssh_host is required only for an SSH link, not for the link in general. The docs also imply that a link with only a prompt opens the new-session page with that prompt filled in: 'earlier versions ignore the SSH parameters and open the new-session page with only the prompt'. The only section that documents the link is the SSH one, and its full behavior without ssh_host (local folder, other parameters) is not spelled out, so that part remains UNVERIFIED until tested. Desktop fills in the prompt and never sends it.

## Facet: box

Facet: showing Box sources inside the review surface (as of 2026-10-14).

Short answer: the only route that renders Box documents with page fidelity, needs no secret in the page, and sits inside one Claude window is (a) a claude.ai artifact page. It uses the `mcp` runtime capability to call the viewer's own Box connector tool `get_preview_page`, which returns one page as a PNG. The page shows each PNG as an image and adds the `comments` capability (with customAnchors) for pins on the page, plus the `db` capability for verdicts. A full Box viewer embedded in the artifact (UI Elements Preview SDK, or a Box Embed iframe) is blocked or unverified. The page's network is blocked. The Box CDN is not on the artifact script allowlist. UI Elements also need a Box access token in the page.

(c) The desktop app's built-in browser pane can open the Box web app itself. Box's native preview, annotations and comments work there, using a persistent sign-in that belongs to the person. That pane shares one side-panel slot with artifacts and documents, so the Box page and an artifact cannot be shown side by side.

(b) A mod pane gives weak fidelity. The desktop surface has no Image or iframe element; it has only Svg (at most 131,072 characters, drawn as an image) and Link. The terminal surface has an Image element, but only kitty-class terminals draw it.

(d) A Claude Doc can show page images only after Claude copies the bytes into the doc's artifact asset store as blobs. That puts client document content into claude.ai storage, and its comments anchor to words, not to positions on a page.

Annotations cannot round-trip to Box with their positions. Box annotations (point, highlight, draw) exist only in Box's preview layer. No public REST endpoint to read them was found; the event stream records only that an annotation was created or edited. Box file comments can be written through the connector's `create_file_comment` (plain text, at most 1000 characters, attached to the whole file, no page or position). So a review pin in the artifact could be copied to Box as a whole-file comment that quotes the page and location in its text.

On auth, the artifact route and the mod route both call the connector, which runs with the viewer's own credentials, so no token reaches page code. Box download URLs are bearer secrets that last 60 seconds and must never be stored. Box's own embed routes need downscoped tokens or expiring embed links.

The repo's `@beep/box` driver currently gives CCG and developer-token auth, a 28-operation generated surface (getFileById, getFileThumbnailUrl, getDownloadFileUrl, events, webhooks) and a FileFull model with an `expiringEmbedLink` field. It has no comments, downscope, representations or preview operations, and no existing review app renders Box files.

**Skeptic verdicts:**
- confirmed: A Claude Code mod's desktop surface has no Image, Raster or iframe element; only the terminal surface has Image, and it draws pixels only on kitty-class terminals.
  - Correction: Line numbers are close but not exact. The Elements doc comment starts at :3795, the desktop table is at :3824-3835, and the Image props comment is at :5303-5304. Two details are worth stating: desktop does have Svg (vector graphics) and Client (a region drawn by a mod's own surface module). Client modules use ClientElements, which is the terminal table minus Client, Raster and Image (:1403-1409), so no route on desktop draws raster pixels or embeds a frame.
- confirmed: An artifact page can call the viewer's connected MCP tools without ever seeing tokens, and results can include image content blocks.
  - Correction: The type contract confirms this. I did not run the live image-block test (publishing a test artifact and calling get_preview_page), so that the Box connector actually returns an image through the artifact bridge is still UNVERIFIED. The connector's own schema says get_preview_page 'Returns the current preview page as an image' (PNG). Its description also limits use to a file preview context from get_file_preview, which an artifact page may not have.
- confirmed: Artifact pages have their network blocked and may load scripts only from the allowlisted CDNs, which excludes Box's cdn01.boxcdn.net.
  - Correction: Both parts come from the docs. Neither source mentions iframes, so whether an iframe to app.box.com is blocked is UNVERIFIED, and I ran no CSP test. The 'network is blocked' line is in the sample capability's image-option doc, not a general network policy statement.
- confirmed: Box Content Preview needs an access token in the browser, ideally downscoped to base_preview plus annotation scopes; highlight annotations also need item_download.
  - Correction: The item_download requirement for highlights is stated on the Preview guide, not the Annotations guide. The Annotations guide only shows item_download in a sample scenario next to text selection. I did not open the downscope guide itself.
- confirmed: No public Box REST API reads annotation content; only ANNOTATIONV2_* events are exposed.
  - Correction: Two sources agree, but I could not read the cited community post: support.box.com redirects to a Zendesk login. A negative claim cannot be fully proven, so 'none added recently' stays UNVERIFIED beyond the reference index and the repo's generated client.
- confirmed: Box file comments created via the connector are whole-file plain text up to 1000 characters with no page or position anchor.
  - Correction: The 1000-character limit belongs to the connector. The REST page for POST /comments states no message limit. The REST endpoint also accepts tagged_message (@-mentions) and item.type 'comment' (replies), and the connector does not expose either.
- confirmed: The built-in browser pane keeps a persistent profile, so the attorney's Box sign-in persists there, but it shares a single side-panel slot with artifacts and documents.
  - Correction: The skill describes this behavior in general. I did not test it on the attorney's Windows desktop app, so a persisting Box sign-in there is UNVERIFIED. The skill also says the browser keeps working while hidden behind another panel item; the person just cannot see it. Ctrl+Shift+B on Windows brings it back.

## Facet: prior-attempts

Post-mortem of four earlier attorney-review attempts, built from the operator's auto-memory files (cited by filename only, since they are out of repo) and repo packets. No client content was opened.

(A) Box identification spot-check page, v1 then v2, 2026-10-06. It was a private tailnet page with a token in its address and 103 questions, "mostly one tap". It saved answers as he typed, had a notes field, a resume marker, and Box links for the folders he could open. Verdicts went to answers.jsonl, and locked.json marked the end. An agent polled for locked.json and then acted on the answers.
- Outcome: the 88/89-question v3 was never deployed. The operator said "we need to rethink & do a better job ... before we give him another large review", and the target became at most 20 hard cases after the machine had resolved the rest. Memory records that "two review rounds cost the attorney real time".

(B) Practice-kg "sitting" review app, 2026-10-09. A 16-card deck on a tailnet page, each card with inline sources and Copy / Open-in-Claude-Code buttons. The buttons used the claude-cli:// handler, which opens Windows Terminal and shows a one-time "allow handler" prompt in the browser. Answers went to the same answers.jsonl + locked.json store (66 revision rows), and agents pulled the Claude Code transcripts over SSH.
- Before the sitting, the operator caught four problems in the first deck: a chat deep link instead of Claude Code, a Copy button that copied prose, raw tool JSON in the expected answers, and a prompt suffix telling the model to log its work.
- During the sitting it failed outright. The operator's words: "horribly confusing", "verbose, long, confusing & not ergonomic". ChatGPT computer use finished it. The defect register logs this as UX-1 P1, and ruling S15 retired the app.
- What worked: the append-only revisions plus the lock made the tally reproducible, and evidence was collected without bothering him.

(C) Design-figure drawing rounds, 2026-10-06 to 10-14. The draft sheets went out by email. He marked them up in his own tools and sent back flattened annotated PDFs and phone photos; a second email pointed at USPTO Guide pages. Agents had to build intake tooling: a mailbox pull, then matching each page to its sheet by ink coverage, because the PDFs had no /Annots.
- Eight questions sent by email were answered in about 25 minutes, and the answers became "Attorney ruling, relayed" rows in the decision log.
- A later claude.ai Artifact page with a notes box per figure was sent by link. There is no evidence any notes came back (UNVERIFIED).

(D) Docket intake and mail tagging, the in-place pattern. Nothing new to open: tentative Outlook calendar entries carry Docket-* categories and a link to the source email. Low-confidence items go to "Docket - needs review" after an adversarial extractor/critic loop. Re-categorizing an entry to "Docket - verified" is the verdict, and undo keeps it. The attorney's spot-check of the first entries is still an open operator item.

Applications he had to juggle:
- A: browser + Box web.
- B: browser page + Windows Terminal / Claude Code + Box + Claude Desktop. The runsheet's install check ran in Desktop chat, and the PC had two practice-kg servers configured, one in the Desktop extension and one legacy entry.
- C: Outlook + an annotation tool + phone camera, then a claude.ai page.
- D: Outlook only.

ERGONOMIC REQUIREMENTS (grounded):
- R1 One surface. Every failure had several apps or a long deck; the fastest loop (C's email questions, about 25 minutes) used the app he already works in.
- R2 Machine first. Only unresolved items reach him, at most about 20, one question at a time (S15, D8).
- R3 Plain lawyer language, no engineer jargon (10-09 defaults).
- R4 The plain answer first, then only the needed sources with the relevant passage highlighted. Box sources must open for that viewer, with collaboration verified.
- R5 Label "incomplete" separately from "retrieval failure", and examiner rejection separately from applicant response.
- R6 Visible "saved" confirmation, verdicts he can undo or reset, save while typing, and context kept across sessions with a resume point.
- R7 Verdicts are captured where the item lives and flow back as structured, append-only, lockable records. No relaying by email or computer use.
- R8 Prompts sent to the model are exactly the question; operational guidance goes in a CLAUDE.md, never in the prompt.
- R9 Markup must arrive structured: anchored notes, not flattened ink.
- R10 Evidence (transcripts, tool calls) is collected behind the scenes.
- R11 Windows: no protocol-handler prompts, no Windows Terminal hand-off, one MCP config.

ANTI-PATTERNS:
- tailnet pages that need a token,
- 100+ question decks,
- Copy / Open buttons that bounce between apps,
- chat-vs-Code deep-link confusion,
- raw JSON or tool names as sources,
- Box links to folders he is not collaborated on,
- verdicts that only reach the system through operator relay,
- flattened-PDF markup,
- a correction email to fix what the first email left out (C's round-3 mail did not say the tabs were still solid),
- review surfaces that live outside where his work already is.

**Skeptic verdicts:**
- confirmed: The practice-kg sitting review app could not be completed with the attorney; ChatGPT computer use finished the last part, and ruling S15 retired the app and made attorney evaluations agent-run, with only unresolved items going to him.
  - Correction: Minor precision: the record says the operator (not the attorney alone) could not finish the flow with the attorney, and ChatGPT computer use completed the later portion 'for the operator' after independent source reads. The record calls these 'assisted assessments', not 16 unassisted attorney evaluations. S15 was issued 2026-10-10 about the 2026-10-09 sitting.
- partly-wrong: The operator described the sitting flow as 'horribly confusing', 'very clunky bad user interface', and 'too verbose, long, confusing & not ergonomic'.
  - Correction: The verbatim quote is 'Very clunky bad user interface' and '...because it was to verbose, long, confusing & not ergonomic to complete' (the source spells it 'to', not 'too'). The quote also says the flow was horribly confusing to the attorney (a family member, so do not name him) and that the work should be automated and done by agents.
- confirmed: S15 sets the bar for any remaining attorney-facing step: one question at a time, the plain answer first, only the needed sources with the passage highlighted, rejection vs response and incomplete vs retrieval failure labelled separately, visible saved confirmation, optional details for noise, and context kept across sessions.
  - Correction: Nothing to correct. The memory amendment adds that the 16-card deck with inline sources and Copy/Open buttons failed this bar even after the 10-09 defaults: it was too long, too verbose, and the relevance of its sources was unclear.
- confirmed: Large questionnaires are rejected: the 88-question second questionnaire was not deployed; the target is at most 20 hard cases after machine resolution.
  - Correction: Nothing to correct. D16 adds that the second questionnaire then ran only as a 20-question loopback preview for the operator, not for the attorney. Operator reason (D8): rethink identification and organisation 'before we give him another large review to do'.
- partly-wrong: Email Q&A in the attorney's own mail client got answers about 25 minutes after the questions were sent (drawings round 1).
  - Correction: The timing is right: the questions went out about 01:44Z on 2026-10-14 and the answer came at 02:09Z, about 25 minutes later. They were the round-1 questions. The cited SPEC line does not say email, though. Mail is established by research/SOURCES.md:18, which describes the attorney's reply in the same subject thread from the mailbox, and by SPEC.md:9 and :103 (Outlook). No source says it was 'the attorney's own mail client', so that wording is UNVERIFIED.
- partly-wrong: The attorney's drawing markup came back as flattened PDFs with no annotation objects, so agents needed custom intake and ink-coverage sheet matching.
  - Correction: Flattening (no /Annots) motivates only T2, the ink-coverage page-to-sheet matching that refuses a page without a unique match. T1 (`beep drawings intake`) exists to pull Outlook message attachments into the corpus root with sha256 records and to replace a throwaway script; it is not a consequence of flattening. Both T1 and T2 are unchecked acceptance criteria, meaning planned tooling, not shipped tooling.
- confirmed: The first sitting deck shipped a chat deep link instead of Claude Code, a Copy button that copied prose, raw tool JSON, and a prompt suffix that told the model to log its work.
  - Correction: Nothing to correct. The source says the raw tool JSON was 'in the expected answers'. It also says the operator caught all four problems while reviewing. 'Instead of Claude Code' fits the memory's default, which calls for a `claude-cli://open` Claude Code link (MEMORY.md index line for this file).

## Facet: landscape

External landscape (web sources, 2026-10-14). The products that make lawyer review easy share three habits. (1) They put review inside the app the lawyer already uses, mostly Word: Harvey for Word, Spellbook, Legora, Lexis Create+, Microsoft Copilot in Word, DeepIP, and Anthropic's own Claude for Word. (2) Every AI claim links to a passage in the source, and clicking the link scrolls to and highlights that passage beside the answer (Harvey, CoCounsel, Adobe Acrobat, Box AI's hover excerpt, Relativity aiR citations). (3) The AI's proposal is kept apart from the lawyer's decision. The proposal arrives as tracked changes, a predicted field, or a cell to verify, and the lawyer accepts it, rejects it, or marks it verified (Spellbook approve/bulk-approve, Harvey 'verify' on review cells, Relativity aiR's separate prediction fields that humans then copy to coding fields, Claude for Word tracked changes plus comment-thread replies).

For grid-shaped work (many documents × many questions) the pattern is a review table with source footnotes on each cell and cells that can be edited or verified in place (Harvey Vault Review, CoCounsel tabular review, Legora Tabular Review).

For annotation, Hypothesis/W3C Web Annotation is the reference model: highlights anchored by quote plus prefix/suffix with position fallbacks, page notes, threaded replies, and a sidebar. Box Preview already offers native highlight, comment, and drawing annotations as an overlay that is not written into the file.

Evidence on adoption friction is thin and mostly commentary. Harvey cites 'a study' that 90% of legal professionals use Word every day. LexisNexis blogs repeat the UC Irvine figure of 23 min 15 s to resume an interrupted task. A 2026 ABA Experience article advises lawyers to use fewer tools. I found no quantified survey of lawyers on tool count.

Most transferable to a Claude-native workspace: (a) one surface with the source on one side and AI output on the other, with click-to-highlight citations; (b) highlight-to-ask, scoped to the selection; (c) AI proposals as reviewable deltas with one-click accept/reject/verify, and verdicts stored apart from the AI output; (d) a review-table/queue view for batch work; (e) comment threads the AI answers in place; (f) verdicts written back into a store the firm already uses (Box comments or metadata) rather than a new app.

A notable option for this practice: Claude for Word is now GA on paid Claude plans per claude.com/claude-for-word. It puts tracked changes, comment-thread replies, skills, and connectors inside Word, the patent attorney's home tool. It is a candidate surface alongside the Claude Code mod pane. Whether it can reach the firm's MCP server or Box is UNVERIFIED.

**Skeptic verdicts:**
- partly-wrong: Most legal AI vendors bring review into Microsoft Word as a sidebar add-in rather than asking lawyers to move to a new app, and Harvey cites a study that 90% of legal professionals use Word daily.
  - Correction: The 90% figure is confirmed: Harvey says a study found 90% of legal professionals use Word every day, and links the word 'study' without naming it. The 'sidebar add-in' pattern holds for only some of the cited vendors. Harvey's page describes a Word Add-In with Ask and Edit modes but never says sidebar or pane. Spellbook says it adds redlines 'right in Microsoft Word' but doesn't say add-in or sidebar. The cited LexisNexis release never mentions 'Lexis Create+'. It describes Lexis+ with Protege producing Word, Excel and PowerPoint outputs, not running inside Word. Of the cited sources, only Claude for Word describes a sidebar. 'Most legal AI vendors' is therefore an inference from a few vendors, not something any source states.
- confirmed: Claude for Word/Excel/PowerPoint is generally available on all paid Claude plans (Outlook in beta). Claude for Word edits with native tracked changes, replies in comment threads, uses saved skills and connectors, and nothing is saved until the user approves.
  - Correction: Small scope nuance: the page says 'Nothing goes out or gets saved until you say so' about the Microsoft 365 apps as a whole, not specifically about Word. The launch coverage dated 2026-04-13 does describe 'a beta add-in for Claude Team and Enterprise plans'. Whether the firm MCP server or a Box connector can be reached from the Word sidebar remains UNVERIFIED.
- partly-wrong: A common verdict-capture pattern keeps AI output in separate fields from the human decision: Relativity aiR never writes to coding fields, and Harvey cells are explicitly 'verified'.
  - Correction: The Relativity part is confirmed: aiR 'does not actually write to these fields. It is not coding the documents or writing to the coding fields', and this 'makes it easier to compare aiR's predictions to human coding'. The Harvey part is overstated. The July 2025 Brief only says users can 'Edit, verify, and track changes to individual Vault Review cells directly in Harvey'. Verification is an action users can take on a cell. Nothing says cells are explicitly marked 'verified' or that AI output is kept in a field separate from the human decision.
- partly-wrong: Citations that click through to a highlighted source passage are a baseline expectation: Harvey, Adobe, CoCounsel, Box AI (hover excerpt), Relativity (cited passage existence check).
  - Correction: None of the cited sources that could be reached describe clicking through to a highlighted passage. Box AI: you hover over the citation numbers and 'A small window shows the source text from the document' (an excerpt popup, not a highlighted passage). CoCounsel (thomsonreuters.in): 'source citations side-by-side' and 'links to trusted Westlaw authority', with no mention of highlighting in the source. Relativity aiR 'checks all citations against the prompt text', scores citations it cannot find as -1 errors, and recommends manual review. That is an existence check, not click-through. Harvey and Adobe remain UNVERIFIED: Harvey help is login-gated and Adobe returned 403. 'Baseline expectation' is an inference no source states.
- partly-wrong: Robust passage anchoring is a solved pattern: W3C Web Annotation TextQuoteSelector (exact text plus prefix/suffix) combined with position and XPath selectors and fuzzy re-anchoring, as used by Hypothesis.
  - Correction: The W3C Recommendation confirms the selectors: TextQuoteSelector (exact, prefix, suffix), TextPositionSelector, XPathSelector, multiple selectors on one Specific Resource, refinedBy and RangeSelector. The spec itself does not define fuzzy matching, at least in the first 100,000 characters read. The cited Udell post confirms that Hypothesis uses TextQuoteSelector plus TextPositionSelector. It does not mention XPath, RangeSelector or fuzzy re-anchoring. annotator.apache.org/docs now redirects to the Apache Incubator project page and gives no docs. So 'XPath plus fuzzy re-anchoring as used by Hypothesis' is UNVERIFIED from the cited sources, and 'solved' is an editorial judgement.
- partly-wrong: The Box connector exposes an in-chat file preview widget that feeds the current page to the model, plus file-level comments of up to 1000 characters with no anchor field.
  - Correction: The widget does not send the page itself to the model. It 'sends file preview context (fileId, fileName, currentPage) into the conversation'. The model then has to call get_preview_page(fileId, page) to get the page as a PNG: 'You cannot see the page content until you call this tool.' The comment part is confirmed: create_file_comment takes only file_id (pattern ^\d+$) and message (minLength 1, maxLength 1000), with no page, region or anchor field. Whether the widget renders in the Desktop Code tab is still UNVERIFIED.
- confirmed: Box Preview natively supports highlight, comment and drawing annotations as an overlay that is not embedded in the file.
  - Correction: Details to add: freehand drawing is available on iOS and the Box Web app. The developer guide lists four types: highlight comment, highlight only, draw, and point (point is the only type that also works on images). Permission limits: users with the Uploader, Previewer or Previewer Uploader role can't use Highlight and Comment. 'Disable commenting on this folder' blocks annotations. Users can edit only their own annotations, and only folder owners, co-owners or the comment's creator can delete one.

