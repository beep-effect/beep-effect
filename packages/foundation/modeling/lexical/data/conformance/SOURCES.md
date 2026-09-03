# Lexical conformance sources

Lexical is an upstream implementation and persisted data model, not a web
standard. This package therefore distinguishes the pinned upstream source,
informative documentation, real runtime oracles, and the package-owned persisted
contract.

- The Lexical `v0.49.0` commit tarball is the approved upstream source pin for
  serialized node definitions and runtime behavior.
- The nodes and transforms pages are informative snapshots. They explain the
  intended model, but they are not treated as normative specifications.
- `lexical`, `@lexical/list`, and `@lexical/table` version `0.49.0` are
  development-only implementation oracles used for compatibility checks.
- `beep-lexical-v1` is the package-owned strict/lossless persistence profile.
  Its node version `1` is a wire version and must not be confused with Lexical
  package version `0.49.0`.

The current code still contains release-specific prose referring to Lexical
`0.45`. Until the approved source corpus is vendored and compared against every
supported node, compatibility outside the directly exercised runtime cases is
recorded as `cannotTell`, not as proven `0.49.0` parity.

Normal tests and generation must remain offline. Source acquisition is a
separate operation, and lossless decoding must continue to preserve unknown
wire data even when strict semantic decoding rejects it.

The package-reviewed source entry is an immutable public pre-initiative
baseline at commit `1ed08f66df016a18c6d7d56bd97aa778912cb37b`; it is not a
digest of the dirty working tree or the final initiative implementation.
Provenance for the completed initiative is supplied by its eventual Git commit
and pull request, never by a guessed self-referential working-tree digest.

Every source, profile, and invariant entry decodes directly as the shared
`SpecificationSource`, `ConformanceProfile`, or `InvariantDescriptor` schema
from `@beep/schema/Conformance`. Retrieved concepts pages are `bestPractice`
evidence, and npm artifacts plus the package baseline are
`implementationReference` evidence; neither role is presented as a normative
standard. Package-local inventory and coverage fields remain outside those
shared entries.
