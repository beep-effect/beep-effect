---
"@beep/openai-compat": patch
---

Omit `tool_choice` from chat completion requests that carry no tools. xAI
rejects a `tool_choice` without `tools` with HTTP 400 `invalid-argument`, and
the field is meaningless to every OpenAI-compatible provider when no tools are
declared.
