# Independent outbox contract amendment review

Reviewed 2026-10-06 at selected repository HEAD `2208622aa8d0a5765769e3950c44ec9e81be9ceb`, separately from the amendment author. This is a source-bound packet review, not a mailbox exercise, implementation review or production verification. No original source, goal, package, catalog or public reading output was modified by this reviewer.

## Verdict

**Accept D-12 and the bounded fixture checkpoint as an amendment to the existing `m365-agent-outbox` owner. No P0/P1 blocker found in the amendment.** The correction removes an unsupported success inference and preserves the existing write-safe executor, one explicit send route, local append-only audit and existing phases. There is no reason to create a separate send-reconciliation platform or reopen the completed generic workflow machinery.

The reviewed packet bytes are:

- `goals/m365-agent-outbox/SPEC.md`: SHA256 `b38202c8e31914d856b3535e2076752b007c5ac0b8dfb28bd425556fa2f80206`.
- `goals/m365-agent-outbox/PLAN.md`: SHA256 `27e8b30837b65d8592a4ab072ea22eadd9204ece7ea98d496996d9ed112b0685`.
- `goals/m365-agent-outbox/research/RESEARCH-CORPUS-2026-10.md`: SHA256 `16823965a6ae41ecdb1d54a0de91d7ae14cfb0fd28592942923c859c7ef08325`.

No asynchronous owner agreement is inferred. The attachment correctly says the owning session must reconcile this intake against its current branch. Accepting a packet correction does not establish that the behavior is already implemented.

## Primary-source inspection and supported conclusions

I independently read the retained documentation ranges below and verified each retained artifact's bytes against its catalog SHA256. The table records the exact source/capture/artifact relationship, not a generated provider summary.

| Primary evidence | Source ID / capture ID / artifact SHA256 | Inspected lines |
| --- | --- | --- |
| Graph draft-message send | `88e9b2fc5a2a1131b95833a4710725ca4bfd10a5a38c1d00cbda8f5b55e75b6f` / `21edfa8ef298898ddef7cfb51585382318dc16f20ac43c892ff0ab5252ad62cc` / `5f180022e336c3e559e647692c3f459f200050543fc6074c6354f07322f7e31d` | `2-source.md:328-399` |
| Graph immutable Outlook IDs | `93c34cb72545277efd70396e9130e0b7329b2aef8aa9512c2a4f89c525233f7b` / `f675d6b2547651600905a70c23769389214b535c0932b00586c3ff9c000a0b31` / `56450c63ff7b8ed4500f806afe2891c24a22a35c600fff0045a333f17d83bcff` | `source.md:330-387` |
| Graph message properties | `851273430c270232bae6e46827bd83fbe8fad291e1bef55c455120884c821777` / `d734bd794acef016f6eb949d6d5e04254a24fea07325dce5835273b6960f7fe0` / `55d34c72f9e6a1ad0c1d5e08ed9b4d748c966b3b2ffa67aac405412e118d1e0d` | `2-source.md:379-416` |
| Graph create-and-send processing overview | `a39e2848ded65ebb5b985c3f7db9b09632cc4cbc055145aa27eb9a7860b94548` / `514e65fd97dbd15fb6cb29c7d2ccdb9d48985952ca954d8d8ffd45f822daf1ce` / `a5f3df62f7d8f93ffcc26060c2a7b9007c56dd4cca4fe292fd0b9d1f3d6cf2aa` | `source.md:322-365` |
| Exchange message trace | `84b0cac698bcda85a117e8c074bc8ca1ca575d47258f411d5a9315f6a7f07f55` / `0b64eb5727cf21a247312d8f0df3f4cb3e1ac0cda531edba477bb61bac6d2fc2` / `cbe51b1cb1240fd8cfcca36f5783209d2fa767fe78d86a8b940f7fd2a5c1434f` | `source.md:381-405`, `622-675` |
| Exchange trace FAQ | `f08a34d617889a57519f7b81d759fbf1b41234c60e8a8b24dd5a01377bb61e56` / `6b617f91eeaff0d94a50e99f7ae73a4d6a641f2fc8d72736116eb2314e4ec6ee` / `2f4daccab22148dae69c966f0eb75a285bcafae9c6e4eb0c0bb6b51884207517` | `source.md:295-311`, `464-474` |

Graph's draft-send method documents an empty `202 Accepted` response and saving the message in Sent Items. The immutable-ID documentation supplies the specific create/send/get route to retrieve that sent copy by the original draft's immutable ID. It explicitly says visibility can lag until the message successfully sends. Therefore a failed immediate GET cannot prove success or failure. This positive-copy route, rather than a generic overview's timing narrative, supports the proposed reconciliation.

Default message IDs change when moved; immutable IDs are case-sensitive, request-opt-in and stable only within the documented mailbox lifetime. The `Prefer` header is per request, so “consistently” must cover creation and every subsequent lookup/send request. Archive-mailbox moves and export/re-import are exceptions. A stored correlation ID or a similar subject cannot replace the exact known message identity.

