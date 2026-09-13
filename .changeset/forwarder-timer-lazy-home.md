---
"@beep/repo-cli": patch
---

Resolve HOME only when the forwarder timer probes the default Bun candidates or expands a `~/` pin, so an absolute `--bun-path` renders without HOME.
