# Fallow runtime refactor checkpoint

Following the regex grammar checkpoint, separate runtime validation and state
transitions into named operations with the same call order and closed failures.

- Capture the existing regex deadlines/Clock in one shared policy helper,
  preserving each caller's precision and queue-inclusive timeout boundary.
- Separate capture-record progress checks, flat JSON byte-state handling,
  native-layout measurement and bounded atom encoding.
- Compare optional edition references using their canonical equivalence;
  separate non-null case hashing from occurrence-identity handling.
- Preserve registry primitive/subclass protocol dispatch and reference pruning.
- Share original Python text measurement; retain native width/word validation,
  frozen hashes, interruptibility and no extra encoded copy.
- Separate callback selection/result snapshots from session recording, keeping
  dictionary reads, callback order, alias refresh and actual ownership checks.
- Separate cleaner charge consumption, callable lookup and empty-plan charging.
- Separate source validation from native HTML process ownership; retain retirement.
- Separate document ID uniqueness from reference/identity coherence checks.

Verification: **106 tests across 17 server suites** and **12 CitationDocument
tests** pass. Server and domain test type checking pass. Package laws pass with
only the existing PracticeKg flow advisory. The new-only Fallow audit against
`432dbaa867` reports **37 complexity findings, all in tests/fixtures**, and
**17 clone groups**. No production source complexity findings remain in that
audit. These remaining findings are actionable; Fallow is not yet green.

No suppression, threshold change, source-fixture change, or semantic waiver is
introduced. Hosted native exhaustive qualification and coverage remain pending.
