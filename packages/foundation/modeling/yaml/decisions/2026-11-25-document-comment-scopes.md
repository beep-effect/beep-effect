---
title: The document owns its header, its trailer and the root block collection's terminal comments
date: 2026-11-25
reversal: Share one last-comment offset across the `---` marker and leave the root collection's terminal and escaped comments on the root collection.
governs:
  - src/internal/composer/document.ts#composeCommentChild
  - src/internal/composer/document.ts#escapeRootTerminalComment
  - src/internal/composer/document.ts#takeEscapedComments
  - src/internal/composer/document.ts#placeLeadingHeader
  - src/internal/composer/document.ts#placeAfterMarkerComment
  - src/internal/composer/document.ts#attachHeaderToFirstEntry
enforcedBy: []
---

Leading comment lines join with `\n`, a blank line within the run embedding as an empty line. The `---` marker partitions the run per comment: comments ahead of it are the document header (`commentBefore`), comments after it lead the root node, and each side keeps its own last offset, so a blank line under that side's block embeds as a trailing empty line on that side only (one shared offset moved the blank of `# a\n---\n# b\n\nx: 1\n` across the marker). With no content node the after-marker run joins the header instead of being dropped. A marker-less header is the first own-line comment of the item stream, so it attaches to the first pair's key, the first sequence item or a scalar root (`attachHeaderToFirstEntry`).

Comments after content, or after a `...` marker even in an empty document (`---\n...\n# tail\n`), are the document's trailing `comment`. The root block collection's terminal run, and comments that escaped it at a column shallower than an indented root's content (`# esc` in ` - a\n# esc\n`), belong to the document as the root's enclosing scope: escaped comments open the trailing block in source order, blank lines kept, and are drained so they never leak into the next document. A flow root keeps its terminal comment inside its brackets, and nested collections are unaffected.

Rejected: one shared last-comment offset for both sides of the marker; keeping the root collection's terminal and escaped comments on the collection, which diverges from the `yaml` npm package's document `commentBefore` and `comment`.
