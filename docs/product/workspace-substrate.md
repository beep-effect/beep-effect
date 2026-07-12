# The Workspace Substrate — Product Vision

> **The workspace is data.**
> Blocks are the content substrate. Docks are the spatial substrate. Both are schema.
> A workspace is therefore a value — and a value is something an agent can operate.

- **Status:** Vision (canon) · **System name:** the dock kernel · **Intended packages:** `@beep/dock`, `@beep/dock-react`
- **Product target:** `apps/professional-desktop` first; any beep app with panels after
- **Companion docs:** [Prose-to-Proof Vision](../PROSE_TO_PROOF_VISION.md) · [Prose-to-Proof PRD](./prose-to-proof.md) · [Dock kernel README](../../scratchpad/dockview/README.md) · [Living ledger (WHAT-IS-LEFT)](../../scratchpad/dockview/WHAT-IS-LEFT.md) · [Computable-geometry exploration](../../explorations/computable-workspace-geometry/README.md)

---

## 1. The one sentence

Every surface in a beep application — its rich content (**blocks**) and its spatial arrangement (**docks**) — is a schema-encoded value, so a complete workspace can be persisted, restored, diffed, and composed like any other data; and because layout changes are a typed command algebra, an agent can arrange your workspace through exactly the same kernel your mouse compiles gestures into.

## 2. Why: the pre-IDE professional

Developers learned this lesson decades ago. Before the IDE, programming meant shuttling between an editor, a compiler, a debugger, and a terminal, carrying the state of each in your head. The IDE won because it collapsed the shuttle: one surface, one working set, one attention span.

In the last year, agents collapsed the *rest* of it. Claude Desktop, T3 Code, and Codex Desktop are no longer chat windows — each has simultaneously become a design canvas, a browser, a place to search your email, a code reviewer, a test runner, a collaboration surface for artifacts, and your terminal. A year ago, baking all of that into a single application sounded absurd. As agents envelop the working day it becomes obvious, because the binding constraint was never screen space — it is **context-switching**, and the tax compounds when you are parallel-managing nine agents on whatever headroom your own working memory has left. The unified surface saves headspace, and headspace is the scarce resource.

Now look outside software. An IP attorney runs a practice across Word, Excel, AutoCAD, Outlook, NetDocuments, and SharePoint — carrying the state of each in his head. Every other profession is still **pre-IDE**. The consolidation that agents just delivered to developers is coming for all of them, and the professional desktop is our vehicle for it.

## 3. The thesis: workspace as data

Two substrates make up a workspace, and in this codebase both are already, or are becoming, schema:

- **Content: blocks.** [`@beep/md`](../../packages/foundation/modeling/md) and [`@beep/lexical-schema`](../../packages/foundation/modeling/lexical) model rich documents as typed, serializable trees — Notion-like blocks where the file is canonical and the editor is a projection.
- **Space: docks.** The dock kernel models the spatial arrangement — tab groups, splits, floating panes, maximize — as a schema-decoded tree with invalid states removed by construction: a split always has exactly two children, a group is a non-empty zipper, ratios are exact basis points that cannot drift.

The consequence is the thesis. When both substrates are schema, a workspace stops being an accident of what happens to be mounted in the DOM and becomes a **value**: persistable (a versioned `DockSnapshot` envelope), restorable (decode, validate, install), diffable and versionable (it is just data), and composable (a working set is a value you can name, save, and hand to someone — or something — else).

This is the same philosophy that produced `@beep/md` and `@beep/lexical-schema`, extended to the last unserialized dimension of the application: where things are.

## 4. Agents operate the workspace

Here is the commitment, stated plainly: **agents are first-class workspace operators.** Not a future consequence — a design requirement.

The dock kernel's mutation surface is a typed command algebra — open, activate, move panel, move group, update, close, resize, float, dock, maximize, restore — where every command produces either a changed state with semantic events or an explicit typed no-op reason, and every completion (success *and* typed failure) lands in a lossless, in-order outcome feed. That is not merely a nice reducer. It is, structurally, **an agent tool surface**: schema-decoded input, typed results, honest failure channel, replayable history.

Mouse gestures and agents are two clients of one kernel. The pointer adapter compiles a drag into the same `DockCommand` an agent would submit. Nothing the human can do spatially is invisible to the agent, and nothing the agent does is outside what the human could have done. Concretely:

- *"Put the office action and my draft response side by side"* — the agent opens both panels and issues one split placement.
- *"Set me up for drafting"* — the agent restores a named snapshot: correspondence left, document center, deadlines floating.
- *"Show me what you changed"* — the agent finishes a task and composes the review layout itself: diff panel, test output, the artifact.

