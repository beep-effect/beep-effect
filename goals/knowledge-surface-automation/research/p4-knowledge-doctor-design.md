# P4 design — `beep knowledge doctor` (Workstream C Stage 2)

Status: design (2026-10-13), agent-decided under the 2026-10-06 autonomy charter; K1–K10 below carry their reasons and reversals. PR 1 (read-only `--report`) is the first implementation step.

## Scope and binding doctrine

Workstream C Stage 2 (`goals/knowledge-surface-automation/SPEC.md`, "Stage 2"): a
full-corpus doctor that reuses the domain evaluators and is hardened against gaming from
the start. This design covers all four ratified hardening measures (sealed baseline,
counterfactual assertion tests, debt leases, causal grouping), span classification, and
evaluator reuse.

Sealed and NOT reopened: C1–C8 (`research/p2-grill-decisions.md`); the Stage-1 contract
(`knowledge-finding/v1`, `knowledge-normalization/v1`, paired-archive semantic delta,
fence decoys, `<!-- beep:assert path-exists -->`); the FP verdicts
(`research/p1-fp-eyeball-verdicts.md`: strict scanner, documentation fixes over
normalizer exceptions, exploration research stays live corpus); and the same-repo-only
probe execution policy.

Out of scope, each later and separately designed: tombstone identity tracking beyond the
C6 tiers (`beep knowledge rename` does not exist yet, so C6 tier 2 is git lineage alone
until it ships), the ambiguity-lint lane, the contradiction/redundancy pass, and running
` ```bash beep:exec ` fences. This doctor only probes them structurally.

Ground truth this design builds on:
- `KnowledgeTreeOracle`/`KnowledgeArchiveOracle` (tree-scoped reads, never the working filesystem).
- The static command surface (`Knowledge.command-surface.ts`).
- Producer registrations (`producer://goals/index`).
- `KnowledgeRefClassification` (12-class rule table).
- The goals-doctor ratchet (`classifyGoalDoctorFindings`, `internal/ratchet/RatchetDiff.diffMembership`).
- `.github/CODEOWNERS`, which exists and holds `* @kriegcloud`.

## Decided contract

1. **Phase 0 is read-only.** `knowledge doctor --report` reads no baseline, writes
   nothing, gates nothing, and exits 0 on findings. Every extraction form starts
   report-only. It is promoted to blocking only through the C7 zero-FP window, one
   promotion PR per form, with the window evidence attached.
2. **Every reference-shaped span is classified by a total, ordered rule table** (not
   hand labels):
   (a) inside a fence whose info string carries `beep:generated=<producer-id>` →
   `generated-example`. Validated by regenerating via the producer registry and
   byte-comparing. Never executed. Fence-scoped by construction (C2).
   (b) on an archival-classified path and under a valid historical citation →
   `historical-with-commit`. Verified against the cited commit's tree and command
   surface, not HEAD's.
   (c) on a live surface → `verified`. Verified at HEAD, always: a historical marker
   on a live surface never moves a span off HEAD (see contract 3).
   (d) anything else → `unclassified`. Unmarked fences are decoys, not spans.
3. **Historical citation shape.** Block form `<!-- beep:historical commit=<40-hex> -->`
   scopes to exactly the next Markdown block (paragraph, list, table, or fence), by AST.
   Document form is frontmatter `beep-historical: <40-hex>`. Both forms are admitted
   only on paths the refs rule table already classes as archival. On a live surface a
   marker of either form is inert, and the span stays `verified` at HEAD. The marker
   itself is reported as `historical-marker-on-live-surface` so it cannot be used to
   launder live debt. The commit must be an ancestor of HEAD
   (`merge-base --is-ancestor`); otherwise `historical-commit-not-ancestor`. A citation
   is a claim that gets checked, not an exemption: a span that fails at its cited commit
   is `historical-claim-unverified`.
4. **Unclassified spans are non-baselineable.** They never enter the sealed set. Their
   only gate is the Stage-1 introduced-only paired delta (new unclassified spans block
   once promoted; existing ones are reported for classification burn-down).
5. **Evaluators prove their passes.** A `Resolved` outcome must carry a non-empty array
   of resolution witnesses (schema-enforced). Witness-free success cannot be expressed,
   so every pass is counterfactually testable.
