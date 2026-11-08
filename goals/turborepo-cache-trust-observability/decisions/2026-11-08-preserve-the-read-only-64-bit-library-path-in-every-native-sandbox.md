---
title: "Preserve the read-only 64-bit library path in every native sandbox"
date: 2026-11-08
kind: checkpoint
reversal: "Restore the former mapping through a PR if accepted-source evidence contradicts it; retain all failed observations and keep qualification closed."
---

Run42452673520 passed input preparation and then refused sandbox Bun library discovery. All three sandbox constructors redirected lib64 to usr/lib, hiding a separate usr/lib64 tree. Use usr/lib64 inside the existing read-only usr mount, preserving hosts where that path aliases usr/lib. Keep the ldd exit, stderr, truncation, resolved-path and digest checks, namespace isolation and resource caps. Add only fixed-role numeric and boolean failure metadata and a synthetic private-stderr refusal control. The original log does not prove the mapping was its sole cause; a fresh accepted-source hosted observation is still required. No local quality suite, same-source retry, credential or signing activation is authorized by this checkpoint.
