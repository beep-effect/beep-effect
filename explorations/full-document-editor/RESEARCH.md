# Research

## 2026-08-04 — External and upstream landscape

The explicit behavior reference is
[Lexical Playground](https://playground.lexical.dev/). A live Chrome audit
captured 17 screenshots and distinguished observed, exercised, inferred, and
unverified behavior. It covers the toolbar, keybindings, semantic highlight,
selection UI, page setup, inserts, slash commands, feature gates, import/export
controls, accessibility observations, and remaining parity gaps. See
[`LEXICAL-PLAYGROUND-LIVE-AUDIT.md`](./research/LEXICAL-PLAYGROUND-LIVE-AUDIT.md).

The explicit source reference is Meta's
[Lexical repository](https://github.com/facebook/lexical), locally pinned at
commit `a933222c489e7025d87b9217c2489d309fc8a3cf` and package version `0.49.0`.
Its MIT license permits porting with attribution. The source audit found 38
root-registered node classes and at least 41 effective rich-text nodes, with no
unexplained top-level feature registration. See
[`LEXICAL-PLAYGROUND-SOURCE-AUDIT.md`](./research/LEXICAL-PLAYGROUND-SOURCE-AUDIT.md).

The upstream app mixes product-eligible editing capabilities with diagnostics,
demo fixtures, browser/service integrations, and experimental collaboration.
Parity therefore requires explicit classification rather than wholesale source
copying.

The two audits are reconciled into a navigable node/surface ledger in
[`CAPABILITY-REFERENCE.md`](./research/CAPABILITY-REFERENCE.md). It is the
human-readable research snapshot; Goal A owns the machine-validated atlas and
zero-omission verifier.

## 2026-08-04 — In-repo capability inventory

- `@beep/md` (`packages/foundation/modeling/md`) is the canonical schema-owned
  document model and safe rendering substrate. **Extend.**
- `@beep/lexical-schema` (`packages/foundation/modeling/lexical`) owns strict
  and lossless Lexical wire admission plus Md codecs, with zero runtime Lexical
  imports. **Extend only in Goal B batches; inventory-only in Goal A.**
- `@beep/editor` (`packages/foundation/ui-system/editor`) is the React/Lexical
  projection. It currently has fixed `editorNodes` and a chat-specific boolean
  `ComposerFeatures` model, not a general capability registry. **Extend.**
- `@beep/ui` owns the editor theme and content-editable primitives. **Reuse.**
- `apps/professional-desktop` already hosts a registry-keyed dock workspace and
  uses `@beep/editor` for chat/viewer surfaces, but has no general document
  editor panel. **Extend with a synthetic proof panel in Goal A.**
- `@beep/pandoc-ast` is a pure Pandoc JSON model and compatibility mapper. It is
  not an executable Pandoc/DOCX driver. **Reuse later.**
- Prose-to-Proof (`docs/product/prose-to-proof.md` and companion vision/map)
  requires exact-source-span highlighting, artifact-ref hover cards,
  candidate review, and approval. These are Portal product semantics, not
  ordinary text formatting. **Later product goal.**
- `@beep/provenance` already defines source-anchor substrate; comment/review
  lifecycles and owning artifact revisions remain product-slice work. **Reuse.**

Live source and package barrels were used for discovery. The retired
`standards/repo-exports.catalog.*` surface was not used.

## 2026-08-04 — Constraints discovered

1. Current Lexical-to-Md conversion drops or degrades several Playground
   semantics, including underline, highlight, casing, sub/superscript, inline
   style, alignment, indentation, images, math, and other structured nodes.
2. Capability configuration must control authoring without making supported
   existing content unreadable or lossy.
3. Semantic highlight, arbitrary background color, comments, evidence spans,
   search matches, collaboration selections, and retained selections are
   different concepts.
4. Page setup is canonical export-relevant metadata; zoom and workspace chrome
   are view state.
5. Collaboration changes authority, history, identity, comments, transport,
   and versioning and must follow the single-user local-first proof.
6. Remote media and embeds must remain network-inert until explicitly
   authorized.
7. Diagnostics are atlas-visible but development-only.
8. Accessibility, responsive alternatives, and recorded browser QA are
   completion gates.
9. The first goal must stop at the complete atlas, ratified capability/profile
   contract, and a small synthetic dock-panel proof. Full parity is Goal B.
