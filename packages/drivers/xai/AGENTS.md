# Agent Guide

`@beep/xai` is the Effect driver for the xAI (Grok) REST API: the `XAi`
`Context.Service` exposes one method per documented xAI endpoint plus SSE
helpers for chat, responses, legacy completions, and Anthropic messages;
`XAiLanguageModel` is the Effect AI language-model adapter backed by
`XAi.createChatCompletion`.

`XAI_ENDPOINTS` (with `XAI_ENDPOINT_COUNT`/`XAI_ENDPOINT_METHOD_NAMES`) is the
checked-in endpoint coverage manifest — keep it in sync when adding or
removing endpoint methods.
