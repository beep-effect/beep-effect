---
title: "P1: the snapshot release is a property of the change against its base ref"
date: 2026-11-22
lane: "tksr-p1c"
reversal: "Restore committed-snapshot release arithmetic and remove exact-release and new-row since checks with a superseding decision."
---

PR C review found that each write counted the same branch change again: two deprecations over 1.0.0 became 2.0.0 and 3.0.0, and repeated additions became 1.1.0 and 1.2.0. The release now belongs to the whole change against its base.

1. The lint, registry writer, deprecation writer and rebind writer share one base reader. Each accepts --base; the default is the merge base of HEAD with origin/main. A base that publishes no term set leaves the checkout snapshot as the previous one. The hermetic --check reads no git state.
2. RegistryTable.releaseAfter computes one release from the base and final rows. RegistryTable.snapshot raises it to the largest since its rows record, preserving the release of a stacked layer whose main base publishes nothing. planDeprecate records the whole change release, so consecutive retirements over a published base have equal since values.
3. Against a published base, the lint refuses both an understated and an overstated release. Each new binding or deprecation records the whole change release; a rebind preserves the since of the term it keeps bound. A base that publishes nothing skips exact-release and new-row since checks.
4. To repair release findings, merge the base when needed, correct each since reported as since-misstated in its source shard, and regenerate with identity registry --write using the same --base. Restoring the base snapshot by hand is no longer needed. After a parent merges, the same lint names the next release and each stale row.
5. Tests cover repeated writes, consecutive deprecations, additions followed by retirement, too-high releases, stale rows, empty bases, literal remedies and coherent random edit sequences. The default and explicit parent-base writes leave this layer byte-identical at 2.0.0. Handler-reachable identity modules are unchanged.
