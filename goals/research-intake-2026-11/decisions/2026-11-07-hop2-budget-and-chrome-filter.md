---
title: "Hop 2 admits the 400 most cross-site-cited routed identities; page chrome and fragments are refused"
date: 2026-11-07
lane: "feat/research-intake-2026-11"
reversal: "Raise --hop2-limit or clear the chrome lists in LibraryHopPolicy and re-run hops and acquire; refused identities stay catalogued"
---

With routed findings in place, the routed-parent gate with a 25-per-domain cap admitted 15,597 hop-2 identities. Nearly every hop-1 parent carried live topics, and the top of the list was site navigation, social profiles, privacy pages, image assets and extraction fragments such as https://arxiv/ and doi.org/10. That exceeded the remaining Firecrawl plan credits (about 6,600 of 8,000) and the mining budget with no purchase allowed. The gate now refuses non-content (reserved hosts, IP literals, static assets, dotless or wildcard hosts, bare site roots, empty query values, suffixless DOIs, social or consent hosts, X profiles other than posts, YouTube channel pages, legal and administration paths), counts in-degree only from routed parents on a different site than the child, and admits a global budget of 400 by that in-degree with a canonical-URL tie-break. Result on the real library: 75,918 hop-2 identities catalogued, 400 admitted, 9,481 non-content, 43,863 over budget, 15,611 unrouted, 4,607 GitHub not transitive, 1,544 arXiv catalogue-only. Residual portal pages among the 400 are left to T1, which skips them. Rejected: a relevance-score threshold (model opinion, as the routes goal already decided) and acquiring the 15,597.
