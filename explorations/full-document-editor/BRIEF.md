# Brief

## Problem

`@beep/editor` proves a narrow schema-first Lexical pipeline for chat and
viewer use, but the eventual Professional Desktop Portal needs a configurable,
full-document authoring substrate. “Clone Lexical Playground” is useful as a
completeness bar, yet the Playground is a demo monolith mixing production
features, diagnostics, experimental collaboration, external embeds, raw
Lexical persistence, and behavior that the current canonical `@beep/md` model
cannot represent losslessly.

Without a capability atlas and a ratified configuration contract, adding
features one-by-one will miss secondary activation paths, silently lose content
through codecs, entangle product semantics with foundation UI, and produce an
editor whose toolbars, shortcuts, importers, and registered nodes disagree.

## Appetite

The first bet is one bounded goal packet: finish a versioned screenshot/source
atlas, ratify and minimally prove the schema-backed capability/profile
mechanism, and mount a synthetic dock-compatible editor panel. It does not
implement full Playground parity or any product persistence.

Full single-user parity is a second goal implemented in deliberate semantic
batches. Collaboration, redlining, DOCX execution, authoritative PDF export,
the Prose-to-Proof Portal, and product-specific authoring lifecycles follow as
separate goals.

## Solution Sketch

1. **Capability atlas.** Give every visible and source-registered feature a
   stable ID, upstream evidence, activation paths, dependencies, node/mark
   ownership, commands/keybindings, interchange behavior, read-only fallback,
   accessibility expectations, profile eligibility, and disposition.
2. **Compatibility matrix.** Map every capability across canonical `@beep/md`,
   strict/lossless Lexical wire, Markdown, HTML, raw Lexical JSON, and future
   Pandoc/DOCX/PDF targets. Loss is data, never a log line or surprise.
3. **Capability contract.** `@beep/editor` owns schema-backed descriptors and a
   resolver. Profiles compose capabilities; product profiles remain app/slice
   owned. Profiles are mount-immutable and reject dependencies/conflicts before
   mount. Disabled authoring never invalidates supported existing content.
4. **One command source.** Commands, platform keybindings, activation paths,
   and generated shortcut help share the resolved registry.
5. **Representative proof.** Mount a registry-keyed, box-filling synthetic
   editor panel in Professional Desktop using only already-supported semantics.
   Prove minimal versus document-proof configuration without adding new
   `@beep/md` nodes or persistence.
6. **Evidence loop.** Use Storybook/unit/type proof plus the recorded browser QA
   loop. Accessibility and narrow/touch alternatives are acceptance criteria.

The canonical content model stays `@beep/md`. Lexical and Pandoc remain
projections. Product slices own identity, revisions, autosave, approval, and
publication around shared document values.

## Rabbit Holes

- Treating toolbar visibility as feature disablement while shortcuts, slash
  items, importers, or nodes remain active.
- Extending `@beep/md` before the capability/format matrix proves the semantic
  need and target behavior.
- Collapsing authored highlight, background color, comments, evidence spans,
  search matches, and collaboration selections.
- Copying raw Lexical JSON or URL-compressed private content as authority.
- Allowing remote embeds to cause network egress on document open.
- Letting the capability registry become a giant product-mode registry.
- Treating Playground demo limits, bundled media, analytics, debug trees, and
  experimental collaboration as production defaults.
- Confusing comments with tracked changes, or `@beep/pandoc-ast` with an
  executable DOCX converter.
- Preserving desktop-only hover/drag controls without accessible alternatives.

## No-Gos

- No vendored Playground monolith or pixel-perfect clone.
- No full feature-parity implementation in Goal A.
- No new canonical `@beep/md` or `@beep/lexical-schema` semantics in Goal A.
- No production persistence, autosave, revisions, sharing, or real documents.
- No real-time collaboration/Yjs.
- No formal redlining/tracked changes.
- No executable DOCX or authoritative PDF pipeline.
- No Prose-to-Proof evidence/approval workflow.
- No patent, email, prompt, or skill product lifecycle.
- No user-authored executable editor plugins.
- No commit, push, or PR as part of exploration/packet authorship unless
  separately requested.
