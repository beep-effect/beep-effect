# Agent Guide

`@beep/openai-compat` is the OpenAI-compatible Effect AI protocol driver:
tolerant chat completion schemas (`OpenAiCompatChatCompletionRequest`/
`Response`/`Chunk` + decoders), the `OpenAiCompatClient`
`/chat/completions` HTTP + streaming service, and Effect AI language-model
constructors (`makeFromProvider`, `layerFromProvider`, `make`, `layer`,
`model`) for provider callbacks or the package client. Usage examples live in
the docgen `@example` blocks on those exports.
