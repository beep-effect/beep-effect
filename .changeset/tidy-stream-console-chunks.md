---
"@beep/repo-cli": patch
---

Serialize console output through per-stream FIFO queues of callback-driven 8 KiB UTF-8 chunks so large hosted-runner logs drain completely before exit.
