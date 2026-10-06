---
"@beep/m365": patch
---

Decode optional Graph fields that arrive as `null` (for example
`seriesMasterId` on a single calendar event) as absent instead of failing the
whole response. An absent value still encodes as a missing key.
