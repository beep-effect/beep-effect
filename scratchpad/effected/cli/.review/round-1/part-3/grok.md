I'll review the listed CLI render and UI files against the pinned upstream oracle and the port decisions, and report only findings.The review is still open. I am finishing the unread renderer and live-loop comparisons, then I will report only findings.Schema errors take their `name` from the identity string unless a subclass overrides it. I am checking the four classes that skip that override, and the renderer and live-loop bodies that were not compared yet.### grok-1-1
- file: scratchpad/effected/cli/ui/Confirm.ts:22
- class: bug   severity: required
- standard: D9, section 14 ("different formatted byte")   evidence: `Schema.Error` assigns the identifier to `prototype.name` (`~/YeeBois/references/effect/effect/packages/effect/src/Schema.ts:16221`). `$I`DuplicateToggleKeyError`` is `@beep/scratchpad/effected/cli/ui/Confirm/DuplicateToggleKeyError`. `Error.prototype.toString` is `name + ": " + message`, and `Die.toString` formats the defect through that (`internal/core.ts:340`). Upstream `Confirm.ts:102` throws `new Error(...)`, whose name is `"Error"`. The throw is at lab line 117. `scratchpad/test/cli/ui/Confirm.test.ts:57` matches `/unique.*x/` and stays green.
- failure: A duplicate toggle key stringifies as `@beep/scratchpad/effected/cli/ui/Confirm/DuplicateToggleKeyError: @effected/cli/ui: Confirm toggle keys must be unique; "…" repeats`. Upstream stringifies as `Error: ` plus the same message. Law 7 forces `S.TaggedError`. It does not force this name. `ScreenExited` (`CliUi.ts:44`) and `DuplicateItemKey` (`MultiSelect.ts:27`) already set the instance name back to `"Error"`.
- fix: Add `override readonly name = "Error"` on `DuplicateToggleKeyError`.

### grok-1-2
- file: scratchpad/effected/cli/ui/Select.ts:18
- class: bug   severity: required
- standard: D9, section 14 ("different formatted byte")   evidence: Same `prototype.name` assignment as grok-1-1. Identifier `@beep/scratchpad/effected/cli/ui/Select/NoEnabledChoiceError`. Upstream throws `new Error(NO_ENABLED_CHOICE)` at oracle `Select.ts:122` and `:315`. Lab throws at lines 141 and 340. `Select.test.ts:88` checks `defect.message` only.
- failure: An empty enabled-choice list stringifies with the scratchpad identifier as `error.name`, so `String(error)`, `error.stack`, and `Cause.pretty` (`internal/effect.ts:327` copies `original.name`, `:378` rebuilds `${name}: ${message}`) start with `@beep/scratchpad/effected/cli/ui/Select/NoEnabledChoiceError: ` instead of `Error: `. The message text is still `NO_ENABLED_CHOICE`.
- fix: Add `override readonly name = "Error"` on `NoEnabledChoiceError`.

### grok-1-3
- file: scratchpad/effected/cli/ui/DocView.ts:14
- class: bug   severity: required
- standard: D9, section 14 ("different formatted byte")   evidence: Same `prototype.name` assignment. Identifier `@beep/scratchpad/effected/cli/ui/DocView/MissingDocViewThemeError`. Upstream `DocView.ts:58` throws `new Error(OUTSIDE)`. Lab throws at lines 71 and 74 with the same `OUTSIDE` string. No test pins `error.name`.
- failure: A `DocView` drawn with no `ctx` and no theme stringifies as `@beep/scratchpad/effected/cli/ui/DocView/MissingDocViewThemeError: @effected/cli/ui: DocView was drawn with no ctx…`. Upstream stringifies as `Error: ` plus that message. The inner throw at line 74 is the same class.
- fix: Add `override readonly name = "Error"` on `MissingDocViewThemeError`.

### grok-1-4
- file: scratchpad/effected/cli/ui/CliUiLive.ts:251
- class: bug   severity: required
- standard: D9, section 14 ("different formatted byte")   evidence: `Effect.die(LiveTickError.make(...))` at line 273 replaces oracle `CliUiLive.ts:266` `Effect.die(new Error(TICK_INVALID(tickMillis)))`. `Exit` failure `toString` prints `Die(${format(defect)})` (`internal/core.ts:340`), and `format` uses `Error.prototype.toString` (`Formatter.ts:167`). `CliUi.live.modes.test.ts:110` only asserts `String(exit)` includes `"tickMillis"`.
- failure: An invalid `tickMillis` dies as `@beep/scratchpad/effected/cli/ui/CliUiLive/LiveTickError: @effected/cli/ui: CliUi.live's tickMillis must be a positive, finite number of milliseconds, not ${tickMillis}`. Upstream dies as `Error: ` plus that message. The inclusion check stays green.
- fix: Add `override readonly name = "Error"` on `LiveTickError`.

### grok-1-5
- file: scratchpad/effected/cli/ui/Confirm.ts:117
- class: bug   severity: required
- standard: D9, section 14 ("a different error tag"); law 7   evidence: Ledger `w4-cli.deviations` is `[]` (`PORT_LEDGER.json:7890`) and README Port notes say `None` (`scratchpad/effected/cli/README.md:233`). Upstream throws or dies with `new Error(message)` at oracle `Confirm.ts:102`, `MultiSelect.ts:115`, `Select.ts:122` and `:315`, `DocView.ts:58`, `CliUi.ts:208`, `CliUiLive.ts:266`. Lab uses `S.TaggedError`, so each value has an own `_tag`. `Data.Error` copies enumerable schema fields (`internal/core.ts:674`, `internal/record.ts:16`). Message-level tests stay green: `Confirm.test.ts:57`, `MultiSelect.test.ts:77`, `Select.test.ts:88`, `CliUi.run.test.ts` ("exited without resolving"), `CliUi.live.modes.test.ts:110`.
- failure: The died or thrown value's tag and class differ from `Error` at all six sites: `Confirm.ts:117` (`DuplicateToggleKeyError`), `MultiSelect.ts:132` (`DuplicateItemKey`), `Select.ts:141` and `:340` (`NoEnabledChoiceError`), `DocView.ts:71` and `:74` (`MissingDocViewThemeError`), `CliUi.ts:221` (`ScreenExited`), `CliUiLive.ts:273` (`LiveTickError`). `message` is an own enumerable field, so `JSON.stringify` includes `_tag` and `message`. Law 7 forbids going back to `new Error`. The deviation is unrecorded, so the module still claims there is none.
- fix: Add one `w4-cli` `deviations` entry and a README Port notes row with reason `law:7`, covering these six sites. Pin `_tag`, `name === "Error"` (after grok-1-1..4), and the unchanged message in one test.

REQUIRED: 5
BACKLOG: 0
