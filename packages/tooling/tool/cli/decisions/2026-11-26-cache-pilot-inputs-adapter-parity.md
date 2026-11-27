---
title: cache-pilot-inputs emulates the retired Python adapter's stdlib output byte for byte
date: 2026-11-26
reversal: Emit JSON with JSON.stringify, use the platform URL, tar and PATH helpers, and re-baseline the ci-cache-pilot parity pins.
governs:
  - src/commands/Ci/CiCachePilotInputs.ts#shortEscapes
  - src/commands/Ci/CiCachePilotInputs.ts#pythonJson
  - src/commands/Ci/CiCachePilotInputs.ts#UrlParts
  - src/commands/Ci/CiCachePilotInputs.ts#tarMembers
  - src/commands/Ci/CiCachePilotInputs.ts#which
  - src/commands/Ci/CiCachePilotInputs.ts#runCachePilotInputs
enforcedBy: []
---

The command replaced a Python adapter, and the `ci-cache-pilot` parity tests pin its bytes, so it
emulates the stdlib the adapter called: `json.dumps` with `ensure_ascii=True` (short escapes, then a
lowercase `\uXXXX` for every unit outside printable ASCII), its `", "` and `": "` separators or
`indent=width`, `urllib.parse.urlsplit`, `tarfile.getmembers()` (pax and GNU long-name records fold
into their member) and `shutil.which`.

Rejected: `JSON.stringify` and the platform URL, tar and PATH helpers, whose bytes and edge cases
differ from the pinned adapter output.
