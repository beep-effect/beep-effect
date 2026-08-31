# HTML conformance sources

This directory is the reviewable provenance surface for the
`html-whatwg-living-2026-08-30` target profile and the older
`html-current-vendored-2026-06-15` profile that the generator consumes today.
The separate `html-safe-output-policy-e6e88af6` profile records the
package-owned `SafeHtmlAst` policy without presenting that stricter policy as a
WHATWG author-conformance requirement.
The package-level [source ledger](../SOURCES.md) remains authoritative for the
existing generator inputs; this narrower ledger records their relationship to
the semantic conformance initiative.

## Authority and derivation

- The pinned WHATWG HTML `source` commit is the normative target authority.
- The pinned WHATWG MIME Sniffing `mimesniff.bs` commit is a normative
  dependency for the valid MIME string grammar and JavaScript MIME essence
  registry consumed by `ScriptState`; it is not an implementation oracle.
- W3C webref JSON is a derived machine-readable index. It is useful for
  exhaustive inventories, but it does not replace the WHATWG requirements.
- `whatwg/content-model.json` was extracted from the non-normative list of
  elements. Its source record pins an immutable public copy of the exact
  committed JSON bytes, not the HTML page from which they were derived. It is
  a current local generator input, not a complete normative content model.
- The IANA Language Subtag Registry is the registry authority for language-tag
  components used by `track[srclang]` validation.
- `classification.json` and `obsolete-interfaces.json` are package-reviewed
  interpretations and gap closures. They are not external specifications.
- The pinned `Html.policy.ts` source is the exact implementation reference for
  `inspectSafeHtml` and `enforceSafeHtml`. Its deny-by-default element,
  attribute, URL, target, role, and ARIA rules are package policy, not WHATWG
  general conformance.

## Current bytes versus approved refresh

The current webref inputs are still pinned to commit
`99e9e5eccbfc924203bda66a2328eade5cc08e7b`. The approved refresh records use
commit `f3b81966c45f34f62df20e7f8d6f66d5b5ba9279`, but those target bytes are not
yet vendored and must not be described as generator inputs. The current-vendored
profile therefore selects only the six files read by `scripts/generate.ts` and
only the inventory invariants whose references stay inside that source set.
Target-refresh and normative content-model invariants remain in the WHATWG
target profile. Likewise, the approved WHATWG source commit is recorded as
target authority while the current content-model JSON remains a dated derived
snapshot pinned at the package commit that first published those exact bytes.

The digest for the current local webref element index covers the committed
18,704-byte file. It differs from the pinned 18,703-byte upstream response only
because the package artifact normalizes one trailing LF. The IANA digest covers
the committed File-Date 2026-06-14 registry snapshot; its canonical URL is
mutable and can serve a newer registry version without changing the local
generator input. Neither distinction authorizes a silent source refresh.

The MIME Sniffing dependency is pinned independently at commit
`39aa53511b13953d84fef8d4131d6f61d0ccbde6` with the source-byte digest recorded
in `sources.json`. HTML script-type classification uses only its
`valid-mime-type` and `javascript-mime-type` anchors.

Normal generation must remain offline. A future source-refresh command may
replace vendored bytes only after verifying the recorded SHA-256 values,
licenses, inventory drift, and reviewed override coverage.

## Artifact roles

- Every entry in `sources.json`, `sources.json#profiles`, and `invariants.json`
  decodes directly as the shared `SpecificationSource`, `ConformanceProfile`,
  or `InvariantDescriptor` schema from `@beep/schema/Conformance`.
- `sources.json` records authority, revision, byte digest, license, and consumed
  scope. Derived webref data and package-reviewed overrides are
  `implementationReference` entries, never substitutes for the
  `primarySpecification` WHATWG source.
- `inventory.json` enumerates every generated element and every public AST
  union relevant to conformance.
- `invariants.json` records what the current schema, decoder, tree validator,
  and adapters do and do not prove.
- `coverage.json` mirrors every invariant ID with current and target evidence.
