# Single public origin beep-effect.com Spec

## Objective

Make `beep-effect.com` the single public origin for everything this repo
projects to developers and agents. The identity authority moves to
`https://beep-effect.com/ns/`, a new foundation package `@beep/public-site`
owns the reserved apex route table, the two drift authorities fold into `$I`,
every retired-host literal is rewritten, and a new law,
`bun run beep laws retired-iri-authorities`, keeps the retired hosts out and
keeps the origin literal inside its two owner packages. Code and doctrine land
in one PR.

## Non-Goals

- Deployment of any surface, Cloudflare configuration, DNS, and CI deploy
  workflows. Each surface gets its own follow-on deployment goal.
- Wiring consumers of `hostedUrl` or `labRoute` (I9). No base-path config
  exists yet; each deployment goal wires its own consumer.
- The practice authority under `oip.law` (I14). It is a separate origin.
- An alias or rebase map for the old root. The 2026-10-20 probe found nothing
  durable persisted under it (D6).
- Unparking `explorations/knowledge-endgame`. Its training-data-flywheel
  reopen trigger now has an origin, but the trigger has not fired.

## Source Hierarchy

1. The operator brief, recorded verbatim in
   [`history/2026-10-20-operator-brief.md`](./history/2026-10-20-operator-brief.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture standards: `standards/ARCHITECTURE.md` core
   principle 8, the 2026-10-20 entry in `standards/architecture/DECISIONS.md`,
   and `standards/architecture/GLOSSARY.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict. The I-rows below
refine the brief where it could not be executed as written or left an
implementation choice open.

## Target Surfaces

- `packages/foundation/modeling/identity` and
  `packages/foundation/capability/semantic-web`: the authority literal and the
  new `$EpistemicId` and `$QaId` root composers.
- `packages/foundation/modeling/public-site`: new package (`PublicOrigin`,
  `SiteRoute`, `hostedUrl`, `labRoute`, drift test).
- Drift folding: `packages/epistemic`, `apps/labs/lejeune-bolt-workbench`,
  `packages/foundation/modeling/skill-contract`, and the QA judge under
  `packages/tooling/tool/cli/src/commands/Qa`.
- Ontology cluster: `packages/foundation/modeling/ontology`,
  `packages/documents`, `packages/foundation/modeling/rdf`,
  `packages/tooling/test-kit`, `packages/law-practice`.
- The law and its lane: `packages/tooling/tool/cli/src/commands/Laws`, root
  `package.json`, `turbo.json`, and the quality lane registrations.
- Residue: every other tracked file that names a retired host, outside
  `**/history/**` and the top-level `research/` tree.
- Doctrine: `standards/architecture/DECISIONS.md`,
  `standards/architecture/GLOSSARY.md`, `standards/ARCHITECTURE.md`,
  `explorations/identity-as-iri/DECISIONS.md`,
  `explorations/knowledge-endgame/README.md`, and this packet.

## Constraints

- Retired hosts are written defanged everywhere except the brief record:
  ns[.]beep[.]sh, beep[.]sh, beep[.]dev, beep-effect[.]dev (I7).
- Code derives IRIs from `@beep/identity` composers and hosted URLs from
  `@beep/public-site`; it never writes the origin as a string literal (D4, I6).
- `@beep/identity` never depends on `@beep/public-site` (D4).
- Hard cut: no alias map, no compatibility shim (D6).
- No changeset files; every affected workspace is private (I8).

## Acceptance Criteria

Copied from the brief's Acceptance section, adjusted where an I-row
supersedes it.

- [ ] `graft grep` for each retired host (ns[.]beep[.]sh, beep[.]sh,
      beep[.]dev, beep-effect[.]dev) returns hits only under `**/history/**`
      and the top-level `research/` tree. Adjusted by I4 (beep[.]sh added) and
      I5 (the brief's `research/**` means the root tree only; nested packet
      `research/` folders are rewritten).
- [ ] `bun run beep laws retired-iri-authorities --check` is green, and a
      seeded violation in a scratch file turns it red. Both rules hold: retired
      hosts (I5) and the origin literal in TS/JS code roots (I6).
- [ ] `@beep/identity` type-level assertions are updated: a composer such as
      `$I.create("x").iri` is literally `https://beep-effect.com/ns/x`, the
      authority is written once as `IdentityAuthority` (I1), and existing `$I`
      call sites compile unchanged.
- [ ] `@beep/public-site` exports `PublicOrigin`, `SiteRoute`, `hostedUrl` and
      `labRoute` (I10), and its drift test proves `hostedUrl("ns") + "/"`
      equals the identity authority at runtime and at the type level.
- [ ] The TaxonomyLoader filter, the Taxonomy seed `SCHEME_IRI`, the
      party-roles, docketing and legal-intake seeds, the `Vitest.errors` IRIs
      and the DocumentAnnotation adapter IRIs are all under the new root, and
      their tests are green.
- [ ] Drift authorities fold into `$I` with the shape-preserving host swap
      (I2); evidence predicate types are `/v2` and the QA judge contract is
      2.0.0 (I3).
- [ ] `bun run beep quality package-verify` is green (via `beep-heavy`) for
      `@beep/identity`, `@beep/public-site`, `@beep/ontology`,
      `@beep/skill-contract`, `@beep/epistemic-*`, `@beep/exiftool` and
      `@beep/repo-cli`.
- [ ] Changesets: superseded by I8. No changeset file is added;
      `bun run beep quality changeset-graph` stays green, and the wire-level
      changes are listed in this Decision Log and in the PR body.
- [ ] Doctrine entries ride the same PR: architecture DECISIONS, GLOSSARY,
      ARCHITECTURE core principle 8, the identity-as-iri supersession entry,
      and the knowledge-endgame trail note.
- [ ] Closeout follows I17: Yeet publish, ready at content-final, merge at the
      gate, then `yeet sweep --retire`. The final PR carries
      `proposedCloseout` and the reflection.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Retired-host law | `bun run beep laws retired-iri-authorities --check` | Passes; a seeded scratch violation fails |
| Retired-host census | `graft grep` per retired host | Hits only under `**/history/**` and root `research/` |
| Package proof | `beep-heavy bun run beep quality package-verify <@beep/package>` for each package above | Passes |
| Changeset graph | `bun run beep quality changeset-graph` | Passes |
| Packet doctor | `bun run beep goals doctor` | No new blocking finding |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |
| Knowledge refs | `bun run beep knowledge refs --check` | Passes |
| Packet launcher size | `test "$(wc -m < goals/public-origin-beep-effect-com/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/public-origin-beep-effect-com/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/public-origin-beep-effect-com` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

### Operator decisions D1 to D6

The operator decided D1 to D6 in a grilling session on 2026-10-20; they are
final and not reopened. The text below is the brief's wording with one change:
each retired host is defanged (ns[.]beep[.]sh, beep[.]dev, beep-effect[.]dev,
beep[.]sh) so this file passes the law it introduces. The undefanged original
is recorded once, in
[`history/2026-10-20-operator-brief.md`](./history/2026-10-20-operator-brief.md).

```text
D1  Identity authority moves. `https://ns[.]beep[.]sh/` is retired (we never
    owned beep[.]sh; it was a placeholder). New root:
    `https://beep-effect.com/ns/`. `@beep/a/b` mints
    `https://beep-effect.com/ns/a/b`; the `beep:` CURIE prefix is unchanged;
    per-vocabulary hash-vs-slash choices are unchanged. Supersede the
    2026-07-02 "authority host (RESOLVED)" entry in
    explorations/identity-as-iri/DECISIONS.md with a new dated entry.

D2  Single public origin, routes not subdomains. Law (architecture-wide,
    goes in standards/architecture/DECISIONS.md and ARCHITECTURE.md):
    the apex `beep-effect.com` hosts ring-0 projections of the public
    substrate only; `/ns/` is reserved forever for identity dereference;
    subdomains are for services and instances that are not projections
    (a practice instance, the proxy, anything authenticated). Rationale:
    llms.txt/robots/sitemap/.well-known are origin-scoped, the knowledge-
    endgame training-data flywheel wants one crawler authority, every listed
    surface is public and unauthenticated so cookie/CSP isolation buys
    nothing, and schema.org/w3.org precedent mints IRIs as apex paths.
    `/ns/` is dereference (exact registry); `/taxonomy` is its HTML
    discovery projection (knowledge-endgame law: dereference and discovery
    stay separate). www redirects to apex (infra, later).

D3  Reserved v1 route table (reserved now, deployed later):
    /ns  /taxonomy  /docs  /api  /storybook  /llms.txt  /mcp
    /labs/<name>  /goals  /explorations  /research
    /.well-known/*  /sitemap.xml
    `/api` = Scalar docs for every HttpApi contract (today apps/labs/api-docs).
    `/labs/<name>` = hosted projection of apps/labs/<name>; <name> is the
    portless name with `.labs.beep.localhost` stripped. Labs keep the segment
    so nothing lab-grade reads as official.

D4  Owner of the hosting map: NEW foundation package `@beep/public-site`
    under packages/foundation/modeling/, created with
    `bun run beep create-package` (never mkdir). It owns:
      - `PublicOrigin` (the literal `https://beep-effect.com`, schema-typed)
      - `SiteRoute` as a `LiteralKit` of the D3 slugs
      - `hostedUrl(route, path?)` returning a typed URL
      - a `labRoute(portlessName)` helper for /labs/<name>
    The identity authority stays a type-level literal in @beep/identity
    (`DefaultIdentityAuthority` in Id.ts; `Identity.make("beep", {authority})`
    in packages.ts; Vocab.ts). @beep/identity must NOT depend on
    @beep/public-site. One test in @beep/public-site asserts
    `hostedUrl("ns") + "/"` equals the identity authority so the two literals
    cannot drift. Hosting is build-time/runtime config as schema, never an
    env read. apps' base-path configs and @beep/repo-configs consume
    @beep/public-site; tooling never becomes the owner because product code
    (MCP output, llms.txt generation) cannot import tooling.

D5  Fold the two drift authorities into `$I`:
      - `https://beep[.]dev/epistemic/...` in
        packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts
        (CLAIM_CLASS_IRI, EVIDENCE_QUOTE_IRI, CLAIM_SUBJECT_PREFIX) plus the
        JSDoc examples in epistemic domain/tables, and
        apps/labs/lejeune-bolt-workbench/src/runtime/Projections.ts
        (LEJEUNE_ONTOLOGY_NAMESPACE)
      - `https://beep-effect[.]dev/skill-contract/evidence/...` in
        packages/foundation/modeling/skill-contract/src/Recovery.ts and
        EvidenceReceipt.ts, and `https://beep[.]dev/evidence/...` examples in
        Gate.ts; the QA judge contract in
        packages/tooling/tool/cli/src/commands/Qa/JudgeContract.ts and
        CitedArtifactExistsGate.ts
    Replace literals with `$EpistemicId.create(...)` /
    `$SkillContractId.create(...)` style derivations from @beep/identity.
    Evidence predicate-type strings are compared by equality in receipts, so
    this is a wire-level change: bump their `/v1` suffix to `/v2` and note it
    in the skill-contract changeset.

D6  Migration posture: hard cut everywhere, one record, one gate.
      - Rewrite every literal of the three retired hosts (ns[.]beep[.]sh,
        beep[.]dev, beep-effect[.]dev) in src, tests, seeds (.ttl/.jsonld),
        docs, explorations, skills, JSDoc examples. Exempt `**/history/**`
        and `research/**` (immutable packet history; goals/semantica-canary/
        history alone holds ~50k generated occurrences).
      - Also rewrite the exiftool XMP namespace
        `BEEP_QA_XMP_NAMESPACE_URI` in
        packages/drivers/exiftool/src/ExiftoolConfig.ts to
        `https://beep-effect.com/ns/qa/1.0/` (readers key on it; same
        change, same changeset).
      - Add `bun run beep laws retired-iri-authorities` modelled on
        packages/tooling/tool/cli/src/commands/Laws/RetiredEffectPaths.model.ts
        and its registration in Laws.command.ts: fails on any literal
        `https://ns[.]beep[.]sh/`, `https://beep[.]dev/`, `https://beep-effect[.]dev/`
        outside the exempt dirs, and on any literal `https://beep-effect.com`
        outside @beep/identity and @beep/public-site (the second rule is what
        keeps future surfaces going through `$I`/`hostedUrl`). Wire it into
        the same quality lane that runs retired-effect-paths.
      - Probe evidence (2026-10-20): nothing durable is persisted under the
        old root; corpus hits are practice-kg sitting transcripts and QA
        logs, XDG hits are regenerable caches. No alias/rebase map.
```

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-20 | D1: the identity authority moves to `https://beep-effect.com/ns/`; CURIE prefix and hash-vs-slash choices unchanged. | Operator brief; the old host was a placeholder never owned. Verbatim above. | `git revert` the PR, then run `bun run beep laws retired-iri-authorities` in report mode to list what would re-flag. |
| 2026-10-20 | D2: single public origin; apex hosts ring-0 projections, `/ns/` reserved for dereference, subdomains for services. | Operator brief. Verbatim above. | Same as D1. |
| 2026-10-20 | D3: reserved v1 route table. | Operator brief. Verbatim above. | Same as D1. |
| 2026-10-20 | D4: `@beep/public-site` owns the hosting map; identity keeps the authority and never depends on it. | Operator brief. Verbatim above. | Same as D1. |
| 2026-10-20 | D5: fold the two drift authorities into `$I`; evidence predicate types bump to `/v2`. | Operator brief. Verbatim above; the changeset clause is superseded by I8. | Same as D1. |
| 2026-10-20 | D6: hard cut everywhere, one record, one gate. | Operator brief. Verbatim above; I5 and I6 make the two law rules precise. | Same as D1. |

### Agent rulings I1 to I20

Orchestrator rulings made while executing the brief. Each is agent-decided
under the AGENTS.md autonomy charter. Unless a row says otherwise, reverse it
with `git revert` of the PR and a re-run of
`bun run beep laws retired-iri-authorities` in report mode.

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-20 | I1: `@beep/identity` exports one runtime literal, `IdentityAuthority`; `DefaultIdentityAuthority` is its type, and `$I` and `SemanticFoundationVocab.beep.iri` reference it. | The authority was written in three places; one source removes drift. It stays a type-level literal, so D4 holds and identity has no public-site dependency. | Inline the literal again at the three sites. |
| 2026-10-20 | I2: shape-preserving host swap. Every retired-host IRI keeps its path and only the host changes to the new root; code derives the value from the composer named by the path's first segment (`$SkillContractId`, `$EpistemicId`, `$QaId`, `$SemanticaId`, or an inline `$I.create(...)` chain). Trailing-slash namespaces use `${composer.iri}/`; fragment IRIs use `${composer.iri}#Term`. | Keeps every vocabulary's shape; only the authority moves. Cross-package vocabularies get a named root composer (precedent `$SemanticFoundationId`); one-off namespaces derive inline. | Default. |
| 2026-10-20 | I3: only evidence predicate types bump `/v1` to `/v2` (skill-contract evidence, QA evidence, QA receipts). Contract ids and schema ids keep `/v1`. `qaJudgeContractVersion` goes to 2.0.0, its pinned digest is recomputed, and the generated `packages/tooling/tool/cli/skills/qa-inventory-judge/SKILL.md` is regenerated with `bun run beep qa judge-skill --write <path>`. | D5: receipts compare predicate types by equality, so the change is wire-level. Contract and schema ids version the schema, not the predicate. | Default; regenerate the judge skill after the revert. |
| 2026-10-20 | I4: the bare beep[.]sh host (the semantica lab base and its SPARQL literals) is a fourth retired host under D1. | The operator never owned beep[.]sh; the same reasoning as D1 applies. | Default. |
| 2026-10-20 | I5: law rule 1 matches every host form of the four retired hosts (with or without scheme, `//host`, bare host before `/`, `@beep[.]dev` emails) with boundaries that reject lookalikes. It scans the working-tree text of every tracked regular file and skips binaries. Exempt: any path with a `history/` segment and the top-level `research/` tree only. The law's own source and tests build patterns from escaped regex sources and seed violations by concatenation. | D6's exemption glob is root-anchored, so nested packet `research/` folders are rewritten. Building patterns from escaped sources keeps the law clean without a self-allowlist. | Default. |
| 2026-10-20 | I6: law rule 2 matches `http(s)://beep-effect.com` and `http(s)://www.beep-effect.com` only inside string and template literal tokens of tracked TS/JS sources under `packages/`, `apps/`, `scripts/`, `tools/` and `infra/`. Excluded: the identity and public-site packages, test code, and an allowlist with reasons (see the Exception Ledger). Subdomains are not matched. | D6 rule 2 exists to push code through `$I` and `hostedUrl`. Data and prose (seeds, JSON fixtures, doctrine, packets, tests) may name the origin; subdomains are services under D2. | Default. |
| 2026-10-20 | I7: one record. The undefanged brief lives only at `history/2026-10-20-operator-brief.md`, with the Cloudflare account id redacted. Every other surface writes retired hosts defanged. The identity-as-iri 2026-07-02 entry is defanged with a superseded pointer and a new entry is appended. | D6 asks for one record; the repo is public; doctrine must pass its own law. | Default. |
| 2026-10-20 | I8: no changesets. The wire-level changes (skill-contract and QA judge predicate types `/v2`, QA judge contract 2.0.0, the exiftool XMP namespace, rdf DocumentAnnotation `@context` literals, epistemic vocabulary IRIs, practice-kg bundle IRIs) are recorded here and in the PR body. | Every affected workspace is `private: true`, and `bun run beep quality changeset-graph` rejects notes naming private workspaces (`.changeset/README.md`). Supersedes the brief's changeset acceptance line and D5's changeset clause. | Add changesets only if a package becomes publish-enabled. |
| 2026-10-20 | I9: no consumer of `hostedUrl` or `labRoute` is wired in this packet. `apps/labs/api-docs` keeps its internal `/apis/<slug>` routes; its deployment goal mounts it under `/api`. | No base-path config exists today; wiring belongs to each per-surface deployment goal. | Not applicable; later goals wire consumers. |
| 2026-10-20 | I10: `@beep/public-site` surface: `PublicOrigin` (a schema literal annotated with `$PublicSiteId`), `SiteRoute` (`LiteralKit` of the D3 slugs), `hostedUrl(route, path?)` with an exact template-literal return type (file routes take no path; `labs` goes through `labRoute`), and `labRoute(portlessName)`, which strips `.labs.beep.localhost` and accepts the full host or the bare label. The drift test compares `hostedUrl("ns") + "/"` with `$I.iri` and `IdentityAuthority`. | Makes D4 concrete and type-checked; identity is a dependency of public-site, never the reverse. | Default. |
| 2026-10-20 | I11: practice-kg bundle IRIs move with the authority and `graphBundleVersion` becomes `2026-10-20-01`, so an installed attorney bundle reads as stale. | A stale bundle under the old root must be visibly stale. If a consumer outside tests pins the old value, the bump is left out and reported. | Restore the previous `graphBundleVersion`. |
| 2026-10-20 | I12: the binding paragraph lands in `standards/ARCHITECTURE.md` as core principle 8. | The file has no identity or config section; the brief named one. | Delete core principle 8. |
| 2026-10-20 | I13: the sibling lane `lint:retired-iri-authorities` sits in the same tier, wave and phase as `lint:retired-effect-paths`; the root script of the same name runs `bun run beep laws retired-iri-authorities --check`. | Lane ids name their command; the brief asked for the retired-effect-paths lane. | Default. |
| 2026-10-20 | I14: out of scope: the `oip.law` practice authority, deployment, Cloudflare config, CI deploy workflows. | The practice authority is a separate origin (a D2 service); the brief excludes deployment. | Not applicable. |
| 2026-10-20 | I15: example IRIs in tests and JSDoc that do not name repository vocabulary move to `https://example.test/...`; Storybook sample URLs and `@beep[.]dev` sample emails move to example.com. Repository vocabulary examples use the new root. | RFC 6761 reserves `.test`; minting fakes under `/ns/` would pollute the reserved namespace. | Default. |
| 2026-10-20 | I16: frozen artifacts (goal data JSONL with source hashes, raw Grok JSONL, training-corpus fixtures) are rewritten. Where code reads a file and verifies a hash over the changed text, the recorded hash is updated in the same change, or the case is reported. | D6 is a hard cut; history and the root research tree are the only exemptions. | Default. |
| 2026-10-20 | I17: closeout follows `goals/README.md` as of #1928. The final PR keeps `initiative.status` at `active` and adds `proposedCloseout` and the reflection; the orchestrator fills `finalPullRequest` and the gating `yeet-verdict` evidence after publish. | It is the current written packet standard and is schema-validated. Supersedes the brief's closeout line where it differs. | Remove `proposedCloseout` and flip status with `bun run beep goals set-status`. |
| 2026-10-21 | I18: QA files stamped under the retired XMP namespace URI are not read back. ExifTool binds the `beepQA` prefix to the new URI through the rendered `-config`, so an old stamp reads under a temporary prefix and its provenance decodes as `None`; the constant's JSDoc says so. | D6 forbids an alias or rebase map, nothing in the repo reads QA provenance back today, and the 2026-10-20 probe found no durable stamps outside `history/` evidence. Raised by the #1946 review (round 1). | Register the retired URI under a second prefix and accept that group in `provenanceFromRawTags`. |

### Closeout recovery on 2026-10-28

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-28 | I19: deliver a fresh evidence closeout PR from current main and bind its final head, readiness verdict and merge receipt. Keep the original #1946 evidence as history and the operative lifecycle active. | `goals completion refresh` returned unsatisfied for #1946: required Effect Diagnostics failed at merge, Lint was unknown, the review window was open, and the declared Yeet verdict was unreadable. The retained receipt is `history/2026-10-28-original-completion-receipt.json`. A merged PR alone does not satisfy the current completion contract. | Revert the closeout PR to restore the #1946 proposal; its failed completion receipt remains historical evidence. |

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-28 | I20: use the AGENTS.md ten-minute publication fallback and hosted CI after cancelling the local publish job. | The cheap-gates step exceeded ten minutes while regenerating the JSDoc inventory. Completed package audits and local gate results remain evidence; unfinished JSDoc regeneration and head-install preflight are disclosed in the PR. | Re-run the local publication preflight after capacity allows. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Origin-literal allowlist (I6) | `packages/tooling/test-kit/test-runner/src/Vitest.errors.ts` | `@beep/test-runner` | The test runner pins IRIs because it must not depend on `@beep/identity`; a parity test in `@beep/identity` guards drift. | The test runner can import identity without a cycle. |
| Retired-host exemption (I5) | `**/history/**` and the top-level `research/` tree | this packet | Immutable packet history and machine-generated research; `goals/semantica-canary/history` alone holds about 50k generated occurrences. | None; standing scope of the law. |
