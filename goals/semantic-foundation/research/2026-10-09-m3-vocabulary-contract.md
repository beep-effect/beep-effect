# M3 version-pinned ready vocabulary contract

Status: ready candidate, 2026-10-09. Package `@beep/ontology` exports
`VocabularyRegistry`, `VocabularyPin`, `VocabularySeed`, `VocabularyConcept`,
`VocabularyError` and the three committed seeds. Exact `load({kind,version})`
and `resolve({kind,version},notation)` fail closed for missing/unknown pins
and absent concepts. No latest alias, I/O, date arithmetic or entity creation.

## Frozen schemes and concept IRIs

All three versions are `1.0.0`. Minting uses `$SemanticFoundationId`.
Every concept IRI is the scheme IRI plus `/concept/<notation>` below.
Deprecate an IRI; never delete it or repoint it. New semantics use a new IRI;
breaking consumer metadata changes require a new explicit version. Consumers
retain both the version pin and resolved IRI as their receipt.

### docketing

Scheme: `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing`

| Notation | Frozen concept IRI |
| --- | --- |
| Deadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/Deadline` |
| DocketingEvent | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/DocketingEvent` |
| StatutoryDueDate | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/StatutoryDueDate` |
| SoftDueDate | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/SoftDueDate` |
| OfficeActionResponseDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/OfficeActionResponseDeadline` |
| MaintenanceFeeDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/MaintenanceFeeDeadline` |
| AnnuityDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/AnnuityDeadline` |
| IDSDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/IDSDeadline` |
| RCEDueDate | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/RCEDueDate` |
| AppealDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/AppealDeadline` |
| ContinuationDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/ContinuationDeadline` |
| NationalStageDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/NationalStageDeadline` |
| StatementOfUseDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/StatementOfUseDeadline` |
| Section8Deadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/Section8Deadline` |
| Section9RenewalDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/Section9RenewalDeadline` |
| Section15DeclarationDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/Section15DeclarationDeadline` |
| TrademarkOfficeActionResponseDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/TrademarkOfficeActionResponseDeadline` |
| OppositionDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/OppositionDeadline` |
| TrademarkRenewalDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/TrademarkRenewalDeadline` |
| TrademarkApplicationDeadline | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/TrademarkApplicationDeadline` |
| DeadlineState | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/DeadlineState` |
| OpenDeadlineState | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/OpenDeadlineState` |
| ExtendedDeadlineState | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/ExtendedDeadlineState` |
| FinalDeadlineState | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/FinalDeadlineState` |
| MissedDeadlineState | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/docketing/concept/MissedDeadlineState` |

### party-kinds

Scheme: `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/party-kinds`

| Notation | Frozen concept IRI |
| --- | --- |
| Party | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/party-kinds/concept/Party` |
| NaturalPersonParty | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/party-kinds/concept/NaturalPersonParty` |
| OrganizationParty | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/party-kinds/concept/OrganizationParty` |
| LawFirm | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/party-kinds/concept/LawFirm` |
| PatentOffice | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/party-kinds/concept/PatentOffice` |
| TrademarkOffice | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/party-kinds/concept/TrademarkOffice` |

### legal-roles

Scheme: `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/legal-roles`

| Notation | Frozen concept IRI |
| --- | --- |
| InventorRole | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/legal-roles/concept/InventorRole` |
| ApplicantRole | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/legal-roles/concept/ApplicantRole` |
| AssigneeRole | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/legal-roles/concept/AssigneeRole` |
| OwnerRole | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/legal-roles/concept/OwnerRole` |
| ExaminerRole | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/legal-roles/concept/ExaminerRole` |
| AttorneyOfRecordRole | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/legal-roles/concept/AttorneyOfRecordRole` |
| CorrespondentRole | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/legal-roles/concept/CorrespondentRole` |
| ClientContactRole | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/legal-roles/concept/ClientContactRole` |
| SignerRole | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/legal-roles/concept/SignerRole` |
| LicenseeRole | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/legal-roles/concept/LicenseeRole` |
| LicensorRole | `https://ns.beep.sh/ontology/semantic-foundation/vocabulary/legal-roles/concept/LicensorRole` |

## Identity, role assignment and authority boundary

