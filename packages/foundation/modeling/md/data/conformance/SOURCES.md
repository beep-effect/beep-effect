# Markdown conformance sources

The package has three intentionally distinct profiles:

- `commonmark-0.31.2` for CommonMark syntax and semantics;
- `gfm-0.29.0.gfm.13` for the pinned GitHub Flavored Markdown extensions;
- `beep-md-extensions-v1` for package-owned nodes such as math, footnotes,
  admonitions, embeds, YouTube blocks, and trust-aware raw content.

CommonMark `spec.txt` is the normative source for the CommonMark profile and
`spec.json` is its machine-readable example index. The CommonMark profile does
not select the separate GFM authority or the cross-profile invariant that cites
it; CommonMark extension rejection remains covered by the package-owned
`md.extensions.nonstandard-members` invariant. The published
[GFM 0.29 specification](https://github.github.com/gfm/) is recorded as release
`0.29-gfm`; its source scope retains the 2026-08-31 retrieval context for the
recorded digest. The pinned cmark-gfm `test/spec.txt` and `test/extensions.txt`
files are conformance corpora, not specifications. None of the approved corpus
bytes is currently vendored or run exhaustively by package tests, so
corresponding coverage is recorded as a gap rather than inferred from the AST
shape.

The GFM publication identifies itself as version `0.29-gfm`, whereas the
package separately targets CommonMark `0.31.2`. Those versions are recorded as
distinct authorities: this package does not claim that applying the published
GFM extension semantics to its newer CommonMark target creates an official GFM
revision.

`micromark` and `micromark-extension-gfm` are implementation oracles. They can
support differential tests, but passing their behavior cannot by itself prove
compliance with CommonMark or GFM. The current package uses `micromark` only in
focused URL-sanitization rendering tests; the GFM extension is not currently a
package test dependency.

The Beep extension profile is package-reviewed policy. Extension invariants
must not be attributed to CommonMark or GFM unless a cited rule actually
defines them. Normal conformance generation and tests must use committed bytes
only; acquisition or refresh is a separate networked operation.

The package-reviewed source entry is an immutable public pre-initiative
baseline at commit `1ed08f66df016a18c6d7d56bd97aa778912cb37b`; it is not a
digest of the dirty working tree or the final initiative implementation.
Provenance for the completed initiative is supplied by its eventual Git commit
and pull request, never by a guessed self-referential working-tree digest.

Every source, profile, and invariant entry decodes directly as the shared
`SpecificationSource`, `ConformanceProfile`, or `InvariantDescriptor` schema
from `@beep/schema/Conformance`. CommonMark examples are a
`conformanceCorpus`; package and micromark records are
`implementationReference` evidence and carry no normative authority.
`coverage.json` keeps package-local positive/negative test classification and
target enforcement without adding those ledger fields to shared invariant
entries.
