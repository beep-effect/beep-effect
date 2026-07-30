---
"@beep/libpff": patch
---

Fold assembled EML headers to the RFC 5322 998-octet line limit on both the verbatim and synthesized paths, and emit a real `Date:` header parsed from the Outlook client-submit time in place of the nonstandard `X-Beep-Libpff-Client-Submit-Time` carrier.