Party holders persist independently of role changes. The party-kind scheme
names holder categories; institutional labels describe function and do not
assert rigid essences. Legal roles are contextual participation descriptors,
can overlap, and never become broader/narrower party-kind concepts. Historical
inventorship or a signature remains attributable after an operational role
record ends. No finite end time is invented for a continuing attribution.

A future assignment contract records holder party IRI, matter or asset scope,
evidence, start/end applicability and authority event. It can represent
`prov:qualifiedAssociation` with `prov:hadRole`, `prov:startedAtTime` and
`prov:endedAtTime`; a missing end is unknown or continuing, not automatically
terminated. This is prose only. No role-assignment record or RDF constant is
added. Existing law-practice `legal_client`/`legal_contact` associations remain
unchanged and do not replace holder identity.

Targets, observed events and evidence-backed statuses remain distinct. Status
labels may overlap. Open includes elective targets; Section 15 is elective.
Jurisdiction, procedure, issued action and source edition remain consumer
inputs. Public source notes cite contextual rules; repository planning/status,
institutional and contact definitions are explicitly repository-owned and do
not claim the cited patent source defines all trademark or agreement contexts.
No null/absent observation becomes an open, missed, role or identity assertion.

No external exactMatch/closeMatch metadata is admitted: no VETTED M3 row
establishes FOLIO/LKIF/FOAF/ORG correspondences. Labels create no mapping.
The audit, adversarial review and blinded category review are retained beside
this contract; all six requested corrections were incorporated before freeze.

## Consumer ownership and spawn seed

A future `trademark-docketing-domain` owns TrademarkAsset, docketing entities,
observations and role-assignment records. M4 SHACL and semantic-web contracts
remain excluded. The read-only bootstrap plan below is retained; no packet
was created.

