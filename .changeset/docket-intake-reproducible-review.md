---
"@beep/anthropic": minor
"@beep/law-practice-use-cases": minor
"@beep/law-practice-server": minor
"@beep/docket-intake": minor
---

Make docket intake reviews reproducible and explainable: an optional
`temperature` on the Anthropic language-model options with
`makeAnthropicLanguageModelLiveLayer`, both docket agents at temperature 0, and
a text-free per-round trace on every review verdict. The matter lookup reads
store format 4 bundles and treats `mention-dominance` memberships as
unverified.
