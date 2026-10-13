I'll review the xdg port at that commit against the oracle and round-1 inventory, and report only new findings.Round 1 closed eight required items. I'll check this commit against the oracle and those fixes, and only report what is still open.The round-1 required fixes are in the source. Next I’ll compare the oracle and the new S2/S3 tests for anything the gates would miss.The empty-string regression tests never reach the normalization they claim to pin. `ConfigProvider.fromUnknown` drops `""` before `Xdg.layer` reads it, so those cases stay green if the round-1 filter is removed.

### grok-2-1
- file: scratchpad/test/xdg/Xdg.test.ts:22
- class: test   severity: required
- standard: D9, section 14, section 11.4 (vacuous checks).   evidence: `env` builds `ConfigProvider.fromUnknown(vars)` with no options. In the Effect reference, `fromUnknown` sets `preserveEmptyStrings` only when that option is `true` (`ConfigProvider.ts:797-801`), and `emptyStringAsMissing` then turns `""` into a missing node (`ConfigProvider.ts:844-851`). The same default is documented for `fromEnv` (`ConfigProvider.ts:911-915`). The empty-variable cases at `Xdg.test.ts:99-105` and the empty-`HOME` case at `Xdg.test.ts:108-120` therefore see a missing key. `Config.String` and `Config.NonEmptyString` both fail on a missing `HOME`, and `Config.option` yields `None` for a missing optional key, so `O.filter(..., Str.isNonEmpty)` is never given `Some("")`. Line coverage of `Xdg.ts` still hits that expression via non-empty values. Reverting `Config.NonEmptyString("HOME")` to `Config.String` and removing the `Str.isNonEmpty` filter leaves this file green.
- failure: The tests cited for the empty-environment deviation do not observe it. An empty optional directory stays an absent key, and an empty `HOME` still fails with `XdgEnvError`, even when `Xdg.layer` keeps empty strings. A provider built with `preserveEmptyStrings: true` can again resolve those values as relative paths with these tests still passing.
- fix: Pass `{ preserveEmptyStrings: true }` from `env`. Keep the absent-key and typed-`XdgEnvError` assertions. Leave the non-empty search-path cases and the `layerFrom` empty-path case as they are.

### grok-2-2
- file: scratchpad/test/xdg/AppDirs.test.ts:160
- class: test   severity: required
- standard: D9, section 14, section 11.4.   evidence: The application-resolution test uses the same default `ConfigProvider.fromUnknown` as grok-2-1 (`AppDirs.test.ts:160-163`). With empty `XDG_*_HOME`, `XDG_RUNTIME_DIR`, `APPDATA`, and `LOCALAPPDATA` erased by the provider, `resolveAll` takes the absent-key ladder on the oracle too: `config`/`data`/`cache`/`state` become `/home/ada/.myapp`, runtime is absent, and `native: true` on darwin still reaches `NativeDirs`. The assertions at `AppDirs.test.ts:166-179` pass without `Str.isNonEmpty`.
- failure: This regression does not fail if empty environment bases are retained and joined into relative application directories. That includes the Windows native bases, where `NativeDirs` treats `""` as present (`paths.appData ?? fallback` at `NativeDirs.ts:102-103`).
- fix: Pass `{ preserveEmptyStrings: true }` on this `fromUnknown`. Keep the current path, runtime, and darwin assertions; they are the right oracle once the empty strings actually arrive.

### grok-2-3
- file: scratchpad/test/xdg/NativeDirs.test.ts:55
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D5; goal section 11.2.   evidence: The win32 cases at `NativeDirs.test.ts:55`, `:66`, and `:79` unwrap `Option<NativeDirs>` with `O.getOrThrow` and then `assert.strictEqual` the fields. The canon detector’s EV006 pattern is hand-rolled `expect` checks, so `O.getOrThrow` stays inside a green S3 run. The darwin case at `:34` already uses `assertSome` with the full `NativeDirs` payload.
- failure: A `None` result throws inside the effect instead of failing as an Option assertion, and the expected win32 payload is not checked as one value.
- fix: Assert those three results with `assertSome(native, NativeDirs.make({...}))` and the same path strings. Drop the `O.getOrThrow` field checks.

### grok-2-4
- file: scratchpad/effected/xdg/README.md:75
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md systemic `S.Finite` ruling; `schema-number` (`effect-tsgo` `docs/rules/schema-number.md`); numeric-domains deviation.   evidence: The config-file example still declares `port: S.Number`. The integration fixture at `scratchpad/test/xdg/XdgConfig.test.ts:198` uses `S.Finite`. Docgen typechecks JSDoc fences, so this README fence is outside that gate.
- failure: The adapted README teaches a number schema that accepts `NaN` and infinities for the same save-path example the test pins with `S.Finite`.
- fix: Change that example field to `S.Finite`.

REQUIRED: 2
BACKLOG: 2
