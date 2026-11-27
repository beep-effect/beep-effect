---
title: cache-pilot-inputs reproduces the retired Python and shell adapter byte for byte
date: 2026-11-26
reversal: Emit JSON with JSON.stringify, use Effect helpers in place of the stdlib emulations, and re-baseline the ci-cache-pilot parity pins.
governs:
  - src/commands/Ci/CiCachePilotInputs.ts#refuse
  - src/commands/Ci/CiCachePilotInputs.ts#shortEscapes
  - src/commands/Ci/CiCachePilotInputs.ts#pythonJson
  - src/commands/Ci/CiCachePilotInputs.ts#UrlParts
  - src/commands/Ci/CiCachePilotInputs.ts#tarMembers
  - src/commands/Ci/CiCachePilotInputs.ts#which
  - src/commands/Ci/CiCachePilotInputs.ts#runCachePilotInputs
enforcedBy: []
---

The command replaced a Python adapter driven by a shell step, and the `ci-cache-pilot` parity tests pin its bytes. A refusal is the adapter's `SystemExit(message)`: stderr and exit 1. Strings use `json.dumps` framing with `ensure_ascii=True`: the short escapes, then every unit outside printable ASCII (control units, DEL, non-ASCII and lone surrogates) as a lowercase `\uXXXX` escape. Values are `json.dumps(value)` with `", "` and `": "` separators, or `json.dumps(value, indent=width)`, keys in insertion order. The registry URL check follows `urllib.parse.urlsplit`, archive members follow `tarfile.getmembers()` (pax and GNU long-name records fold into their member), and tool lookup follows `shutil.which`. Git keeps the shell step's inherited stdio, so its output reaches the job log, and `$(git rev-parse HEAD)` drops trailing newlines before the comparison. `umask 077` covers every file the command and its children create, and a platform or decoding failure (the adapter's traceback) exits 1.

Rejected: `JSON.stringify` and the platform URL, tar and PATH helpers, whose bytes and edge cases differ from the pinned adapter output.
