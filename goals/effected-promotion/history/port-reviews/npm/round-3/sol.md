### sol-3-1

- file: scratchpad/effected/npm/NpmRegistry.ts:743
- class: bug   severity: required
- standard: D9, D11, section 14’s verified-upstream-bug exception; `NpmRegistry.makeSeeded`’s absent-version contract.   evidence: Read-only `bun -e` probes against the reviewed port and pinned oracle used `{ registries: { [DEFAULT_REGISTRY]: { p: {} } } }`. Both returned `Some` for `version("p", "toString")` and `version("p", "constructor")`, and `None` for `version("p", "1.0.0")`. A separate lab probe decoded the seed through `RegistrySeed` first and reproduced the failure, with zero own seeded version keys. The nested lookup reads inherited properties; the live packument implementation already guards version lookup with `R.has`.
- failure: A seeded registry reports versions that were never seeded. This gives consumers a false “already published” answer and makes the test double disagree with the registry’s own-key lookup semantics. The existing schema round-trip properties and full coverage do not check this absence property.
- fix: Use own-key lookups through `R.get` for the registry, package and version dictionary axes, preserving explicitly seeded own keys. Apply the same lookup discipline to the other seeded methods. Add regressions requiring `None` for inherited version names on an empty package and preserving an explicitly seeded own `"constructor"` entry. Record the verified upstream correction under section 14.

### sol-3-2

- file: scratchpad/effected/npm/PackagePublish.ts:133
- class: jsdoc   severity: required
- standard: standards/effect-first-development.md EF-3; `.patterns/jsdoc-documentation.md`’s requirement that example code use Effect patterns; D5/D11.   evidence: The reviewed commit contains 17 synchronous codec calls inside JSDoc examples. Besides this site, they occur in `PackagePublish.ts:174,212,244`, `PackageManagerPin.ts:234–235`, `ReleaseAgeGate.ts:56`, `RegistryKind.ts:26`, `Manifest.ts:260`, `IntegrityHash.ts:704`, `DependencySpecifier.ts:515,810,812`, and `DependencySection.ts:28,56,124,140`. EF-3 explicitly names these synchronous methods as APIs to avoid by default. The supplied green gates missed these example bodies: they remain in comments, while successful docgen compilation establishes that the snippets type-check, not that they follow this codec rule. No recorded deviation authorizes these examples.
- failure: Public documentation teaches throwing synchronous decoding and encoding as the normal way to consume the port’s schemas and codecs, bypassing the Effect composition and error handling required by EF-3.
- fix: Use Effect codecs in examples that demonstrate decoding or encoding, and execute the composed example at its outer runtime boundary. Use schema `.make(...)` where the example only demonstrates construction. Preserve every example’s purpose and expected result.

### sol-3-3

- file: scratchpad/test/npm/PackagePublish.test.ts:42
- class: law   severity: required
- standard: standards/effect-first-development.md EF-19; Effect-first-development skill’s non-negotiable law 22, which explicitly includes tests and fixtures; `.patterns/jsdoc-documentation.md`’s Effect-pattern requirement for examples; D5/D11.   evidence: Direct `JSON.stringify` remains in this fixture, `PackagePublish.test.ts:49,447`, and `PackageManagerPin.test.ts:111`. Executable documentation also uses it at `Manifest.ts:215,379` and `README.md:101`. These exact sites remain despite the supplied green gates. The test calls serialize static fixtures or test names outside their Effect generators; the documentation calls live in example text. The recorded native-runtime deviation covers replacing production pack-output parsing with a Schema codec and does not authorize these remaining calls.
- failure: Fixture generation and published examples retain native JSON serialization where the cited law requires Schema JSON codecs. The malformed pack fixture also bypasses the prescribed codec path, although its intentionally invalid shape can be preserved without doing so.
- fix: Encode fixture values through `S.fromJsonString(S.Unknown)`, using Effect encoding in effectful setup or an explicit Result codec for static fixtures. Keep the missing-filename fixture encoded as `Unknown` so it remains intentionally malformed. Replace documentation serialization with Schema encoding, and use a Schema string codec when quoting rejection inputs in test names.

REQUIRED: 3
BACKLOG: 0