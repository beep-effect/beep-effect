---
title: "A second import of the imported folder returns the current base; any other folder is refused"
date: 2026-11-10
lane: "agent-memory-store-p1"
reversal: "Let one log hold several folders by adding a folder identity to FolderImported and FileImported, by decision file once the store must project more than one memory folder"
---

FolderImported carries a digest and no root, and FileImported paths are relative to the folder, so one log holds exactly one memory folder (one store database per memory folder, which matches the per-repository Claude Code memory folder). When the log already holds a FolderImported, importFolder appends nothing: if every memory file now in the folder holds bytes this store imported from or wrote to that same folder (the export fence, decision export-fence-is-bound-to-the-folder), it returns the base of the log's current state, so a bootstrap step can run import unconditionally; otherwise it fails with ForeignFolderError (first ProjectionError; decision projector-refusals-are-typed-errors), because re-importing would mint a second set of nodes for the same bytes and an edited or foreign folder must reach the log as captured operations (P2 admission, P5 memory admit), not as a fresh import. Tests: the second-import case in packages/tooling/library/agent-memory-store/test/MarkdownProjector.test.ts. Rejected: re-importing and diffing (op capture is P2) and appending a second FolderImported (two claims for one folder).