```json
{
  "compilerVersion": "goal-materialization-compiler/v1",
  "conflicts": [],
  "entries": [
    {
      "action": "create",
      "ownership": "generated",
      "path": "goals/trademark-docketing-domain/ops/manifest.json",
      "payload": "{\n  \"schemaVersion\": \"initiative-manifest/v2\",\n  \"initiative\": {\n    \"id\": \"trademark-docketing-domain\",\n    \"packetId\": \"goal-packet/v1:ac7d70fcc4617616ab5d278592f686801e11b038af19122cd0c39511f0ba2238\",\n    \"title\": \"Trademark Docketing Domain\",\n    \"status\": \"active\",\n    \"created\": \"2026-10-10\",\n    \"updated\": \"2026-10-10\",\n    \"packetAnchorDocument\": \"SPEC.md\"\n  },\n  \"packetPath\": \"goals/trademark-docketing-domain\",\n  \"lifecycle\": \"active\",\n  \"mission\": \"Model trademark assets, docket targets and evidence-backed role assignments using pinned semantic-foundation vocabulary contracts.\",\n  \"executionCapable\": true,\n  \"reflectionRequired\": true,\n  \"completionGate\": {\n    \"operator\": \"yeet\",\n    \"requiresPullRequest\": true,\n    \"requiresMergeable\": true,\n    \"statement\": \"Not achieved until this goal's work ships as a PR driven to mergeable via /yeet (bun run beep yeet: repair -> verify -> publish --pr -> monitor).\",\n    \"grandfathered\": false\n  },\n  \"currentSourceOfTruth\": [\n    \"AGENTS.md\",\n    \"CLAUDE.md\",\n    \"goals/trademark-docketing-domain/README.md\",\n    \"goals/trademark-docketing-domain/SPEC.md\",\n    \"goals/trademark-docketing-domain/PLAN.md\",\n    \"goals/trademark-docketing-domain/GOAL.md\",\n    \"goals/trademark-docketing-domain/research/SOURCES.md\"\n  ],\n  \"researchReports\": [\n    \"research/SOURCES.md\"\n  ],\n  \"agentLaunchers\": [\n    {\n      \"kind\": \"codex-goal\",\n      \"path\": \"GOAL.md\",\n      \"targetChars\": 3500,\n      \"maxChars\": 4000,\n      \"command\": \"/goal follow the instructions in goals/trademark-docketing-domain/GOAL.md\"\n    }\n  ],\n  \"provides\": [],\n  \"requires\": [],\n  \"phases\": [\n    {\n      \"id\": \"P0\",\n      \"name\": \"Research\",\n      \"status\": \"pending\"\n    },\n    {\n      \"id\": \"P1\",\n      \"name\": \"Implement\",\n      \"status\": \"pending\"\n    },\n    {\n      \"id\": \"P2\",\n      \"name\": \"Verify\",\n      \"status\": \"pending\"\n    },\n    {\n      \"id\": \"P3\",\n      \"name\": \"Yeet: PR to mergeable\",\n      \"status\": \"pending\"\n    },\n    {\n      \"id\": \"P4\",\n      \"name\": \"Close\",\n      \"status\": \"pending\"\n    }\n  ],\n  \"verificationCommands\": [\n    \"test \\\"$(wc -m < goals/trademark-docketing-domain/GOAL.md)\\\" -le 4000\",\n    \"jq . goals/trademark-docketing-domain/ops/manifest.json\",\n    \"rg -n \\\"trademark-docketing-domain|GOAL.md|agentLaunchers|packetAnchorDocument\\\" goals/trademark-docketing-domain\",\n    \"git diff --check -- goals/trademark-docketing-domain\",\n    \"bun run beep lint reflection-artifacts\"\n  ],\n  \"stopConditions\": [\n    \"Required source files are missing or materially contradictory.\",\n    \"Any spend: purchases, paid services, quota top-ups or plan changes need the operator.\",\n    \"The same blocker repeats after reasonable investigation.\"\n  ]\n}\n",
      "payloadDigest": "d8786a58673166592c77cc1dd7376c84480216d99ce54bfbefa09f68fa19daea",
      "reason": "Every byte derives from the input and the archetype."
    },
    {
      "action": "create",
      "ownership": "generated-seed",
      "path": "goals/trademark-docketing-domain/README.md",
      "payload": "# Trademark Docketing Domain\n\n## Status\n\nLifecycle: `active`\n\nSource: [`ops/manifest.json`](./ops/manifest.json)\n\n## Mission\n\nModel trademark assets, docket targets and evidence-backed role assignments using pinned semantic-foundation vocabulary contracts.\n\n## Launch\n\nUse this command for execution-capable sessions:\n\n```text\n/goal follow the instructions in goals/trademark-docketing-domain/GOAL.md\n```\n\n`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.\n\n## Read This First\n\n1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.\n2. [`SPEC.md`](./SPEC.md) - normative source of truth.\n3. [`PLAN.md`](./PLAN.md) - active execution plan.\n4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.\n5. [`research/`](./research/) - supporting research, if present.\n6. [`history/`](./history/) - evidence and closeouts, if present.\n\n## Current Phase\n\nP0 Research — not started.\n\n## Latest Evidence\n\nNot started.\n\n## Notes\n\n<Record high-signal constraints or resume notes that do not belong in the\nnormative spec.>\n",
      "payloadDigest": "dbc4a0cbc273ca45f6a144282099a0c0117e5225e54b54756a5c67231384699c",
      "reason": "Written once from input; human-owned immediately after."
    },
    {
      "action": "create",
      "ownership": "generated-seed",
      "path": "goals/trademark-docketing-domain/GOAL.md",
      "payload": "# GOAL: Trademark Docketing Domain\n\nRepo root: the current working directory — the `beep-effect` checkout you are\nrunning in. Do not assume an absolute path; several checkouts exist. All paths\nbelow are repo-relative.\n\nOutcome: Model trademark assets, docket targets and evidence-backed role assignments using pinned semantic-foundation vocabulary contracts.\n\nThis is a compact `/goal` launcher. Treat the packet files as the detailed\ncontract:\n\n- `goals/trademark-docketing-domain/README.md`\n- `goals/trademark-docketing-domain/SPEC.md`\n- `goals/trademark-docketing-domain/PLAN.md`\n- `goals/trademark-docketing-domain/ops/manifest.json`\n\nRead those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing\nstandards named by `SPEC.md`. Higher-priority repo standards outrank packet\nprose when they conflict.\n\nScope:\n\n- In: <paths, packages, docs, workflows, or artifacts this goal may change>.\n- Out: <non-goals and areas not to touch>.\n\nWorkflow:\n\n1. Inspect referenced files and current repo state.\n2. Make the smallest change that satisfies `SPEC.md`.\n3. Preserve unrelated user/worktree changes.\n4. Keep decisions tied to evidence from files, tests, docs, or command output.\n5. Update packet evidence/status if the implementation changes readiness.\n6. At the Close phase, write a closeout reflection to\n   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;\n   `bun run beep lint reflection-artifacts` must pass.\n\nAcceptance:\n\n- [ ] `SPEC.md` acceptance criteria are satisfied.\n- [ ] Required verification commands pass, or unrelated failures are reproduced\n      and recorded separately.\n- [ ] No unrelated refactors or formatting churn.\n\nVerification:\n\n```sh\ntest \"$(wc -m < goals/trademark-docketing-domain/GOAL.md)\" -le 4000\njq . goals/trademark-docketing-domain/ops/manifest.json\ngit diff --check -- goals/trademark-docketing-domain\n```\n\nDecide changes to public API, schema, data migration, auth, infra, security\nbehavior, dependencies, lockfiles, generated files, or destructive state\nyourself when the goal needs them: record each in SPEC.md's Decision Log with\nits reason and how to reverse it, then continue. Land the reversal path for an\nirreversible change (a tested down-migration, a backup of deleted state) before\nthe change merges, and ship a breaking public API or schema change with a major\nchangeset. Escalate only what AGENTS.md \"Autonomy\" lists.\n\nDone only when the goal reaches `completed-retained` (acceptance passes,\nverification is complete, closeout and reflection landed), or when a blocker\nthat needs the operator is reported with file/command evidence.\n",
      "payloadDigest": "b570f8c7fa5a69e417e8a984ef55228069e76feba8733f7cb7a878994e149b07",
      "reason": "Written once from mission and scope inputs; human-owned immediately after."
    },
    {
      "action": "create",
      "ownership": "generated-seed",
      "path": "goals/trademark-docketing-domain/SPEC.md",
      "payload": "# Trademark Docketing Domain Spec\n\n## Objective\n\nModel trademark assets, docket targets and evidence-backed role assignments using pinned semantic-foundation vocabulary contracts.\n\n## Non-Goals\n\n- <Out-of-scope behavior, package, workflow, migration, or policy.>\n\n## Source Hierarchy\n\n1. User objective or issue that created this packet.\n2. `AGENTS.md`, `CLAUDE.md`, and required skills.\n3. Governing architecture/package standards.\n4. This `SPEC.md`.\n5. `PLAN.md`.\n6. `GOAL.md`.\n7. Supporting `research/`, `ops/`, and `history/` files.\n\nHigher sources outrank lower sources when they conflict.\n\n## Target Surfaces\n\n- <Package, app, docs, workflow, or artifact this goal may change.>\n\n## Constraints\n\n- <Hard requirement, boundary rule, compatibility concern, or quality bar.>\n\n## Acceptance Criteria\n\n- [ ] <Observable result that proves the goal is complete.>\n- [ ] No unrelated refactors or formatting churn.\n\n## Verification Matrix\n\n| Check | Command or evidence | Required result |\n| --- | --- | --- |\n| Packet launcher size | `test \"$(wc -m < goals/trademark-docketing-domain/GOAL.md)\" -le 4000` | Passes |\n| Manifest JSON | `jq . goals/trademark-docketing-domain/ops/manifest.json` | Passes |\n| Whitespace | `git diff --check -- goals/trademark-docketing-domain` | Passes |\n\n## Stop Conditions\n\n- Required source files are missing or materially contradictory.\n- Any spend: purchases, paid services, quota top-ups or plan changes need the\n  operator.\n- The same blocker repeats after reasonable investigation.\n\nScope growth, destructive side effects and policy calls are not stops: decide\nthem and record each in the Decision Log.\n\n## Decision Log\n\n| Date | Decision | Reason | How to reverse |\n| --- | --- | --- | --- |\n| None | N/A | N/A | N/A |\n\n## Exception Ledger\n\n| Exception | Scope | Owner | Rationale | Removal condition |\n| --- | --- | --- | --- | --- |\n| None | N/A | N/A | N/A | N/A |\n",
      "payloadDigest": "78eaafddf21a0fbe48189d40849c8eb0541d50c8675389b07e85071376616026",
      "reason": "Written once from input; human-owned immediately after."
    },
    {
      "action": "create",
      "ownership": "generated-seed",
      "path": "goals/trademark-docketing-domain/PLAN.md",
      "payload": "# Trademark Docketing Domain Plan\n\n## Status\n\nStatus: `pending`\n\n## Phases\n\n| Phase | Status | Goal | Exit criteria |\n| --- | --- | --- | --- |\n| P0 Research | pending | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |\n| P1 Implement | pending | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |\n| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |\n| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |\n| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |\n\n## Closeout Checklist\n\nBefore marking the packet closed:\n\n1. Write a closeout reflection via the `/reflect` skill to\n   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must\n   validate against `ReflectionFrontmatter`.\n2. Run `bun run beep lint reflection-artifacts`.\n3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase\n   statuses + `initiative.status`.\n\n## Execution Notes\n\n- Preserve unrelated worktree changes.\n- Keep `SPEC.md` normative and update it only when the contract changes.\n- Keep this plan current; archive old run outputs under `history/`.\n\n## Verification Commands\n\n```sh\ntest \"$(wc -m < goals/trademark-docketing-domain/GOAL.md)\" -le 4000\njq . goals/trademark-docketing-domain/ops/manifest.json\nrg -n \"trademark-docketing-domain|GOAL.md|agentLaunchers|packetAnchorDocument\" goals/trademark-docketing-domain\ngit diff --check -- goals/trademark-docketing-domain\n```\n",
      "payloadDigest": "53f1120f635ffeebd45783acd9dd1992ece9492f0287f82158b9507fd81ab5dd",
      "reason": "Written once from the archetype phase table; human-owned immediately after."
    },
    {
      "action": "create",
      "ownership": "generated-seed",
      "path": "goals/trademark-docketing-domain/research/SOURCES.md",
      "payload": "# Trademark Docketing Domain — Sources & Provenance\n\n- **Source exploration:** none — this goal was authored directly; build the\n  corpus during the first research phase.\n\n## 1. Mined source corpus\n\n| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |\n|--------|-------|-----------------|------------------------|-------|-------------|\n\n## 2. Upstream repositories & licenses\n\n| Repo | License | Port discipline | What we take |\n|------|---------|-----------------|--------------|\n\n## 3. External research sources\n\n## 4. In-repo capability references\n\n## 5. Cross-links & provenance\n",
      "payloadDigest": "4d046a26b55e6cf4ac328ef1979e78b7e245f2c1e5b2038c4f6bbdc2092014fe",
      "reason": "Written once from provenance inputs; human-owned immediately after."
    },
    {
      "action": "create",
      "ownership": "generated",
      "path": "goals/trademark-docketing-domain/research/.gitkeep",
      "payload": "\n",
      "payloadDigest": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
      "reason": "Directory marker."
    },
    {
      "action": "create",
      "ownership": "generated",
      "path": "goals/trademark-docketing-domain/history/.gitkeep",
      "payload": "\n",
      "payloadDigest": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
      "reason": "Directory marker."
    },
    {
      "action": "create",
      "ownership": "generated",
      "path": "goals/trademark-docketing-domain/history/reflections/.gitkeep",
      "payload": "",
      "payloadDigest": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "reason": "Directory marker."
    },
    {
      "action": "report",
      "ownership": "generated",
      "path": "goals/INDEX.md",
      "reason": "Disposable projection owned by producer://goals/index; regenerate with `bun run beep goals index --write` after publish."
    }
  ],
  "mode": "bootstrap",
  "packetPath": "goals/trademark-docketing-domain",
  "planId": "goal-plan/v1:f8d52a88acdd043d24bbe40b9137571e65bed66090784b61ca9641da5500c020",
  "preservations": [],
  "schemaVersion": "goal-materialization-plan/v1",
  "slug": "trademark-docketing-domain",
  "validations": [
    "manifest-decodes",
    "doctor-clean",
    "index-regenerates",
    "readme-lifecycle-line",
    "goal-md-within-budget"
  ]
}

```
