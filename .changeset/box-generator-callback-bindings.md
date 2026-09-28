---
"@beep/box": patch
---

Generate SDK callback bindings from the available method parameters, so methods
without cancellation parameters compile under strict unused-parameter checks.
Preserve cancellation forwarding for supported methods and regenerate the SDK
operation surface.
