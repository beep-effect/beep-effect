# Canonical Digest Owner Spec

## Objective

Give the repository one owner for the bytes its digests hash.

- The canonical byte form is RFC 8785 (JSON Canonicalization Scheme) output.
- `JsoncFingerprint` in `@beep/jsonc` is the only implementation of it.
- A self-describing digest is `sha256:` followed by 64 lowercase hex digits,
  owned by `@beep/schema` beside `Sha256Hex`.
- Every hand-rolled encoder that already emits RFC 8785 on its domain is
  replaced by the owner, with tests showing byte equality and a replay showing
  that every stored digest still recomputes.

Graduated from [`explorations/protocol-as-value`](../../explorations/protocol-as-value/README.md);
the shape is the 2026-11-10 entry in its `DECISIONS.md`, and the evidence it
starts from is
[`research/encoder-differential-2026-11-10.md`](../../explorations/protocol-as-value/research/encoder-differential-2026-11-10.md).

## Non-Goals

- No new canonical encoder. The work is adoption of the existing one.
- No rewrite of a stored digest, event file name, seal or parent chain.
- No journal, register or fold kit; no definition digest or normalizer; no
  protocol value, projection, transport or agent runtime. Those are gated
  candidates in the exploration's `MAP.md`.
- No digest channel inside `@beep/identity`.
- No unification of hashing backends (`@noble/hashes` and
  `effect/crypto/Digest` both stay where they are).
- No change to PartyKey v1 bytes or the `pk:v1:` grammar.
- No change to the indented renderers (`canonicalJsonTextPretty`, the
  OpenClaw document renderer) beyond recording them in the census.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/foundation/modeling/jsonc` (the `undefined`-member pre-pass and
  its tests).
- `packages/foundation/modeling/schema` (the prefixed digest grammar beside
  `Sha256Hex`).
- `packages/foundation/modeling/provenance` and
  `packages/foundation/capability/file-processing` (`SourceTextDigest` and
  `ContentDigest` derive from the shared grammar).
- `packages/foundation/modeling/epistemics/src/internal/CanonicalJson.ts`.
- `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketDigest.ts`.
- `apps/labs/semantica/src/corpus/Canonical.ts`.
- `packages/tooling/policy-pack/lint-rules` (one guard rule) and
  `biome.jsonc`.
- Any further encoder the census classifies as RFC 8785 on its domain.
- This packet.

## Constraints

- **Census first.** No encoder is replaced before the census row for it
  exists and the stored-digest replay for its record classes has passed.
- **Three classes.** Each encoder or digest preimage found is classified as
  RFC 8785 on its domain (replace), separately pinned by a specification
  (keep, with the reference), or a renderer (keep, and confirm no canonical
  digest is taken over its output).
- **Refuse, never coerce.** A value outside plain JSON is a typed failure
  from the owner. The one permitted pre-pass drops object members whose
  value is `undefined`. An `undefined` array element, a non-finite number, a
  bigint, a lone surrogate and a non-plain object are refusals.
- **Coerced history keeps its function.** If the replay finds a stored digest
  that depended on a coerced value, that record class keeps the old function
  under a name that says legacy, with a census row explaining why. Nothing
  is re-digested.
- **Exports stay.** `canonicalDetectionJson` and `canonicalJsonText` keep
  their names and signatures; only their bodies change. A replaced encoder
  that could throw before may throw the owner's typed error instead, and the
  change is listed in the pull request.
- **Grammar.** One algorithm prefix. The encoding version is not part of the
  digest string; the schema that names a preimage contract carries it. Bare
  `Sha256Hex` stays valid everywhere it is stored today.
- **Dependency edges.** `@beep/epistemics` and the semantica lab gain a
  dependency on `@beep/jsonc`. Confirm the edge against
  `standards/ARCHITECTURE.md` before the swap; `@beep/schema` must not import
  `@beep/jsonc`, which already depends on it.
- **One encoder per commit** in the swap slice, so a revert is one commit.
- Repository code laws apply (schema-first, Effect helper modules, titled
  JSDoc sections, `bun run beep quality package-verify` per touched package).

## Acceptance Criteria

- [x] A tracked census lists every sorted-key encoder and digest preimage
      in package and app source with its class and disposition.
- [x] A property test holds each replaced encoder byte-equal to
      `JsoncFingerprint.canonicalizeResult` on generated plain JSON, and it
      ran green before that encoder's body was replaced.
- [x] A replay recomputes every stored PacketCore event digest in the tree
      and every execution-record seal fixture through the owner, with zero
      mismatches, or each mismatch has a legacy row in the census.
- [x] A test fixes the refusal table: each non-JSON input class and the
      typed error the owner returns for it.
- [x] `@beep/schema` exports the prefixed digest grammar, and
      `ContentDigest` and `SourceTextDigest` are defined from it with their
      encoded forms unchanged.
- [x] `rg` finds no sorted-key JSON encoder outside `@beep/jsonc` except the
      census rows classed as pinned, renderer or legacy.
- [x] A lint rule rejects a new one, and it is wired into the single lint
      pass.
- [x] `explorations/protocol-as-value/MAP.md` still lists the three gated
      candidates; this goal activated none of them.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/canonical-digest-owner/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/canonical-digest-owner/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/canonical-digest-owner` | Passes |