`isDraft` and `sentDateTime` describe message state. Combined with a response bound to the original immutable identity and expected message fingerprint, they can support the packet's mailbox-send observation. A returned non-draft from another message, mailbox, stale fingerprint or unrelated correlation does not. The expected fingerprint and source-observed timestamp requirement avoids declaring success from a convenient unrelated message. No provider deduplication key or stronger exactly-once guarantee is documented by these ranges.

Exchange distinguishes Send from Deliver. Its FAQ says Delivered can include Junk/quarantine; trace availability can lag. That supports the amendment's distinction between mailbox send state and recipient-level provider evidence, while still stopping short of recipient reading, attention or successful task completion. The FAQ's suggested trace timing is not a guaranteed mailbox sent-copy polling deadline. The research note correctly avoids adopting a numeric read-poll guarantee.

The create-and-send processing overview explicitly scopes itself to forward/reply/replyAll/sendMail methods. Its detailed step timing must not be generalized as a precise contract for the separate draft-send endpoint. The amendment's intake note already preserves this limitation. The actual Grok workflow report is interpretation with partial results; the retained Microsoft pages are the primary support.

## Retry and audit semantics

The amendment's lost-response, missing/deleted draft, delayed copy, moved default ID, stale identity and read-timeout cases correctly retain uncertainty and require zero additional send POSTs during reconciliation. Finding the draft again does not prove the earlier send was rejected before processing. A matching later sent-copy is positive recovery evidence and can append a new linked receipt without editing the original unknown event.

I checked the existing driver seam after Graft lookup: `packages/drivers/m365/src/M365.service.ts:1826-1863` routes POST through the retry predicate for known rejection-before-processing and converts transport/ambiguous processing failures to `ambiguous write`. The source's POST branch does not retry a transport-unknown write. This is existing code reuse, not a test of the future outbox send handler. Implementation must use that seam rather than catch an unknown error and introduce an outer resend loop. The currently allowed known-rejection retry is distinct from the forbidden replay of an unknown outcome.

Intent-before-call, durable flush and append-only reconciliation are sound. The audit content stays local and excludes bodies/attachment bytes. A guard refusal is not proof that a POST occurred. The one-day synthetic-response fixture addition is scoped to the existing send/audit phase and needs neither new credentials nor live delivery integration. The amendment does not claim the credential-gated live smoke or existing phases are already complete.

## Advisory clarifications for the owning implementation

These refinements do not block retaining the source-backed D-12 correction:

1. Treat the stated two send records as the initial intent/outcome pair, with zero or more linked reconciliation events afterwards. Do not impose an exact two-row invariant that rejects the third, additive recovery receipt.
2. A later missing sent-copy lookup must not erase a prior positive `accepted` receipt. Preserve independently known request acceptance while send-state observation remains unknown. Add the fixture `202 -> GET404 -> delayed matching sent copy`: acceptance stays in history, reconciliation later records observed send, and no outcome is labeled delivery.
3. Model the crash after durable intent but before outcome append as an unresolved attempt on resume; the absence of an outcome is not permission to send again. Preserve the original intent and append an explicit uncertainty/reconciliation receipt. This follows the existing no-blind-replay boundary and does not require a new workflow platform.
4. Retain exact mailbox/immutable-ID comparison, observed `isDraft`/sent timestamp, expected fingerprint and lookup time in the reconciliation evidence. Prefer scoped IDs/counts/hashes in traces. User-visible “sent” must remain explicitly mailbox send state; use recipient-level provider evidence only for an explicitly separate delivery claim.

The first two points sharpen the producer/fold contract; the latter two should be covered by the existing bounded fixtures. Neither this review nor the packet establishes current runtime behavior, exactly-once delivery, all provider failure semantics or legal/professional approval to send.

## Mechanical supplement validation

The strict mechanical validator was extended to bind `parent/supplemental-document-reading.jsonl` to live-catalog documents and immutable snapshot bytes, verify its full reading range and finding references, and keep those rows outside the original document denominator. It also checks the observed Unicode line-range separators instead of silently treating a range as a single line.

Strict result is `passed`, exit0: original142documents + separate `.gitkeep`,419claims,1217sections,1175responsibility IDs remain unchanged. Seven new supplemental source IDs resolve against the live catalog, which now has1182sources. The one supplemental discovery input is document `00e14e2962d2cf25887a24a8f1ddb464b5166aec7ffc175d6899ca9578b1d66d`, snapshot SHA256 `538529e4e267c3de9749fdcc73fcdac0d6870d347726bd8253913f5b050fad26`, with a complete1-13 reading attestation. R0-019/020 resolve; all461findings pass the mechanical binding checks. No source reading status or substantive finding was generated automatically.
