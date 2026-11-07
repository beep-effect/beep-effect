---
title: "Web acquisition runs through a new @beep/firecrawl driver"
date: 2026-11-06
lane: "explore/research-library-ontology"
reversal: "Remove the driver package and the native web route; web sources fall back to session-scrape plus import-result under the unchanged Library.web validator"
---

External SDK wrappers belong in drivers/*. The driver produces exactly the envelope Library.web.ts already validates so October's imported captures and native captures verify under one contract. Key is op://BEEP_SECRETS/BEEP_SECRETS/AI_FIRECRAWL_API_KEY through the op shim; never in argv or logs. Session-scrape (infeasible at 835 URLs per hop) and a keyless effect/http fetch route (loses JS-rendered pages) were rejected.
