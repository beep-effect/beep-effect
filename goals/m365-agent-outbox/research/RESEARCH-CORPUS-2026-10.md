# Research intake: unknown send outcomes

Investigation I-01 in [research-corpus-synthesis](../../../explorations/research-corpus-synthesis/research/INVESTIGATIONS.md)
started from a concrete contradiction: the workflow-boundary paper separates
physical effect from observed outcome, while this SPEC formerly inferred a send
from disappearance of a draft. The actual Grok Build `/deep-research` workflow
completed. Its report is partial, retains rejected claims, and is interpretation;
primary pages were independently captured through the maintained Firecrawl route.
No tenant request, mailbox action, or production smoke occurred here.

## Primary evidence and limits

- [Graph message send](https://learn.microsoft.com/en-us/graph/api/message-send?view=graph-rest-1.0)
  documents HTTP202 with an empty body. Source `88e9b2fc…`, extracted artifact
  `5f180022e336c3e559e647692c3f459f200050543fc6074c6354f07322f7e31d`, lines328–399.
- [Immutable identifiers](https://learn.microsoft.com/en-us/graph/outlook-immutable-id)
  describes create/send/get with the same immutable ID and warns that the sent
  copy may not be immediately available. Its stability has mailbox/archive limits.
  Source `93c34cb7…`, artifact
  `56450c63ff7b8ed4500f806afe2891c24a22a35c600fff0045a333f17d83bcff`, lines330–387.
- [Message properties](https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0)
  distinguishes default mutable IDs, `isDraft`, `sentDateTime` and correlation ID.
  Source `85127343…`, artifact
  `55d34c72f9e6a1ad0c1d5e08ed9b4d748c966b3b2ffa67aac405412e118d1e0d`, lines379–416.
- [Exchange trace](https://learn.microsoft.com/en-us/exchange/monitoring/trace-an-email-message/message-trace-modern-eac)
  distinguishes Send from Deliver. The [FAQ](https://learn.microsoft.com/en-us/exchange/monitoring/trace-an-email-message/message-trace-faq)
  describes delayed trace appearance and notes that delivery can include Junk or
  quarantine. This is context, not a requirement to install a trace integration.

Full IDs, captures, exact local paths and original bytes live in the external
library's supplemental discovery intake and parent supplemental-reading ledger.
The send-mail process overview primarily scopes create-and-send methods; do not
silently generalize all of its step timing to the separate draft-send endpoint.
No numeric polling guarantee or provider deduplication guarantee was established.

## Bounded acceptance addition

Use the existing write-safe executor and in-process synthetic Graph responses.
A lost POST response followed by404, repeated404, delayed sent copy, moved default
ID, deleted draft, stale correlation and read timeout must preserve uncertainty
and issue zero additional send POSTs. The positive control returns the original
immutable identity, matching expected message and non-draft sent state; it appends
reconciliation evidence. Test that HTTP202 alone is labeled accepted and that a
send-state receipt is never labeled recipient delivery. Scope: at most one day
within the outbox's existing fixture phase; no new service, registration or spend.

## Ownership and coordination

The active outbox packet retains implementation ownership. The workstation session
ledger checked during synthesis had no named outbox owner row. This attachment,
SPEC D-28 and the PLAN checkpoint are the asynchronous intake record; no owner
agreement or live implementation is claimed. The owning session must reconcile
against its current branch before adopting the packet. The synthesis owns this
contract correction only. Existing lifecycle and implementation phases remain.

Independent source-bound amendment review accepted the amendment (then D-12, now D-28) without P0/P1 blockers.
Its four refinements are retained in SPEC: allow later reconciliation rows,
preserve known 202 acceptance after a missing read, retain intent-without-outcome
as unresolved, and bind mailbox/immutable ID/fingerprint/observed state. See the
[review receipt](../../../explorations/research-corpus-synthesis/research/OUTBOX-REVIEW.md).

## Fresh-main integration

At `99d30b1b5286ae281cfab6dd7e67b169c6b01111`, upstream decisions D-12–D-27
are retained; this research amendment is D-28. The independent review preserves
its original decision numbering as historical evidence. Outbox slices 1/2 have
landed and P1 is in progress. Current v1 audit `sent` means Graph accepted the
request, and the driver discards the successful send response. Immutable IDs
and positively observed sent-state reconciliation remain required follow-up,
with compatible journal evolution rather than reinterpretation of old bytes.
The existing ownership guard, intent write, refusal semantics and append-only
audit remain in force. This intake changes the packet contract, not runtime.
