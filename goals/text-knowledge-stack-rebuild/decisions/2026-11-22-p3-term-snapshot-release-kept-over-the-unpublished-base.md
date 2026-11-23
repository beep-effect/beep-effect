---
title: "P3: the term snapshot keeps release 2.0.0, because the stack's base publishes no term set"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Regenerate with bun run beep identity registry --write --base <ref> against a ref that publishes 2.0.0, which writes 2.1.0"
---

Decision `p3-registry-terms` expected the registry writer to release the P3 term additions as 2.0.0 to 2.1.0, "if nothing else lands first". Commit 2 ran `bun run beep identity registry --write` with its default base, the merge base of the lane with `origin/main` (`9a4f7b0258d`). That commit has no `@beep/identity` term snapshot, because the P1 registry has not merged, so the writer took its `keep` release policy (`packages/tooling/tool/cli/src/commands/Identity/Registry.ts`, `releasePolicy`): until a base publishes a term set, every edit of the P1, P2 and P3 stack is part of one unreleased change, and the committed release stays 2.0.0. `beep lint identity-registry` and `beep identity registry --check` both pass on that snapshot.

The release is not set by hand and no `--base` naming the P2 lane is passed: that would release one step of an unpublished stack and bump once per layer. When a parent that publishes 2.0.0 reaches `origin/main` and the lane merges it, the writer then succeeds that snapshot. The lane regenerates at that merge, which gives 2.1.0 for these additions, and `release-regressed` in the identity-registry lint fails the lane until it does.
