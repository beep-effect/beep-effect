I'll review the npm port against the pinned upstream oracle and the binding decisions, and report findings only. First I'm loading the port laws, the ledger, and both trees.Identity is in place and the export surface matches. I'm comparing the credential and registry paths next, where the port's signatures already diverge from upstream.The report needs exact line citations, so I am re-reading the credential throw, the barrel, and the port notes before writing findings.### grok-1-1
- file: scratchpad/effected/npm/RegistryCredential.ts:105
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and section 14; effect-laws-v1 law 7; operator revision 2026-10-09 (one ledger and README deviation entry per systemic class, including tagged errors)
- evidence: Oracle `RegistryCredential.ts:77` throws `new RangeError("A basic-auth username cannot contain a colon")`. The port throws `InvalidBasicAuthUsernameError.make` with the same message. Oracle `PackagePublish.test.ts:644` asserts `RangeError`; `scratchpad/test/npm/PackagePublish.test.ts:650` asserts `InvalidBasicAuthUsernameError` and imports it from the file. `index.ts:78-83` exports `basicCredentialFromPair` and not the error class. README Port notes say `Deviations: None` and `Added exports: None`. Ledger `w2-npm` has `deviations: []` and `exportsAdded: []`. The same unrecorded class change is at `NpmRegistry.ts:383` (`Effect.die(new Error(message))` to `Effect.die(UnstubbedRegistryMethodError)` with the same message) and `PackagePublish.ts:452` (`UnstubbedPublishMethodError`). Those tests only assert a `Die`.
- failure: `instanceof RangeError` no longer matches the public throw. The replacement class is not on the package entry, so a barrel caller cannot name the catch type. The die defect's `name`, `_tag`, and string form differ from `Error` while the effect still dies. Section 14's ledger, README, and cited-test record is missing. Reverting to `RangeError` or `new Error` fails law 7.
- fix: Keep the tagged errors. Add one `w2-npm` deviation, cause `law:beep-laws/no-native-runtime` (effect-laws-v1 law 7), listing these three sites and citing `scratchpad/test/npm/PackagePublish.test.ts`. Mirror it under README Port notes → Deviations. Export `InvalidBasicAuthUsernameError` from `index.ts` and list it under Added exports and `exportsAdded`.

### grok-1-2
- file: scratchpad/effected/npm/RegistryCredential.ts:100
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and section 14; operator revision 2026-10-09 (a lab change no law or diagnostic forced is restored). `effect/Function.ts` `dual` case 2 returns a function when `arguments.length < 2`.
- evidence: Oracle `basicCredentialFromPair` is a plain `(username, password) => BasicCredential`. The port wraps that body in `dual(2, …)` and publishes a data-last overload `(password) => (username) => BasicCredential`. No beep law requires dual here. The 2-arg success path is unchanged.
- failure: A one-argument call used to enter the body and throw. It now returns a function and does not check the username. Typed callers can pass one argument. That is a new accepted input with no `law:` or `upstream-bug:` cause, so it cannot be recorded as a deviation.
- fix: Drop `dual` and restore the two-argument function. Leave the tagged-error throw from grok-1-1 in the body.

### grok-1-3
- file: scratchpad/effected/npm/PackagePublish.ts:49
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and section 14; `@effect/tsgo` rule `effecttsgo/schema-number`; operator revision 2026-10-09 (`S.Finite` is one recorded systemic class)
- evidence: Oracle uses `Schema.optionalKey(Schema.Number)`, which accepts `NaN`, `Infinity`, and `-Infinity`. The port uses `S.optionalKey(S.Finite)` at `PackagePublish.ts:49-51` (`size`, `unpackedSize`, `entryCount`) and `:93`, `:95`, `:97` (`packedSize`, `unpackedSize`, `fileCount`), `NpmRegistry.ts:123` (`status`), `PublishError.ts:34` (`exitCode`), `PackageTarball.ts:49` (`status`), and `ReleaseAgeGate.ts:52` (`PartialReleaseAgeGate.ageMinutes`). README and `w2-npm.deviations` do not record it. `AgeMinutes` (`ReleaseAgeGate.ts:70`) already rejected non-finite values upstream via `Schema.isFinite()`; that site is not a deviation.
- failure: Decoding a non-finite number now fails where upstream `Schema.Number` accepted it. The gate forces `S.Finite` and does not check the ledger, so the section 14 record is missing. Reverting to `Schema.Number` fails `schema-number`.
- fix: Keep `S.Finite`. Add one deviation, cause `law:effecttsgo/schema-number`, listing the optional-number sites above, and mirror it in README Port notes → Deviations.

### grok-1-4
- file: scratchpad/effected/npm/DependencySection.ts:24
- class: law   severity: required
- standard: effect-laws-v1 law 19; EFFECTED_PORT_GOAL.md D5 (LiteralKit for named literal domains; kits apply in this review stage). `LiteralKit` extends `S.Literals`, so the decoded string union stays the same (`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts`).
- evidence: Named domains are still `S.Literals`: `DependencyKind` and `DependencyField` (`DependencySection.ts:24` and `:39`), `RegistryKind` (`RegistryKind.ts:19`), `PackageManagerPinName` (`PackageManagerPin.ts:92`), and `CachingPackageManager` (`PackageManagerCache.ts:34`). Anonymous field unions (`kind`, `reason`, `source`, and the `S.is(S.Literals([...]))` algorithm guard in `IntegrityHash.ts`) are the law 19 case that stays `S.Literals`.
- failure: Named literal domains do not carry the LiteralKit helpers law 19 requires. The four gated laws do not check this.
- fix: Replace those five named schemas with `LiteralKit` from `@beep/schema/LiteralKit`. Leave anonymous inline `S.Literals` in place. If the schema value's new helpers are treated as an observable addition, record one `law:19` deviation and any added export.

### grok-1-5
- file: scratchpad/effected/npm/README.md:274
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D4 (carried README). S2 has not run, so this stays backlog.
- evidence: Attribution contains `- scratchpad/effected/npm/DependencySection.ts:10 // KIND_TO_FIELD is the single source of truth; the inverse is derived from it,` which is the source comment from `DependencySection.ts:10`, not an attribution fact.
- failure: Port notes → Attribution includes a source comment.
- fix: Delete that bullet.

REQUIRED: 4
BACKLOG: 1
