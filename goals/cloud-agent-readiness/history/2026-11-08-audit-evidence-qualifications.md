# Bootstrap documentation and historical evidence qualifications — 2026-11-08

This note clarifies the recorded evidence without rewriting the original
[2026-11-02 receipt](2026-11-02-bootstrap-denied-host.md). It records a source
and document review, with no new bootstrap or denied-host execution.

## Vendor detection header

The bootstrap header now names the existing non-empty `CURSOR_AGENT` marker.
The implementation already considered it after the Claude and Codex markers,
with `BEEP_CLOUD_VENDOR` taking precedence. The header change is a comment;
vendor detection and its precedence are unchanged.

## Historical comparison revisions

The original table's initial six cases compare against the `7ae3f014` scripts.
Later cases also use intermediate revisions: two rows explicitly name
`ebc5a1f6` and `f1359e77`, and the R2 explanation names `989df624` for its
`fetch.sh` comparison. The column heading does not make every later result a
measurement against `7ae3f014`.

Some later rows do not name their comparison revision individually. Their
attribution remains unspecified here. An intermediate regression repaired in
the same change does not establish an inherited defect on the original base.

The final proxy-DNS row has no bold failure marker, while the recorded prose
counts four intended R2 failures. Preserve both the missing cell marker and
that stated count. This review does not independently rerun or reconstruct
the row's result.

## ShellCheck scope and acceptance

The receipt reports default-severity exit 1 with SC1091 on both its base and
head, and exit 0 at warning severity on the head. The warning-only result does
not satisfy the verification matrix's literal default-severity requirement
of no findings. The original missing-tool observation remains part of the
history. No fresh ShellCheck result is asserted by this note.

A historical phase milestone also does not establish every current acceptance
row. Keep unchecked acceptance and later host-specific gaps explicit until
corresponding evidence is verified. This clarification changes no phase or
initiative lifecycle state.
