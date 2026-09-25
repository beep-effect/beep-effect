# Schema resource and live-clock preparation

Wave C continues the saved resource and flake inventory before assertion and
property migration. This receipt records local preparation, not a completed wave
or canonical finding disposition.

- CsvParser removes the empty Layer cast; test bodies and assertions stay intact.
- DOM constructor fixtures capture their original descriptors before setup and
  restore descriptors or original absence in suite teardown.
- Markdown renderer replacement restores the original property descriptor or
  absence. All consumers share a serialized suite boundary.
- Protobuf BigInt spy ownership uses acquire/release; all scalar consumers share
  a serialized suite boundary. The three invalid inputs and not-called checks
  remain.
- Both live LocalDate cases bracket the operation with real-clock observations
  and compare the complete UTC year/month/day tuple. Existing TestClock cases
  remain unchanged.

Validation after all five files changed:

- `bun run beep quality package-verify @beep/schema`: audit and docgen passed.
- Focused Vitest run for these five files under Node: 116 tests passed.
- The same focused run under Bun: 116 tests passed.
- `git diff --check`: passed.

No full schema coverage or hosted proof is claimed. No production source changes
were needed for this preparation. Assertion/property migrations and runner
adoption remain pending; canonical findings are not marked fixed yet.
