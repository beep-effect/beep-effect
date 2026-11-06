# Source metadata year checkpoint — 2026-11-03

`MetadataYear.ts` adapts the original helpers.get_year native-string behavior.
Installation captures Effect Clock and CurrentTimeZone once, like the source's
module-import date, and freezes the upper year at that local calendar year plus
one. Calls require no services. Later caller clock/zone changes cannot alter
the bound. Installation rejects dates outside Python date's year 1..9999 domain
with a closed error rather than silently defining additional calendar behavior.
A final live engine Layer still needs to supply the intended local zone and
establish its import/installation lifetime; this private component does not
close that integration obligation.

## Source observations

`ops/probe-metadata-year.py` verifies the clean pinned commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e and tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, CPython 3.11.15, Unicode 14.0.0,
regex 2023.12.25 and the 4300-digit integer-conversion limit. It calls the actual
helper, explicitly parameterizing only its import-time highest-valid-year value.
Five bound profiles retain 1169 observations, including 744 accepted years.

The corpus covers every one of Python's 660 decimal code points and 128
nondecimal digit characters, all 29 str.isspace characters in leading/trailing
positions, every ASCII point in leading/internal positions, signs, underscores,
numeric-looking invalid strings, scalar versus literal-surrogate words, a digit
introduced after Unicode 14 and 4299/4300/4301-digit boundaries. Leading zeroes
and underscore-separated long inputs retain Python's actual digit counting.

Producer SHA-256:
`2f750eee2f2cebeca4aad071c72999797a23c8e0acb1f72b9f943a835ac22807`.
Formatted metadata-year.json SHA-256:
`af1fab4a6b980c333431a28aef7f4529cd4d684d4d2b56689e1873b0f92a899a`.
Regeneration and formatting compare byte-identical.

## Reuse and parsing

The existing frozen PythonTextData supplies decimal and whitespace facts.
`PythonDecimal.ts` shares one immutable Effect HashMap between resolution and
year conversion; the existing resolver's arbitrary-precision conversion is
otherwise preserved. PythonUnicode supplies a borrowed native-point reader for
already validated source storage. Reading native points independently avoids
turning adjacent literal surrogate words into one scalar digit.

The source integer grammar permits one ASCII sign and single underscores only
between decimal digits. It distinguishes integer-parser ASCII whitespace from
str.isspace's additional ASCII separators U+001C..U+001F. Non-ASCII whitespace
uses the frozen Python facts. Decimal accumulation saturates above 10000, the
largest possible upper bound from a valid source date. It continues to validate
syntax and count digits; leading zeroes remain significant to the 4300-digit
limit. This bounded arithmetic preserves every observable get_year result
without allocating an unbounded integer. Invalid conversion and out-of-range
years return None-equivalent Option data; malformed native representations and
resource exhaustion remain typed boundary failures.

## Validation and remaining work

Thirteen tests pass in CitationMetadataYear, CitationResolverText and
CitationPythonUnicode. All 1169 observations compare. Controls cover both sides
of a UTC year boundary under different captured zones, a later clock change,
invalid source calendar dates, malformed native storage, exact text limit and
fresh-call recovery, and the captured deadline under a disabled caller Clock.
Each clock-changing test has its own upstream TestClock layer; sharing a clock
caused cross-test deadline interference and was corrected without suppressions.
Server quick verification passes lint and source/test type checks.

This is get_year behavior, not completed metadata extraction. Law/journal/case
metadata assignment, parenthetical processing, pincites, document offsets,
references, parallel citations, filtering, custom protocols and the remaining
full-goal accounting/safety gates remain open. No semantic waiver or quality
floor change is introduced.

Scoped Oxlint, staged new-only Fallow (zero introduced findings), schema-first
and Effect/Vitest policy checks, deterministic repeat capture and portable
divergence accounting pass. No new policy exception is retained.
