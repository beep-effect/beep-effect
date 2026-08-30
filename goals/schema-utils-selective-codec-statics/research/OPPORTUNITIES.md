# Opportunities

## 2026-08-30 — Goal doctor treats a new untracked active packet as stale

- **What I was doing:** Validating a newly materialized goal packet before the
  first `/grilling` round.
- **Evidence:** `bun run beep goals doctor` returned zero blocking findings but
  emitted `schema-utils-selective-codec-statics [stale-active] active packet
  untouched for 21+ days` even though the manifest's `created` and `updated`
  dates are 2026-08-30 and the packet is new and untracked.
- **What would have prevented it:** The stale-active advisory should recognize
  an untracked/new packet's manifest dates or suppress age advice until the
  packet has a first commit.

