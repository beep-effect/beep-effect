# P0 labeling disposition — blocked

The out-of-repo blind directory held only the guide, opaque fixture texts and
`inputs.jsonl`. No label A file existed when either B run began. Both commands
used GPT-6.1-Sol medium, `--ignore-user-config`, `--ephemeral`, and read-only
sandboxing. Both processes ended normally; no auth/model fallback was needed.

## Audits

- Run 1: command paths were local and item types allowlisted, but output line 28
  is invalid JSON. Void. The label A freeze script failed before writing any
  labels; the discarded B output was then opened prematurely by a dependent
  batched read. This ordering fault is recorded as a friction receipt.
- Run 2: fresh out-of-repo blind directory, same source hashes and boundaries.
  The output also fails JSON parsing. Void. No B result is used as label evidence.
- B labels are unavailable after the brief's two permitted attempts. Repairing
  their JSON manually would not satisfy the recorded audit and is not done.
- Label A was frozen after the second run ended, before its output was opened.
  Its SHA-256 is held in the private ledger. The provisional A judgments predate
  the first B output read, but there is no claim of valid dual-label independence.

## Corpus counts and limits

| Modality | Text fixtures | Eligible real-OA positives | Reviewed floor vector |
| --- | ---: | ---: | --- |
| public-form-language | 32 | 0 | not established |
| OCR-derived | 1 | 0 | not established |
| layout-derived | 1 | 0 | not established |

ODP additionally retrieved 16 image-only originals. All have zero fonts and
only page separators in the extracted text. They are excluded from positive
recognition; no original source text is committed. The fallback form corpus has
three MPEP form families, gamma held out, plus synthetic cover and hostile
variations. It is research inventory, not real-OA performance proof.

No agreement rate or eligible/emitted/abstained/invalid/contradicted/correct
vector is claimed: B is unavailable, the fixture adapter is unimplemented, and
only A labels exist. Every fixture is listed on the attorney spot-check sheet.
Constructed stale-identity, digest-drift, raw-slice-mismatch and inert shadow
fixtures remain to be added; no constructed-truth fixture was included in B.

## Gate decision

P0 remains pending. The corpus stop condition applies: valid dual labeling
cannot establish the prescribed floors with the available form-only evidence.
The two-void-run disposition and full spot-check sheet are retained, but they
are not silently promoted into passed quantitative proof. P1–P3 are unstarted.
