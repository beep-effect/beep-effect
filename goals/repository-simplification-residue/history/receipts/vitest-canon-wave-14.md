# #1875 Effect Vitest canon wave 14: record

Branch `test/vitest-canon-wave14` off `main` `66d3427553`. Scope: every remaining EV015
`shared-test-clock-adjustment` exception (12 rows, 11 tests, 7 files).

## Migration

Each exception's exit read "retire when each clock-adjusting test owns its TestClock, for example
a single-case `it.layer(TestClock.layer())` block". This wave does exactly that. Each test that
advances the clock is wrapped in its own `it.layer(TestClock.layer())("<title> (own clock)", ...)`
block inside its existing suite, so it keeps the suite's services and gets a TestClock no other
test shares. A ts-morph script did the wrapping: it found each flagged `TestClock.adjust` and its
enclosing `it.effect` statement. Test bodies, assertions, timeouts and suite options are
unchanged.

| File | Package | Tests | Rows |
| --- | --- | ---: | ---: |
| `test/AiProviderCliSession.test.ts` | ai-provider-cli | 2 | 2 |
| `test/ContradictionDetection.golden.test.ts` | epistemic-use-cases | 1 | 1 |
| `test/AgentMessage.runtime.test.ts` | repo-cli | 2 | 2 |
| `test/accounts-usage.test.ts` | repo-cli | 1 | 1 |
| `test/cache-acceptance.test.ts` | repo-cli | 1 | 1 |
| `test/cache-producer.test.ts` | repo-cli | 1 | 1 |
| `test/yeet-ready-gate.test.ts` | repo-cli | 3 | 4 |

## Inventory, paired by `(ruleId, file, occurrence)` against `66d3427553`

| | Rows | Exceptions | Open |
| --- | ---: | ---: | ---: |
| Before | 448 | 448 | 0 |
| After | 436 | 436 | 0 |

- Gone: 12, all EV015. EV015 now has **0** rows.
- New: 0.
- One identity move: the EV004 exception at `AgentMessage.runtime.test.ts:669` became `:672`
  when its test was nested. Its evidence is byte-identical, and its existing reason moves with it.
- A plain rescan reports `introduced=0 resolved=0`.

## Verification

| Check | Result |
| --- | --- |
| The 7 files, Bun and Node 24 | ai-provider-cli 49, epistemic-use-cases 20, repo-cli 257: all pass |
| `turbo run check` for the 3 packages | exit 0 |
| Biome | clean |

Coverage, package-verify and final-check are left to hosted CI under the push-first rule.
