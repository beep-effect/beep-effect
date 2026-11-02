# Recorded minimatch 10 reference

These fixtures preserve the package's minimatch 10.2.6 dialect while its live
upstream test dependency uses the patched minimatch 11.0.3. The package does not
install or import the old matching implementation. Current upstream continues
to check unchanged escape, expansion and magic-classification behavior.

The inputs originate from the tests at accepted main commit
`0e601a3d55f88d875ca49d47931e216a5a328aa2`. Expected outcomes and compiled
expressions were captured from the independent published minimatch 10.2.6
implementation, not this package's port. Its installed JavaScript and license
were verified against the npm tarball. The provenance file records the
upstream archive integrity, executable digest, original input-source digests,
fixed sampling seeds, counts and each fixture's formatted-byte digest.

The corpus retains 2,043 directed matching cases, 495 whole-expression cases
and 108 optimizer records, including 5,832 ordered pair controls. It also
contains 5,403 fragment records covering 2,541 distinct patterns. Five fixed
`Arbitrary.sampleEffect` runs draw 2,000 examples each from the original
property-generator definitions: default matching, option bags, public facade,
path matching and AST fragments. The first four retain 8,000 matching outcomes;
the AST run contributes fragment patterns under both dot modes.

All recorded matching outcomes execute deterministically. Public-facade cases
run through both synchronous and Effect compilation APIs. Randomized tests
also select recorded cases and compare fragment expressions against fresh
candidates of at most twelve characters. The original generated-pattern
round-trip and hostile-input tests remain. This finite corpus is compatibility
evidence, not an exhaustive proof over every possible pattern.

Regeneration requires the exact upstream archive and accepted input sources
named in `minimatch-v10-provenance.json`. Evaluate the original generator
schemas with the recorded Effect sampling options; query upstream only with
those bounded inputs. Capture its results before running this package's
implementation, format with the repository's Biome version, and update the
formatted-byte digests. Never derive new expected values from the port or
replace old outcomes merely because a new upstream dialect differs.

The tuple layouts are defined and decoded by `test/legacyOracle.ts`:

- Fragment: pattern, options, expression flag, literal/source, flags.
- Match/sample: group, pattern, candidate, options, expected boolean.
- Regexp: pattern, options, nullable source, flags, magic flag, candidate/outcome pairs.
- Optimizer: options, input parts, level-two result, level-one result,
  first-phase result, adjacent-globstar result, pair records.
- Optimizer pair: other parts, empty-globstar mode, nullable parts-match
  result, second-phase result. Null represents upstream's false result.

The upstream package is MIT licensed; its authorship and the port's notices
remain recorded in the package license and source headers. No upstream
JavaScript is vendored by these fixtures.
