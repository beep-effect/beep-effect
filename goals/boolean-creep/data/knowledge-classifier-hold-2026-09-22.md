# KnowledgeRefClassificationInput adjudication hold

Exact source: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`.
Owner: `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts:1855-1864`.
Historical inventory id: `knowledge-ref-classification-input`.

## Decision

Do not promote this record to qualified/designed on present evidence. The existing D1 note is insufficient: these are not demonstrated independent domain facts. However, the public classifier deliberately defines ordered, total behavior for the raw bag, including cross-kind and simultaneous flags. The inspected sources do not settle whether those inputs are supported normalization inputs or merely representable incoherence. Record a narrow adjudication hold outside the v1 inventory status union, following `data/r31-law-owner-holds.json` as the packet precedent. Parent may archive/remove the historical D1 row while unresolved; this proposal supplies no replacement supported-D1 claim. No proposed inventory row or design is supplied; no P3, implementation or census-round credit follows.

## Immutable input

Copied canonical inventory to `input-inventory.jsonl` before inspection. Its SHA-256 is `de0477d42e7c44de5d1f41e869565bce230d2378542f9ed4d1785bf28f69cf38`. `input-row.json` is the extracted original row, whose anchor1836 is stale; the declaration is1855. The row names patternContext, pairingAmbiguous and ungoverned, status disqualified/D1. Parent alone owns canonical inventory edits.

## Evidence for a semantic restriction

- Source1847-1849 says anchor/token are populated only for host paths, pairingAmbiguous only for goal URIs and ungoverned only for repository paths.
- Host producer2512-2535 emits false/false with populated anchor/token; repo producer2622-2651 emits false/ungoverned with empty host Options; goal producer2668-2692 emits pairingAmbiguous/false with empty host Options.
- Source1961-1965 gives pairing ambiguity precedence over ungoverned syntax. Combined true has no separate arm. This resembles E2, but precedence in a raw classifier is not by itself proof that combined true is illegal.
- patternContext is independently computed in every producer (2527,2642,2685). It can accompany either syntax state; it must not be collapsed as an exclusive sibling of the other flags.

## Counterevidence and public owner boundary

- Exported type1855 admits every boolean combination and all four KnowledgeRefKind values. Kind docs51-57 reserve upstream in the domain even though current census producers never emit it.
- Exported classifier1960-1987 describes its cascade as ordered and total at1909. It returns ambiguous-ref-pairing for pairingAmbiguous, then ungoverned-syntax for ungoverned, without validating kind or rejecting conflicts.
- Host anchor=None explicitly returns actionable-host-path at1968-1969. This bypasses even patternContext/archival handling. Host token=None explicitly becomes an empty string at1973. Private producers currently provide both, but that does not authorize deleting either public fallback.
- All five resolution statuses remain accepted by the public type. The host path ignores resolutionStatus, and either syntax flag takes priority over it. For unflagged nonhost inputs,1979-1985 maps all five, including not-applicable -> ambiguous-ref-pairing. Source1918-1920 explains intended producer reachability but is not an input validator or rejection policy.
- Tests747-784 verify host pattern-before-archival and two coherent grammar-failure inputs only. The test title says 'outrank every resolution outcome', but its fixtures both use not-applicable and never exercise simultaneous flags or wrong-kind flags. It cannot settle the broader supported-input contract.
- Examples1929-1951 show coherent archival-host and missing-repo inputs. No example establishes rejection of incoherent raw inputs.

## Cardinality accounting and its limit

The original three flags represent8 raw assignments; patternContext is independent. If the bus-local documentation is normative for public input validity, the pair pairingAmbiguous/ungoverned has3 legal states out of4, independently of patternContext. Including kind, the projection has16 representable states;6 would be legal under that interpretation (host1, repo2, goal2, upstream1). Neither6 nor the producer-only counts are established as the full public contract here.

The whole raw input has more dimensions: kind4, resolutionStatus5, surface live/archival2, booleans8, anchor/token Option presence4. That presence-only abstraction is1280 states before splitting anchor literals and string payloads. The runtime probe exercises every one with representative Some payloads and observes a result for all1280. This demonstrates total runtime behavior, not that all are legitimate domain states; conversely, producer reachability cannot prove that the others are illegal. No aggregate legal cardinality is claimed. Anchor and token payloads are explicitly accounted for, and the host fallback prevents assuming both-present as a public invariant.

## Complete known boundary and consumer map

- Declaration/docs:1842-1864; classifier/docs/examples:1904-1987.
- Production constructor:2958-2967, copying candidate fields and computed resolution.status.
- Private upstream producers:2512-2535,2622-2651,2668-2692. They belong to the separate RefCandidate owner; its stronger private invariants are not inherited by this exported type.
- Test import/type helpers/readers: knowledge-refs.test.ts3,35,747-784.
- Broader scanner fixtures cover ungoverned root escapes202-205, host conventions234-405, ambiguous pairings477-497 and later generated-evidence pattern tests. They establish current producer/report behavior, not all raw classifier inputs.
- Source imports in Knowledge.command.ts, Knowledge.service.ts and Lint/RoadmapRefs.ts consume other module facilities; exhaustive symbol search found no further direct classifier call sites.
- Module is exposed by @beep/repo-cli's wildcard package subpath exports. Root package privacy is not proof that the exported classifier has no supported callers.
- This input is currently an exported TypeScript type, not a codec. It is constructed in-process and is not the report encoding:2973-2986 separately builds KnowledgeRefObservation from classification, resolution, ref and metadata. Any later migration must preserve report/CLI bytes and classification precedence for every supported input.

## What resolves the hold

First ask an independent reviewer to adjudicate the source, docs, tests and exact probes below; code evidence may settle the contract without a user policy decision. If that review remains inconclusive, establish from a binding specification or authoritative owner decision whether kind-mismatched/simultaneous grammar flags are legitimate raw classifier inputs whose precedence must remain supported. If yes, retain a D1/raw-policy adjudication with corrected explanation: the source intentionally accepts the product and resolves precedence. Do not qualify merely from exclusive producer writes. If no, bind that contract and its full supported host Option/upstream/resolution cases, then requalify with proven projection cardinality and schema-first design. A future tagged model must retain independent patternContext and host Option fallbacks; it must not silently shrink resolution statuses or drop reserved upstream.

The separate private RefCandidate audit may proceed without this decision. Its adapter must continue constructing the current classifier input until this owner is resolved.

## Verification and limitations

`classifier-contract-probe.ts` was executed using `bun --eval` from the repository root against the actual exported classifier. Exit0; stdout records1280 representative-presence cases, stderr empty. This is a read-only runtime probe, not a test change or proof of semantic legality. No package implementation was edited; no package verification required or claimed.

## Parent disposition

The historical D1 row was archived in `history/inventory/2026-09-22-pre-knowledge-websocket-refresh.jsonl` and removed from the live projection. This owner remains unresolved, not settled or absent from campaign scope. Its qualification and any migration await contract adjudication; no replacement design or review credit is claimed.
