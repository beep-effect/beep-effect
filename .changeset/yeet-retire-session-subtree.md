---
"@beep/repo-cli": patch
---

`yeet sweep --retire` lets the archive fence exempt the invoking Claude
session's own subtree: with `CLAUDE_PID` naming an invoker ancestor, the MCP
servers, tool shells, and background jobs that session spawned into the lane no
longer block its post-merge closeout. Any other holder still refuses it, the
refusal now names each holder's process, and its hint runs the lane's own CLI
from the owning clone so a clone whose checkout predates `--retire` still works.
