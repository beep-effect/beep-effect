---
title: "VidBee and alphaXiv imports are new tagged manifests beside the legacy provider imports"
date: 2026-11-07
lane: "feat/research-library-routes"
reversal: "Fold them into LibraryImportPayload with provider vidbee or alphaxiv"
---

kind: vidbee and kind: alphaxiv manifests decode first in importLibraryRoutedResult; everything else falls through to the existing importer, so the MCP-event alphaXiv path and October imports are unchanged. VidBee FAQ frontmatter has model but no effort key on disk today, so effort comes from an effort key or a model(effort) pin and is otherwise recorded as unrecorded.
