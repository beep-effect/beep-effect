---
"@beep/repo-ai-metrics": patch
"@beep/repo-cli": patch
---

Cover the permission notifier's Claude Desktop session route and the labeled
"Open parent task" route for headless children of desktop tasks, plus one
replaced-in-place desktop card per wait that closes once the wait resolves. The PR-wave
notifier test now asserts that the wave worker stays independent of the
sequence-break worker, not that the sequence-break worker never changes.
