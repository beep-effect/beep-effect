# Canonical resolver text and numeric foundations

Date: 2026-10-28. Private resolver checkpoint; full resolution remains open.

## Exact source behavior

`ResolverText.ts` ports the pinned `utils.strip_punct` substitution order and
`resolve._has_invalid_pin_cite`. The source retains BSD-2-Clause attribution.
These are semantic helpers for the forthcoming default resolver, not a parser
or new public service. No capability, donor or divergence row is promoted.

Antecedent stripping preserves source quirks, including the deletion of the
character preceding an apostrophe-space pair. It uses explicit Python Unicode
14 whitespace classes. JavaScript whitespace would incorrectly discard a BOM
and retain some Python separator controls/NEL. No intuitive extra punctuation
normalization or JavaScript trim is substituted.

The numeric path preserves Python str.isdigit separately from Unicode decimal
conversion. The former accepts superscript digits that Python int cannot
convert. Actual integer parsing maps frozen decimal characters to ASCII and
uses BigInt, preserving arbitrary-precision comparisons and the source's
150-page inclusive range. The frozen Python 4,300-digit conversion limit also
applies. The optional lowercase at-plus-space prefix is exact and
case-sensitive; only the initial decimal prefix is consumed, as in the source
regex.

Missing case pages invalidate Id. before checking its pin. Missing law/journal
page keys and explicit nulls remain distinct: an explicit null page with a pin
raises the canonical attribute error. Conversion/type errors become sanitized
private failures rather than silently successful or unresolved outcomes. Final
public error mapping is still engine work.

## Frozen character facts

The maintainer producer exhaustively queries all 1,114,112 Unicode code-point
values for digit, decimal and whitespace properties under Python 3.11.15 and
Unicode 14.0.0. It captures 788 digit characters, 660 decimal characters and
29 whitespace characters. Decimal ordering is independently checked against
unicodedata.decimal. The generated private schema-owned data is static runtime
input; it includes no Python/Unicode implementation source or runtime access.

The producer verifies the clean oracle commit/tree, Python/Unicode versions,
hash seed and integer conversion policy, retaining its own hash and the oracle
license/lock hashes. The fixture includes all positive digit characters,
adjacent negative boundaries, multi-character checks and a post-Unicode-14
counterexample. Target data equality and counts are checked in tests.

## Verification boundaries

The committed fixture captures 60 punctuation/whitespace observations, 955
digit checks and 38 pin checks. Cases cover empty/null/missing fields, inclusive
range bounds, exact prefixes, unsupported pin syntax, Unicode mixed decimal
scripts, superscript conversion failures, large integers and conversion limits.
Raw failures retain no citation text, cause or Python exception payload.

Regexes remain synchronous private source-backed implementations. Family-level
safety review, routing, bounded execution and adversarial scaling proof are
still required before engine exposure. These tests do not approve a regex
family, complete the default/custom resolver or prove extraction parity.
The canonical resolver's grouping and matching integration remains next work.

The full server package gate passes (audit 42.6 seconds, docgen 11.0 seconds),
including builds, type checks, tests, lint and documentation. Four focused tests
cover all 1,053 captured observations and sanitized invalid input. Stable
regeneration is data-identical and the producer hash matches the fixture.
The ten-component evidence audit, goals index/doctor and new-note/README
Markdown checks pass; target parity remains pending. Cache logs use the
`resolver-text-` prefix.

The owning server tests now use a package-scoped test-only Citation alias in
its test compiler/Vitest configuration, following the repository import law.
The alias is absent from production source and package exports. A fresh Node
resolution check rejects that namespace with ERR_PACKAGE_PATH_NOT_EXPORTED.
Existing mention, authority and document suites migrate to the same test alias;
production internals remain private without a public compatibility export.

Reproduce with:

```sh
PYTHONHASHSEED=0 "$EYECITE_ORACLE_ROOT/.venv/bin/python" \
  goals/citation-extraction-engine/ops/probe-resolver-text.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" \
  --data-output /tmp/PythonTextData.ts \
  --cases-output /tmp/resolver-text-cases.json
bun run beep quality package-verify @beep/law-practice-server
bun run --cwd packages/law-practice/use-cases citation:parity-check --audit
```

P0/P1 and the full goal remain in progress. Source/runtime proof for the
complete canonical resolver, custom resource keys, live artifact adapter,
Bluebook codecs and bounded full-corpus engine remains unfinished.
