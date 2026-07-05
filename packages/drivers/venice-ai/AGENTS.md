# Agent Guide

`@beep/venice-ai` is the product-neutral Effect driver for the Venice AI API:
the `VeniceAI` service exposes one method per `swagger.yaml` operation plus SSE
helpers; `VeniceAiChat` delegates chat text convenience to
`VeniceAI.createChatCompletion`, and the `VeniceAiLanguageModel` namespace is
the Effect AI language-model adapter backed by the same method.
