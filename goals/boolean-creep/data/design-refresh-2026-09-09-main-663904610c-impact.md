# Main integration impact — 2026-09-09

Prior source: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`.
Prior corpus main: `52fcc8d1353db9481ef9edb6cc9619500f95568d`.
Merged source: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
Merged corpus main: `663904610cce2a38c06b0619a8c414646b69361c`.

All three native readers finished before the merge. The prior citation refresh
updated 36 affected qualified designs against the prior source; its receipt is
`data/design-refresh-2026-09-09-design-citation-refresh.md`. This receipt
records the subsequent source delta and does not replace independent P3 review.

## Upstream delta

PRs #1018 and #1017 change 21 repository files. Exactly one included authored
census source changes: `packages/drivers/tika/src/Tika.config.ts`. Its
property-test arbitrary replaces a host regular expression with localhost or
the library domain generator. The runtime schema checks and Boolean policy
functions above that expression do not change.

The remaining changes are upstream dependencies and lockfile, the ONNX
installer patch and regression tests, Tika tests, Vercel settings, changesets,
and time-to-certainty documentation. No source or supporting test cited by the
162 qualified designs changes in this delta. The source corpus remains 3,061
included files; no new authored census file is added by these two PRs.

## Tika census correction after the frozen round

The existing D1 `tika-server-base-url-checks` names
`carriesQueryOrFragment` and `hasHttpProtocol`. Both are callable functions at
`Tika.config.ts:20-25`, invoked separately by schema filters at lines 36 and
43. No Boolean pair is bound, stored or passed onward together.

This is outside the value-carrier net. Withdraw it without replacing it with
another D1 or a design. Its old row is preserved in
`history/inventory/2026-09-09-post-r26-tika-callable-withdrawal.jsonl`.
The correction also removes its inaccurate claim that the endpoint schema
accepts query-bearing HTTPS URLs; the schema explicitly rejects those inputs.

The current inventory is now 940 records: 162 qualified and 778 disqualified
(610 D1 / 168 D2). The frozen round-26 snapshot and verdict remain at 941
records and 162 qualified cases. This later source audit does not rewrite that
historical snapshot or award dry credit.

## Merge preservation

The first merge attempt stopped because the packet was staged. The merge
preservation transaction saved its index patch and working-tree file hashes,
temporarily removed only the packet from the index, merged main, then restored
the same staged patch. Exact comparisons passed for all 409 staged paths and
703 packet files. The merge commit contains no boolean-creep packet change.
Private recovery copies and the detailed receipt remain in the task cache.

Commit-message validation and post-merge version synchronization passed. The
Bun 1.4.2 frozen install completed successfully, including the existing
postinstall hooks; it changed no tracked dependency or lockfile. Packet
verification and the next full census follow this install. Package source implementation, current-source dry convergence,
replacement P3 review and GATE 2 approval are not claimed by this receipt.
