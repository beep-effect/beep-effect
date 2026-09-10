# Instance

- id: `r3-tooling-docker-tag-kind-flags`
- file:line: `packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/DockerResolver.ts:428`
- symbol: `buildDockerReport.tagKind`
- members: `isUnpinnedTag`, `isMajorOnly`
- evidence: E2 at `DockerResolver.ts:428-466` — `latest` and digits-only major
  tags are disjoint, and the report dispatch checks latest before major-only
  with no combined-true arm.

# Current shape

Each Docker image tag is classified twice, then the booleans are read in
different report branches and one contributes to aggregate `hasUnpinned`.
The domain is one tag kind: floating latest, major-only, or specifically pinned.

# Cardinality gap

Four boolean pairs are representable and three tag kinds are legal:
`latest`, `major-only`, and `pinned`.

# Target schema

Define a private named `DockerTagKind` LiteralKit and one classifier that reuses
the existing `LatestDockerTag` and `MajorOnlyDockerTag` schema guards. Derive
the literal once per image, match it for aggregate unpinned status and the
no-latest fallback item, and retain the independent latest-version Option.

# Migration inventory

- `DockerResolver.ts:137-150` — keep both narrow tag schemas/derived guards and
  add the named three-case owner beside them.
- `DockerResolver.ts:423-480` — replace both booleans with one tag kind;
  preserve latest-resolution drift precedence, exact expected strings,
  item ordering, aggregate `hasUnpinned`, and final status selection.
- `ResolverService.ts:18-100` remains the only production report consumer.
- Add focused `buildDockerReport` tests because the current repo-CLI suite has
  no direct table for this classifier; whole-source/barrel search found no
  other local boolean reader.

# Guard-deletion accounting

Delete `isUnpinnedTag`, `isMajorOnly`, their impossible combined-true state,
and repeated interpretation in the branch chain. One literal drives both the
per-image fallback and aggregate unpinned fact.

# Encoded-side impact

None. VersionSync report schemas and rendered output remain unchanged. Docker
image tag bytes, network lookup, drift items, category statuses, error strings,
and command JSON stay stable.

# Test impact

Table-test latest, numeric-major, semver/specific pinned, latest-version Some
equal/different, latest-version None, mixed image arrays, item ordering, and
final ok/drift/unpinned statuses. Run focused VersionSync tests and full
`@beep/repo-cli` package verification; add the required patch changeset unless
the package is explicitly ignored.

# Risk and sequencing

Land in Tier 1E. Latest-version drift has higher precedence than tag-kind
fallback today; the literal refactor must not reorder that branch or change
aggregate status when multiple image kinds coexist.
