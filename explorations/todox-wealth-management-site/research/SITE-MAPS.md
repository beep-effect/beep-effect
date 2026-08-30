# Mariner and AdvicePeriod site maps

Captured 2026-08-27 with Firecrawl `firecrawl-map` followed by targeted
scrapes. The raw URL inventories remain under the ignored research tree; this
file preserves counts, structure, high-value routes, and relationship findings.

## Coverage

| Collection | Returned URLs | Canonical URLs |
| --- | ---: | ---: |
| Mariner full map | 1,907 | 1,907 |
| AdvicePeriod full map | 265 | 264 |
| Mariner sitemap-only map | 1,901 | 1,901 |
| AdvicePeriod sitemap-only map | 242 | 242 |
| Mariner union of full, sitemap, subdomain, and filtered maps | — | 1,936 |
| AdvicePeriod union of full, sitemap, subdomain, and filtered maps | — | 292 |

The 10,000-URL full-map limit was not binding. Subdomain-enabled passes found
no additional hosts under either apex. Completeness means Firecrawl's observed
coverage on this date, not a guarantee that every JavaScript-only or orphaned
page exists in the inventory.

## Structural census

The following buckets overlap; they are navigational research aids, not a
partition.

| Page family | Mariner union | AdvicePeriod union | Reading |
| --- | ---: | ---: | --- |
| Team and advisor bios | 896 | 45 | Mariner's public surface is unusually biography-heavy. Several AdvicePeriod people have both advisor and bio routes. |
| Services | 34 | 4 | Mariner spans individual, business, executive, professional, and life-event segments. AdvicePeriod keeps a smaller service tree. |
| Locations | 161 | 11 | Mariner's national footprint creates a large local page family. |
| Insights and blog | 663 | 196 | Both firms publish heavily; AdvicePeriod press items live inside blog categories. |
| Newsroom and press | 85 | 2 | Mariner has a dedicated newsroom. AdvicePeriod does not. |
| Regulatory, disclosure, privacy, and legal | 11 | 6 | These pages provide the strongest entity and affiliation evidence. |
| Advisor-platform and recruiting | 1 on-site | 1 | Mariner's primary advisor recruiting surface is the separate `joinmariner.com` domain. AdvicePeriod's advisor page points toward Mariner Advisor Network. |
| Technology and AI | 9 | 2 | Most Mariner hits are insight posts. Its AI-transparency page concerns hiring, not a client AI product. |
| Dedicated client stories or testimonials | 0 found | 0 found | Rankings and marketing assertions are not client stories. |
| Contact and lead generation | 15 | 6 | Both sites repeat lead forms and advisor-contact paths. |

## High-value first-party routes

### Mariner

- [Home](https://www.marinerwealthadvisors.com/)
- [Who we are](https://www.marinerwealthadvisors.com/who-we-are)
- [Individual services](https://www.marinerwealthadvisors.com/our-services/individual)
- [Legal and Form ADV links](https://www.marinerwealthadvisors.com/legal)
- [Privacy](https://www.marinerwealthadvisors.com/privacy)
- [Form CRS](https://www.marinerwealthadvisors.com/form-crs)
- [AI transparency](https://www.marinerwealthadvisors.com/ai-transparency)
- [Newsroom](https://www.marinerwealthadvisors.com/newsroom)
- [Mariner Independent platform news](https://www.marinerwealthadvisors.com/newsroom/2025/06/17/mariner-expands-independent-platform-leadership-team-amid-surge-in-advisor-demand)

### AdvicePeriod

- [Home](https://www.adviceperiod.com/)
- [Why AdvicePeriod](https://www.adviceperiod.com/why-adviceperiod)
- [Services](https://www.adviceperiod.com/services)
- [Ultra-affluent](https://www.adviceperiod.com/ultra-affluent)
- [For advisors](https://www.adviceperiod.com/for-advisors)
- [Team](https://www.adviceperiod.com/team)
- [Disclosures and terms](https://www.adviceperiod.com/disclosures-terms-of-use)
- [Form ADV wrapper](https://www.adviceperiod.com/form-adv-mwa)

## Relationship finding

The supplied “child company” shorthand is directionally useful but legally
imprecise. AdvicePeriod's first-party disclosure says the name is a business
name and brand used by both Mariner, LLC and Mariner Platform Solutions, LLC,
which are SEC-registered investment advisers. It further distinguishes
employee-model representatives associated with Mariner Wealth Advisors, LLC as
parent from independent-contractor representatives associated with Mariner
Platform Solutions.

The shorter sitewide footer also names AdvicePeriod as a brand used by Mariner,
LLC and Mariner Platform Solutions. The AdvicePeriod careers, privacy, and
accessibility links connect into Mariner surfaces, and its advisor page says
the team joined Mariner Advisor Network.

Safe account language: “AdvicePeriod is a Mariner-affiliated brand used by
Mariner, LLC and Mariner Platform Solutions.” Do not flatten this into “the
same legal entity,” “a wholly owned subsidiary,” or a distinct standalone RIA
without current legal evidence.

## Discovery implications

- The strongest public account evidence lives in legal/disclosure pages,
  advisor-platform material, executive interviews, and newsroom coverage—not
  a testimonial library.
- Mariner's site expresses scale through people, locations, specialist
  services, rankings, and acquisition news.
- AdvicePeriod expresses a retained, more argumentative identity through
  simplicity, fiduciary objectives, and an independent-advisor path.
- Neither mapped host exposed a public client-facing AI-advisor product page.
  Mariner's AI-transparency page is a hiring disclosure; its privacy page says
  AI may process personal information.
- Betterment, Black Diamond, and RightCapital appear as AdvicePeriod client
  portal destinations. Their presence is account-stack evidence, not proof of
  a Todox integration.
- `joinmariner.com` is the largest un-mapped adjacent account surface if a
  later research pass expands advisor-platform coverage.

## Access and caveats

- All 14 high-value sample scrapes returned HTTP 200.
- One acquired-brand Mariner slug resolved to the Mariner homepage, so similar
  slugs should not be treated as live local pages without a scrape.
- The AdvicePeriod Form ADV wrapper links a dated 2021 PDF. Do not use it for
  current firm facts without retrieving the live IAPD brochure.
- Targeted map searches found no dedicated client-story or testimonial hub.
  Absence from this map is not proof that no story exists elsewhere.
- LinkedIn URLs were observed as outbound links but were not fetched by the
  map lane. Their separate access result is `policy-blocked`.

## Rerun

Exact CLI conventions, filtered queries, custody rules, and promotion gates
are in [`GROK-FIRECRAWL-RUNBOOK.md`](./GROK-FIRECRAWL-RUNBOOK.md). The full-map
pattern is:

```bash
mise x node@24.19.0 -- npx -y firecrawl-cli@latest map \
  "https://www.marinerwealthadvisors.com/" \
  --limit 10000 --sitemap include --wait --timeout 180 --json --pretty
```

Run the same pattern for AdvicePeriod, retain raw JSON under `.firecrawl/`,
then canonicalize scheme and host, strip query and fragment, decode paths, and
remove trailing slashes except `/` before counting.
