---
"@beep/repo-cli": patch
---

`hashFileSha256` streams the file in 1 MiB chunks through an incremental SHA-256, so hashing uses bounded memory at any file size and produces the same digests. `corpus salvage`, the cache runtime, runner bake, and the files commands inherit it.