| Touched packages | `bun run beep quality package-verify <package>` for each | Passes |
| Differential property test | the test added in slice A | Passes |
| Stored-digest replay | the replay added in slice A | Zero unexplained mismatches |
| Lint | `bun run lint` | Passes with the new guard active |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add canonical-digest-owner --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug canonical-digest-owner`; add a `kind: decision` file there, never edit this block._

### Appetite: four slices; no kit, normalizer or protocol value, 2026-11-10

Four slices, each its own pull request: census and proof, owner surface, swaps, guard. The journal kit, the definition digest and the protocol kit stay gated in the exploration's MAP.md; a fired gate reopens the exploration. Unifying hashing backends and changing PartyKey v1 bytes are out. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.

Lane docs/protocol-as-value-graduate

Reverse: Reopen explorations/protocol-as-value at decompose when a MAP gate fires; do not widen this goal.

### Canonical bytes are RFC 8785 and @beep/jsonc owns them, 2026-11-10

The canonical byte form is RFC 8785 output and JsoncFingerprint in @beep/jsonc is its only implementation. A new encoder in @beep/schema was rejected: @beep/jsonc already depends on @beep/schema, so that would be a cycle or one more copy. A differential run found the epistemics, PacketCore and semantica encoders byte-identical to it on plain JSON. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.

Lane docs/protocol-as-value-graduate

Reverse: Supersede with a decision naming another owner; the swaps are import changes held byte-equal by test, so reverting them restores the old encoders.

### A stored digest that depended on coercion keeps its old function, 2026-11-10

If the stored-digest replay finds a digest computed over a coerced value, that record class keeps the previous function under a legacy name and gets a census row saying why. No stored digest, event file name, seal or parent chain is rewritten by this goal. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.

Lane docs/protocol-as-value-graduate

Reverse: Re-digest that record class under a migration decision that lands its reversal path first.

### One sha256: digest grammar in @beep/schema; no encoding version in the string, 2026-11-10

A self-describing digest is sha256: plus 64 lowercase hex digits, the form ContentDigest and SourceTextDigest already use. @beep/schema owns it beside Sha256Hex and domain digests brand over it. The encoding version stays out of the string: the schema naming a preimage contract carries it, so two digests of the same bytes never differ for a reason the hash cannot see. Bare Sha256Hex stays valid wherever it is stored. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.

Lane docs/protocol-as-value-graduate

Reverse: Add a second algorithm prefix or a versioned form in a superseding decision; stored values keep decoding because the grammar only widens.

### Refuse values outside plain JSON; drop only undefined members, 2026-11-10

The owner returns a typed failure for a non-finite number, a bigint, a lone surrogate, a non-plain object and an undefined array element. One named pre-pass drops object members whose value is undefined, because every legacy encoder and JSON.stringify already treat such a member as absent. The legacy encoders coerced the rest silently, so two different values could share a digest. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.

Lane docs/protocol-as-value-graduate

Reverse: Widen or narrow the pre-pass in a superseding decision and update the refusal-table test with it.

### Callers rely on one coercion, dropped undefined members; unpaired surrogates are reachable but unstored, 2026-11-12

P0 answer, 2026-11-12, from two sources: a reading of every caller (research/encoder-census.md) and a temporary probe that wrapped the three encoders and compared each call with the owner while the callers' test suites ran (ten package and app suites plus 46 repo-cli Goals, Explore and Skills test files; about 27,900 encoder calls; never committed). No call produced bytes that differ from the owner's where the owner emits. Relied on: an object member whose value is undefined. goalCompletionDeclarationDigest and the declaration comparison in Goals/Completion.ts pass packetId and proposedCloseout as undefined when absent (443 calls) and depend on the member being dropped; with undefined members removed the owner's bytes matched in all 443. That is the pre-pass SPEC.md already permits, so the PacketCore swap in slice C depends on slice B landing it. Reachable but not relied on: an unpaired surrogate. Free-text S.String fields admit one, schema-derived arbitraries generated them in about 1,070 calls (contradiction facts, evidence quotes, grant destinations, packet event actors), the encoders escape and digest them, and the owner refuses. No stored event, seal or committed fixture carries one. Slice C must list each such digest as a behaviour change from a sealed value to a typed refusal. Not reached by any caller: NaN, an infinity, a bigint, a Date, an undefined array element, undefined at the root and nesting past 256 levels; only the slice A table tests produce them. One input is not plain JSON by type: retentionPayloadBytes takes an edge fact typed as a record of unknown; it counts bytes, is not hashed, and production reads the fact from a JSON column.

Lane test/canonical-digest-census

Reverse: Rerun the probe described in research/slice-a-evidence.md and supersede this file with the new counts.

### Slice A tests live beside each encoder's importer; two dev edges, no production edge, 2026-11-12

The differential and off-domain tests for the epistemics and PacketCore encoders, and the packet event replay, live in the @beep/repo-cli test tree: that package already depends on @beep/epistemics, @beep/jsonc and the test kits, so they add no edge. The semantica encoder is app-internal and a package cannot import an app, so its two tests live in apps/labs/semantica/test with @beep/jsonc as a devDependency, the edge SPEC.md already plans as a dependency in slice C. The execution-record seal replay extends the golden-vector block in packages/execution-authority/domain/test with @beep/jsonc as a devDependency; standards/ARCHITECTURE.md (Family And Kind Dependency Rules, Slice Consumption Rules) lets a domain package import foundation/modeling. The same table settles the slice C question early: @beep/epistemics to @beep/jsonc is modeling to modeling, which is allowed, and acyclic because @beep/jsonc depends only on @beep/identity, @beep/schema and @beep/utils. Rejected: one test in @beep/jsonc (it would import a tooling tool and an app), and a shared generator exported from a test kit (new public surface for scaffolding that slices C and D retire). The generator is effect/Arbitrary over S.Json, widened in the repo-cli test with fixed pools of numbers, strings and keys; the semantica test uses the schema-derived arbitrary alone plus fixed examples.

Lane test/canonical-digest-census

Reverse: Move the test files, drop @beep/jsonc from the devDependencies of @beep/execution-authority-domain and @beep/semantica, and run bun run beep tsconfig-sync.

### The shared grammar is Sha256PrefixedDigest; a domain digest keeps both brands, 2026-11-12

Slice B call. @beep/schema exports Sha256PrefixedDigest beside Sha256Hex, with Sha256PrefixedDigestFromHex as the codec between the bare and the prefixed form. The name Sha256Digest was not used: @beep/sbom already exports a schema of that name for the bare 64-character form (it strips an optional prefix while parsing), and two modeling packages exporting one name for opposite grammars would invite the mix-up this goal removes. ContentDigest and SourceTextDigest are now that schema with their own brand added, so each keeps its encoded string and its existing brand, and gains the shared brand. A domain digest is therefore assignable to the shared type, and a function that only needs the grammar can take any of them; two domain digests stay distinct from each other. Rejected: an unbranded shared grammar, which would make every prefixed string a digest of every kind once decoded. Found while surveying and left for slice C because both sit in @beep/repo-cli, which slice C already changes: the cache workflow schema and the files media schema each spell the same grammar as a regular expression.

Lane feat/canonical-digest-owner-surface

Reverse: Rename the export in @beep/schema and its two importers; the encoded string does not change, so nothing stored is affected.

### The undefined-member relaxation is an option of the emitter, not a second pass, 2026-11-12

Slice B call. The 2026-11-10 decision named a pre-pass that drops object members whose value is undefined. It lands as JsoncCanonicalizeOptions.omitUndefinedMembers on the owner's own walk, default false, accepted by canonicalizeResult, canonicalize, hashResult and hash. Contract is the one already decided: only an object member read as undefined is left out; an undefined array element, an array hole, an undefined root, a function, a symbol and every other value outside plain JSON still fail typed, and a member key with an unpaired surrogate fails even when its value is undefined. Rejected: a separate function that copies the value without those members before canonicalizing. It would read every getter twice or need its own copy of the hardening the walk already has (the depth cap that also stops cycles, the guards around throwing getters and Proxy traps, indexed array reads), and a second walk could disagree with the first about which member fails first and at which JSON pointer. Inside the walk the member is read once, so a getter decides once whether its member exists, and the first-failure order and pointers are unchanged. Also rejected: a second set of entry points with the relaxation in their names; the options class matches JsoncTextHashOptions, which the same facade already uses for hashText. Tests: the refusal table in the jsonc fingerprint test fixes each input class, its code and its pointer under all three option states, and a property holds the option equal to deleting the members.

Lane feat/canonical-digest-owner-surface

Reverse: Add a standalone pre-pass function beside the option and move callers to it, or remove the option and its tests; the default is refusal, so no stored digest depends on the option until slice C adopts it.

### The replay covers archived and history-only events through a tracked snapshot, 2026-11-12

P0 count, 2026-11-12. Main has minted 76 packet event digests. Four are in the tree (four goals, one packet-created event each). The archive repository beep-effect/beep-effect-goals-archive holds 71 at commit 6187b837dc1b (61 packet-created, 9 status-set, 1 risk-tier-overridden). One exists only in history: goals/firecrawl-driver, deleted with its packet in pull request 1975 and never archived. The replay must cover the archive: it holds 71 of the 76, every parent link and every body type other than packet-created, so a tree-only replay would never exercise a chained event. The archive is a separate repository that hosted CI does not check out, so all 76 events are snapshotted into one JSONL fixture in the repo-cli test tree, each line naming its source commit. The four in-tree events are in the snapshot too and are not read live: a test that reads packet data must be registered as a goal-data consumer (the ROUT-03 census), which would move every pull request that adds a packet event onto the code route. Result: 76 of 76 recompute through JsoncFingerprint.hash; no legacy row. Refresh the snapshot with the commands in research/slice-a-evidence.md when the tree or the archive gains an event.

Lane test/canonical-digest-census

Reverse: Delete packages/tooling/tool/cli/test/fixtures/canonical-digest-owner/stored-packet-events.jsonl and the snapshot case in canonical-digest-owner-replay.test.ts; to read the tree live instead, register the test in ciGoalDataConsumers.

### Swapped encoders' differential tests keep the legacy column as a record, 2026-11-13

Once an encoder is the owner, its byte-equality property compares the owner with itself, so those properties and their generator are gone. What carries information stays. The off-domain tables now assert what each export does (the owner's refusal, read back by code; PacketCore's undefined-member row still emits through the option), beside a legacy column recorded from slice A, since that code no longer exists to observe. The depth-cap and NaN rows assert that the exports refuse. The md block pins the frontmatter text and both render outcomes. The packet event replay, the W1 corpus hash replay and the execution-seal replay are unchanged in substance and still pass. Existing property tests whose schema-derived free text produced an unpaired surrogate now either expect the seal or the owner's refusal, or draw well-formed text through a repo-cli test helper where the property is about canonical bytes.

Lane refactor/canonical-digest-owner-swaps

Reverse: Restore the slice A versions of the two differential test files from history; they need the legacy encoders, so revert the swap commits first.

### The md import boundary exempts the JsoncFingerprint facade by name, 2026-11-13

@beep/md keeps every parser package, @beep/jsonc among them, out of the runtime closure of its non-bridge entries, and its boundary test failed once the render module imported the owner. The swap needs that import, so the test now exempts exactly the specifier @beep/jsonc/JsoncFingerprint: the canonical-JSON facade of that package, whose own closure is one constant module and loads no parser. Every other @beep/jsonc subpath, and the package root, still counts as a parser. Rejected: keeping md's own encoder as a pinned row, since the census classes it replace and it diverged from RFC 8785 on unpaired surrogates, and moving the facade to another package, since @beep/schema cannot import @beep/jsonc and SPEC.md puts the owner in @beep/jsonc.

Lane refactor/canonical-digest-owner-swaps

Reverse: Remove the exemption and the render import together, restoring md's own frontmatter encoder as a pinned census row.

### Only PacketCore passes omitUndefinedMembers; the other swaps are strict, 2026-11-13

Slice C call, made per encoder from what the legacy encoder did and what its callers rely on. PacketCore canonicalJsonText passes omitUndefinedMembers: Goals/Completion.ts builds the completion declaration with packetId and proposedCloseout left undefined when absent, and 443 probe calls depended on the member being dropped. The epistemics encoder (behind canonicalDetectionJson and the two domain aliases) and the semantica lab encoder also dropped undefined members, but no caller relies on it: their seal and digest inputs are schema wire forms, no schema in those domains declares a member that encodes as undefined (no S.optional, only exact optional keys), and the probe's one undefined-member call for each came from the slice A table test. The md frontmatter encoder already threw on an undefined member, since its input is S.JsonObject. Strict is preferred wherever nothing relies on the relaxation, so a member left undefined by mistake is a typed refusal rather than a silently different preimage. Rejected: the option everywhere for symmetry, which would hide such mistakes in the seal domains that SPEC.md wants refused.

Lane refactor/canonical-digest-owner-swaps

Reverse: Pass JsoncCanonicalizeOptions with omitUndefinedMembers in the encoder that needs it; stored digests are unaffected because no stored preimage carries an undefined member.

### PartyKey v1 keeps its serializer and gains a parity proof, 2026-11-13

PartyKey v1 bytes are pinned by the archived party-slice specification and by the package fixture, and SPEC.md forbids changing them, so its encoder is not swapped. A property in the package's PartyKey test holds its canonicalJson equal to the owner's RFC 8785 bytes for the encoded basis on 200 seeded bases (source-record and namespaced identifier, drawn from canonical text), and hand-written cases cover each escape it writes and the pinned email basis. The two agree because the basis domain is narrow: fixed ASCII keys, where code-point and UTF-16 order coincide, string values only, and unpaired surrogates refused at decode. The census row stays pinned with the proof as its evidence. Adds @beep/jsonc as a devDependency of @beep/party-domain. Rejected: a swap, which would make the owner's future behaviour part of a pinned contract, and a pinned row without proof, which would leave the slice D guard trusting an unverified claim.

Lane refactor/canonical-digest-owner-swaps

Reverse: Delete the parity block from the PartyKey test and the devDependency; the pinned fixture still fixes the bytes.

### The proposal-fact bound check stays total: a refused fact is out of bounds, 2026-11-13

The contradiction proposal fact schema bounds a fact by the byte length of its canonical JSON. After the epistemics swap that check would throw for a fact the owner refuses: S.is then throws (the guard adapter dies on a failure that is not a schema issue), decode dies instead of failing, and the exported contradiction arbitraries throw while sampling. Five existing test suites failed that way. The check now reads the owner's Result and returns false on a refusal, so such a fact fails decode with the schema's typed error, as any other unbounded fact does. This is not a new check: the bound already meant at most 64 KiB of canonical UTF-8, and a value with no canonical form has no such size. It also guards detection beliefs, whose assertion check reuses the fact schema. Rejected: keeping the throw, since a schema guard that throws is a defect, and a separate well-formedness check on the fact, which would be a new domain check and is out of scope for this slice.

Lane refactor/canonical-digest-owner-swaps

Reverse: Call the epistemics canonicalJson in the check again; a fact with an unpaired surrogate then makes the fact schema throw instead of fail.

### The cache and files sha256 schemas are the shared grammar, 2026-11-13

The cache workflow's GitHub artifact digest and FileSha256Hash in the files media schemas each spelled the sha256: grammar as a regular expression. Both accepted exactly what Sha256PrefixedDigest accepts: the prefix, 64 characters, lowercase hex only, with uppercase digits, a longer tail and an uppercase prefix refused by both. So both are now that schema, and FileSha256Hash keeps its identity annotation. Encoded strings are unchanged and the decoded type gains the shared brand. One visible difference is accepted: a rejected value reports the template-literal message instead of the old pattern message. Rejected: a filter over the shared guard that keeps the old message, which would leave FileSha256Hash unbranded and outside the shared type.

Lane refactor/canonical-digest-owner-swaps

Reverse: Restore the two regular expressions; nothing stored changes.

### Guard exceptions: a source-root override that exempts @beep/jsonc, and census rows in source, 2026-11-13

Slice D call. The root biome.jsonc registers the rule through an overrides entry with includes ["**/src/**", "!packages/foundation/modeling/jsonc/**"]. Path scope is how the repository's other plugin rules take exceptions (no-native-error and no-bigint-literals are both override-scoped), and no plugin rule had an in-source suppression before this one. The negated glob exempts the owner package, whose JsoncFingerprint walk builds its object text with the same join the rule rejects; a fixture tree proved Biome 2.5.6 honours the negation in an override. Source roots only, matching the census scope, which excludes tests: under test/ the shape builds JSON, YAML flow and glob brace text on purpose (glob brace-expansion property tests, the yaml flow property tests, the jsonc tests, a practice-mail-tagging fixture). scripts/ is out as well: its only hits are three html generator templates that emit TypeScript object literals, not JSON, and no census encoder lives in a script. Every hit left in source is a census row and carries biome-ignore lint/plugin/no-hand-rolled-canonical-json on the line above it, with the row id and class: E5 PartyKey.behavior.ts (pinned), E6 PublicationResourceHash.ts (pinned), E7 PacketDigest.ts canonicalJsonTextPretty (renderer), E8 OpenclawRender.ts (renderer), E9 ToolNames.ts (renderer), E11 the yaml stringifier flow mapping (renderer, YAML; it is renderFlowObject, called from stringifyObjectLines, row 13 of the foundation-drivers partition) and E12 PolicyFingerprintJson.ts (renderer, tooling row L4). A suppression must sit directly above the line where the diagnostic starts; Biome reports one that matches nothing as suppressions/unused, so a suppression goes stale loudly when its encoder changes. No hit lacked a census row. Rejected: a per-file override list in biome.jsonc for the census rows, which would hide the reason from the code and exempt a whole file instead of one expression.

Lane feat/canonical-digest-owner-guard

Reverse: Move the rule to the top-level plugins array or widen its override includes, and add or remove biome-ignore lines to match the hits that result.

### The guard matches braces around a join of members, in three forms, 2026-11-13

Slice D call. The rule no-hand-rolled-canonical-json in @beep/lint-rules is a Biome GritQL rule at severity error with three arms. An untagged template whose first chunk is an opening brace and whose last chunk is a closing brace, each optionally padded by a newline and indentation (a trailing newline is allowed), with at least one interpolation that is a direct join of members: xs.join(sep), A.join(xs, sep), A.join(sep)(xs), or a join as the last stage of pipe or .pipe. A pipe, flow or .pipe call with a join stage and, as another stage, an arrow whose body is such a brace template. A string concatenation of a brace literal, a join and a closing brace literal. Every sorted-key encoder the census found built its object text one of these ways: the first arm matches E1, E2 and E3 as they were before slice C and E5 to E9, E11 and E12 (tooling L4) today; the second matches the E4 md frontmatter encoder as it was. Biome 2.5.6 support was proved by fixtures, not assumed: node patterns with list fields under some, regular expressions over a node's source text, and a spread before one element work; a spread before two adjacent elements (flow($..., $join, $wrap, $...)) matched only when the join was the first argument, which is why the second arm anchors on the arrow and checks direct stages with some. Deliberately not matched: braces around an interpolation that is not a join (URL path templates, regex quantifiers, glob alternatives built without a join, markdown attributes), arrays, space-padded braces (TOML inline tables at packages/foundation/modeling/toml, N3 formulas), tagged templates and fixed-key templates such as the eyecite resource preimages in CaseResourceHash.ts. A join assigned to a variable before it is wrapped is not followed. Glob brace text built with a join cannot be told from JSON by syntax; in source it would need a biome-ignore saying what it is, and today there is none. Cost, one plugin over every TS and JS file in packages, apps and infra: 21.7 s CPU against 12.6 s with no plugin, 1.2 s against 1.0 s wall; prefer-exact-optional-key, measured the same way, costs 64 s. Rejected: an oxlint rule or a ts-morph check, since the repository puts syntactic guards in GritQL and SPEC.md names biome.jsonc; and braces around any interpolation, which fires on the runpod path template, the glob and markdown emitters and the law-practice regex translator.

Lane feat/canonical-digest-owner-guard

Reverse: Delete rules/no-hand-rolled-canonical-json.grit, its registry entry, fixtures, preset lines and biome.jsonc override, and the seven biome-ignore lines.

### The recursive key-sort arm is dropped, 2026-11-13

Slice D call on the stretch arm: a self-recursive function, declared or assigned to a variable, whose body sorts record keys (R.keys, R.toEntries, Object.keys, Object.entries or Struct.keys under A.sort, .sort, .toSorted or a pipe into A.sort) and calls itself by name. Measured over every TS and JS file in packages, apps and infra it reports exactly two sites, OpenclawRender.ts encodeCanonicalValue (E8) and ToolNames.ts renderCanonicalValue (E9). Both are census rows, so it passes the precision test, but the template arm already reports both. Run against the four legacy encoders as they were before slice C it reports none: E1 sorted a filtered entry list rather than R.keys, E3 and E4 recursed mutually through a second function, and E4 was point-free. E10 sortKeys is not recursive, so the arm misses it too. It needs a whole-body contains on every variable declarator and function declaration. Alone, over the same files, it cost 178.8 s CPU and 4.8 s wall, against 21.7 s and 1.3 s for the shipped rule and 12.0 s and 1.2 s with no plugin: about 167 s of CPU for the arm against about 10 s for the whole shipped rule. It adds no recall at that price, so the rule ships with the three brace arms only. Rejected: keeping it for symmetry with the census definition of an encoder, which sorts keys whether or not it builds braces; a guard on that definition needs data flow, which GritQL in Biome does not have.

Lane feat/canonical-digest-owner-guard

Reverse: Add the arm to no-hand-rolled-canonical-json.grit with fixtures; it reports E8 and E9 on today's tree, which already carry suppressions.

### Swapped synchronous exports throw the owner's typed error; no new error channels, 2026-11-13

The four exports stay synchronous and return a string, as SPEC.md requires under Exports stay, so a refusal is thrown: each body is Result.getOrThrowWith over JsoncFingerprint.canonicalizeResult with identity, and the thrown value is the owner's JsoncCanonicalizeError with its code and JSON pointer, never a wrapped or plain Error. The digest helpers built on them (contradiction proposal and candidate digests, detection proposal id, evidence manifestation key, grant-set digest, PacketCore event and plan digests, the lab content ids) keep their Result or Effect signatures and SchemaError channels. The throw escapes Result.map, and inside an Effect generator it becomes a defect. Only the md render entry points turn it into a typed failure, because Md.render already captures adapter throws as RenderError. Rejected for this slice: widening those channels with JsoncCanonicalizeError, which changes every signature from the encoders up to the services, and adding schema checks on free-text fields, which the orchestrator decides after reading the surfacing list in PLAN.md. No stored event, seal or fixture carries a refused value, so nothing that verifies today stops verifying.

Lane refactor/canonical-digest-owner-swaps

Reverse: Add JsoncCanonicalizeError to the error channel of a digest helper and call canonicalizeResult there, or add a well-formedness check at the boundary that feeds it; the exports themselves can keep throwing.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
