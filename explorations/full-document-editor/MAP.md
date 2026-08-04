# Map

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `lexical-playground-capability-atlas` | Version the complete Playground atlas, implement the minimal capability/profile resolver, and prove it in a synthetic dock panel. | none | `@beep/editor`, `@beep/md`, `@beep/lexical-schema`, `@beep/ui`, Professional Desktop dock |
| `configurable-full-document-editor` | Implement every production-eligible single-user Playground document semantic, authoring mechanic, and projection in semantic batches behind the ratified registry. | `lexical-playground-capability-atlas` | prior row plus deliberate `@beep/md`/Lexical codec extensions; product sidecars remain slice-owned |
| `document-annotation-substrate` | Add revision-anchored comments/threads, anchor rebasing, orphan handling, and annotated-output policy around owning-slice document revisions. | configurable editor plus owning-slice document authority | `@beep/provenance`; NET-NEW annotation records and revision contracts |
| `editor-collaboration` | Add remote identity/presence, Yjs transport, and offline reconciliation as projections over existing document and annotation authority. | configurable editor, owning-slice document authority, and `document-annotation-substrate` | NET-NEW collaboration policy/adapter; upstream Yjs reference |
| `document-redlining` | Add revision-aware tracked insertions/deletions with accept/reject and export semantics. | configurable editor, document commands, revisioned artifacts | `@beep/md`, annotation/provenance substrate; NET-NEW redline model |
| `pandoc-docx-driver` | Add executable Pandoc/DOCX import/export with generated provenance fixtures and compatibility proof. | configurable editor and approved rich document schema | `@beep/pandoc-ast`; NET-NEW Pandoc driver/sidecar |
| `document-pdf-export` | Produce deterministic PDFs with fonts, assets, pagination, metadata, and reproducibility. | canonical presentation metadata and paginated editor proof | `@beep/md`; NET-NEW deterministic export adapter |
| `prose-to-proof-portal` | Compose document authoring with evidence spans, artifact refs, candidate review, approval, and matter walls. | configurable editor plus relevant runtime/epistemic goals | `@beep/provenance`, `@beep/editor`, epistemic/workspace slices |
| `professional-authoring-products` | Add slice-owned skill, prompt, patent, and email template lifecycles over shared editor profiles. | configurable editor and owning slice contracts | `@beep/md`, agents/documents/law-practice/communication slices |

## Sequencing

1. Graduate and execute `lexical-playground-capability-atlas` first. The atlas
   and resolver contract prevent completeness and ownership drift.
2. Implement `configurable-full-document-editor` in semantic batches, keeping
   all production-eligible single-user capabilities in the completion bar.
3. Land owning-slice document authority and the annotation substrate before
   collaboration or formal review. Collaboration transports/projects comments;
   it does not define their canonical model.
4. Run DOCX/PDF work only after canonical rich-document semantics and page
   presentation are stable.
5. Compose Portal and product authoring goals as consumers; do not push their
   meaning down into foundation UI.

## First Vertical Slice

A developer opens a new registry-keyed synthetic document panel in Professional
Desktop. The panel fills its dock box and uses a resolved schema-backed profile
over only already-supported editor semantics. A minimal profile and a broader
document-proof profile expose different authoring commands while the same
supported canonical content remains readable. Invalid dependencies or
keybinding collisions fail before mount. The shortcut help is generated from
the resolved command set. Recorded browser QA proves keyboard, pointer,
responsive, and accessibility behavior.

The same goal delivers a versioned atlas covering all live/source features,
including every node, setting, command, keybinding, transformer, import/export
surface, and explicit deferred classification.

## Open Risks Inherited From The Brief

- Capability identity and dependency design must remain small enough to avoid a
  new framework while still covering every activation path.
- Profile remounts may not preserve Lexical-local history; canonical content
  preservation is the required guarantee.
- Existing chat/editor consumers must not change behavior while the general
  registry is introduced.
- The proof must avoid accidentally expanding canonical document semantics.
- Browser QA evidence must not confuse upstream reference screenshots with
  local implementation acceptance.
- Poll question/options and Review/Card/Pull Quote document structure may use
  shared authoring mechanics; poll responses, system authorship, review
  lifecycle, and similar identity-bearing state require an owning slice.
- Upstream version drift after `a933222` requires an explicit re-audit rather
  than silent atlas mutation.
