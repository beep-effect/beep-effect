# Practice Box Onboarding Spec

## Objective

Move the solo practice onto Box so the attorney can file and retrieve his
work there: inventory his current matter files, map them into the provisioned
client/matter tree, migrate them with `@beep/box` through a resumable,
dry-run-first, content-hash-deduped engine that leaves every source untouched,
and hand him Box Drive on his PC plus a one-page guide.

This is workstream C of the solo-practice bridge (operator-ratified
2026-10-06). The other workstreams own the docket intake service, email matter
tagging and attachment auto-filing, and practice-KG completion.

## Non-Goals

- No email attachment auto-filing: the sibling email-tagging workstream owns
  it and consumes this tree.
- No vault mirror: `goals/legal-document-intake` builds the local-vault to
  Box mirror later; this goal uploads once.
- No metadata templates or retention policies: both stay
  `BlockedByEntitlement` on the Business plan. Folder conventions carry the
  taxonomy.
- No mail archives: PST files and mail exports belong to
  `goals/practice-mail-backfill`.
- No deletes, overwrites, or new file versions in Box, and no writes of any
  kind to a migration source.
- No plan upgrade, storage purchase, or paid external collaborator. Anything
  that costs money goes to the orchestrator as a money question.
- No client names, matter names, file names, or document content in this
  repository. The map, the plan, the journal, and the spot-check list are
  private operator artifacts.

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

- `packages/drivers/box-provisioning` — the content-migration schemas,
  service, journal, and tests.
- `docs/runbooks/practice-box-drive-windows.md`,
  `docs/runbooks/practice-box-how-to.md`,
  `docs/runbooks/practice-box-content-migration.md`.
- This packet.
- The live Box tenant, through the reviewed-plan apply paths only.
- Private, out-of-repo operator artifacts under the corpus home's
  `ops/box-onboarding/` directory.

## Constraints

- **Design order**: schema, then `Context.Service` contract, then
  implementation.
- **Dry-run is real**: planning hashes every source, lists the destination
  folders that exist, classifies every file, and performs no provider
  mutation. Apply consumes a reviewed plan digest and fails closed on drift.
- **Never overwrite**: a destination name that already holds different
  content is a blocker, not an overwrite and not a new version.
- **Resumable by idempotence**: after any partial run, a fresh plan
  classifies uploaded files as identical and created folders as existing.
- **Content-hash dedupe**: the map carries one entry per distinct SHA-256;
  Box-side identity is the file's SHA-1.
- **API allowance**: the tenant has a monthly API allowance. Every run takes
  a hard provider-call budget and stops cleanly when it is spent.
- **Windows-safe names**: destination names must sync through Box Drive on
  Windows.
- **Confidentiality**: tracked files carry counts, sizes, digests, and typed
  outcomes only.

## Decision Log

Decided under the operator autonomy charter (only money escalates). Private
specifics stay out of this file.

