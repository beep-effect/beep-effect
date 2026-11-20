---
title: "P1: TermSnapshot gains namespaces and a release, and snapshotViolations replaces unexplainedRemovals (design D6)"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Drop the namespaces field and keep only the removals check, by a decision file before the snapshot is first published."
---

D6 of the registry-first design, not replaced by a ruling, read with rulings 2 and 8. The committed snapshot packages/foundation/modeling/identity/registry/term-snapshot.json is regenerated from the source shards and holds every term IRI and every namespace IRI, the namespaces (so a prefix change is visible), the bindings and the append-only deprecations, as strictly ascending sorted arrays laid out one canonical row per line, plus the release field of decision 2026-11-19-p1-since-is-a-snapshot-vocabulary-release. snapshotViolations(previous, next) returns a typed SnapshotViolation union in place of the design-module unexplainedRemovals: a removal with no deprecation, a revived deprecated term, a changed or removed deprecation, a rewritten since, a reassigned or ambiguous binding and a dropped namespace. The gate compares against the base ref; an unreadable base is unknown, never clean. A git-free genesis floor fixture beside it guards the first snapshot.
