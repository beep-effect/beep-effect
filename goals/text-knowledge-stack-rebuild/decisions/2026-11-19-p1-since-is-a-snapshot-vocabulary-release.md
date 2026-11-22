---
title: "P1: since is a vocabulary release of the term snapshot, not a package version (replaces design D7)"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Tie since to the @beep/identity package version by a decision file and recompute the since values before the P1 snapshot merges; after P1 only a new release may change it."
---

P1 ruling 2, replacing D7 of the registry-first design. The since field of a term, a binding and a deprecation is a vocabulary release of the term snapshot. TermSnapshot carries a release field that starts at 1.0.0. The snapshot writer bumps the minor when a term is added and the major when a term is deprecated, and every existing row keeps its since: regeneration never rewrites one, and a rewritten since is a snapshot violation. No lint ties since to a changeset. The base design computed since as semver.inc(identity.version, highestPendingBump) from .changeset/*.md frontmatter and refused a registry change without an @beep/identity changeset; both are dropped, because @beep/identity is private (package.json private true, version 0.1.1) and a private workspace may not carry a changeset (decision 2026-11-19-p1-no-changesets-for-private-workspaces). Every row of the first P1 snapshot carries since 1.0.0. The doctrine text that called since a package version (ops/design/L0.identity.ts, chapter 16, GLOSSARY.md) is corrected in the same commit as this decision.
