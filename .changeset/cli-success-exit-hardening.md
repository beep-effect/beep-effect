---
"@beep/repo-cli": patch
"@beep/repo-docgen": patch
---

Exit explicitly on success in both Effect CLI entrypoints: the platform
runner only hard-exits on failure or signal, so a handle leaked by a child
(turbo daemon socket, resident bunx wrapper) wedged successful CI lanes
after their work completed. The docgen:local turbo spawn also drops its
bunx layer and runs with `--daemon=false`.
