# Round 27 agent seed anchors

Source: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
Corpus main: `663904610cce2a38c06b0619a8c414646b69361c`.

The independent `r27-agents-workspace` report is empty and its successful
end-turn receipt accounts for all nine assigned roots and thirteen seed
declarations. Its two reported line changes require these adjudications:

- `chat-timeline-refresh-latch`: update the primary anchor from 961 to 971
  in `packages/agents/client/src/Chat.atoms.ts`, where `refreshStarted` is
  declared. The callback still observes `result.waiting` at 975, updates the
  latch at 976 and rejects the unchanged cached result at 979. This is an
  anchor correction; the existing D1 classification is unchanged.
- `r3-domains-chat-turn-active-receipt-uncertain`: withdraw this old D1 row
  from the live census and archive it. Moving its anchor from 814 to 822
  would leave an eligibility error: `isUncertainTurnRequestStatus` is a
  callable predicate at `Chat.atoms.ts:822`, while `turnActiveAtom` is an
  Atom handle at `:1313`. These members are not co-carried Boolean values.
  The actual evaluated `requestStatusUncertain` local at `:1188` is a
  different carrier; the historical predicate/handle pair cannot stand in
  for it.

This audit changes packet metadata only. It does not constitute independent
P3 approval or product implementation.
