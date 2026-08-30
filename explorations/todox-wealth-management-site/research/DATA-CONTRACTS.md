# Research data contracts

These packet-local contracts keep sources, claims, stories, and inspiration
traceable. They are not application APIs and do not require changes under
`apps/todox`.

## Source record

Stored as one object per entry in `SOURCE-MANIFEST.json`.

| Field | Meaning |
| --- | --- |
| `id` | Stable packet identifier such as `src-mariner-home`. |
| `url` | Requested URL. Private source URLs may be replaced with a stable internal label. |
| `canonicalUrl` | Final public URL when known. |
| `title` | Page, artifact, document, or repository source title. |
| `publisher` | Organization or repository that owns the source. |
| `capturedAt` | ISO date for this research pass. |
| `publishedAt` | Source publication/update date when available. |
| `accessMethod` | `firecrawl-map`, `firecrawl-scrape`, `firecrawl-search`, `browser-read`, `claude-notion-mcp`, or `repo-read`. |
| `accessResult` | `full`, `partial`, `auth-required`, `policy-blocked`, or `not-found`. |
| `tier` | `first-party`, `regulatory`, `trade-press`, `interview`, `social-lead`, `private-context`, or `repo-authority`. |
| `visibility` | `public-copy-eligible`, `sales-only`, `internal-private`, or `synthetic`. |
| `contentHash` | Hash when a stable local capture exists; otherwise `null`. |
| `usage` | Citation, quotation, paraphrase, reference-only, or anti-reference restrictions. |

## Claim record

Stored as JSON Lines in `CLAIMS.jsonl`.

| Field | Meaning |
| --- | --- |
| `id` | Stable claim identifier. |
| `proposition` | One checkable statement or one clearly labeled inference. |
| `sourceIds` | One or more source-record IDs. |
| `evidence` | Short supporting spans or a precise section/path locator. |
| `kind` | `fact`, `inference`, `hypothesis`, or `synthetic-illustration`. |
| `proof` | `verified-first-party`, `corroborated`, `single-source`, `inference`, `hypothesis`, or `illustrative`. |
| `confidence` | `high`, `medium`, or `low`. |
| `freshness` | Date or explicit stale/unknown marker. |
| `audiences` | Advisor, operations, compliance, innovation, executive, or Fable. |
| `visibility` | Same controlled visibility as the source record. |
| `publicEligible` | Boolean public-copy gate. |
| `caveat` | Required qualification or reason the claim is private. |

## Story record

Story records live in `CUSTOMER-VOICE.md` and carry:

- role and operating context;
- job to be done;
- present friction and trigger;
- source artifact or information boundary;
- proposed runtime steps;
- required human decision;
- potential value;
- evidence status;
- visibility and public-use decision.

A story without direct evidence is a labeled scenario hypothesis, never a
customer story.

## Inspiration record

Inspiration records live in `VISUAL-INSPIRATION.md` and carry:

- source ID and URL;
- observed typography, palette, material, imagery, motion, or editorial pattern;
- whether each value is observed or inferred;
- why the pattern may fit the Todox subject;
- what Fable must not copy;
- logo, image, trademark, and font-license cautions;
- classification as `ingredient`, `contrast`, or `anti-reference`.

This file never selects the final font, palette, component system, layout, or
brand. Fable owns those decisions.
