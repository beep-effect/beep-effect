# Supplemental cleaning and annotation observations

The supplemental bundle advances to `citation-supplemental-extraction/v2`.
Its original thirteen extraction/resolution probes remain unchanged as
observations. Twenty-six text probes add ten cleaning and sixteen annotation
cases, with twenty-three successes and three expected failures. The combined
bundle has thirty-nine audit rows and eighty coordinate records. All target
proof stays null; five supplemental coverage families remain explicitly open.

## Pinned observation and provenance

The authored `ops/supplemental-text-plan.json` retains each input, exact expected
outcome and mapping trace. The expected results were inspected against the
pinned implementation. `ops/observe-supplemental-text.py` calls the public
operations and traces actual `SpanUpdater.update` returns, restoring the method
in `finally`. It does not replace the diff algorithm or annotation decisions.
The main producer verifies the clean commit/tree before and after execution,
retains the same Python/dependency/clock/hash-seed pins, and binds the text plan
and observer source by SHA-256. Seven oracle source-file hashes reconcile with
the existing static inventory, now including clean, annotate and utility code.

Each text observation uses the existing exact-byte JSON codec. Its digest binds
input, output or exception, mapping updates and coordinate records. Two separate
generations and the committed fixture were byte-identical: 30,456 bytes,
SHA-256 `ce596f3c6af59ede5d320a2a33cd4b5ed0a0c5fb9458b54b769f7b7867832714`.
The BSD-2 attribution and terms already retained in `THIRD_PARTY_NOTICES.md`
cover these oracle-derived observations. There is no new runtime dependency.

## Cleaning behavior

The probes retain no-op cleaning; inline versus all-whitespace behavior,
including zero-width space; underscore removal; XML followed by HTML cleaning;
hidden HTML content; nonbreaking space/entity handling; and cleaner ordering.
Removing underscores before whitespace collapse produces `a b`; reversing the
steps produces `a  b`. HTML cleaning alone preserves a nonbreaking space.

Empty HTML produces `lxml.etree.ParserError` with `Document is empty`.
An unknown cleaner produces the exact upstream `builtins.ValueError`, including
the ordered cleaner-name list. These are oracle observations, not approved
target error-union members. Target failures still require the closed engine
error mapping. Injected cleaner callbacks remain a separate open obligation.

## Annotation and source evidence

The probes cover plain and astral text; markup mapping; unchecked, skip and wrap
HTML modes; repeated-source insertion and deletion using both diff algorithms;
overlap clipping; duplicate coverage; zero-width insertion; invalid mode;
empty input; and a changed source with no annotation spans. The invalid mode
preserves the exact upstream `ValueError` and its message.

Mapping traces retain the left/right bisect choice and returned Python offset.
Mapped coordinate records index the source before overlap clipping or HTML
balancing. Input records index plain text. Neither is a verified raw anchor.
The checker compares planned inputs, outcomes and traces, then independently
converts all fifteen annotation input intervals and eight mapped intervals.
Three intervals are zero-width points. Nonempty ranges use the public
prerequisite converter; nonzero points use a nonempty prefix to obtain their
UTF-16 boundary, and a point at zero maps to zero. Point text must be empty.
No empty `VerifiedSpan` or `TextOffsetRange` is constructed.

Two observed choices require explicit fidelity/anchoring resolution before
target readiness:

- A source containing two identical citations is annotated at the first
  occurrence by both diff implementations in the selected probe.
- When the second plain-text occurrence has been deleted from the source,
  its boundaries both map to the source end, producing an empty annotation.

These observations do not authorize selecting an ambiguous raw anchor or
claiming that deleted text is present. The raw verification contract remains
binding. No target divergence is implemented or approved by this checkpoint.
The focused projection stores text outcomes and mapping updates; logging and
diagnostic fidelity still require audit, including the skip-mode warning.

## Validation

The supplemental validator now checks both ledgers, globally unique IDs, exact
plan coverage, source/observer/plan hashes, all outcome variants, coordinate
ownership, mapping direction and boundary consistency. Test reference checks
apply to text rows too. Completion checks include all thirty-nine rows and
reject actual unfinished proof. The package audit still has eight components;
its existing supplemental component now owns the expanded bundle.

The supplemental audit passed, default mode rejected the open proof, and all
fifty-two corruption controls passed. The new controls exercise missing or
duplicate text rows, cross-ledger ID reuse, absent metadata, stale observer and
source hashes, failure-to-success changes, exception identity/message changes,
cleaner order, diff mode, mapping side/boundary/trace, UTF-16 ownership,
zero-width evidence and target references. Payload changes are rehashed before
validation so semantic rejection paths are exercised.

Both package-command audit baselines and all thirteen command-level rejection
controls passed. Package audit/docgen and the standalone command's strict
TypeScript/Effect checks passed. Formatting, Markdown and diff checks cover the
authored checkpoint. This proves evidence consistency, not target execution or
exhaustive parity.

Supporting logs are under
`/home/elpresidank/.cache/beep/citation-extraction-engine/`: `text-check.log`,
`text-controls.log`, `text-parity-controls.log`, `text-typecheck.log`,
`text-package-verify.log` and `text-markdown.log`.
