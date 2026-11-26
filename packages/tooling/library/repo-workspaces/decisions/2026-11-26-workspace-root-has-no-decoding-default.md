---
title: WorkspacePackage.workspaceRoot has no decoding default, so a value serialized before the field fails decode
date: 2026-11-26
reversal: Give WorkspacePackage.workspaceRoot a decoding default (an empty string or a root guessed from path and relativePath) and change the pre-field test in test/WorkspacePackage.test.ts to expect a successful decode.
governs:
  - src/WorkspacePackage.ts#WorkspacePackage
enforcedBy: []
---

`workspaceRoot` is required on decode, the deliberate exception to the compat posture under which `manifestRecord` defaults to `{}` for snapshots serialized before it existed.
`manifestRecord` has an honest empty default; a root does not, and every consumer of the field resolves config such as `.changeset/config.json` against it.
Failing decode is the conservative direction: the caller re-runs discovery, which is cheap.
Rejected: an empty-string or guessed-root default, which hands back a wrong absolute path and silently reads the wrong config, the class of bug the field was added to remove.
