# Opportunities

## 2026-10-09 — Package verification cold declarations

- Work: initial TypeScript verification of the router and provider driver.
- Evidence: `quality package-verify --quick` skipped upstream build; direct check
  reported `TS6305` for missing declaration outputs and a large cascading error
  set. Default package verification built most upstream outputs, while
  `@beep/repo-configs` still needed its own build. Initial new-source errors
  were separated from this cold-checkout condition and repaired by their owners.
- Prevention: make the quick-check description state its cold-declaration
  prerequisite, and verify that cached upstream builds restore all declarations.
- Disposition: environment precondition repair in this lane; no unrelated
  TypeScript suppression or source repair.

## 2026-10-09 — Enrollment generations at tool boundaries

- Work: review the real SQLite/MCP boundary before native autonomous proof.
- Evidence: a grant check followed by a separate inbox query or acknowledgment
  permitted endpoint replacement to change the authorized generation between
  operations. Predecessor reply correlation also needed generation-aware
  authorization rather than endpoint-name equality alone.
- Prevention: validate grants with scoped inbox/receipt/discovery queries and
  acknowledgment inside their store transactions; authorize the immutable reply
  source through the same generation-aware receipt boundary. Retain regression
  tests that replace an endpoint and distinguish predecessor from successor mail.
- Disposition: owning store/tool sessions repair the boundaries; private profile
  ownership does not replace peer enrollment revocation semantics.

## 2026-10-09 — Native fixture success versus live protocol qualification

- Work: first autonomous Codex/Grok pair through the new durable router.
- Evidence: the first seed became ambiguous after roughly 28 ms without MCP grant
  usage; the ephemeral/resume lifecycle was not qualified for the new driver.
  The next attempt reached Codex seed acknowledgment and one persisted send to
  Grok, but Grok's claimed turn ended ambiguous without a grant debit or reply.
- Prevention: retain exact real-provider RPC/status evidence separately from
  synthetic framing fixtures; qualify persistent profile/resume and tool
  execution policy with the owned launch configuration before promising a
  two-provider conversation.
- Disposition: provider owner diagnoses the current Grok route; preserve both
  failed/partial attempt receipts. No fallback provider, billing change or
  completed-conversation claim follows from these attempts.


## 2026-10-09 — Full proof ran while implementation changed

The orchestrator reported a full CLI audit with 5,800 passing and five failing
tests, plus a red docgen pass. Four tests loaded an earlier implementation while
source was changing (missing subscription, Option shape and dropped-ACK count);
the remaining failure found six missing ACP/provider/MCP patterns in generated
policy input closure. In-flight provider framing generics also failed docgen.
Private logs retain the exact failure output. No final green gate is claimed.

Prevention: freeze source/build inputs for the final full proof, then run canonical
tsconfig synchronization and `lint policy-fingerprint --write` after new
workspace dependencies. Provider-owned framing repairs need final type/docgen
proof. The public live runner now compares before/after source and executable
digests so a changed implementation cannot receive a passing live receipt.


## 2026-10-09 — Native MCP sandbox overrode the outer writable mount

A zero-model native child diagnostic proved `SQLITE_READONLY_DIRECTORY`. The
outer sandbox could write the owned SQLite copy, but Grok’s inner MCP sandbox
kept that directory read-only. This explains why outer BEGIN/ROLLBACK and scoped
ACK checks passed while live native MCP writes failed.

The installed native sandbox documentation describes a custom `beep-messaging`
profile extending read-only with the exact owned router state directory writable.
The provider owner is adding a bounded `sandboxWritablePaths` launch field, private
canonical ownership validation and policy fingerprint; the serving CLI enforces
an exact state-directory match. The public runner supplies only that owned path.
Before any model rerun, require actual native-child state write success and
outside-write refusal. No repair success or new autonomous proof is claimed here.

The post-format quick gate also caught an in-flight declaration mismatch:
`ManagedLaunchProfile` had no `sandboxWritablePaths` at the runtime consumer.
Provider model/export/build readiness must precede the frozen dependent package
check; retain the distinct red receipt and require an actual successful rerun.

## 2026-10-09 — Repository gates cover more than package handoff checks

The first complete cheap-gate run passed ten lanes and failed six: reviewed cache
configuration, schema-first, Effect Vitest conventions, and three Fallow lanes.
The new dependency edges and generated input closure require a scoped cache
review. Native wire records need annotated classes. Test assertions need the
specialized public helpers; genuine filesystem/process and shorter backup scopes
need explicit provenance review. New store and native control-flow complexity is
being reduced without changing receipt or transaction boundaries.

Fallow also treated two historical Relay spike scripts as repository entrypoints
with undeclared third-party dependencies. Their existing recipe already runs them
only from a disposable cache installation. They are now retained byte-for-byte as
`.mjs.txt` research source artifacts, and the recipe restores `.mjs` names during
the copy. No Relay dependency or runtime is added to this implementation.

Prevention: run collected cheap gates before describing a package-local pass as
repository readiness. Review exact detector rows; preserve meaningful native and
storage tests rather than deleting coverage or broadly refreshing baselines.

## 2026-10-09 — Live CLI test fixtures overlap publish-intent inspection

Yeet publication refused six untracked files beneath a temporary
`.qualification-accept-cli-*` directory while the canonical full CLI audit was
actively exercising cache qualification. These are owned test fixtures, not
publication content. Stashing or removing them during the running test would
corrupt its evidence. Let that active audit finish and clean its scoped fixtures,
then retry the unchanged staged publication. Do not add a broad ignore or stage
the generated receipts. Prevention: test scratch should stay outside the source
checkout, or publication must coordinate with a live test's fixture lifetime.

## 2026-10-09 — Release-policy landing changes the final integration base

After the initial draft publication, PR #1566 landed the manifest-aware release
policy. Merging it conflicted only in the generated cache baseline; preserve
both the release-policy and messaging graph reviews through structural resolution
and the canonical audit. Both touched drivers are private workspaces, so remove
this branch's now-rejected private-package changeset. Package publication remains
dormant. The prior full CLI proof belongs to implementation commit `1565951a24`;
final hosted checks qualify the integrated head. No message-router or provider
implementation is changed by this merge.