6. **Domain reuse through cores, not command handlers.**
   - Packet-status claims use the goals-doctor packet core (`packetFindings`), refactored
     onto a tree reader, plus `GoalManifest` decoding.
   - Skill sources and licenses use a new hermetic `evaluateSkillsLocal` split out of
     `runSkillsUpdate`: lock coverage, floating/unresolvable sources, codex-config and
     agents-mirror drift, and `SkillLicense` presence.
   - `RemoteSkillDrift` needs `HttpClient`, so it stays in `skills update --check`. The
     doctor never touches the network.
   - Findings the domain commands already gate (all `GoalDoctorFindingKind`s) appear in
     the report as `delegated`. They are used as causal roots and never baselined by the
     knowledge doctor. One owner per finding, no double ratchet.
   - Wall-clock and git-advisory kinds (`stale-active`, `active-after-merge`) are
     excluded entirely, because they are not a function of the SHA.
7. **Extraction forms** are paths, `bun run beep` commands (C3 option introspection now
   emits `unknown-beep-option`), `@beep/*` package/subpath/export symbols (package names
   and `exports` maps from the tree; exported identifiers by declaration scan of the
   resolved file, never `tsc`), packet-status claims, skill sources, and licenses.
8. **Sealed baseline** `goals/knowledge-doctor.baseline.jsonc`, next to
   `goals/goals-doctor.baseline.jsonc`:
   - Keys are minted only by `knowledge doctor mint` in the C8 CI job, at a
     default-branch SHA recorded as `mintedAt`.
   - The seal is reproducibility, not a signature: re-minting at `mintedAt` must
     reproduce the file byte-for-byte.
   - A feature branch may only delete entries. Any added entry, changed field
     (relabel = kind, subject, or class change), changed `mintedAt`, or edited note is a
     blocking `baseline-tamper`.
   - A non-removal change is admissible only when all four hold:
     (i) CI passes `--accept-mint` because the head branch is
     `automation/knowledge-baseline-mint` and the PR author is the mint App;
     (ii) the PR diff touches only the baseline file;
     (iii) `mintedAt` is an ancestor of the merge-base;
     (iv) `verify-mint` byte-equality holds. This is C8 exactly.
9. **The mint cannot launder.** Mint output = baselineable findings at the SHA,
   intersected with (previous keys ∪ findings of kinds promoted since the previous mint
   ∪ everything, on the very first seal). Promotions live outside the sealed file, in
   `goals/knowledge-doctor.promotions.jsonc`: an append-only, human-reviewed list of
   `{ kind, promotedAt, windowEvidence }`. A promotion PR edits only that file, never the
   baseline, so the baseline stays byte-reproducible from (`mintedAt`, promotions as of
   `mintedAt`). The mint reads the promotions file at its SHA. A feature branch that edits
   or removes an existing promotion row is a blocking `baseline-tamper`; appending is the
   only admitted change. Any other blocking finding at a main SHA makes
   the mint refuse with the list (`KnowledgeMintRefusal`). Leased or lease-expired
   findings are never minted.
10. **Baseline keys use durable identity (C6 order).** The key is
    `knowledge-doctor/v1:<sha256>` over the length-prefixed normalization version,
    kind, durable document identity, NFC subject, and occurrence. Durable identity
    resolution order:
    (1) `beep:ref` identity where dual-write exists;
    (2) git rename lineage from `mintedAt` to HEAD;
    (3) sidecar `goals/knowledge-doctor.identity.jsonc`, admitted per entry only if the
    source existed at `mintedAt` and is absent at HEAD, the target is absent at
    `mintedAt`, and the mapping is 1:1.
    The Stage-1 comparison-scoped `findingId` is unchanged.
11. **Debt leases** `goals/knowledge-doctor.leases.jsonc`. Leases are the only
    author-written suppression. Each lease carries `key`, `owner`, `reason`, `issued`,
    `expires`, and an optional `tracking` field.
    - The owner must be in the CODEOWNERS owner set for the leased document's path. Set
      resolution uses GitHub last-match semantics over the merge-base tree's
      `.github/CODEOWNERS`, so a PR cannot grant itself ownership.
    - Lifetime: `expires - issued ≤ 30 days`. `issued` is immutable relative to the base,
      so renewal cannot outrun the cap.
    - Quotas: 2 active leases per document, 20 per repo.
    - Leases cannot target `unclassified`, delegated, or governance kinds.
    - Violations: `lease-owner-unresolved`, `lease-lifetime-exceeded`,
      `lease-quota-exceeded`.
    - Expiry: yeet warns at T-7 days. At expiry the doctor drops the lease, the finding
      becomes introduced again, and it blocks (`lease-expired` is the root).
