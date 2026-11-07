---
title: "Recreate @beep/firecrawl as a small v2 scrape driver, not the retired SDK wrapper"
date: 2026-11-07
lane: "feat/research-library-routes"
reversal: "Delete packages/drivers/firecrawl, restore its standards/changesets.retired-packages.json entry, and drop the route"
---

The name was retired 2026-10-21 when an unused SDK wrapper was removed (71d48a5c50). This goal needs one capability: a bounded v2 /scrape for markdown plus rawHtml with the exact response bytes retained. A ~300-line HTTP driver (config, errors, models, service with makeLayer, lazy makeLayerWithKey, Config layer and test layer) covers it; reusing the old SDK surface would re-import unused API. create-package --reuse-retired-name removed the guard entry.
