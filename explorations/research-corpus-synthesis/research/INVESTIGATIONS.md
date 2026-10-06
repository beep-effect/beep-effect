# Evidence-gap investigations

## I-01 — Mail send outcome after a lost acknowledgment (2026-10-06)

**Trigger.** The primary paper arXiv:2609.15397v1 distinguishes an external
operation from the caller's observation of it (local extracted artifact
`9cc4530f8fe66d2c82df060ad0bfc23f03c580d8958e2d0c3ed9b8795f7337e4`,
lines 147–155, 261–312, 492–549). Its catalog makes authoritative outcome
resolution a prerequisite for safe retry/compensation. It is a research
argument with stated limits, not proof that every listed implementation fails.

**Concrete local gap.** `goals/m365-agent-outbox/SPEC.md`, Audit log, says
that a draft gone from Drafts after an unknown send outcome was sent. The
existing M365 driver correctly exposes `ambiguous write` rather than blindly
replaying POST. Whether disappearance is sufficient positive send evidence
needs official Graph/Exchange documentation before any amendment.

**Authorized expansion.** One actual Grok Build `/deep-research` workflow,
limited to official Microsoft documentation on send acceptance/processing,
message identity/movement/deletion, missing-item errors and outcome evidence.
No mailbox operation, private data, provider purchase, or implementation.
The exact prompt and sanitized workflow events remain in the external library's
operational evidence after completion. Results are pending; this trigger is not
a finding that the inference is already disproved.

## I-01 result and retained limits

The actual Grok Build deep-research workflow completed. Its report was **partial**:
verification excluded several overly strong claims and the synthesized body failed
citation validation, so Grok returned a deterministic finding list. This is retained
as interpretation with launch/completion evidence, not passed off as primary text.
Six selected official Microsoft pages were independently acquired and inspected.
The resulting R0-019 supports outbox SPEC D-12: known request acceptance, positively
observed sent copy and recipient delivery remain distinct. Missing lookup cannot
resolve an unknown send, and recovery does not replay POST. No mailbox action,
numeric polling guarantee or provider idempotency guarantee was established.
The [independent review](OUTBOX-REVIEW.md) accepted the amendment and its four
receipt refinements. All six source/capture/hash/range records are in the parent
finding and supplemental-source reading rows.

## I-02 — Legal Research Bench public harness

Trigger: reader3's full-paper inspection found a repository link and five public
sample questions, contradicting an abstract-limited downloaded report assessment.
Acquired an ordinary pinned clone of `vals-ai/legal-research-bench` through the
maintained library route. The README was read completely; the public JSON has five
tests and version 1.0.0. The platform route requires gated access. No code/script,
dependency installation, model benchmark or platform operation was executed.
R0-020 corrects public-access scope and parks benchmark execution. No claim of
access to the413 held-out/public-total tasks follows from the five samples.

Both investigations are a separate discovery intake: one authored document, seven
references and seven new source identities. Original142 document/1,175 source
coverage remains an immutable denominator. External operational evidence is under
`ops/session-evidence/2026-10-06/phase2/` in the library.