12. **Causal grouping.** Each finding carries a `causeKey`:
    - for missing targets: the identity of the missing target (path, command node,
      export, or manifest), so one deleted file referenced from 40 docs is one root with
      40 dependents;
    - for delegated domain findings: the domain finding itself (a `manifest-invalid` root
      explains the packet-status claims beneath it).
    Each root is attributed to its authoring commit (`git log --diff-filter=D|R`, from
    `mintedAt` to HEAD). Rename lineage proposes a repair target, but prose is never
    rewritten automatically. Human output shows roots; `--json` keeps every finding.
13. **Determinism and fail-closed.** Output is canonical sorted JSON. Operational
    failures (absent ref, shallow history, malformed UTF-8, undecodable baseline or lease
    file, missing CODEOWNERS when leases exist) are typed errors with C4-style
    remediation, never findings and never skips.

## Schema sketch (illustrative, not implementation)

New module `commands/Knowledge/KnowledgeDoctor.schemas.ts`:

```ts
export const KnowledgeSpanClass = LiteralKit(["verified", "generated-example", "historical-with-commit", "unclassified"])
export const KnowledgeEvaluatorId = LiteralKit(["paths", "commands", "symbols", "packet-status", "skills-local"])
export const KnowledgeFindingOrigin = LiteralKit(["owned", "delegated"])            // delegated: domain gate owns blocking
// KnowledgeFindingKind (existing LiteralKit) gains, additively:
//   unknown-beep-symbol, packet-status-claim-drift, skill-license-unrecorded, generated-example-drift,
//   historical-claim-unverified, historical-commit-not-ancestor, historical-marker-on-live-surface,
//   unclassified-reference-span,
//   baseline-tamper, lease-expired, lease-owner-unresolved, lease-lifetime-exceeded, lease-quota-exceeded
export class TreeEntryWitness   extends S.TaggedClass<TreeEntryWitness>()("TreeEntryWitness", { path: S.String }) {}
export class CommandNodeWitness extends S.TaggedClass<CommandNodeWitness>()("CommandNodeWitness", { commandPath: S.Array(S.String), option: S.optionalKey(S.String) }) {}
export class ExportWitness      extends S.TaggedClass<ExportWitness>()("ExportWitness", { packageName: S.String, file: S.String, exportName: S.String }) {}
export class ManifestFieldWitness extends S.TaggedClass<ManifestFieldWitness>()("ManifestFieldWitness", { slug: S.String, field: S.String }) {}
export class LockEntryWitness   extends S.TaggedClass<LockEntryWitness>()("LockEntryWitness", { skill: S.String }) {}
export class ProducerWitness    extends S.TaggedClass<ProducerWitness>()("ProducerWitness", { producerId: S.String }) {}
export const ResolutionWitness = S.Union([TreeEntryWitness, CommandNodeWitness, ExportWitness, ManifestFieldWitness, LockEntryWitness, ProducerWitness])
export class EvaluationResolved extends S.TaggedClass<EvaluationResolved>()("Resolved", { witnesses: S.NonEmptyArray(ResolutionWitness) }) {}
export class EvaluationFailed   extends S.TaggedClass<EvaluationFailed>()("Failed", { candidate: KnowledgeFindingCandidate, causeKey: S.String }) {}
export class KnowledgeDoctorFinding extends S.Class<KnowledgeDoctorFinding>(...)({
  finding: KnowledgeFinding, spanClass: KnowledgeSpanClass, origin: KnowledgeFindingOrigin,
  evaluator: KnowledgeEvaluatorId, causeKey: S.String,
  baselineKey: S.OptionFromOptionalKey(KnowledgeBaselineKey),                // none ⇔ non-baselineable
}) {}
export class KnowledgeCauseGroup extends S.Class<KnowledgeCauseGroup>(...)({
  causeKey: S.String, root: KnowledgeDoctorFinding, dependents: S.Array(KnowledgeFindingId),
  authoredBy: S.OptionFromOptionalKey(KnowledgeCommitSha), repairProposal: S.OptionFromOptionalKey(S.String),
}) {}
export class KnowledgeBaselineEntry extends S.Class<KnowledgeBaselineEntry>(...)({
  key: KnowledgeBaselineKey, kind: KnowledgeFindingKind, document: S.String, subject: S.String,
  spanClass: KnowledgeSpanClass.pipe(S.check(notUnclassified)), owner: S.String,
}) {}
export class KnowledgeDoctorBaseline extends S.Class<KnowledgeDoctorBaseline>(...)({
  schemaVersion: S.tag("knowledge-doctor-baseline/v1"), mintedAt: KnowledgeCommitSha,
  entries: S.Array(KnowledgeBaselineEntry),                                     // sorted by key
}) {}
export class KnowledgeDoctorPromotion extends S.Class<KnowledgeDoctorPromotion>(...)({
  kind: KnowledgeFindingKind, promotedAt: KnowledgeCommitSha, windowEvidence: S.String,
}) {}
export class KnowledgeDoctorPromotions extends S.Class<KnowledgeDoctorPromotions>(...)({
  schemaVersion: S.tag("knowledge-doctor-promotions/v1"), promotions: S.Array(KnowledgeDoctorPromotion), // append-only
}) {}
export class KnowledgeDebtLease extends S.Class<KnowledgeDebtLease>(...)({
  key: KnowledgeBaselineKey, owner: S.String, reason: S.NonEmptyString,
  issued: S.DateFromString, expires: S.DateFromString, tracking: S.optionalKey(S.String),
}) {}
export class KnowledgeDoctorReport extends S.Class<KnowledgeDoctorReport>(...)({
  schemaVersion: S.tag("knowledge-doctor/v1"), tree: KnowledgeCommitSha,
  mode: LiteralKit(["report", "check"]), groups: S.Array(KnowledgeCauseGroup),
  findings: S.Array(KnowledgeDoctorFinding),                                     // full JSON retained
  spanCounts: S.Record(KnowledgeSpanClass, S.Natural),
  ratchet: S.OptionFromOptionalKey(KnowledgeDoctorRatchet),                      // introduced/inherited/resolved/leased; none in --report
}) {}
```

