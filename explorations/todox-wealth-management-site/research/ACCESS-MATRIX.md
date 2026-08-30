# Supplied-source access matrix

Captured 2026-08-27. Access results are channel-specific. A Firecrawl login
shell does not mean the source is unavailable through an authenticated
connector, and a provider-policy block is not a `not-found` result.

## Results

| Source | Firecrawl | Secondary access | Result and use |
| --- | --- | --- | --- |
| Mariner homepage | `full` | Not required | Public page retrieved. The account-cartography lane owns the full map. |
| AdvicePeriod homepage | `full` | Not required | Public page retrieved. The account-cartography lane owns the full map. |
| AdvicePeriod LinkedIn company page | `policy-blocked` | None attempted | Firecrawl identifies LinkedIn as unsupported. Use first-party pages and opened non-LinkedIn sources instead. |
| Advisor domain-expert profile | `policy-blocked` | None attempted | Same provider-policy block. No bypass attempted. |
| Additional wealth contact profile | `policy-blocked` | None attempted | Same provider-policy block. No bypass attempted. |
| Claude artifact `94890cda` | `full` | Anonymous browser confirmed | Full public text layer retrieved. Interactive state was flattened. |
| Claude artifact `6f0c3839` | `full` | Anonymous browser confirmed | Full public text layer retrieved. Dynamic interaction was flattened. |
| `N-PUBLIC-DIRECTION` | `full` | Claude Notion MCP `full` | Public product-direction page resolved to a public Notion host. |
| `N-AUG-MEETING` | `auth-required` | Claude Notion MCP `full` | Firecrawl received a login shell; authenticated Notion access was read-only. Only sanitized decisions may enter this packet. |
| `N-COMPETITIVE` | `auth-required` | Claude Notion MCP `full` | Same split result. Private competitive claims require independent public corroboration. |
| `N-APR-PROPOSAL` | `auth-required` | Claude Notion MCP `full` | Same split result. Historical proposal context is superseded where newer direction differs. |
| Firecrawl AI-onboarding documentation | `full` | Not required | Public documentation retrieved and used to confirm the CLI workflow. |

Firecrawl totals for the supplied-source lane: 6 `full`, 0 `partial`, 3
`auth-required`, 3 `policy-blocked`, and 0 `not-found`.

## Credit accounting

- Successful records attributed 9 credits to the supplied-source lane.
- Several research lanes executed concurrently, so account-wide balance
  changes are not attributable to one lane and remain in ignored run logs.
- LinkedIn policy-block responses did not report credit use.

The user requested no arbitrary scrape cap. Ignored run logs retain per-lane
status snapshots for operational accounting.

## Interpretation rules

- `full` means a meaningful page body was retrieved, not that every animation,
  canvas state, interaction, or authenticated subresource was preserved.
- `auth-required` means Firecrawl did not access the private content.
- `policy-blocked` means the provider refused the origin. It does not establish
  that the page or person is absent.
- Search snippets are discovery leads only. They are not promoted to claims
  without opening the underlying source.
- Private Notion URLs, page identifiers, correspondence, quotations, pricing,
  and named-firm procurement details remain outside tracked files.
