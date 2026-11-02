# Visible synthetic CLI and desktop evidence

Previously, the live proof distinguished its synthetic inputs through session
names. Privacy hashing correctly removed those names, also removing the visible
CLI/desktop distinction. The new optional route policy permits exactly two finite
fixture labels. Ordinary routes remain disabled by default and ignore producer
fixture claims. Enabled invalid values refuse the span.

Labelled spans have names such as `fixture.cli.agent` and
`fixture.desktop.agent`, with `ai_metrics.synthetic=true`,
`ai_metrics.fixture.surface=cli|desktop`, and
`ai_metrics.fixture.provenance=declared_synthetic_fixture`. Session names remain
hashed. These describe synthetic examples, never actual CLI/desktop application
instrumentation. Real harness coverage remains unknown until separately proved.
The collector accepts only matching finite names/annotations. Native read-back
checks these managed fields even when expected to be absent.

## Precision defect found by the live proof

The first new live proof stored two correct labelled records but failed because
worker reconciliation never wrote visibility. The source timestamp ended in
`.837194870` seconds; Phoenix stored `.837195`. Its pinned source uses
`datetime.fromtimestamp(time_unix_nano / 1e9, tz=timezone.utc)`, which rounds through
floating-point seconds. The previous reader required truncation to `.837194`.
No data loss was established; the mismatch was in representation verification.
The failed proof, both backend records and its local journal remain retained;
the owned service/frontend/collector were stopped and removed. The old IDs were
not resent. See `ops/phoenix-time-quantization-regression.json`.

Read-back now permits only the adjacent representable microsecond bucket, with
strict integer difference below 1000 nanoseconds and exact original timestamp
attributes. Already aligned values must match exactly. Point spans cannot split
into a duration and endpoint order cannot reverse. Tests reproduce the former
failures and reject excessive drift, altered exact timestamps, unexpected fixture
keys and invalid endpoint shapes. Very distant future values whose backend float
representation exceeds this bound remain unqualified rather than silently
broadening the tolerance.

The refreshed disposable and live fixtures deliberately use an 870-nanosecond
remainder so upward rounding is exercised, not left to timing chance. Current verification passed:

- `surface-label-package-verification.json`: full package audit and docgen,
  165 current source/test fingerprints.
- `surface-label-cli-verification.json`: both scoped compilers and29tests,
  11 source fingerprints. Whole-CLI gate remains open.
- `surface-rounded-recovery-verification.json`: pinned disposable backend,
  three native plus six reconstructed records, exact upward-rounded microsecond
  fields, unchanged exact source nanoseconds, nine invalid route combinations
  filtered, and seven attempts/one dropped/six upstream replay accounting.
- `surface-label-live-verification.json`: two exact labelled records in project
  `foundation-canary-c04d2cf89339`, both worker visibility receipts, explicit
  870ns remainder, pause/refusal and rollback, backend evidence preserved.
  All83 source fingerprints matched both before build and after cleanup.
  Maintenance/restart/credential and independent local health proof also pass.
- `surface-label-proof-archives.json`: same-host fsynced failed and passing proof
  material. These bundles are retained evidence and must not be executed.

The failed first canary remains historical evidence of the discovered defect;
its original IDs were not resent. The successful run used a fresh bounded project.
The historical forwarder service/timer remain masked and inactive. No production
collector or actual harness enrollment changed. Final independent review and the
remaining SPEC/repository gates retain their own acceptance requirements.


## Rollback boundary

Disabling the optional route policy restores ordinary intake behavior. Do not run
an older reader against newly labelled journals: older encoders cannot reproduce
the original labelled bytes and must not reinterpret them. Preserve these journals,
receipts and backend records as held evidence. Restore older service/template code
only on the corresponding older/unlabelled state or a separately validated restored
destination. Never change old IDs or erase conflicts to make a downgrade appear
successful. The tested operational rollback stops/removes the new owned route and
preserves its state, not an in-place historical schema downgrade.

Independent Astra review accepted this focused delta and closed F9/F10. It matched
all retained source fingerprints and checked both stored live labels, exact source
times, visibility receipts and cleanup. Whole-goal acceptance remains held; see
review-panel-astra.md for scope and outstanding requirements.
