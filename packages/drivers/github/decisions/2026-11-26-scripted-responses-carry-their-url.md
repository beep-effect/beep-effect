---
title: The scripted fetch double defines Response.url on every reply it builds
date: 2026-11-26
reversal: Return the plain new Response(...) from toResponse in test/support/fixtures.ts, without the Object.defineProperty call.
governs:
  - test/support/fixtures.ts#toResponse
enforcedBy: []
---

`toResponse` defines `url` on each scripted `Response`. A manually constructed `Response` has `url === ""`, and octokit's paginator does `new URL(response.url)` whenever the payload carries a `total_count`, which throws `TypeError: Invalid URL` on an empty string. Real fetch responses always carry a URL, so the failure is an artifact of the double.
Rejected: a plain constructed `Response`, which breaks every search-shaped and `total_count` pagination case with an error that never names the double.
Rejected: scripting only payloads without `total_count`, which stops the suite exercising GitHub's real list shapes.