## Service contract

```ts
export interface KnowledgeEvaluator {
  readonly id: KnowledgeEvaluatorId
  readonly kinds: ReadonlyArray<KnowledgeFindingKind>
  readonly evaluate: (span: KnowledgeSpan, tree: KnowledgeDoctorTree) =>
    Effect.Effect<EvaluationResolved | EvaluationFailed, KnowledgeOperationalError>
}
export interface KnowledgeDoctorTree extends KnowledgeTreeOracle {          // tree-scoped, overlay-able
  readonly commandTree: Effect.Effect<KnowledgeStaticCommandTree, KnowledgeOperationalError>
  readonly atCommit: (sha: KnowledgeCommitSha) => Effect.Effect<KnowledgeDoctorTree, KnowledgeOperationalError> // historical
}
export interface KnowledgeDoctorShape {
  readonly scanTree: (tree: KnowledgeDoctorTree, evaluators: ReadonlyArray<KnowledgeEvaluator>) =>
    Effect.Effect<KnowledgeDoctorReport, KnowledgeOperationalError>          // pure; golden + counterfactual tests
  readonly report: (treeish: string) => Effect.Effect<KnowledgeDoctorReport, KnowledgeOperationalError | KnowledgeCloneAttributesError>
  readonly check: (opts: { baseRef: string; acceptMint: boolean; now: DateTime.Utc }) =>
    Effect.Effect<KnowledgeDoctorReport, KnowledgeOperationalError | KnowledgeCloneAttributesError>
  readonly mint: (sha: KnowledgeCommitSha) => Effect.Effect<KnowledgeDoctorBaseline, KnowledgeMintRefusal | KnowledgeOperationalError>
  readonly verifyMint: (baseline: KnowledgeDoctorBaseline) => Effect.Effect<void, KnowledgeSealBroken | KnowledgeOperationalError>
}
export class KnowledgeDoctor extends Context.Service<KnowledgeDoctor, KnowledgeDoctorShape>()($I`KnowledgeDoctor`) {}
export const overlayWithout: (tree: KnowledgeDoctorTree, witness: ResolutionWitness) => KnowledgeDoctorTree  // test + harness
```

`check` gets `now` passed in, so lease expiry is testable without a clock. `mint` is pure
and only returns the baseline. Writing the file is the CI job's step.

## Command surface

