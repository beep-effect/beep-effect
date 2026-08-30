# Sources and provenance

Captured 2026-08-27. This is the human-readable provenance ledger for the
Todox.ai research packet.

## Machine-readable ledgers

- [`SOURCE-MANIFEST.json`](./SOURCE-MANIFEST.json) contains 91 promoted source
  records with access method, access result, source tier, visibility, and use
  restrictions.
- [`CLAIMS.jsonl`](./CLAIMS.jsonl) contains 40 atomic propositions with source
  references, proof grades, audience, copy eligibility, and mandatory caveats.
- [`DATA-CONTRACTS.md`](./DATA-CONTRACTS.md) defines the packet-local record
  shapes and controlled values.

These are promotion ledgers, not raw scrape dumps. A source can be public and
still be restricted to sales research, synthetic illustration, or visual
inspiration.

The manifest also records the Impeccable agent index, tagged 4.1.2 release,
forward-fix commit, and public version endpoint as tooling provenance. They are
not Todox marketing evidence or visual-direction authority.

## Evidence custody

Raw Firecrawl results, Grok transcripts, page markdown, screenshots, maps,
search results, private-source summaries, and operational receipts remain
under the gitignored `.firecrawl/todox-wealth-management-site/` tree.

The tracked packet contains only:

- public URLs and repository locators needed for provenance;
- opaque labels for the four Notion sources;
- short source-supported paraphrases;
- source and claim classifications;
- de-identified customer-voice patterns;
- visual observations and explicit no-clone boundaries;
- safe rerun conventions without credentials.

It does not contain a Firecrawl key or its secret reference, raw private
Notion content, private page identifiers, personal profile URLs, client
correspondence, or account-wide credential and billing metadata.

## Source tiers

| Tier | Role in this packet | Treatment |
| --- | --- | --- |
| `repo-authority` | Current implementation, status, policy, and roadmap truth | Outranks demos, notes, and marketing. Distinguish specification from shipped behavior. |
| `regulatory` | Current or historical legal-entity status | Refresh before live sales use; do not flatten entity relationships. |
| `first-party` | Company, product, policy, pricing, service, and visual claims | Treat as publisher claims, not independent verification. |
| `interview` | Executive or advisor voice and historical operating context | Preserve date and speaker context; do not assume an old pain remains current. |
| `trade-press` | Discovery and corroboration | Open the underlying source and label vendor/customer wire copy precisely. |
| `private-context` | User-supplied Notion direction and advisor context | Synthesis only; never public proof without independent corroboration and clearance. |
| `social-lead` | Discovery lead | No social result was promoted into a claim in this pass. |

## Collection coverage

### Supplied sources

- Six Firecrawl results were `full`: two Claude artifacts, one public Notion
  page, two company homepages, and the Firecrawl onboarding documentation.
- Three private Notion pages were `auth-required` in Firecrawl and readable
  only through Claude's connected Notion service.
- Three LinkedIn URLs were `policy-blocked` by Firecrawl.
- No supplied source was classified `not-found`.

See [`ACCESS-MATRIX.md`](./ACCESS-MATRIX.md) for the channel-level detail.

### Company maps and account evidence

- Mariner full map: 1,907 URLs and 1,907 canonical URLs.
- AdvicePeriod full map: 265 URLs and 264 canonical URLs.
- Canonical union across full, sitemap, subdomain, and targeted maps: 1,936
  Mariner and 292 AdvicePeriod URLs.
- Fourteen high-value account verification scrapes returned HTTP 200.
- Public legal, disclosure, privacy, newsroom, recruiting, interview,
  regulatory, and service sources were promoted selectively.

See [`SITE-MAPS.md`](./SITE-MAPS.md),
[`ACCOUNT-BRIEFS.md`](./ACCOUNT-BRIEFS.md), and
[`CUSTOMER-VOICE.md`](./CUSTOMER-VOICE.md).

### Competitor and visual corpus

- Competitive lane: 30 searches, 21 maps, 140 successful official-page
  scrapes, two recorded failures, and 423 raw provenance records.
- Visual lane: ten branding-and-image captures, ten full-page screenshots, and
  ten verified 1920-pixel-wide PNGs.
- The tracked manifest promotes only the sources needed for atomic claims and
  the selected inspiration corpus. The full raw vendor inventory remains in
  ignored custody.

See [`COMPETITIVE-POSITIONING.md`](./COMPETITIVE-POSITIONING.md) and
[`VISUAL-INSPIRATION.md`](./VISUAL-INSPIRATION.md).

## Promotion rules

A proposition can enter content candidates only when:

1. every referenced source exists in `SOURCE-MANIFEST.json`;
2. its access result is meaningful for the asserted fact;
3. the underlying page, not a search snippet, was opened;
4. the claim record separates fact, inference, hypothesis, and synthetic
   illustration;
5. source visibility allows the destination;
6. repository product truth does not contradict the wording;
7. named-account evidence cannot imply a Todox relationship;
8. synthetic material is labeled wherever it could be mistaken for real data;
9. the caveat survives any copy rewrite.

`publicEligible: true` is necessary but not sufficient. Fable must still check
the source's usage restriction, proposition tense, and caveat.

## Quotations and customer stories

- Short quotations in research files remain attributable research samples,
  not pre-cleared website copy.
- AdvicePeriod's current-client testimonials retain the source disclaimer and
  remain sales-only. Names, images, quotes, and outcomes may not move into the
  Todox site.
- Recruiting stories are advisor-platform evidence, not end-client proof.
- Joint vendor/customer announcements are not independent audits.
- A story without direct evidence is labeled a scenario hypothesis.
- Neither supplied individual is a public Todox spokesperson, customer, or
  endorser.

## Visual rights and anti-cloning

Firecrawl screenshots and branding records are research evidence. Third-party
logos, wordmarks, images, faces, illustrations, typefaces, exact tokens,
prose, components, and compositions are not production assets. Fable must
create or properly license original material and avoid the no-clone boundaries
in [`VISUAL-INSPIRATION.md`](./VISUAL-INSPIRATION.md).

## Freshness and reruns

Company relationships, regulatory records, privacy terms, vendor features,
pricing, certifications, and product names can change. Re-run the relevant
official source before a sales conversation or public assertion that depends
on a time-sensitive detail.

The safe workflow and exact CLI wrapper are documented in
[`GROK-FIRECRAWL-RUNBOOK.md`](./GROK-FIRECRAWL-RUNBOOK.md). Authentication must
continue through stored Firecrawl credentials or authorized 1Password
environment injection; never print or persist a raw key.
