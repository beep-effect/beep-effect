# Agent Guide

`@beep/wink` is the driver-level wink-nlp runtime for the product-neutral
`@beep/nlp` / `@beep/nlp-processing` contracts. Keep reusable NLP schemas and
contracts in `@beep/nlp`; keep wink model loading, FFI, and live handler
layers (`WinkBackendLive`, `WinkNlpToolkitLive`) here. Keep driver code free
of product-domain vocabulary.

Failure discipline: keep expected driver failures in typed error channels — do
not convert them to defects before AI tool handling. Use `AiToolError` for NLP
tool failure schemas and return failures with `failureMode: "return"`.

Observability: annotate traces with counts, ids, and text lengths; never add
raw text to span attributes or metric dimensions.
