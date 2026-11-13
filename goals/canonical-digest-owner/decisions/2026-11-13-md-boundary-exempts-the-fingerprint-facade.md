---
title: "The md import boundary exempts the JsoncFingerprint facade by name"
date: 2026-11-13
lane: "refactor/canonical-digest-owner-swaps"
reversal: "Remove the exemption and the render import together, restoring md's own frontmatter encoder as a pinned census row."
---

@beep/md keeps every parser package, @beep/jsonc among them, out of the runtime closure of its non-bridge entries, and its boundary test failed once the render module imported the owner. The swap needs that import, so the test now exempts exactly the specifier @beep/jsonc/JsoncFingerprint: the canonical-JSON facade of that package, whose own closure is one constant module and loads no parser. Every other @beep/jsonc subpath, and the package root, still counts as a parser. Rejected: keeping md's own encoder as a pinned row, since the census classes it replace and it diverged from RFC 8785 on unpaired surrogates, and moving the facade to another package, since @beep/schema cannot import @beep/jsonc and SPEC.md puts the owner in @beep/jsonc.
