# Duplicate-check fixtures

Every lockfile here is **hand-authored** in pnpm's v9 shape: the check is a pure
value over the parsed graph, and there is no oracle to agree with — pnpm has no
aggregated "who resolves twice" command (issue #603), which is why this module
exists. Each fixture is wrong in exactly one way relative to its neighbour, so a
test reading one cannot pass by accident.

- `kit-skew/` — the issue #298 graph: `@effected/npm@0.8.2` pulls
  `@effected/commands@0.2.1` while `@effected/workspaces@0.10.1` pulls
  `@effected/commands@0.3.1`, both from the root importer.
- `kit-deduped/` — the same graph with npm repinned to commands `0.3.1`.
- `peer-variants/` — `foo@1.0.0` twice, differing only by peer suffix. One
  version, two instances: not a duplicate.
- `peer-variants-skew/` — `peer-variants/` plus a third importer taking
  `foo@2.0.0`, so `foo` IS a duplicate and its `1.0.0` row lists both instances.
- `filtered/` — the kit skew plus a `semver` skew, where the non-kit package
  `@savvy-web/silk-effects` is what pulls the stale kit copy.
- `other-importer/` — the skew reachable only through `packages/app`, never
  the root.