```text
bun run beep knowledge doctor --report [--tree HEAD] [--json]        # phase 0: no baseline, exit 0
bun run beep knowledge doctor [--base origin/main] [--json]          # gate: ratchet + seal guard + leases
bun run beep knowledge doctor mint --at <sha>                        # CI-only: refuses unless CI=true, clean tree, sha ∈ origin/main
bun run beep knowledge doctor verify-mint                            # re-mint at mintedAt, byte-compare
bun run beep knowledge doctor leases [--json]                        # active / expiring(<=7d) / expired; yeet consumes
```

There is deliberately no `--write-baseline`. That is the difference from
`goals doctor`. Quality wiring: a `knowledge:doctor` step after
`knowledge:semantic-delta` in `rootRepoLintPolicySteps`. It is report-only until the
first promotion. Mint workflow: `.github/workflows/knowledge-baseline-mint.yml`
(weekly schedule plus `workflow_dispatch`, `fetch-depth: 0`, pinned
`peter-evans/create-pull-request` to `automation/knowledge-baseline-mint`). It needs a
dedicated GitHub App token, the same unprovisioned prerequisite that keeps
`data-sync.yml` dormant, because PRs opened with `GITHUB_TOKEN` do not trigger checks.

## Test plan

1. **Counterfactual harness (all evaluators).** For every `Resolved` span in the
   fixture trees, `overlayWithout(tree, witness)` for each witness, re-evaluate, and
   require `Failed`. A surviving pass fails the test with the vacuous evaluator's id.
   Overlay per witness tag:
   - hide the tree entry;
   - prune the command node or option;
   - delete the export declaration;
   - drop the manifest field;
   - drop the lock entry;
   - swap the producer output.
2. **Adversarial fixtures per evaluator:**
   - reflowed and rewrapped spans;
   - alternate spellings (`./x`, `x/`, `x//y`, NFD vs NFC, percent-encoding, case
     variants);
   - an unmarked fence decoy;
   - a `beep:generated` fence with a wrong or unknown producer;
   - a generated marker smuggled into prose or into an HTML comment inside a fence;
   - `~~~` and nested fences;
   - rename, rename+edit, and multi-hop moves;
   - a historical citation with a non-ancestor commit, and one with an ancestor commit
     where the claim also fails;
   - a document-level and a block-level historical marker on a live path: both inert,
     the span still checked at HEAD, and each reported as
     `historical-marker-on-live-surface`.
3. **Seal guard:** add, relabel kind/subject/class, change `mintedAt`, edit a note, mixed
   baseline+code diff with `--accept-mint`, hand-crafted "mint" that fails byte
   reproduction. All of these must block. Pure deletion and pure key reordering
   (canonicalized away) pass.
4. **Mint non-laundering:** a new blocking finding at a main SHA → `KnowledgeMintRefusal`;
   newly promoted kind → admitted; leased finding → excluded.
5. **Leases:** owner outside the merge-base CODEOWNERS set, a CODEOWNERS self-grant in
   the same PR, `issued` mutated, 31-day lifetime, a third lease on one document, the
   21st lease repo-wide, expiry at `now` (finding re-blocks), T-7 warning surfaced in
   `leases --json`.
6. **Causal grouping:** one deleted target cited 40 times → 1 group, 40 dependents.
   A `manifest-invalid` delegated root collapses its packet-status claims. Grouping is
   order-independent across shuffled discovery orders.
7. **Reuse parity:** after the tree-reader refactors, `goals doctor` and
   `skills update --check` output is byte-identical on the live repo.
   `evaluateSkillsLocal` runs with no `HttpClient` in context, which is a type-level proof.
8. **Evergreen and determinism:** the full corpus `--report` round-trips its schema, two
   runs give identical bytes, porcelain is unchanged, and `verify-mint` passes on the
   committed baseline.
9. **Nightly:** seeded 50-span counterfactual sample over the live corpus in
   `property-laws-nightly.yml`.

## Sequencing

- **PR 0 (docs-only):** this design plus K-decisions, per the packet rule.
- **PR 1:** span extraction, the classification rule table, the witness-bearing paths and
  commands evaluators, `unknown-beep-option`, the overlay plus counterfactual harness,
  adversarial fixtures, and `knowledge doctor --report --json`. Also the committed
  `research/p4-report-knowledge-doctor.md`: full-corpus run with annotated candidate FPs
  per class, span-class counts, and the unclassified worklist. Nothing seals.
- **PR 2:** the domain evaluators (goals packet core on a tree reader,
  `evaluateSkillsLocal` with licenses, `@beep/*` symbols), with parity tests. Report-only.
