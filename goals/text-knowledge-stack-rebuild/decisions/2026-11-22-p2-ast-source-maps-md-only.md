---
title: "P2: the AST source map of @beep/md yields verified anchors; pandoc-ast, lexical-schema and html have no text positions to re-point"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Add a positions feature to the named AST package in the phase that needs it; nothing in P2 depends on its absence."
---

PLAN P2 says AST source maps point at @beep/text. Measured: only @beep/md has a source map (MdSourceMap); pandoc-ast locates by JSON path, and lexical-schema and html record no positions and have no consumer asking for them. P2 adds @beep/md/Md.anchors with anchorAt(map, document, path, source), which reads positionAt, keeps the offsets only when they are naturals with start < end, slices the verified text and returns an Option of VerifiedTextAnchor through verifyTextAnchorAgainstVerifiedSource. The module is bridge-side: the package lists its subpaths one by one, so ./Md.anchors is added to exports and publishConfig.exports, it stays out of src/index.ts, imports only Md.syntax and @beep/text at runtime and @beep/markdown as a type, and Md.import-boundary.test.ts classifies it with the bridge modules. A zero-width or synthetic markdown position has no text, so it is None and is never turned into an empty anchor. MdSourceMap and @beep/markdown Position keep their shapes (markdown is outside the amendment's packages and stays untouched). Chapter 16's source-map sentence is corrected to name md as landed and the other three as added when a phase needs them.
