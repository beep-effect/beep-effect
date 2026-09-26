---
"@beep/anthropic": patch
"@beep/openai": patch
"@beep/openai-compat": patch
"@beep/venice-ai": patch
"@beep/xai": patch
---

Adopt the instrumented test runner for provider validation, preserving existing
schema domains and assertions while making fixture lifetimes explicit. Strengthen
stream event and cancellation checks and report absent-key Venice integration
coverage as skipped. Production provider behavior is unchanged.
