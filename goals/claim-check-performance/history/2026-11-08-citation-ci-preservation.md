# Citation coverage repair and unchanged claim-check measurement

Hosted coverage at `74c1f259bc2` found uncovered citation dump/repr paths and
package coverage below the unchanged floors. Two focused test files cover
Boolean/None/Text rendering, span/context boundaries, policy and input refusals,
chunked repr, shared-budget refusal, and valid and invalid integer inputs.

The sole production change removes an unreachable local integer-encoding error
mapper. Raw input is decoded before rendering, and `S.Int` produces an owned
safe-integer primitive. The finite encoder therefore cannot reject an accepted
integer. The final code keeps `S.encodeEffect`, treats an impossible internal
schema failure as a defect with `Effect.orDie`, and leaves `parts.literal`
outside that conversion so its budget errors retain their existing channel.
Malformed raw values still fail at the original `invalid-input` decoder.
Independent review verified this boundary against the installed schema parser.

The initially proposed synchronous conversion failed `TS377130` before commit;
that failed check remains retained. The final Effect composition passes package
source and all-test typechecks, all six focused tests, package lint and scoped
native Fallow with zero findings. No coverage floor, baseline or suppression
changed. No local audit/full-root queue or declaration rebuild was run for this
repair.

The coverage projection combines the retained canonical hosted producer maps
with the new focused map. It transfers hits only across exact unchanged source
ranges into the new map geometry and discards records spanning the changed
encoder region. It does not merge shifted numeric map IDs. The projection has
100% lines for all three reported files and package branches/functions/statements
of 94.25/95.54/97.47%, above the unchanged floors. This remains a projection;
the new published head must pass hosted coverage.

The committed source head `042f16c8bc33` then received a fresh full-538 replay:
**48 strict, all 48 retained, zero gains/losses, zero changed selected score
rows, 537 parsed and 538 abstained**. All 60 embedded report payloads remain
byte-identical under compact UTF-8 encoding preserving property order, and all
1,219 context records and source-input ledgers are unchanged. The decoder
rejection control, pre/post runtime verification and original preservation pass.
The new 121 output files are sealed separately.

Capture established that `Dump.ts` is outside the claim-evaluation closure.
An initial expectation of one changed runtime file was corrected from the
actual manifests: all 1,845 file pins, 1,544 input paths, 94 asset pins and the
entire runtime metadata object are identical. The new implementation digest
differs through ancestry metadata only. Static equality and this preservation
replay establish no additional performance gain.

All 1,213 original bindings and 1,974 prior artifact files across 20 recorded
groups verify unchanged. The independent source, closure and actual measurement
reviews are retained. The full usefulness gate package remains unmet and the
goal stays active.

Numerical receipt:
[citation-dump-ci-preservation-001.json](../research/citation-dump-ci-preservation-001.json).
Private coverage evidence is under
`~/.cache/beep/claim-check-performance/pr2980-dump-coverage-repair-001/`;
the replay is under `citation-dump-ci-evaluation-001/`, with separate runtime
and product archives. References, source fixtures, scorer and earlier results
remain intact.
