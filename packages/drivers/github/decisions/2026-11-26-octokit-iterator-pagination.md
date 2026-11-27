---
title: REST pagination walks octokit's page iterator, not a hand-rolled Link-header loop
date: 2026-11-26
reversal: Replace composePaginateRest.iterator with a loop that follows each response's Link header.
governs:
  - src/internal/octokit.ts#makeTransport
enforcedBy: []
---

`pageSource` drives `composePaginateRest.iterator` one `next()` per page, each under the per-page retry.
Reason: the iterator advances its cursor only on a successful page, so retrying `next()` re-requests that page rather than skipping it. It also carries the compare endpoint's `total_commits` continuation, the `{ total_count, items }` envelope normalization, and the empty-repository 409 GitHub answers commit listings with.
Accepted limit: the iterator retains only method, url and headers, so a `request` hook wraps each attempt to restore its signal and per-request options. Hook wrappers bind the options object they receive, the auth hook included, so the hook updates `pageOptions.request` in place.
Rejected: a hand-rolled Link-header walk, which would have to reimplement each of those cases.
