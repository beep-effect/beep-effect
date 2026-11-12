# Encoder and digest-preimage census

Slice A of this goal. Read at commit `4f1ef2168f9` on 2026-11-12, seeded from the
2026-11-10 section of `explorations/protocol-as-value/RESEARCH.md`.

Scope: package and app source (`packages/**`, `apps/**`, `infra/**`), excluding
tests, generated files and build output. A row is either an encoder (a
function that turns a structured value into JSON text with a key order it
controls) or a digest preimage built from a structured value. Hashes of raw
bytes, of one opaque string, and authentication hashes are not rows.

Three read-only sweeps produced 157 rows. Their full tables, with line
numbers, callers and non-JSON behaviour per row, are the partition files:

| Partition | File | Rows |
| --- | --- | --- |
| `packages/tooling/**` | [`census/tooling.md`](./census/tooling.md) | 92 |
| `packages/foundation/**`, `packages/drivers/**` | [`census/foundation-drivers.md`](./census/foundation-drivers.md) | 20, plus the owner and its one consumer |
| every other package, `apps/**`, `infra/**` | [`census/slices-apps.md`](./census/slices-apps.md) | 45 |

This file is the consolidated reading: the classes, the encoders this goal
acts on, the stored digests that must keep recomputing, and what slice A
proved about each.

## Classes

| Class | Meaning | Disposition |
| --- | --- | --- |
| replace | A sorted-key encoder whose output is RFC 8785 on its domain, and the digests taken over it. | Slice C replaces the encoder body with `JsoncFingerprint`; exports and digests keep their bytes. |
| pinned | Bytes fixed by a named specification, a wire contract or an in-source digest constant. | Keep. |
| renderer | Indented or domain-ordered output for files and people. | Keep. The row says whether a digest is taken over the output. |
| outside | A digest preimage that is not sorted-key JSON: hand-joined fields, JSON in schema field order, or an array-only tuple. | No action in this goal. Recorded so the slice D guard can tell known from new. |
| legacy | A stored digest that does not recompute through the owner. | None found. |

The partition files use `other` for the fourth class. They also mark twelve
array-only tuple preimages `replace` because RFC 8785 gives them the same
bytes; this file moves those to `outside`, because they go through a schema
JSON codec and have no hand-rolled encoder to replace.

| Class | Rows | Where |
| --- | --- | --- |
| replace | 27 | 4 encoders and 23 digests or uses over them |
| pinned | 10 | PartyKey v1, three eyecite parity encoders, two in-source pins, the Actions cache version, AWS SigV4, two RDF canonicalizations |
| renderer | 23 | indented JSON, `package.json` ordering, YAML |
| outside | 97 | 85 marked `other` by the sweeps and the 12 array-only tuples |
| legacy | 0 | |

## Sorted-key JSON encoders

Every function in source that sorts object keys and emits JSON text. This is
the list the acceptance criterion "`rg` finds no sorted-key JSON encoder
outside `@beep/jsonc` except the census rows" is checked against.

