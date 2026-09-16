---
"@beep/repo-cli": patch
---

`yeet sweep --retire` lets the archive fence exempt the invoking Claude
session's own subtree. The request now carries a session marker
(`CLAUDE_PID` and the pid it names) that the fence proves against `/proc`: the
invoker ancestor directly below the named pid must have been started with that
marker, so init, the desktop host, or a pid copied from another shell never
widen the fence. With the proof in hand, the MCP servers, tool shells, and
background jobs that session spawned into the lane no longer block its
post-merge closeout. Any other holder still refuses it, the refusal names each
holder's process, and its hint runs the lane's own CLI from the owning clone so
a clone whose checkout predates `--retire` still works.
