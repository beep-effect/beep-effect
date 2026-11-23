---
title: "P3: the deterministic Tika scaffold declares text-scaffold/1, since the capture gate refuses an unversioned engine"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Replace the pin with the real Tika server version when the app/server path becomes the text engine"
---

The server standing tests use the deterministic apache-tika scaffold. Its descriptor and both ExtractionResult paths omitted engineVersion, so the versioned capture gate correctly refused review. By orchestrator ruling, the exported TIKA_TEXT_SCAFFOLD_VERSION constant is text-scaffold/1; descriptor.version and every scaffold result engineVersion use it. The engine name stays apache-tika. This is a pin of the in-process implementation, not a Java Tika version. The text and image-metadata paths have regression assertions in Tika.service.test.ts. Tika.tikaapp.ts and Tika.server.ts are untouched. The package is private, so no changeset is added. Commit 8 additionally runs package-verify for @beep/tika.
