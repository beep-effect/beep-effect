---
title: "P1: over a base commit that publishes no term set, the writers keep the release"
date: 2026-11-22
lane: "tksr-p1c"
pullRequest: 3449
reversal: "Remove ReleasePolicy and BaseSnapshot.resolved so a writer over an unpublished base succeeds the committed snapshot again, with a superseding decision."
---

PR C review (round 2) found that the default base of a stacked layer still bumped the release once per command: while the parent is open, the merge base with origin/main has no term snapshot, so each writer succeeded the committed snapshot and a second deprecation over 2.0.0 wrote 3.0.0. The lint skips the exact-release checks against such a base, so nothing caught it until the parent merged.

1. A writer whose base commit publishes no term set now keeps the release the committed snapshot has (ReleasePolicy keep, RegistryTable.snapshotKeeping): until the base publishes, every edit is part of one unreleased change. The first write still takes the genesis release, raised to the largest since a row records. A deprecation records the kept release.
2. The committed snapshot stays the previous one for the term-set check, so the writer still refuses to drop a row it carries.
3. A checkout with no base commit at all (no origin/main, not a git work tree, disjoint history) says nothing about what is published. BaseSnapshot.resolved is false there and the writers succeed the committed snapshot as before; --check, which reads no git state, does the same.
4. The README no longer says the writers succeed the checkout's snapshot over an unpublished base, and its stack guidance states that the release is left alone until main publishes.
5. Tests: two deprecations over a base commit with no registry and a committed 2.0.0 stay at 2.0.0 (command level and planning level); an addition there keeps the release; the policy for published, unpublished and unresolved bases.
