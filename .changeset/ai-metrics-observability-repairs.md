---
"@beep/repo-ai-metrics": patch
"@beep/repo-cli": patch
---

Make the ai-metrics observability path readable: surface error causes at debug log levels, stop the agent-effectiveness Phoenix probe wedging on per-project aggregates, and stamp `openinference.project.name` so forwarder spans land in their own Phoenix project instead of `default`. When the per-project aggregates do not return, the doctor now names the mode it hit -- rejected, undecodable, unreachable, or over its time budget -- instead of reporting every one as a timeout.
