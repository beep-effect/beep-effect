---
title: "Turbo 2.11.13 caches three files per hash (tar.zst, -meta.json, -manifest.json); #3433 size model unaffected"
date: 2026-11-20
kind: checkpoint
lane: "fix/turbo-build-cache-prune-tmp"
reversal: "none needed: an observation; the prune allowlist reverts with its PR"
---

Turbo 2.11.13, the repository's pinned version, stores three files per cached task hash: `<hash>.tar.zst` (the outputs), `<hash>-meta.json` and `<hash>-manifest.json`. The manifest is a per-artifact file list of about 200 bytes: `{"version":1,"files":{<path>:{size,mtime_nanos,mode,is_dir}},"order":[...]}`. A partial write leaves `<hash>-manifest.json.tmp` behind.

Census of the workstation Turbo cache (`~/.cache/beep/turbo`, 2026-11-20): 75,037 `.tar.zst`, 75,037 `-meta.json`, 75,037 `-manifest.json` and 7 `-manifest.json.tmp`.

The first main-push snapshot of the trusted Turbo build cache (#3433; main `3c1e3329376`, Heavy / Check job 136040177080) kept 585 files for 197 build hashes: three files for 195 hashes and two for the other two. It measured 23 MiB on disk and 17 MiB compressed in the Actions cache. #3433's size model counted two files per hash. The manifests are too small to move it, so the 64 MiB cap and the worst-case total stand.

The prune now keeps only those three exact names for each kept hash and deletes everything else, partial writes included.