A DOM-first layout library cannot make this promise, because its state lives in the DOM and its serialization is an afterthought blob. Ours can, because the DOM is a projection of dock state — never the source of it.

**Sight: computable geometry.** Operating the workspace is half the claim; the other half is *seeing* it. One fact kept the DOM a layout oracle rather than a pure projection target: text height could not be known without asking the browser. That fact is now dead — [pretext](https://github.com/chenglou/pretext) proves text layout reduces to pure arithmetic over once-measured, cacheable font metrics (7,680/7,680 exact against Chrome, Safari, and Firefox; ~300–600× faster than DOM measurement). Composed with this substrate, the consequence is that the workspace's **rendered geometry becomes data too**: workspace value + container box + font-metric cache → every panel box, every block height, every line break, computed headlessly. An agent can answer "will this title truncate?", "how tall is this thread?", "what split fits both panels?" *before* issuing a command — no browser, no screenshot; and the same purity turns whole classes of layout bugs into unit-testable arithmetic. The metrics cache is per-engine and itself a serializable value — measured once in the user's actual browser, shippable to agents, tests, and servers — which is the honest kind of sight, since "what does the user see" was always a per-engine question. Groundwork, costs, and open questions live in the [computable-workspace-geometry exploration](../../explorations/computable-workspace-geometry/README.md).

## 5. The dock kernel

**What exists.** The kernel is real and proven in [`scratchpad/dockview`](../../scratchpad/dockview) + [`scratchpad/dockview-react`](../../scratchpad/dockview-react): the schema-first domain algebra with constructor defaults and global identity invariants; a transactional reducer (validate → evaluate → validate → publish exactly once); a versioned snapshot envelope; the full Tier-1 command algebra including whole-group moves and cross-group placement; geometry as a pure derived projection with exact-partition rounding; hidden groups and maximize with dockview-parity auto-exit rules; floating groups as first-class topology; a replaceable-policy engine layer (proven, not claimed, via `lockedGroupsPolicy`); the lossless outcome feed; and a hook-free React adapter with a kernel-owned renderer registry, DOM keep-alive panel portals, and a full gesture compiler. Roughly eighty tests across both modules are green.

**Why not dockview-the-library.** [Dockview](https://dockview.dev) is the acknowledged inspiration — it more or less *is* the look, feel, and interaction grammar we want, and its source is cloned locally for study. But adopting it would dig exactly the hole this document exists to prevent. A workspace agents operate must be schema **all the way down**: typed commands in, typed outcomes out, state decodable and encodable at every boundary. Dockview is a DOM-first class hierarchy whose serialized format is a JSON blob shaped by implementation history; retrofitting an effect-native, schema-decoded command surface onto it means wrapping every mutation path and re-deriving every invariant we would rather own. We rebuilt the kernel for the same reason we built `@beep/md` instead of adopting an AST library and `@beep/lexical-schema` instead of trusting editor state: **schema is truth, and behavior precipitates from it.** The kernel's recursive knot even follows the `@beep/md` pattern directly.

**The costs, honestly — and audited.** A vision doc that hides its costs is sales copy; one that inflates them is false modesty. The divergences from dockview are written down ([Divergences and their costs](../../scratchpad/dockview/README.md#divergences-and-their-costs)), and an audit ([exploration packet](../../explorations/computable-workspace-geometry/RESEARCH.md)) sorts them into four classes. Most are **not costs but better semantics owed no apology**: proportional hidden-group ratios restore exactly with zero cached state where dockview needs `cachedVisibleSize`; publish-once event timing is what a projection architecture gets *instead of* will/did event pairs, which exist only because DOM and state mutation interleave; whole-record parameter replacement and non-empty-by-construction groups remove representable invalid states. A second class is **fidelity deltas eliminable at the host layer** — MRU activation is a feed-consumer policy (the lossless feed *is* a recency log), global focus is a host envelope. A third is **unwritten pure math**: the `[1000, 9000]` ratio bound conflates proportion with pixel constraints; min/max-px clamps belong in the pure geometry projection, and content-aware minimums become pure solver inputs once text metrics are data (see §4). The honest residue — real costs every dock system pays, ours least — is three items: browser-oracle maintenance (which moves into a committed, regression-swept ledger rather than vanishing), a11y (live regions, keyboard docking — real projection-layer work), and popout state loss for *foreign* DOM (iframes/webviews); for blocks-native panels, popout is lossless re-projection by construction. Remaining capability gaps (tab overflow, drop indicators, context menus, undo/redo consumers) are effort, not architecture. [`WHAT-IS-LEFT.md`](../../scratchpad/dockview/WHAT-IS-LEFT.md) is the living ledger; when it and this document disagree, the ledger wins.

## 6. Binding guardrails (interim law)

The kernel has not landed as a package yet, and surfaces are being built *today*. "Prepare for the future" is a mood; these four rules are law. Every new surface built between now and the dock shell:

1. **Is a panel candidate.** It fills whatever box it is given, never claims the viewport (`h-screen` is the shell's word, not yours), owns scrolling exactly once, and assumes nothing about siblings or "the one main content area." A surface that violates this cannot be docked, floated, or split without a rewrite.
2. **Has serializable state.** Its essential state — which entity it shows, its mode, its parameters — round-trips through `S.encode`/`S.decode`. The future `DockSnapshot` persists panel parameters; a surface whose state lives only in closures and refs cannot be restored, which means it cannot participate in named working sets. If it can't round-trip, it isn't done.
3. **Is registry-keyed.** Surfaces are addressed by a registered view key (name → renderer), not imported and mounted ad-hoc. The dock adapter already works exactly this way; a surface registered by key migrates by re-registration, one registered ad-hoc migrates by rewrite.
4. **Renders rich content as blocks.** Where a surface renders documents, threads, or structured prose, it goes through `@beep/md` / `@beep/lexical-schema` rather than ad-hoc JSX. *Carve-out:* utility surfaces — settings panes, pickers, status chrome — need no block or AST machinery; the rule binds content, not controls.

None of these require new tooling. All four are enforceable in code review today.

## 7. The bridge

The current shell — split sidebar, main content — will not house this vision, and this document is partly a reply to a concrete fork: harden that shell's layout contract, or clean-room a new one?

**Harden now. The bricks are the migration.** The contract work — `AppShell` owns the viewport, a `Pane` fills what it is given and never asks for `h-screen`, exactly one `Scroller` per surface, `min-h-0`/`min-w-0` baked into the primitives instead of remembered — is not throwaway pre-dock scaffolding. It is guardrail #1 made structural. A dock panel's *content* needs exactly those invariants; the dock shell replaces the application's **spatial layer**, not the pane discipline inside each panel. Every surface hardened against the pane contract today is a surface that ports into the dock shell by re-registration tomorrow. Improvisation, not the old shell, is what the recent layout bugs were made of — and the contract is the end of improvisation.

**Sequencing principle** (status and priority truth live in [ROADMAP](../ROADMAP.md) and `goals/`, not here): the kernel API matures in the scratchpad until it is satisfying to use → it lands as `@beep/dock` + `@beep/dock-react` → the shell revamp puts the dock workspace at the root → existing surfaces migrate one at a time, behind the tests they already have.

## 8. The Portal

"Portal" is already a load-bearing word in this repo's canon. [Prose-to-Proof](../PROSE_TO_PROOF_VISION.md) — the vision for a solo IP attorney's practice — holds as its third principle that **the editor is a portal**: every document is a doorway into a subgraph, provenance one hover away. Its MVP is literally named the *document portal*.

This document extends that principle by one level: **the workspace is the portal into the practice.** Prose-to-Proof describes one application with four faces — document portal, document management, knowledge graph, ask-and-check — all over the same graph. The dock workspace is precisely the substrate that lets one application *be* four faces at once: each face a panel, each panel schema-backed, the arrangement itself a saved, restorable value. And because agents operate the workspace (§4), the agent that proposes claims and drafts inside Prose-to-Proof can also *set the table* — open the office action beside the draft response, float the docket, restore "drafting" when Tom sits down — the way Claude Code operates across a developer's files, terminal, and browser.

That is what "give my dad a Portal" means, concretely: Anthropic and OpenAI gave developers a unified agent-operated workspace and it changed what one developer can carry. The Portal is [that same gift delivered to the solo professional](../PROSE_TO_PROOF_FOR_TOM.md) — the pre-IDE attorney of §2, who happens to be the first user, the corpus source, and the standard of quality. Prose-to-Proof says what the workbench *knows*; this substrate is how the workbench is *inhabited*.

## 9. What this is not

- **Not a general window manager.** The dock kernel models an application workspace, not an OS shell; popout-window lifecycle is an open ledger item, not a promise.
- **Not a rewrite mandate.** Existing surfaces are governed by the guardrails (§6) and migrated deliberately (§7) — this document licenses no demolition.
- **Not dockview-compatible.** Compatibility with dockview's serialized payloads is an explicit non-goal; the inspiration is interaction grammar, not format.
- **Not finished.** The ledger is open and the costs section is load-bearing. When the prose here outruns [`WHAT-IS-LEFT.md`](../../scratchpad/dockview/WHAT-IS-LEFT.md), trust the ledger.

---

*Blocks for content · docks for space · both are schema · the workspace is a value · gestures and agents are two clients of one kernel · the workspace is the portal into the practice.*
