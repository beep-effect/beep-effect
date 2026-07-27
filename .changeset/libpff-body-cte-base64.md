---
"@beep/libpff": patch
---

Emit assembled EML body parts as base64 when any physical body line exceeds RFC 5322's 998-octet limit, instead of always `8bit` verbatim. The trigger measures octets per line split on `/\r?\n/` (a lone CR counts as content), the switch covers the whole part losslessly — decoding restores the exact body string — and compliant bodies keep their byte-identical `8bit` output. Attachment parts are unchanged.
