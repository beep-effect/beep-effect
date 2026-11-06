# Original case-name processing and stop-word cleaning

This is source evidence for the next adapter, not target execution or completion
proof. The original `strip_stop_words` and `_process_case_name` functions execute
from the clean pinned eyecite checkout. No source helper is reimplemented by the
producer. Real FullCaseCitation, ShortCaseCitation, Document and token objects
retain their built-in methods and attribute behavior. Wrappers record original
regex sub/split invocations and return their unchanged results.

The corpus contains 178 stop-word inputs, 328 processing cases and 2,166 regex
calls. Processing retains complete before/after metadata attribute dictionaries,
numeric year, matched/full spans, each regex input/output and the source error
class. There are 100 TypeErrors and 16 ValueErrors. A failed source call can leave
metadata changed; those states are evidence, not a proposal to expose partial
results through the target's closed failure boundary.

Each of the scanner corpus's 56 successful source states is processed under
both full/short forms and seeded/default prior metadata: 224 cases. The eight
failed scans are excluded because this source path never calls processing after
a failed scan. Another 104 cases exercise built-in supplied state dictionaries
independently, explicitly distinguished by null scanCase. Their reachability
through the initialized scanner is not claimed. Seeded short objects carry prior
plaintiff/defendant attributes assigned after construction; these attributes are
not declared by ShortCaseCitation.Metadata but are writable by the source helper.
Snapshots use the actual attribute dictionary so newly created fields are kept.

## Constraints for the target implementation

- Stop-word cleanup is ordered: case-sensitive STOP_WORD_REGEX substitution to
  a space; case-insensitive leading In removal; whitespace and parenthesis
  trimming; selection of the second semicolon component; then case-insensitive
  STOP_WORD_REGEX substitution to empty, comma/space trim and whitespace trim.
- The source pattern `^(?i)In\s+` is accepted by regex V0 and rejected by CPython
  3.11 re. Ten real grammar outcomes cover four raw patterns and both stop-word
  flag settings in both engines. The existing structural compiler does not yet
  support this global inline flag placement; do not silently rewrite the raw
  pattern identity or use a JavaScript matcher as an approximation.
- The v separator split is case-sensitive and limited to one split. A truthy
  selected v token does not guarantee a separator match. Lowercase plaintiff
  removal precedes stop-word cleaning; short mode assigns antecedent_guess.
- Metadata fields update conditionally. Preserve absent versus present fields,
  prior values, and the source order of assignment. A successful cleaned name
  updates the full-span start using native word lengths and Python slicing,
  including negative starts and explicit span start zero.
- Pre-citation year uses direct Python int, not the existing bounded get_year
  helper. This admits zero, Arabic decimal digits and signed whitespace forms,
  while regex-V0 Unicode digits newer than Python Unicode 14 can fail conversion.
  Year metadata is assigned before conversion, and can survive a ValueError.
- Native scalar versus literal surrogate-pair text, unpaired surrogates,
  Unicode case equivalence, all Python whitespace scalars, alternation order,
  consumed separator whitespace, adjacent stop words and semicolon order remain
  distinct source observations.

## Reproduction and portable seal

Oracle commit: 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e; tree:
a35a58fac03400f71a93a93485b77f1d56f2b02f. Interpreter: CPython 3.11.15;
regex 2023.12.25 V0. The producer requires clean source and records hashes of
helpers.py, regexes.py, its own bytes and the prerequisite scanner corpus.

| Artifact | SHA-256 |
| --- | --- |
| Producer | ffb105df6a837b5d8179f53f60dc800979b661a550362e6b48e672ae83791767 |
| case-name-process.json | 027c7f42d55d4fe9ee6f000c98c6427d4931f45bf82675277f60864762b51505 |
| Required case-name-scan.json | 9731078b964f5daa0c075b630a5fa236efe06cb297c123f45f39a637bbac9553 |

PYTHONHASHSEED 307 and 311 produce byte-identical corpora. The portable verifier
checks the full byte seal, producer/dependency identity, complete scan-state
coverage, contiguous case IDs, source-error counts, ordered substitutions and
grammar outcomes. Eight corruption controls reject missing strip/case/grammar
rows, altered provenance hashes and trailing-byte changes. Optional live replay
requires byte identity with the committed corpus. Both the portable controls and
live replay pass. These checks qualify source evidence only; implementation,
resource ownership, runtime replay and exhaustive helper acceptance remain open.

The goal prompt was also shortened without dropping its requirements to restore
the manifest's existing 4,000-character admission limit after accumulated
publication amendments. The authorized follow-up exception remains explicit.
