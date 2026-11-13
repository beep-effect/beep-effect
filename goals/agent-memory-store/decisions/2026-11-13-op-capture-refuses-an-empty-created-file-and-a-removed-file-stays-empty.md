---
title: "Op capture refuses an empty created file, and a removed file stays as an empty file"
date: 2026-11-13
lane: "agent-memory-store-p2"
reversal: "Add a file-retired log event that the projector honours, by decision file, and let removed delete the file and created re-create it"
---

A created file with an empty text partitions into no nodes, so capture emitted no operation, returned no batch and the write path reported nothing while the file never appeared. Capture now refuses it with the typed CaptureEditRefusal emptyCreatedFile. A removed file captures the same batch as an emptied edited file: every node is retired, but the log has no file-level event in P2, so the export writes the file back with no bytes and lists it in the next base, where a created edit of the path is refused with baseFileExists and an edited one refills it. That is documented on FileEdit and writeEdits rather than changed, because removing a file needs a new journal event, a projector rule and an import story that P2 does not carry; P5's agent loop owns the file surface. Code: packages/tooling/library/agent-memory-store/src/OperationCapture.diff.ts and src/OperationCapture.models.ts; tests: test/OperationCapture.test.ts and the removed and empty created files case of test/AgentWrite.test.ts. Rejected: dropping the empty created file silently (the caller cannot tell it was not recorded).
