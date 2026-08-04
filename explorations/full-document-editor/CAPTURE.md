# Capture

<!-- Append-only raw intake. New material belongs under a new dated heading. -->

## 2026-08-04

Source initiative:
[Full Doc Editor in @beep/professional-desktop](https://app.notion.com/p/3b269573788d8096b876ed2ad31d151d).

> I want to implement a fully fledged document editor page inside
> `@beep/professional-desktop`. To start I want to clone Lexical Playground,
> including all features, nodes and extensions. The goal with cloning the
> playground is to establish a baseline that we can then make improvements
> from.

The first need is meticulous documentation of the live
<https://playground.lexical.dev/> page: screenshots, keybindings, text
highlighting, blocks, nodes, settings, and interactions, cross-checked against
the local source at
`/home/elpresidank/YeeBois/dev/text_editor_ui/lexical/packages/lexical-playground/`.

The resulting substrate should extend `@beep/editor`, make feature availability
configurable, and later support Professional Desktop authoring surfaces for
skills, prompts, patent templates, email templates, and other documents. It
must compose with the existing Pandoc/DOCX work and the Prose-to-Proof editor-as-
Portal vision.