| # | Encoder | Class | Layout | Why |
| --- | --- | --- | --- | --- |
| E1 | `packages/foundation/modeling/epistemics/src/internal/CanonicalJson.ts` `canonicalJson`, exported as `canonicalDetectionJson`; aliased by `packages/epistemic/domain/src/values/internal/CanonicalJson.ts` and `packages/execution-authority/domain/src/internal/CanonicalJson.ts` | replace | compact | Recursive `Order.String` sort, `JSON.stringify` scalars. Byte-equal to the owner on plain JSON (differential test). |
| E2 | `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketDigest.ts` `canonicalJsonText` | replace | compact | Same construction. Shares its engine with E7. |
| E3 | `apps/labs/semantica/src/corpus/Canonical.ts` `canonicalJson` | replace | compact | Same construction. |
| E4 | `packages/foundation/modeling/md/src/Md.render.ts` `renderJson` (JSON frontmatter) | replace | compact, between `---json` fences | Found by this census. Recursive sort with its own string escapes; byte-equal to the owner on well-formed input. Not hashed anywhere. |
| E5 | `packages/party/domain/src/values/PartyKey/PartyKey.behavior.ts` `canonicalJson`, `canonicalBytes` | pinned | compact | PartyKey v1 bytes, fixed by the archived party-slice specification (linked from `packages/party/domain/README.md`, restated in that package's `AGENTS.md`) and by the fixture in `packages/party/domain/test/PartyKey.test.ts`. String-only, fixed ASCII keys, own escaping. |
| E6 | `packages/law-practice/server/src/internal/Citation/RuntimeHashEncoding.ts`, `PublicationResourceHash.ts`, `CaseResourceHash.ts` | pinned | Python `json.dumps` separators | Byte parity with eyecite 2.7.6 (`sort_keys`, `ensure_ascii`, code-point order). RFC 8785 differs on all three. |
| E7 | `PacketDigest.ts` `canonicalJsonTextPretty` | renderer | indented, trailing newline | Writes `ops/events/*.json` and `ops/trace.json`. The event digest is taken over E2's bytes, not these (the replay re-renders all 76 stored events byte for byte). File-content digests exist over plan payloads (`Goals/Bootstrap.ts`, `Goals/Materialize.ts`). |
| E8 | `packages/drivers/openclaw/src/OpenclawRender.ts` `canonicalizeDocument` | renderer | indented, trailing newline | Renders `openclaw.json`. `contentHash` is SHA-256 of the rendered file including the newline, a file checksum that `infra/src/OpenClaw.ts` compares with the deployed file. Not a canonical digest. |
| E9 | `packages/drivers/gov-legal-mcp/src/ToolNames.ts` `renderCanonicalValue` | renderer | indented, trailing newline | A copy of E8's pattern. Writes a committed report; no digest over it. |
| E10 | `packages/foundation/modeling/package-json/src/internal/format.ts` `sortKeys`; `packages/tooling/library/repo-utils/src/schemas/PackageJsonTools.ts`; `PackageJson.ts` `toSortedRecord`; `packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScripts.schemas.ts` | renderer | indented | `package.json` ordering: documented keys first, Node condition order preserved. A global sort would be wrong here. |
| E11 | `packages/foundation/modeling/yaml/src/internal/stringifier.ts` (`sortKeys` option) | renderer | YAML | Not JSON. No source caller turns the option on. |
| E12 | One-level sorts that shape a record before an indented file is written: `mcpb-kit` manifest env, cache policy baseline reviews, skills lock map, root package projection, shard timings, coverage baseline, policy fingerprint turbo edit (rows LB4, LB8, S3, S6, T1, Ci2, Q7, L4, L5 in the tooling file) | renderer | indented | Committed or generated files. Where a digest exists it is a file-content digest. |

`packages/tooling/tool/cli/src/commands/Quality/internal/CoverageArtifacts.ts`
`normalizedRaw` sorts only the top-level keys of a compact document and hashes
it as the sealed coverage report's content digest. It is `outside`: a shallow
sort is not RFC 8785, and swapping it would change `reportSha256`.

## Digests over the replace-class encoders

What has to keep recomputing when slice C swaps E1 to E3, where each digest is
stored, and what in slice A covers it. E4 feeds no digest.

| Digest or use | Encoder | Stored where | Slice A coverage |
| --- | --- | --- | --- |
| Packet event id (`packetEventDigest`) | E2 | Event file names under `ops/events/`, in the tree, the archive repository and history | Replay: 76 of 76 stored events recompute through the owner, plus 13 fixture events |
| Plan ids and receipts: graduation plan, goal plan, archive plan, skills relock, patch and migration plans, adoption template hash, harvest row id | E2 | Receipts and ledgers outside the tree, or recomputed and compared with `--expect` | Differential; probe (1,355 calls equal) |
| Goal completion declaration digest (`goalCompletionDeclarationDigest`) | E2 | Completion receipts, machine-local | Differential; probe. Relies on dropped `undefined` members (see below) |
| Grant-set digest, decision seal, outcome seal | E1 | Execution-authority tables (`grant_set_digest`, `hash`, `prev_hash`) | Four golden vectors recompute through the owner; property over every seal the schemas can mint |
| Contradiction proposal and candidate digests, `detectionProposalId` | E1 | Contradiction tables and the persisted proposal payload | Existing golden test and snapshots in `packages/epistemic/use-cases/test`; differential; probe |
| Evidence-verification manifestation key | E1 | `evidence_verification.manifestation_key` | Existing domain test; differential; probe |
| Retention policy digest, calibration authority digest and bundle | E1 | Registry receipt comparison, operator-given bundle file | Differential; probe |
| Unhashed uses: value equality and grouping keys in contradiction detection, retention payload byte count, retention `report.json` text | E1 | `report.json`; otherwise in memory | Differential; probe |
| Lab content ids through `apps/labs/semantica/src/schema/Digest.ts` (about 37 call sites), the gold prompt artifact hash, the W1 `corpusHash`, ledger and provenance ids, provider cache keys | E3 | Committed fixtures under `apps/labs/semantica/fixtures`, C0 ledger rows, cache file names | W1 `corpusHash` recomputes through the owner; probe over the lab's 17 test files (6,717 calls equal), which load and verify the committed fixtures |

`detectionProposalId` has no version line in its preimage, so a byte change
would mint new ids without any marker. The swap must be byte-identical for it
in particular.

## Findings that change later slices

1. **PacketCore depends on the slice B pre-pass.** `Goals/Completion.ts`
   builds its declaration with `packetId` and `proposedCloseout` set to
   `undefined` when absent and relies on E2 dropping them. The owner refuses
   an `undefined` member until the pre-pass lands. With the members removed
   the bytes match.
2. **An unpaired surrogate becomes a refusal.** Free-text `S.String` fields
   reach E1 and E2 (grant destinations and operations, contradiction facts,
   evidence quotes, packet event actors). Today they are escaped and sealed.
   After the swap the owner returns `LoneSurrogate`. No stored event, seal or
   committed fixture carries one. Slice C lists each affected digest and
   decides whether the call site returns a typed error or treats it as a
   defect; `sealExecutionDecision` and `sealExecutionOutcome` return plain
   values today and have no error channel.
3. **E4 writes an unpaired surrogate unescaped**, where E1 to E3 escape it.
   After the swap `@beep/md` frontmatter with one is a refusal.
4. **Nesting past 256 levels** is plain JSON the owner refuses
   (`NestingDepthExceeded`) and the encoders emit. No caller nests that deep.
5. **E1 disagrees with E2 and E3 off the domain** only on a bigint (`{}`
   against `null`) and on an `undefined` array element or root (E1 throws, E2
   and E3 write `null`). No caller reaches either.
6. **The `@beep/epistemics` to `@beep/jsonc` edge is allowed**: modeling to
   modeling, acyclic. See decision `2026-11-12-differential-test-placement`.

The off-domain behaviour of every encoder is fixed row by row in
`packages/tooling/tool/cli/test/canonical-digest-owner-differential.test.ts`
and `apps/labs/semantica/test/CanonicalDifferential.test.ts`.

## Legacy rows

None. Every stored digest the replay reached recomputes through the owner.

## Seen while reading, outside this goal

Not acted on here; each is a row in a partition file.

- `routeFootprintCanonicalJson` (`Ci/RouteFootprints.ts`) is named canonical
  but its keys are in literal order, and its digest is stored in route plans
  and final-check receipts.
- Most digests under `packages/tooling` hash JSON in schema field order: the
  Cache producer, approval and observation family, `ai-metrics` payloads and
  receipt ids, the docgen proof manifest, the harness fingerprint and the
  agent-memory revision preimage. They are byte-stable only while field order
  is.
- `secretsLayoutIdentity` (`Accounts/AccountsSecretsLayout.service.ts`) hashes
  a layout that includes secret field values.
- The RDF dataset fingerprint hashes canonical N-Quads with the final newline
  trimmed, so it is not SHA-256 of the RDFC-1.0 document.
- `BoxMirror` stores an unhashed JSON fingerprint whose bytes depend on the
  key order of object literals at each call site.