| # | Date | Decision | Why |
| --- | --- | --- | --- |
| D1 | 2026-10-05 | The migration source is the corpus home's deduplicated `organized/` projection (dockets, client files, unsorted), not `raw/` or `staging/`. | It is already one file per distinct SHA-256 with restored names; `raw/` is the same bytes plus 35 GB of duplicates. |
| D2 | 2026-10-06 | A matter is the practice KG's `family_key` (client number plus docket family), resolved through the matter-lookup contract. Foreign and PCT members go to `08 Foreign and PCT/<docket>`; US members share the matter's typed folders. Supersedes the 2026-10-05 choice of the bare family number. | Bare family numbers are reused across clients (170 matters over 105 bare families); keying on the bare number would merge different clients' files. One folder per application would create thousands of mostly empty folders. |
| D3 | 2026-10-05 | Every matter gets the full 19-folder template, including empty folders. | "Where things go" must be the same for every matter, and the auto-filer needs fixed destinations. Folder creation is a one-time cost of about 2,000 API calls. |
| D4 | 2026-10-06 | Matter folders are named `<family_key> <invention title>` when a public USPTO title resolves, else the bare `family_key`. Client folders are named `Client <client number>` until the attorney or the KG supplies the name. | Docket numbers are how the attorney already finds work, and the client number is the leading part of his own docket numbers. Renames are cheap later. |
| D5 | 2026-10-06 | Only matters the KG attributes to a client number, with a status other than `recycled-unverified`, are filed. Docket files whose matter is unattributed, recycled, or ambiguous wait under the holding folder's `Dockets To Be Confirmed/<family>/<docket>` and go on the attorney's spot-check list. Supersedes the 2026-10-05 proposal of client names from USPTO applicants. | The matter-lookup contract: never guess. USPTO first-applicant names an organization for a quarter of the families and is not the client of record. |
| D6 | 2026-10-05 | Type folders come from deterministic file-name rules. A file no rule matches lands loose in the matter folder, which the how-to defines as "not sorted yet". | No guessing: a visible unsorted file beats a confidently wrong folder. |
| D7 | 2026-10-06 | An unsorted file is attributed to a matter only when its extracted text carries a full docket reference that resolves to one `family_key`, or bare docket numbers that all belong to a single `family_key`. | Zero, several, or unknown matters means no attribution. Files already uploaded to the holding folder by the first run stay there rather than being placed twice. |
| D8 | 2026-10-05 | Files with no matter go to a new top-level `03 Historical Files To Be Filed` folder that preserves the old drive's layout. | Box searches inside Word and PDF files, so they stay retrievable; inventing matters for them would not be honest. |
| D9 | 2026-10-05 | System files, pipeline byproducts, mail exports, mail archives, and recycle-bin metadata are excluded. | They are not the attorney's work product, or another packet owns them. |
| D10 | 2026-10-05 | The engine lives in `@beep/box-provisioning` as sibling modules, not a new package. | It shares the folder-name rule, digest helpers, tenant guard, and artifact-privacy contract; a new package would duplicate them. |
| D11 | 2026-10-05 | The reconciler owns the skeleton down to client folders and the collaborations; the migration engine owns matter subtrees and files. Engine-created folders appear to the reconciler as foreign resources. | The reconciler's ratified scope is the tree and who can see it. Adoption entries can be generated from the migration journal if the reconciler ever needs to manage matters. |
| D12 | 2026-10-05 | The attorney's collaborations on the new client folders and the holding folder are applied after the upload is verified, not before. | He should not be shown a half-filled tree, and each collaboration can send him an email. |
| D13 | 2026-10-05 | The client and holding folders were applied without an operator-attended session. | The provisioning packet's attended-apply rule protected the first live apply. This plan was eight empty folders, zero destructive actions, zero external collaborators, and zero cost. |
| D14 | 2026-10-05 | OneDrive and SharePoint are not inventoried from the workstation in this pass; the PC checklist carries a read-only local and OneDrive inventory instead. | `@beep/m365` is delegated-only with no cached sign-in on the workstation, and the app-only registration awaits the operator's Entra admin consent. It is reported as a blocker; the engine takes any local source root once those files can be read. |
| D16 | 2026-10-06 | The seven client folders created on 2026-10-05 from the superseded D5 (six applicant names and `Client To Be Confirmed`) stay in the tree, empty and visible only to the service identity. | The reconciler has no rename or delete, and the engine never deletes. They receive no collaboration, so the attorney never sees them; removing them is a follow-up for a reconciler that can prune. |
| D17 | 2026-10-06 | The PC-side work is a single ordered checklist for a Claude Code session on the attorney's PC, with person-only steps marked, kept with the orchestrator's briefs. | Operator instruction of 2026-10-06: do not wait on his workstation; a session on the PC executes the steps. |
| D18 | 2026-10-06 | The attorney's 29 collaborations were created with one driver call each and recorded in the private intent, not applied through the reconciler. | After the migration the reconciler's inventory costs about 6,000 provider calls per pass and a dry-run plus apply needs about five passes. Thirty thousand calls for 29 collaborations is an avoidable draw on the monthly API allowance. The script refuses to run unless the collaboration is declared internal. |
| D15 | 2026-10-05 | Sharing with clients is by shared link and File Request from `90 Client Exchange`, never by inviting the client as a collaborator. | External collaborators are billable on the Business plan. |

## Acceptance Criteria

- [x] A private inventory lists every candidate file with path, size, and
      SHA-256, and a private migration map assigns each mapped file a
      destination in the client/matter tree; the sanitized counts are
      recorded in `history/`.
- [x] `@beep/box-provisioning` ships the content-migration engine with tests
      for determinism, drift rejection, never-overwrite, resumability, the
      provider-call budget, and artifact privacy.
- [x] A live dry-run plan and a live apply are recorded in `history/` as
      sanitized counts, with a post-apply plan that is all existing folders
      and identical files, and sources verified unchanged.
- [ ] The Box Drive install runbook and the one-page how-to are in
      `docs/runbooks/`, and the physical install is on the operator desk.
- [x] A private spot-check list exists for the attorney and is routed through
      the orchestrator.
- [x] `bun run beep quality package-verify @beep/box-provisioning` passes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/practice-box-onboarding/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/practice-box-onboarding/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/practice-box-onboarding` | Passes |
| Package handoff | `bun run beep quality package-verify @beep/box-provisioning` | Passes |
| Live proof | sanitized dry-run, apply, and post-apply counts in `history/` | Recorded |

## Stop Conditions

- Anything that would cost money: a plan upgrade, storage, a billable
  external collaborator, or API overage.
- A post-upload SHA-1 mismatch that repeats for the same file.
- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
