# Supplemental extraction and resolution probes

Thirteen focused synthetic probes are now portable evidence under
`packages/law-practice/use-cases/test/fixtures/eyecite/supplemental-extraction.json`.
They supplement official test observations. They do not replace the canonical
case ledger, prove target parity, or establish exhaustive supplemental coverage.

## Observations

The authored `ops/supplemental-extraction-plan.json` fixes each input, expected
citation kinds and authority membership. The producer runs the unmodified
official pin with Python 3.11.15, `PYTHONHASHSEED=0` and clock date 2026-10-28.
It checks commit, tree and cleanliness before execution and cleanliness after.
It records dependency versions, source, license, lock, producer and plan hashes.

The probes cover these focused behaviors:

- Historical C.I.T. and Ct. Int'l Trade citations remain unequal and resolve
  into two groups, despite their shared current public reporter identity.
- An astral prefix shifts UTF-16 offsets relative to Python offsets; a combining
  prefix remains two code points. An astral character between citations also
  exercises later contextual offsets.
- `35 U.S.C. § 101 (2018)` and `37 C.F.R. § 1.56 (2020)` both produce canonical
  `FullLawCitation` observations. These examples require no extension behavior.
- Standalone `Id.` stays unresolved. Contextual `Id.` resolves to the previous
  authority, including after another full citation and across CRLF text.
- Repeated full citations share one authority; spaced reporter spelling has a
  corrected citation; a text with no citations has empty observations.

The projection records citation kinds, capture groups, corrected reporter,
corrected citation/full citation, three span variants, pairwise equality and
document-local authority membership. Each payload retains its original JSON
bytes and SHA-256 with a coherent schema-decoded view. This projection omits
full dataclass fields already captured by the official operation corpus; it
must not be presented as additional full-model coverage.

Two independent generations were byte-identical: 14,025 bytes, SHA-256
`bd632a6cf8387d130211a1ce806480ca6e5b13e818e3bb4ae84a66d6c37794b3`.
The committed JSON has the same decoded value. The original CIT probe remains
unchanged and is cross-checked for input, reporters, groups, spans, equality,
authority membership and model/resolve source hashes.

## Portable validation

`CitationSupplementalExtraction` is exported only through the use-case `/test`
surface. `ops/check-supplemental.ts --audit` validates exact plan IDs/order,
source ownership against the static inventory, dependency versions against the
operation corpus, payload hashes, citation kinds and planned resolution groups.
It checks equality matrix shape/reflexivity/symmetry and group membership, then
uses the public prerequisite offset conversion for all 57 span slices. Slice
text must exactly match the corresponding UTF-16 input interval.

The package `citation:parity-check --audit` now runs eight component validators.
The supplemental checker receives the selected fixture/evidence directories;
its default mode rejects unfinished target rows or remaining coverage. Target
test references, if supplied, must stay inside the repository, contain the
stated test name and match their captured file hash. This establishes reference integrity,
not execution success; the exhaustive target verifier still owes execution
receipts and full comparisons. Fixture text never supplies executable commands.

The five explicitly open supplemental families are cleaning/markup mapping,
annotation/diff ambiguity, tokenizer/callback injection, hash/model identity,
and malformed/adversarial inputs. All thirteen target rows remain in audit with
null proof. Default package completion therefore fails the supplemental,
canonical ledger and donor checks; the three remaining final verifier
entrypoints are still absent. There is no completion claim.

## Verification

The supplemental audit baseline passed. Default mode rejected the actual open
proof. Twenty-five corruption controls rejected missing/duplicate/unplanned
cases; missing licenses/workflow/proof fields; unknown states; stale provenance,
dependency and payload hashes; incorrect UTF-16 offsets, slices and spans;
invalid equality; collapsed historical authorities; altered reporters; a
misclassified regulation; hidden open coverage; and a target outside the repo.
Payload mutations were rehashed where needed so semantic checks were exercised.

The actual package command and relocated audit baseline passed, followed by
thirteen command-level rejection controls covering unfinished completion,
invalid arguments and a corrupted input for each of eight components. The
package audit and docgen passed in 19.2 and 19.1 seconds. The supplemental
command passed a separate strict TypeScript/Effect check. Formatting, Markdown,
diff and commit checks cover this checkpoint.

Supporting local logs are under
`/home/elpresidank/.cache/beep/citation-extraction-engine/`:
`supplemental-check.log`, `supplemental-controls.log`,
`supplemental-parity-controls.log`, `supplemental-typecheck.log`,
`supplemental-package-verify.log` and `supplemental-markdown.log`.
The portable proof is the committed plan, producer, schema, corpus, validator
and rejection-control source; cache logs are supporting observations.
