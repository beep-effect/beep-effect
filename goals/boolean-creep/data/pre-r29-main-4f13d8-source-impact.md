# Pre-R29 moving-main source and design refresh

This is a bounded native P2 impact refresh on merged HEAD
`f03850b762e41217b5a0c26f26041daee490a070`, whose source tree matches main
`4f13d83e13d61275a57004050ffc62a90d86c014`. It follows the completed R28 census
on HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7` / main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. The intermediate incoming main was
`3bb59f37c02b7d677c6a5b58651fe85bb4bb5943`.

This refresh does not amend the frozen R28 verdict, reports, receipts, historical
inventory or dry-round accounting. It prepares the current packet for the next
exact-source census. It grants no independent P3 approval, implementation or
product-test acceptance. The public preparation receipt records preparation;
actual installation must have its own execution receipt.

## Public evidence and exact originals

All paths in this document are relative to `goals/boolean-creep/`, except source
paths beginning `packages/`, `apps/` or `.repos/`, which are repository-relative.
The complete original inventory is archived at
`history/inventory/2026-09-09-pre-r29-main-4f13d8.jsonl`; all 17 original affected
designs are archived under `history/designs/2026-09-09-pre-r29-main-4f13d8/`.
Each original row and design has an exact SHA-256 in
`data/pre-r29-main-4f13d8-row-design-map.json`, alongside its replacement hash
and public destination. Current designs live under `designs/<id>.md` and the
resulting inventory under `data/inventory.jsonl`.

`data/pre-r29-main-4f13d8-source-bindings.json` records source/test paths and
hashes at the relevant immutable refs, plus merged-source/working-byte equality.
Those bytes are retrievable from repository history with
`git show <recorded-ref>:<recorded-source-path>`; no private source snapshot is
needed. Source hashes establish provenance, not a fresh semantic review of every
transitive dependency. The scoped native conclusions are recorded below and in
the complete current designs. Local Effect reference hashes are separate API
proof and are not additional census source.

## Inventory actions

The inventory remains **674 records / 139 qualified**. There are 34 same-owner
replacements, one excluded-parameter withdrawal, one distinct D1 addition, seven
exact audited retentions and 17 complete design revisions. All 639 unchanged
existing rows retain their exact original line bytes.

| ID | Audit | Action | Design revised |
| --- | --- | --- | --- |
| `codex-findings-packet-commit-kind` | non-Worktree | replace | yes |
| `codex-findings-write-request-options` | non-Worktree | add | no |
| `contained-file-read-outcome` | non-Worktree | replace | yes |
| `coverage-baseline-write-mode` | package-script existing owners | replace | no |
| `create-package-retired-name-reconciliation` | package-script existing owners | replace | yes |
| `create-package-scaffold-shape` | package-script existing owners | replace | yes |
| `create-package-template-type-flags` | package-script existing owners | replace | yes |
| `delete-package-handler-options` | package-script existing owners | replace | no |
| `quality-test-lane-selection` | package-script existing owners | retain-exact | no |
| `r25-cli-commands-a-c-findings-refresh-remove-options` | non-Worktree | replace | no |
| `r25-cli-commands-a-c-findings-write-remove-options` | non-Worktree | replace | no |
| `r25-cli-commands-l-q-coverage-replace-all-scoped` | package-script existing owners | replace | no |
| `r25-cli-commands-r-z-fleet-checkout-detached-branch` | Worktree | replace | no |
| `r25-cli-commands-r-z-porcelain-accumulator-detached-branch` | Worktree | replace | no |
| `r25-cli-commands-r-z-worktree-doctor-entry-detached-branch` | Worktree | replace | no |
| `r25-cli-commands-r-z-worktree-list-entry-detached-branch` | Worktree | replace | no |
| `r25-cli-yeet-pr-session-recording-result` | non-Worktree | retain-exact | no |
| `r26-cli-commands-a-c-cleanup-refresh-staging-exists` | non-Worktree | retain-exact | no |
| `r26-cli-commands-a-c-create-package-execute-mutation-flags` | package-script existing owners | replace | no |
| `r26-cli-commands-a-c-findings-cleanup-refresh-remove-options` | non-Worktree | replace | no |
| `r27-cli-commands-a-c-ecosystem-package-json-flags` | package-script existing owners | replace | no |
| `r27-cli-commands-l-q-effect-tsgo-readme-parser` | non-Worktree | retain-exact | no |
| `r27-cli-commands-l-q-github-check-lane-proof-reuse` | package-script existing owners | retain-exact | yes |
| `r27-cli-commands-l-q-tsgo-smoke-compiler-options` | non-Worktree | retain-exact | no |
| `r28-cli-commands-r-z-checkout-entry-facts-detached-branch` | Worktree | replace | no |
| `r28-cli-commands-r-z-run-git-probe-spawn-options` | Worktree | retain-exact | no |
| `r28-cli-quality-coverage-resolved-operation` | package-script existing owners | replace | yes |
| `r28-cli-quality-test-lane-resolved-selection` | package-script existing owners | replace | yes |
| `r3-tooling-codex-write-packet-options` | non-Worktree | withdraw | no |
| `r3-tooling-fleet-liveness-negative-probes` | Worktree | replace | no |
| `r3-tooling-lint-tagged-union-pattern-gates` | package-script existing owners | replace | no |
| `worktree-branch-diff-reading` | Worktree | replace | yes |
| `worktree-doctor-entry-facts` | Worktree | replace | no |
| `worktree-fleet-epoch-target` | Worktree | replace | yes |
| `worktree-idle-reading` | Worktree | replace | yes |
| `worktree-list-entry-porcelain` | Worktree | replace | no |
| `worktree-policy-reading` | Worktree | replace | yes |
| `worktree-porcelain-accumulator` | Worktree | replace | no |
| `worktree-pr-classification` | Worktree | replace | yes |
| `worktree-process-cwd-reading` | Worktree | replace | yes |
| `worktree-reap-candidate-retirement` | Worktree | replace | yes |
| `worktree-removal-mode` | Worktree | replace | yes |
| `worktree-residue-reason-flags` | Worktree | replace | no |

The Tmpfs discovered/classified/skip owner also receives a consumer-only design
revision; its inventory row is unchanged and outside these 43 row actions.


The existing callable-parameter ID is archived, and the actual request object's
new ID is independently named. All surviving qualified statuses, cardinalities,
member sets, exposure, target taxonomies and landing tiers are preserved.
Unrelated inventory lines remain byte-identical. The exact transaction manifest
binds original and proposed inventory hashes, source refs, all affected rows,
all 17 designs and the seven explicitly retained audited rows.

## Worktree: preserve strengthened boundaries and original state relations

Five Worktree source files changed: Fleet.service, Reap.service,
Worktree.command, Worktree.schemas and Worktree.service. Their19 current rows
include the transitive WorktreeReapCandidate owner in unchanged Reap.schemas.
All 8 Q and 11 D classifications remain. The 18 replacements update locators,
owner-specific evidence and one synthetic enclosing-symbol suffix; the
runGitProbe options D1 row is retained exactly.

The actual sibling locals transcriptNegative/worktreeNegative remain independent
observations inside classifyFleetLiveness. There is no negativeProbes object.
The residue classifier's actual constructed dirty/unpushed object still supports
all four pairs. Doctor's independent observed facts remain D1. Porcelain-token,
detached/branch and unavailable-enumeration mirrors remain D2, including their
full nullable strings and Boolean values. Stronger input framing does not make
these Git-owned mirrors new domain-state migrations.

The eight qualified relations remain removal mode 4/3, epoch target 4/3, process
cwd 4/3, idle reading 4/2, PR classification 64/5, branch diff 4/2, policy reading 30/3
and candidate retirement 32/17. These use full Option/literal domains. Required
path arrays, their emptiness, and required number magnitude are payloads rather
than invented Boolean members. Exact unchanged owner spans are recorded in the
public source bindings; the source/design maps identify changed surroundings.

Worktree.schemas now accepts managed paths only when nonempty and control-free,
and removal names only when one trimmed component excluding dot/dotdot,
separators and control characters. parseWorktreePorcelain is an Effect consuming
NUL-delimited output: empty succeeds, nonempty non-NUL input fails, and unsafe
path blocks are filtered before construction. Preserve attribute latching and
listing order; this is not a claim that every malformed token sequence fails.
All four production list paths include -z and await parsing. Command/reaper
parsing maps to typed command errors, service parsing maps to registration
refusal, and Fleet parsing retains an unlisted clone with a warning.

The unlisted clone uses existing all-null entry facts, head-unknown precedence
and degraded coverage. It bypasses private branch/policy readers; it adds no
fourth policy-reader case and must not be mistaken for probe-failed. The new
fleet fixture keeps a materialized epoch target while one clone is degraded.

Removal-mode's former instruction to delete validateRemovalRequest is replaced.
Only the archive/deleteBranch implication guard moves to the raw command
adapter. The function retains managed-name/path equality, registration,
canonical-path and common-Git-directory checks, required services and all three
calls at Worktree.service.ts:880,1030,1089. Preserve command context/NUL parsing,
invalid name, missing target, unregistered target, raw flag conflict and service
safety-error precedence. Revalidate the original registered request immediately
before destructive work; do not validate the renamed fenced copy against the
original managed-name equality.

Preserve sanitized archive destinations, containment refusal, expected HEAD,
compare-and-swap, dirty-submodule checks, fence/rollback, quiescence before and
after capture, prune and deletion order. New security failures flow through
existing reaper outcomes: still-present is skipped retirement-failed; an already
gone checkout is retired with its cleanup warning. All 16 command-test request
constructions, the reaper request, service fenced copy and schema examples are
included in the corrected migration inventory.

Fleet epoch migration explicitly schema-encodes FleetSnapshot before generic
printCommandJson; a nested codec declaration alone would not prevent a decoded
tag escaping. Reap already schema-encodes its report; OptionFromNullOr preserves
explicit null, not omitted keys. The full 15 skip literals and every independent
candidate payload remain supported. ProcessCwdReading no longer depends on a
withdrawn ProcessScan design. Its aggregate and current raw-procfs/recorded-prefix
identity compatibility remain unchanged.

## Non-Worktree: concrete carriers, payload and safety preservation

The previous r3-tooling-codex-write-packet-options declaration is an excluded
anonymous function parameter in Findings.write.ts:222–229. The distinct new
codex-findings-write-request-options D1 row identifies the actual writePacket
argument in Findings.command.ts:272–278. dryRun/force are independently copied
from the named request; all four pairs have supported behavior. Keep full
repoRoot, slug and documents payloads, existing-destination refusal, document
scan ordering and preview/promote semantics. Do not reuse the excluded ID.

ContainedFileRead remains 4/3: false/None missing, true/None present but unreadable
or non-text, true/Some full text including empty. Symlink refusals remain typed
failures outside the successful return model. Three readers in Ack/ProofLedger
and its public test-kit exposure migrate together. The new guarded writer's 0600
temporary-file chmod/write/containment/rename sequence is separate and remains
intact. No write-only consumer is added to the read-result migration.

Packet commit kind remains 4/2 at its simultaneous local boundary: the existing
non-force refusal and dry-run return occur before replacing is declared, leaving
create false/false or replace true/true. Preserve raw request diagnostics,
Markdown-only spreadsheet-formula filtering, other redaction refusals, CSV
policy, complete documents and transactional backup/restore/promote ordering.
The existing LiteralKit import is reused. Refresh-backup cleanup belongs to
promoteRefreshSnapshot; staging cleanup is an actual object-literal D2 owner.
Those corrections preserve existing identities and contracts.

Tmpfs remains 312/13 with its separate 72/14 local observation model. Incoming
Tmpfs source is byte-identical to R28. ResidueReap does not provide its candidate
objects or process scan, and the two janitors have separate roots and schemas.
Only shifted Quality consumer citations change in the candidate design. Do not
borrow residue containment checks as Tmpfs guard-deletion credit or narrow its
sequential Option observations, including None versus Some(false).

The other source changes preserve their appropriate boundaries: Freshbooks'
rotation remains uninterruptible after permit acquisition so the consumed
credential response is durably stored; its response and Effect/callable API add
no Boolean carrier. The ai-sync literal policy moves git stash drop from allow
to deny without inventing array-count axes. Findings refresh stops duplicating a
full-snapshot suffix. JudgePack changes displayed model/effort. Quality's reap
Flag default becomes false without becoming a data owner. Provenance mirror
permissions harden while append/mirror result Booleans remain independent.
ProcessIdentity emits raw procfs identity by default and retains prefix-aware
recorded replay and alive/dead/unknown behavior. ResidueReap preserves its
canonical home/repo boundary checks, inode binding and path-changed refusal;
required objects/arrays/counts and callback predicates are not new Boolean axes.

Ontology validation.ts basename matches are false positives. Shared Tasks and
its later fixtures are covered by the separate existing-owner refresh below;
the earlier non-Worktree audit did not claim their latest-main semantic review.

## Package-script policy: existing owners and new-source check

### Source and owner adjudication

All paths in this section are repo-relative. Abbreviations:
CP = `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts`;
QT = `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`;
DP = `packages/tooling/tool/cli/src/commands/DeletePackage/DeletePackage.command.ts`;
LC = `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts`.

- **TemplateContext**, CP734-767, retains the real eleven Boolean fields747-757
  beside required PackageType and optional-key family/kind/appKind. Its sole
  producer1479-1504 still follows the same full validation and dry-run path.
  Required name/path/year/plugin strings remain full payloads, not invented
  predicates. The complete 1,658,880/31 grammar and all optional literal
  alternatives are unchanged. Row anchor736→738 and producer/gate citations
  move by two imports. The full public template migration remains necessary.
- **ScaffoldShape**, CP479-488, contains exactly actual OptionFromOptionalKey
  AppKind481 (None plus all five Some literals), Boolean lab482 and stories483.
  Allocation1417 is downstream of unchanged type/app/lab/stories gates. Its
  24/11 cases remain valid. The changed script machinery is a new compatibility
  dependency, not a new member of this private resolved owner.
- **Retired-name reconciliation**, CP1399 and1605-1607, still co-carries two
  command-local Boolean values. Cleared implies sanctioned reuse; an explicit
  removal no-op remains legal. All three final outcomes and the earlier dry-run
  authorized stage survive. The complete helper/registry/test map in the design
  is retained, with CP citations moved by two.
- **Mutation summary D1**, CP1593-1645, retains four actual sibling values
  workspaceUpdated/identityUpdated/retiredNameCleared/lockfileRefreshed.
  Existing source-proven independence after projecting away reuse is unchanged.
  Correct the descriptive `.executeMutationFacts` suffix to actual enclosing
  symbol `createPackageCommand`; no such nested object is declared. This is a
  metadata repair, not withdrawal of actual sibling state or another qualified
  retirement record.
- **Ecosystem manifest D2**, CP1705-1708 and1741, remains an actual instantiated
  npm/bundler object containing inherited private true and sideEffects false.
  The concrete writer is called at2032-2037 after scripts selection2030.
  Preserve the external manifest contract, dependencies, encoding and full
  payloads; this is not an invented object inferred from two method guards.
- **DeletePackageHandlerOptions D1**, DP598-615, retains its fourteen actual
  Boolean members and full target/also strings. The only incoming change above
  it is the package-scripts baseline writer at447-450. The print-prefix reader
  at617-618 still implements dryRun/check precedence; it does not reject both
  true. Existing D1 disposition and raw policy inputs remain unchanged.
- **taggedUnionViolation D1**, LC475-481, retains computed local values
  missesLiteralKitPattern and usesAllowedFallback, not the regex methods as
  members. All four source-string outcomes remain supported: proper required
  patterns without fallback; neither; GenerationAction fallback without all
  required patterns; and the same GenerationAction snippet containing both
  the proper patterns and allowed union fallback. Only nine imports moved the
  existing declarations. Keep fallback permission independent of pattern miss.
- **TestLaneSelectionState D1**, QT232-236, still owns Boolean unit/integration
  and full args. Its false/false accumulator263-267 and reducer310-311 remain
  valid, as do one-lane and both-lane states. Retain its exact row bytes.
- **Raw CoverageTaskOptions D1 pairs**, QT249-256 and618-628, retain raw parsed
  replaceAll/scoped and replaceAll/writeBaseline inputs. Root pure planning now
  reads them at2714-2716, including diagnostic-only runtime combinations that
  are legitimate raw planning requests. Preserve both stable D1 rows. No runtime
  resolver rejection is moved into the raw planner.
- **Lane proof result**, QT1694-1699, remains actual derived reusable/activeReuse
  state with 4/3 outcomes. The exact row is unchanged. Session Option, shadow/
  active policy, full environment/tree proof identity, successful persistence,
  volatile security and report payload/codec obligations remain in the full
  design. Its downstream test facade moves3330→3332.
- **Resolved coverage**, QT715-808, retains four actual Boolean members at its
  successful returned objects and16/7 outcomes. Rejection order720 before725
  before733 is untouched. The consumer is now2993-3019; selected write shards
  remain2843. Full args/expected owners, both noop intents, report-only before
  skip and all current baseline/report codecs remain required.
- **Resolved test lanes**, QT307-321, retain4/3 with real returned unit and
  integration values plus full ordered args; its raw accumulator remains D1.
  Runtime is now3057-3104 and dispatch3106-3112. Both pure/runtime paths,
  unsplit discovery, serial SQL resources and failure ordering are retained.

The source-only import additions and unchanged owner spans were verified
against exact before/current files. Existing constructor/consumer contracts
and complete designs were reused rather than treating graph edges as exhaustive
absence proof. No required enum, array/count predicate, callable guard, Flag
descriptor or anonymous parameter was promoted into another Boolean axis.

### Material design repair: public script writers

CP1961-1964 adds exported `CreatePackageScripts`; the wildcard at
`packages/tooling/tool/cli/src/commands/CreatePackage/index.ts:14` exposes it
through the existing command package subpath. The former ScaffoldShape claim
that only command/resolver/TemplateContext are exported is false and is replaced.
ScaffoldShape itself and its selectors remain private.

`CreatePackageScripts.app` is CP1772-1777. Preserve its full dev/build strings
and either lab value. It delegates to existing canonical
`scaffoldPackageScripts(lab ? "lab" : "app", [])`, overlays dev/build, and
omits coverage only for labs. Dedicated app builders1833-1903 retain their
start/Tauri/dependency overlays.

`CreatePackageScripts.package` is CP1925-1944. Preserve every nonlab
ScriptsPackageKind, full rootRelative/packagePath strings and either stories
value. The helper has no CLI/ScaffoldShape gate. Its exact requested optional
task list is `["lint:fix", "test:integration", "docgen"]`; it retains Babel,
check-tests, policy and coverage overlays. Stories true overwrites the canonical
check and adds check-stories; false preserves the kind-specific canonical check.
Do not narrow these public helper inputs to the private eleven ScaffoldShape
cases or count their scalar Boolean parameters as deleted fields.

The concrete command chooses script kind at CP2018-2029 in this exact order:
ecosystem metadata; remaining Some(appKind); tool; library. Runtime-proof has
no dedicated app builder, so its manifest remains package-shaped while scripts
use canonical app kind. PackageType alone is insufficient to reproduce that
choice. Preserve the existing helper/module, optional tasks, current script
keys/values, source exports, canonical encoder and trailing newline. Do not
restore pre-main codegen placeholders or old inline script tables.

All three CreatePackage designs coordinate this boundary. The updated
ScaffoldShape design changes its export/migration/guard-accounting obligations;
TemplateContext and retired-name designs preserve their existing ownership while
retaining the shared public script writers. The six full replacement files keep
all eight required sections, existing legal tables, raw diagnostics, payloads,
codec/exposure maps and ordered Tier1E/serial shared-file coordination.

### Quality gates and fixture citations

QT2548-2549 adds package-scripts --check then policy-fingerprint --check, before
typos. Both labels/argument arrays, cwd/environment/timeout construction and
blocking failures remain. Neither gate receives Boolean-refactor deletion credit.
This delta changes no proof identity implementation or lane Boolean producer.
All three Quality designs carry that requirement and retain their complete
existing proof/runtime/encoded maps.

The added source imports do not imply a uniform test offset. Exact Git diff
hunks were used to relocate unchanged lines, avoiding ambiguous repeated `it(`
text. `create-package.test.ts:274-332` directly exercises the new public helper
contract; tool creation652-681 verifies its script block and platform-node
payload. App equality checks829/892 and runtime-proof overrides1073-1082 are
retained. Original ordinary-package cases now start683; stories1158-1223,
real apps807-1048 and runtime-proof1051-1099 remain mapped. Lab tests are unchanged.
Quality root-plan lists2798-2799/2836-2837 and exact args2840-2845 verify the new
gates. Later Quality test citations move by ten, while downstream QT runtime
citations move by two. Unchanged TemplateService and Effect references keep
their own original line numbers.

The parent new-source check binds 10 authored paths and finds no additional
qualified or disqualified carrier. TaskScriptBinding and TaskScriptPresence are
already tagged unions. Their one ifPresent Boolean plus required literal/string
payload is not a second Boolean axis. Rule/default/drift/report schemas own maps,
arrays, strings and counts. scriptsBlockFromRecord and scaffoldRuleEnabled use
callable guards. DerivationEvidence contains required sets; processManifest has
one local didWrite and one returned written Boolean in separate scopes. Raw
write parameters and new command Flag/handler descriptors remain excluded.
PolicyToolsFingerprint's required path array and callable equivalence are not a
parallel Boolean state model. This bounded check grants no exemption from R29.

Incoming canonical package scripts, Codegen barrel CLI behavior, CreatePackage
helper exports, DeletePackage baseline writer and the two new root-policy tasks
remain supported. Package script changes are source behavior to preserve, not
implementation credit for this campaign. The incoming dependency declarations
and lockfile were not changed by this refresh transaction.

## Design promotion, landing and verification

All 17 complete replacements retain the eight mandatory sections. Their current
headers bind merged HEAD/main, the public audit/source/row maps and exact original
archives. Private audit/proposal hashes remain provenance fingerprints only;
public evidence has no dependency on private filesystem links. Header/whitespace
normalization is recorded separately from frozen private proposal bytes.

Tier 1 work stays in the ordered Tier1E tooling subsystem batches, with shared
files edited serially and each deletion counted once. Each Tier 2 record remains
a singleton PR with exact encoded compatibility. Shared files do not authorize
combining Tier 2 records. Qualified design review remains independent and pending.

Preparation runs only packet inventory/design validation and mechanical
source/hash/index/whitespace checks. No product test, package verification,
service, generator, model or Grok run supplies new acceptance here. Logical Git
index entries are captured and compared exactly; preparation writes only private
stage files. Existing frozen R28 EOF whitespace remains untouched. Exact original
archives preserve their original bytes even when historical whitespace differs
from the normalized new authored proposals.