- **PR 3:** causal grouping plus root attribution in the report.
- **PR 4:** baseline/identity/lease schemas, `check`, the seal guard, `verify-mint`,
  `leases`, and `knowledge:doctor` wired report-only into the quality lane. Yeet's verify
  step reads `leases --json` (warning only).
- **PR 5 (needs App token):** the mint workflow. Its first CI-generated baseline-only PR
  is the initial seal.
- **Promotion PRs:** one per extraction form, each after its C7 window, appending one
  row to `goals/knowledge-doctor.promotions.jsonc` (never touching the sealed baseline).
  The next CI mint reads the promotion at its SHA and admits that kind's inherited keys.

## Decisions (K1..K12)

- **K1 Witness-mandatory evaluators.** Reason: makes the counterfactual test total;
  vacuous passes cannot be represented. Reverse: if some evaluator legitimately cannot
  name a target, add a `NoWitness` tag that is never baselineable and never blocking.
- **K2 Seal = byte-reproducible mint, plus a CI-context flag.** Reason: no secret key to
  manage, and a hand-crafted baseline cannot pass. The flag keeps "only CI" literal
  under C8. Reverse: if mint becomes non-deterministic (e.g., tool versions drift),
  switch to signing with an App-held key.
- **K3 Mint absorbs only previous keys plus newly promoted kinds.** Reason: otherwise a
  main-red finding or an expired lease launders into permanent debt. Reverse: an
  operator-dispatched `--admit <key>` input recorded in the mint PR body, if the refusal
  stalls main.
- **K4 Delegated domain findings are never knowledge-baselined.** Reason: one ratchet per
  finding; the goals-doctor baseline stays authoritative. Reverse: retire a domain
  baseline into this one if the goals doctor is ever folded in.
- **K5 Remote skill drift stays out of the doctor.** Reason: hermeticity; the network
  belongs to `skills update --check`. Reverse: only with a recorded-snapshot oracle
  checked into the tree.
- **K6 Lease owners resolve from the merge-base `.github/CODEOWNERS`.** Today that is
  `* @kriegcloud`, so every lease is bound to the operator. Reason: CODEOWNERS already
  exists, and reading it from the base blocks self-granting. Reverse: a dedicated owner
  registry, if per-path ownership outgrows CODEOWNERS.
- **K7 30-day immutable-issued lease cap, quotas 2 per document and 20 per repo.**
  Reason: bounded, visible debt that cannot be renewed forever. Reverse: tune the numbers
  from PR-4 report data; the mechanism stays.
- **K8 Historical class verifies at the cited commit, with a block-scoped default, and
  only on archival-classified paths.** On a live surface a block or document marker is
  inert and reported (`historical-marker-on-live-surface`), so live spans are always
  verified at HEAD. Reason: a marker is a checked claim, never an exemption, which honors
  C1. Restricting both forms to archival paths closes the route where a block marker
  would move a live span's check to an old commit (review on #1626). Reverse: admit
  block markers on live surfaces only with dual verification (cited commit and HEAD), if
  a real need appears.
- **K9 Unclassified spans are gated only by the Stage-1 introduced-only delta.** Reason:
  non-baselineable per SPEC without making the initial seal impossible. Reverse: make
  them blocking-by-count once the unclassified worklist reaches zero.
- **K10 New kinds extend the existing `KnowledgeFindingKind` additively. The baseline key
  is a separate `knowledge-doctor/v1` digest over durable identity.** Reason: Stage-1
  `findingId` stays comparison-scoped and unchanged. Reverse: bump to
  `knowledge-finding/v2` if older consumers must reject Stage-2 reports.
- **K11 Promotions live in their own append-only file.** Reason: contract 8 forbids any
  non-mint edit to the sealed baseline and `verify-mint` must reproduce it byte for byte;
  a `promotedKinds` field edited by promotion PRs would break the seal (review on #1626).
  Reverse: fold promotions back into the baseline only if the mint App opens promotion PRs
  itself.
- **K12 Promotion rows are admitted narrowly.** A promotion PR changes
  `goals/knowledge-doctor.promotions.jsonc` and nothing else, appends exactly one row
  whose `kind` is not already promoted, and cites C7 window evidence that CI re-checks
  at the merge-base. Any other diff to the promotions file is `baseline-tamper`.
  Reason: without these rules any branch could append a promotion and reopen the
  laundering route the seal closed (review round 3 on #1626). Reverse: relax the
  single-file rule only if promotions start being minted by the CI App.
