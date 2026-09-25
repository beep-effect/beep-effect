# worktree-removal-mode

P2 refresh at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
Preserves designed4/3, Tier1 internal owner. Independent P3 remains pending.

## Current shape

WorktreeRemovalRequest in Worktree.schemas.ts489-513 stores archive/deleteBranch
Booleans alongside name, targetPath, mainCheckout, branch, expectedHead and the
new independent optional exemptInvoker/exemptInvokerSession fields. All paths
below are relative to packages/tooling/tool/cli/ unless otherwise stated.
Name491 rejects dot/dotdot, separators, control characters and surrounding
whitespace; targetPath492 is nonempty without control characters. Preserve these
exact schemas. Branch and expectedHead retain OptionFromNullOr with no default.

The implication validator at Worktree.service.ts986-991 rejects branch deletion
without archive. The same function979-1035 now permits exact sibling or nested
Claude worktree roots, then checks registration, canonical path and common Git
directory. Existing request writers are interactive command888, Reap562,
Yeet/internal/Retire252 and fenced copy1403. The last changes only targetPath.

## Cardinality gap

Archive/deleteBranch has4 representable and3 legal tuples:00 remove/keep,
10 archive/keep,11 archive/delete, with01 rejected. Branch=None is legitimate
for all modes and yields no deletion. Expected-head authority is independent.
The new exemption policy inputs do not constrain the mode: their archive-only
operational consumption does not imply illegal combinations. Optional session
inference has absent/false/true strata and explicit proof has absent/present;
all six are accepted for each legal mode, yielding24/18 for this expanded finite
projection. Explicit proof takes precedence even when its marker cannot be
proven. Do not absorb or erase that policy as Boolean-creep credit here.

## Target schema

Add annotated WorktreeRemovalMode=LiteralKit(["remove","archive",
"archive-and-delete-branch"]) with same-name Type in the existing schema module.
Replace only archive/deleteBranch with mode on WorktreeRemovalRequest. Retain
all seven sibling fields and complete schemas/default/omission semantics. Use
schema-derived matching; preserve LiteralKit helper statics using the repository
annotation pattern. No Boolean aliases or extra compatibility decoded bag.

At the interactive adapter preserve context resolution, name validation,
registered-root ambiguity refusal, target existence and registration diagnostics
in that order. After those checks and before request construction888, reject raw
false/true with the exact existing message and selected targetPath, then collapse
the three pairs once. Raw CLI flags and rendering's archive parameter remain.
Reap and Yeet retirement construct archive-and-delete-branch directly. Keep the
service validator and all safety rechecks; only remove its implication block.

## Migration inventory

- Worktree.schemas.ts489-513 and example474: mode and exact existing payloads.
  Keep exemptInvoker:optionalKey(WorktreeInvokerExemption) and
  exemptInvokerSession:optionalKey(Boolean), including explicit proof precedence.
- Worktree.command.ts50,845-903: name decoder remains schema-derived; preserve
  sibling/nested registered selection, ambiguous names, missing target and
  unregistered target errors. Insert conflict rejection after registration before
  request construction; keep renderWorktreeRemovalReceipt(receipt,options.archive).
- Reap.service.ts562: keep authorized expectedHead and branch Option.
- Yeet/internal/Retire.ts252: new writer absent from old design; preserve movement
  to owning clone, session marker acquisition and explicit WorktreeInvokerExemption,
  expectedHead=None, error mapping and no new flag adapter.
- Worktree.service.ts979-1035: retain exact nested/sibling root selection, name
  check, registration parse, realPath and common Git directory equality. Remove
  only986-991. Calls1168/1395/1454 remain in their original order and on original
  registered requests, never the renamed copy for managed-name validation.
- Service1183-1196 replaces optional branch filter by mode selection; retain None
  =>false and exact archived-head compare-and-swap. Dispatch1455 uses mode match.
- Service1372-1445 keeps dirty-submodule checks, authority check before fencing,
  residue containment before rename, original-request validation, fenced copy1403,
  rollback, capture, post-capture quiescence, preservation on late writers or
  removal failure, prune and final branch deletion in the same order.
- Service1269-1324 exemption handling stays intact: explicit proof overrides
  session inference; missing/unproven marker does not fall back to a broader
  inferred exemption. Keep full ancestry/marker predicates and holder scans.
- Worktree/index.ts wildcard schema/service exports and package exports retain
  the migrated request. Service interface and test helper request inputs migrate;
  no new raw Boolean compatibility overload. Package root exports the command;
  the commands/Worktree subpath exposes schemas/services. No separately named
  testkit file was found; local test helper factories are enumerated below.
- Worktree command test constructors848,879,912,1008,1043,1128,1192,1237,1289,
  1302,1355,1390,1423,1568,1620,1696,1762,1790,1829,1871,1923 (21 sites) and
  reap test497 migrate. Deliberate invalid request1008 becomes adapter conflict
  coverage retaining target-survival assertions. Service fixtures that carry
  exemption fields must preserve them. Recheck callers at implementation head.

## Guard-deletion accounting

Delete two stored request Booleans and one implication block986-991, replace
archive dispatch and branch selection with mode matches. Keep exactly one raw
CLI conflict check. Delete zero path, registration, realpath, common-directory,
authority, containment, process/exemption, quiescence or preservation checks.
The old instruction to remove validateRemovalRequest wholesale is not valid.
Do not remove safety calls merely because the mode is now valid by construction.

## Encoded-side impact

Internal resolved request: no persisted request object or user-printed request
format was found. Migrate its exported decoded constructor and schema consumers
atomically under the campaign internal-domain policy. Preserve every sibling
field's existing encoding, especially nullable Options and omitted exemption
fields; do not claim blanket compatibility for arbitrary external request JSON.
CLI flags/default false, exact messages, receipts, archive refs, residue paths,
manifest content and Git operands remain unchanged. Release policy is assessed
when implementing; exported TypeScript status alone does not mandate a bump.

## Test impact

Run full four-pair adapter matrix with invalid name, ambiguous registered roots,
missing target and unregistered target precedence. Verify legitimate00/10/11
with branch Some/None and expectedHead Some/None. Retain direct service safety
fixtures for mismatched names, symlinks, foreign common directories, unregistered
repos, sibling and nested lanes. Preserve archive/dirty/submodule/rollback,
exact-head deletion, post-capture writers and cleanup-failure fixtures.

Retain explicit-proof and inferred-session tests, including both policy inputs,
unproven marker, chain-top fallback, sibling holders and archive capture timing.
No actual removal or mutable filesystem behavior proof is run for this P2 audit.
The private finite table proves only mode cardinality, not service security.
After implementation run focused worktree-command/worktree-reap and Yeet retire
coverage plus `bun run beep quality package-verify @beep/repo-cli`, then campaign
and Yeet gates. Local Effect/Schema and LiteralKit source remain the API authority.

## Risk

Current main added nested roots and an explicit retirement writer with exemption
proof. Applying the old five-payload design would drop authorization context.
Moving raw conflict checks earlier would change existing diagnostic precedence;
removing validator calls would weaken authorization. Keep shared Worktree edits
serial in Tier1 tooling batches. This proposal gives no independent P3,
implementation, full-corpus or dry-round credit.
