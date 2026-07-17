---
"@beep/oip-web": patch
---

Greptile review fixes that missed the portless PR's merge window: `start`
returns to plain `next start` (production startup must not depend on the
portless dev CLI), and the dead `https://*.localhost:*` dev CSP wildcard
from the abandoned HTTPS proxy mode is removed.
