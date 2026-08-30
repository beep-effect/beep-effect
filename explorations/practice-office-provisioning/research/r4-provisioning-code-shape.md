# R4: provisioning code shape and driver gaps

Date: 2026-08-30

## Executive summary

Use an Effect-native desired-state reconcile program over `@beep/box` and
`@beep/m365`. Do not put the practice estate behind a Pulumi Dynamic Provider.
The desired-state program should decode a versioned intent document, inventory
the live tenants through driver services, emit a schema-validated plan artifact,
and apply that exact plan with resource-specific idempotency and precondition
checks. Dry-run is the normal planning mode, not a flag that bypasses half of
the program.

This recommendation rests on the live checkout and current provider behavior:

- `@beep/box` is deliberately demand-scoped. Its generated surface contains
  nine SDK managers, and managers outside the manifest are compile-time absent
  (`packages/drivers/box/scripts/box.surface.ts:20-21,55-73`). Folder CRUD is
  present, but metadata templates, folder metadata, metadata cascade policies,
  retention policies and assignments, collaborations, Box Sign requests, and
  webhooks are not (`packages/drivers/box/src/_generated/Box.operations.gen.ts:55-108`).
- The missing Box managers exist in the installed Box SDK. The driver generator
  can wrap them after they are added to the demand manifest, subject to the
  package's type-instantiation budget (`packages/drivers/box/README.md:35-56`).
- The Box Business plan is a product blocker for two desired resource families,
  separate from the driver gap. Box says metadata is Business Plus and above,
  and retention policies require Box Governance on Business Plus or Enterprise.
  The reconciler must emit `BlockedByEntitlement` plan entries for metadata and
  retention on the current plan. It must not quietly skip them or imply that the
  tenant has legal-DMS retention when it does not.
- Box Sign is available on Business, but Box's current plan matrix includes
  100 custom-integration signature requests per year for that tier. Sign
  requests are operational transactions, not standing desired-state resources.
  Provision the folders, templates that the API can read, and webhook plumbing;
  create each engagement-letter request through an idempotent workflow ledger.
- `@beep/m365` has a good technical seam for expansion. `M365` depends on an
  injected token-provider contract and Effect `HttpClient`, so a confidential
  client provider can sit beside the PKCE provider without replacing the REST
  service (`packages/drivers/m365/src/M365.auth.ts:262-300` and
  `packages/drivers/m365/src/M365.service.ts:1180-1209`). The write verbs attach
  to `M365Shape` and `makeService` (`M365.service.ts:791-807,1071-1161`).
- The current M365 read-only scope guard is a blacklist of four values, not a
  complete proof of read-only access. It rejects `Files.ReadWrite.All`,
  `Sites.ReadWrite.All`, `Mail.Send`, and `Calendars.ReadWrite`, but it would
  accept write scopes needed by this goal such as `Files.ReadWrite`,
  `Contacts.ReadWrite`, and `Mail.ReadWrite`
  (`packages/drivers/m365/src/M365.config.ts:122-151,232-244`). The goal should
  replace that blacklist with separate decoded configurations for delegated and
  app-only lanes.
- Pulumi is already part of this repository, so it is not a new dependency in
  the abstract (`package.json:92-96`; `infra/package.json:37-48`). It would still
  be a second state and reconciliation engine for this practice estate. More
  importantly, Pulumi's current Dynamic Provider documentation says `read` is
  not functional. That undercuts live refresh and drift discovery for tenant
  resources. Implementing live reads inside `diff` would recreate the proposed
  Effect planner inside a Pulumi wrapper.

There is also SDK provenance drift to fix before adding Box managers. The brief
calls the driver "v10.1", the root catalog and lockfile resolve
`box-node-sdk@10.14.0` (`package.json:145`; `bun.lock:5769`), and the tracing
constant still says `10.11.1`
(`packages/drivers/box/src/internal/Box.constants.ts:1-7`). The current generated
baseline is therefore not proven by one authoritative version marker.

## Driver gap analysis

### Box driver

#### How to read the surface

The public service is the intersection of generated JSON operations and
hand-written streaming operations (`packages/drivers/box/src/Box.service.ts:24-38`).
`makeService` merges streaming implementations into the generated manager
groups (`Box.service.ts:65-78`). The generator does not reflect the full SDK by
default. `GENERATED_MANAGERS` is the authority, and the package explicitly says
an unlisted manager has no generated operations
(`packages/drivers/box/scripts/box.surface.ts:20-21,55-73`; `packages/drivers/box/README.md:17-33`).

The installed SDK confirms that the missing target managers are available to
wrap: `folderMetadata`, `metadataTemplates`, `metadataCascadePolicies`,
`listCollaborations`, `userCollaborations`, `webhooks`, `retentionPolicies`,
`retentionPolicyAssignments`, and `signRequests`
(`node_modules/box-node-sdk/lib/client.d.ts:106-126,142-165`). These dependency
paths are local verification evidence, not tracked repo source.

The installed declaration files also prove the concrete verbs that could be
admitted into the generated driver:

- `folderMetadata` has list/get/create/update/delete, while
  `metadataTemplates` has lookup/list/create/update/delete and
  `metadataCascadePolicies` has list/get/create/apply/delete
  (`node_modules/box-node-sdk/lib/managers/folderMetadata.d.ts:190-292`;
  `node_modules/box-node-sdk/lib/managers/metadataTemplates.d.ts:373-448`;
  `node_modules/box-node-sdk/lib/managers/metadataCascadePolicies.d.ts:206-246`).
- `retentionPolicies` has list/get/create/update/delete, and
  `retentionPolicyAssignments` has list/get/create/delete plus retained-file
  listing (`node_modules/box-node-sdk/lib/managers/retentionPolicies.d.ts:315-346`;
  `node_modules/box-node-sdk/lib/managers/retentionPolicyAssignments.d.ts:237-269`).
- `listCollaborations` has folder collaboration listing, and
  `userCollaborations` has get/create/update/delete
  (`node_modules/box-node-sdk/lib/managers/listCollaborations.d.ts:211-246`;
  `node_modules/box-node-sdk/lib/managers/userCollaborations.d.ts:275-311`).
- `signRequests` has list/get/create/cancel/resend and `signTemplates` has
  list/get (`node_modules/box-node-sdk/lib/managers/signRequests.d.ts:153-186`;
  `node_modules/box-node-sdk/lib/managers/signTemplates.d.ts:67-75`).
- `webhooks` has list/get/create/update/delete
  (`node_modules/box-node-sdk/lib/managers/webhooks.d.ts:204-235`).

| Capability | Current verdict | Concrete current evidence | Gap and minimum target surface |
| --- | --- | --- | --- |
| Folder CRUD | Covered | `folders` exposes `copyFolder`, `createFolder`, `deleteFolderById`, `getFolderById`, `getFolderItems`, and `updateFolderById` (`packages/drivers/box/src/_generated/Box.operations.gen.ts:85-92`). `updateFolderById` is the SDK route for rename, move, and other folder property changes. | No manager gap for the basic taxonomy. The reconciler still needs exact-name sibling matching, duplicate detection, parent-before-child ordering, and guarded deletion. |
| Metadata templates and cascade policies | Not covered, and blocked by the current Box plan | Neither `metadataTemplates`, `folderMetadata`, nor `metadataCascadePolicies` appears in `GENERATED_MANAGERS` (`packages/drivers/box/scripts/box.surface.ts:55-73`). Event schemas contain metadata event names, but event names are not CRUD operations. | Add `metadataTemplates` list/get/create/update/delete; `folderMetadata` get/create/update/delete so a template instance can be applied to the root folder; and `metadataCascadePolicies` list/get/create/apply/delete. Box requires a metadata instance on the folder before creating its cascade policy. The current Business tenant cannot use the enterprise metadata feature, which Box documents as Business Plus and above. |
| Retention policies | Not covered, and blocked by the current Box plan | `retentionPolicies` is used as the generator's example of a dropped manager (`packages/drivers/box/scripts/box.surface.ts:40-49`) and is absent from the manifest at lines 55-73. There are no retention operations in `BoxGeneratedOperations` (`packages/drivers/box/src/_generated/Box.operations.gen.ts:55-108`). | Add policy list/get/create/update/delete and assignment list/get/create/delete through `retentionPolicies` and `retentionPolicyAssignments`. Do not schedule any action until entitlement preflight proves Box Governance on a supported plan and the required application scopes. Box says retention policies are a Governance add-on for Business Plus or Enterprise, not the current Business plan. |
| Collaborations | Not covered | The only collaboration-related values in generated code are incidental response fields and event literals. There is no collaboration operation group in `BoxGeneratedOperations` (`packages/drivers/box/src/_generated/Box.operations.gen.ts:55-108`). | Add `listCollaborations.getFolderCollaborations` and `userCollaborations.getCollaborationById`, `createCollaboration`, `updateCollaborationById`, and `deleteCollaborationById`. The plan key should be `(item, principal, role)`, not a display name. Business charges for external collaborators, so the plan should show the billing-impact count before apply. |
| Box Sign requests | Not covered | No `signRequests` or `signTemplates` manager is in the demand manifest (`packages/drivers/box/scripts/box.surface.ts:55-73`), and neither operation group exists in generated operations (`packages/drivers/box/src/_generated/Box.operations.gen.ts:55-108`). Existing `files`, streaming uploads, and folders provide prerequisites only. | Add `signRequests` list/get/create/cancel/resend. Add read-only `signTemplates` list/get if engagement letters use Box Sign templates. A sign request create must use a workflow idempotency key or durable ledger and the Box `external_id`; repeated desired-state apply must not resend signature emails. Business currently includes a finite custom-integration allowance even though web-app signing is unlimited. |
| Webhooks | Not covered | There is no `webhooks` manager in `GENERATED_MANAGERS` or `BoxGeneratedOperations` (`packages/drivers/box/scripts/box.surface.ts:55-73`; `packages/drivers/box/src/_generated/Box.operations.gen.ts:55-108`). Event polling through the `events` manager is a separate capability (`Box.operations.gen.ts:74-77`). | Add webhook list/get/create/update/delete. The SDK's `WebhooksManager.validateMessage` is a static signature-verification helper (`node_modules/box-node-sdk/lib/managers/webhooks.d.ts:188-248`), so verify whether the generator can expose it. If not, add a hand-written schema-first verification boundary with redacted primary and secondary keys. |

#### Box expansion order

The driver expansion should be one focused goal or a first phase of the practice
provisioning goal. The dependency order is:

1. Resolve and record the Box SDK generation version. Regenerate against the
   locked version, then update the trace constant from the same source.
2. Add read paths first: template discovery, folder metadata discovery, cascade
   discovery, retention policy and assignment discovery, folder collaboration
   listing, sign request/template lookup, and webhook listing. The reconciler
   cannot plan idempotently without them.
3. Add mutation paths only after the read models and equivalence rules are
   stable.
4. Run the canonical generator. The package requires remeasurement when the
   manager manifest changes and budgets each generated file at 750K marginal
   type instantiations and the package at 3M absolute
   (`packages/drivers/box/scripts/box.surface.ts:11-18`; `packages/drivers/box/README.md:35-52`).
5. Add live smoke tests by resource family behind explicit credentials and
   tenant-entitlement gates. No test should create a signature request or send
   an external invitation without a separate mutation opt-in.

The packet source table currently describes `@beep/box` as a "complete
generated Box SDK surface" (`explorations/practice-office-provisioning/research/SOURCES.md:20-23`).
That is complete for the prior demand, not for this provisioning demand. The
demand manifest and generated contract are the authoritative description.

### Microsoft 365 driver

#### Existing shape and attachment points

| Area | Existing shape | Exact attachment point for the new lane or verbs |
| --- | --- | --- |
| Configuration | Graph is pinned to `v1.0` (`packages/drivers/m365/src/M365.config.ts:18-37`). `M365ConfigInput` combines delegated auth, transport, retry, cache, and an optional redacted but unused `clientSecret` (`M365.config.ts:175-252`). `ResolvedM365Config` preserves the same mixture (`M365.config.ts:254-292`). | Move the unused secret out of delegated configuration and into a required `M365ConfidentialClientConfigInput`. Keep transport settings in a shared decoded config. The app-only schema fixes the token scope to `https://graph.microsoft.com/.default`; it does not accept delegated scopes or loopback/cache settings. The delegated schema owns PKCE scopes, redirect URI, and user cache. |
| Delegated scopes | Defaults are `offline_access`, `User.Read`, `Files.Read.All`, `Sites.Read.All`, `Mail.Read`, and `Calendars.Read` (`M365.config.ts:95-120`). A four-item write-scope blacklist enforces the current claim of read-only construction (`M365.config.ts:122-151,232-244`). | Replace the blacklist with an explicit delegated scope policy per product capability, or separate `M365DelegatedReadConfig` and `M365DelegatedWriteConfig`. The current blacklist misses `Files.ReadWrite`, `Contacts.ReadWrite`, and `Mail.ReadWrite`. |
| Token provider contract | `M365AuthShape` is one re-runnable Effect that returns a redacted token; `M365Auth` is a `Context.Service` over that shape (`packages/drivers/m365/src/M365.auth.ts:262-300`). Tests can inject a static token (`M365.auth.ts:300-319`). | Add an auth-lane discriminator to the provider shape and a second constructor such as `M365Auth.makeConfidentialClientLayer`. It should build MSAL `ConfidentialClientApplication` and call `acquireTokenByClientCredential` with Graph `/.default`. Preserve the static layer with an explicit lane argument for tests. |
| PKCE implementation | `M365Auth.makeLayer` resolves config, loads MSAL, builds `PublicClientApplication`, configures optional encrypted cache persistence, and returns `acquireToken` (`M365.auth.ts:321-369`). Silent acquisition falls back to the host-owned interactive flow (`M365.auth.ts:195-260`). | Put the confidential implementation beside this constructor, not inside `M365.service.ts`. It has no interactive authorizer, no account selection, no `offline_access`, and no delegated token cache path. A null MSAL result and client-credential failure map to sanitized `auth` errors. |
| Service runtime | The runtime carries an auth shape, Effect `HttpClient`, and resolved config (`packages/drivers/m365/src/M365.service.ts:70-94`). `M365.makeLayer` deliberately leaves auth and HTTP transport injectable (`M365.service.ts:1180-1209`); `makeLiveLayer` currently supplies PKCE auth and `FetchHttpClient` (`M365.service.ts:1212-1234`). | Keep the injectable layer. Add a live app-only composition that supplies the confidential layer. Do not create a second Graph REST client. The auth-lane value must be available to endpoint construction so app-only calls cannot use `/me`. |
| Public service contract | `M365Shape` has eleven read verbs: drive delta and download; site, list-item, drive/version reads; and message/event list/get (`packages/drivers/m365/src/M365.service.ts:775-807`). Implementations live together in `makeService` (`M365.service.ts:1071-1161`). | Add the three public write verbs to `M365Shape`, then implement them in `makeService` after their request and response schemas exist. If the file becomes mixed or oversized, run the architecture command before splitting by role. |
| HTTP execution | The only signed request builder is `signedJsonGet` (`M365.service.ts:840-850`). `executeWithRetry` retries `429` and `503`, and `executeJson` assumes signed JSON GET plus JSON response (`M365.service.ts:864-940`). | Generalize request construction by method, content type, body, and retry safety. Contact and MIME-draft POSTs are non-idempotent and must not inherit blind replay. Upload-session chunk PUTs use a preauthenticated URL and must omit the bearer token, just as the existing download path omits it. |
| Schemas | Graph response schemas already include `GraphDriveItem` and `GraphMessage` (`packages/drivers/m365/src/M365.schemas.ts:457-493,551-588`). Requests are schema classes colocated in `M365.service.ts`, and the boundary decodes them before HTTP (`M365.service.ts:370-773,809-820`). There is no contact or upload-session model. | Add schema-first request, progress, result, contact, and Graph error models before adding contract methods. Use a tagged union for upload progress versus completion. Keep raw byte handles as declared in-process values while schema-validating all serializable metadata. |
| Errors | `M365ErrorReason` currently covers config, auth, request/response encoding, response status, transport, throttling, and encrypted-item skips (`packages/drivers/m365/src/M365.errors.ts:35-62`). `M365Error` carries sanitized status, resource, item id, retry delay, and URL (`M365.errors.ts:81-108,125-168`). | Extend the taxonomy for write conflicts, failed preconditions, upload-session/range failures, permission denial, and ambiguous non-idempotent outcomes. Add sanitized operation, auth lane, Graph code, and request-id fields. Never retain Graph response bodies, MIME, contact data, tokens, or upload URLs in errors or spans. |
| Tests | Unit tests inject a static token and fake Effect `HttpClient`, capture URL/method/headers, and route inline JSON fixtures (`packages/drivers/m365/test/M365.service.test.ts:45-59,93-174,190-264`). They cover all read verbs, auth propagation, path rejection, token stripping on preauthenticated downloads, and throttle behavior (`M365.service.test.ts:385-432,436-566,568-719`). Live tests run only when a complete `M365_*` environment and resolved token-cache path exist (`packages/drivers/m365/test/integration/M365.live.test.ts:15-83`). | Reuse the injectable transport and capture pattern. Extend captures to request bodies. Add sanitized checked-in response fixtures for multi-step upload, contact, MIME draft, and Graph errors. Add separate delegated-write and app-only live gates with a hard mutation opt-in and deterministic cleanup. |

The M365 driver is structurally ready for writes, but its HTTP executor is not
write-safe yet. Reusing `executeWithRetry` unchanged could duplicate a contact
or draft after an ambiguous POST failure. Retry classification and Graph error
decoding belong in the driver goal before any write verb is declared complete.

## Shape comparison and recommendation

### Option A: Effect-native desired-state reconciliation

The Effect-native program should separate intent, observation, planning, and
mutation. That is more than a command that calls a sequence of SDK methods.

#### Desired-state schemas

The versioned input should decode into one top-level schema such as
`PracticeOfficeDesiredState`. Its serializable children should include:

- tenant selectors and an expected tenant/enterprise fingerprint;
- a logical folder tree with stable keys, names, parent keys, collaboration
  policy, and deletion policy;
- metadata template definitions and field definitions;
- folder metadata instances and cascade-policy intent;
- retention policy and assignment intent;
- collaboration principals and roles;
- webhook targets, addresses by configuration reference, and trigger sets;
- Box Sign workflow definitions, while excluding individual sign-request
  transactions from desired state; and
- M365 contact and other stable provisioning intent only where there is a
  defensible natural key.

The schema should reject unknown versions, duplicate logical keys, cycles in
the folder graph, conflicting owners, unbounded destructive policies, and
resource families that have no entitlement declaration. This follows the
repository rule that wire, persisted, and config payloads use Schema as the
runtime contract (`standards/ARCHITECTURE.md:114-130`) and the code law requiring
schema-first models, typed errors, tagged unions, and explicit service
boundaries (`AGENTS.md:8-22`).

#### Service contracts

Keep technical API capabilities in the existing drivers. Put practice-specific
meaning in the owning application/use-case boundary, consistent with the rule
that drivers wrap external systems while product behavior lives in its slice
(`standards/ARCHITECTURE.md:47-60,92-98`). The exact package topology should be
confirmed with `bun run beep architecture` when the goal starts. The conceptual
contracts are:

- `PracticeOfficeInventory`: read Box and M365 into a normalized observed-state
  schema. It has no write verbs.
- `PracticeOfficePlanner`: a pure service or pure functions from desired plus
  observed state to a `ProvisioningPlan`.
- `PracticeOfficeApplier`: consume a previously emitted plan, recheck its
  preconditions, execute permitted actions, and return an `ApplyReceipt`.
- `PracticeOfficeProvisioning`: an orchestration service that decodes input,
  runs entitlement and identity preflight, inventories, plans, writes the
  artifact, and optionally applies the exact plan.

`ProvisioningPlanAction` should be a tagged union with at least `Noop`,
`Create`, `Update`, `Replace`, `Delete`, and `Blocked`. Each action records a
stable logical key, provider resource kind, dependencies, sanitized before/after
summaries, destructive classification, preconditions, and reason. `Blocked`
must distinguish entitlement, permission, ambiguity, unsupported driver
surface, and live drift.

#### Plan and dry-run artifact

The plan is a first-class artifact with its own schema version. It should contain:

- desired-state digest and source revision;
- Box enterprise and Entra tenant fingerprints, never tokens;
- inventory time and live-state digest;
- ordered actions and dependency edges;
- entitlement and permission preflight results;
- warnings, blockers, destructive counts, external-collaborator count, and Box
  Sign custom-integration quota impact;
- redacted principals where the artifact leaves the secure runner; and
- an expiry or maximum age after which apply must replan.

Dry-run performs every read, decode, comparison, dependency calculation, and
artifact write. It performs no provider mutation. Apply accepts the plan digest,
re-reads every mutable precondition such as Box object id/etag and collaboration
role, and fails closed if they changed. That makes review meaningful and avoids
the common failure where "dry-run" prints intended calls without proving what
the tenant already contains.

#### Resource-specific idempotency

| Resource | Identity and comparison rule | Apply rule |
| --- | --- | --- |
| Box folder | Stable logical key plus resolved parent id and exact child name. Reject duplicate same-name children instead of choosing one. | Create only when the parent inventory proves absence. Rename/move through update with the observed id. Delete only with an explicit destructive policy, empty/owned-content proof, and a fresh plan. |
| Metadata template | Enterprise scope plus immutable template key. Compare normalized field keys, types, options, and display names. | Create or patch supported differences. Treat destructive field removals and type changes as blocked or replacement requiring explicit approval. On Business, emit an entitlement blocker before API calls. |
| Folder metadata and cascade | Folder id plus `(scope, templateKey)`. | Apply the folder metadata instance first. Create the cascade only after the instance exists. Because cascade application is asynchronous and Box exposes no completion check, record `AcceptedAsync` rather than claiming all descendants are compliant. |
| Retention | Provider id from the last receipt plus policy name and normalized policy body; assignment key is policy plus target. Names alone are not safe enough to auto-adopt ambiguous matches. | Block on Business. After an upgrade, create the policy before assignments. Treat shortening retention, changing disposition, or deleting policy/assignment as destructive and separately approved. |
| Collaboration | Item id plus principal id/login and normalized role. | Create missing grants, update role changes, and remove only grants explicitly owned by this desired-state document. Never prune unrelated collaborations by default. |
| Webhook | Target id, callback identity, and normalized trigger set. | Create/update owned hooks and preserve foreign hooks. Keep signing keys outside desired state and plan artifacts. Verify inbound messages through a dedicated boundary. |
| Box Sign request | Workflow transaction id mapped to Box `external_id` and returned request id. | Do not model as a standing `Create` on every reconcile. The workflow ledger makes create-at-most-once decisions, then later operations read/cancel/resend by request id. |

The apply receipt is not a competing state file. It is evidence and a provider-id
hint. The next plan still inventories live state. Receipts should record action
outcome, returned provider ids, etags, timestamps, and sanitized failure data.
They must not contain access tokens, client secrets, webhook signing keys,
upload-session URLs, document names when those names reveal client matters, MIME
content, or contact bodies.

### Option B: Pulumi Dynamic Provider over the same drivers

A Pulumi implementation would create one dynamic resource type per Box/M365
resource family. Each provider would implement `check`, `diff`, `create`,
`update`, and `delete`, call the same Effect drivers, and return a physical id
plus outputs. Pulumi would compare desired inputs to its last checkpoint and
show changes through `pulumi preview`.

This option has real strengths:

- the repo already has a Node.js Pulumi workspace and schema-decoded Pulumi
  config (`infra/Pulumi.yaml:1-5` and
  `infra/src/internal/PulumiConfigSchema.ts:7-41`);
- root and `@beep/infra` dependencies already include Pulumi and provider
  packages (`package.json:92-96`; `infra/package.json:37-48`);
- Pulumi supplies dependency graphs, preview, update locking, checkpoints,
  replacement semantics, and encrypted secret inputs/outputs; and
- existing infra components show Effect and Schema can coexist with Pulumi
  (`infra/src/OpenClaw.ts:45-57`; `infra/src/AIMetrics.ts:495-653`).

The costs are larger for tenant provisioning than for the repo's current cloud
resources:

| Concern | Effect-native program | Pulumi Dynamic Provider |
| --- | --- | --- |
| Live source of truth | Always reads Box/M365 before planning. Receipts are hints, not authority. | Pulumi normally compares the program to recorded stack state. `pulumi refresh` depends on provider reads, but current Dynamic Provider docs state that `read` is not functional. Live reads would have to be embedded in `diff` or an out-of-band planner. |
| Dry-run artifact | Domain-specific schema can express blockers, async acceptance, quota impact, destructive classifications, and plan expiry. | `pulumi preview --json` is reviewable, but provider-specific blockers and live ambiguity still need custom output. Unknown values and provider scheduling shape the artifact around Pulumi rather than practice operations. |
| Idempotency | One explicit comparison function per resource, shared by plan and apply. | One comparison function is still required inside each provider. Without reliable `read`, provider `diff` risks comparing desired input mainly with last state. The same reconciliation code exists behind another interface. |
| State and recovery | Live inventory plus append-only plan/apply receipts. No hidden resource ownership unless explicitly recorded. | Every resource input/output is persisted in a stack checkpoint. Backend, lock, checkpoint recovery, import/adoption, refresh, and stack migration become operational concerns. |
| Secrets and confidential names | Credentials can be injected at runtime and excluded from all artifacts. Artifact schemas can redact principals and matter names by policy. | Pulumi encrypts values marked secret and tracks transitive secrecy, but all resource inputs and outputs are state. The physical resource id is always plaintext and cannot be marked secret. Logical resource names, previews, or unmarked outputs could disclose client/matter taxonomy. |
| Runtime | One Bun/Effect program using the same drivers and test stack as the rest of the feature. | Pulumi is already installed, so dependency setup is not new. The practice operator still needs the Node language host, Pulumi CLI, a selected stack/backend, stack secrets provider, login, locking, and state backup in addition to the Bun/Effect workflow. |
| Testing | Pure planner tests, fake driver layers, fixture-based driver tests, and credential-gated live smoke. | Those tests remain necessary, plus dynamic-provider lifecycle and Pulumi mock/preview tests. |

Pulumi state can encrypt marked secrets, and the repository already commits
encrypted stack settings. That does not make the full state harmless. Pulumi
documents that all resource inputs and outputs are recorded in state and that a
resource physical id is always plaintext. A practice taxonomy includes client
names, matter names, collaborator addresses, and callback topology. Treat the
whole backend as confidential even if selected fields are marked secret.

#### Recommendation

Choose the Effect-native desired-state reconcile program.

The deciding point is not that Pulumi is foreign to the repo. It is already a
supported tool here. The deciding point is that this job begins with rich live
tenant discovery, entitlement blockers, ambiguous resource adoption, and
practice-specific safety rules. A Dynamic Provider does not remove any of that
code, and its current lack of functional `read` weakens the part Pulumi should
otherwise supply. The wrapper would add checkpoints, stack ownership, imports,
secret marking, Node provider execution, and a second operator workflow while
the real planner still lives in Effect.

Pulumi remains appropriate for infrastructure that hosts the reconciler or its
webhook receiver. It should not own Box folders, collaborations, retention, Sign
transactions, contacts, or mail drafts.

## `@beep/m365` write-verbs goal sketch

### Proposed goal

Slug: `m365-app-auth-and-write-verbs`

Objective: extend `@beep/m365` with an explicit two-lane token provider and
schema-first, Effect-first Graph writes for resumable driveItem upload, contact
creation, and MIME draft creation. Preserve the current read API, default to
delegated read-only configuration, and make every write permission and retry
behavior explicit.

Non-goals:

- PST or historical mailbox import. The MIME endpoint creates a draft; it is
  not a substitute for the Purview/Exchange PST Import Service.
- sending mail. MIME create requires `Mail.ReadWrite`; a later send verb would
  require `Mail.Send` and separate human/process approval.
- making SharePoint the document system of record. Box remains authoritative.
- tenant app-registration, admin-consent, or Exchange RBAC automation until the
  licensing and authority preflight has its own approved desired state.
- exposing the new writes through `@beep/m365-mcp` in the first goal. The driver
  should be proven before an interactive tool boundary can mutate a tenant.

### Public verb set

| Public verb | Boundary schemas and internal operations | Expected result |
| --- | --- | --- |
| `uploadDriveItemResumable` | `M365ResumableUploadRequest` includes drive id, parent item id or existing item id, file name for creates, total byte length, conflict behavior, optional etag precondition, and an in-process byte source. Internal operations create the session, PUT sequential ranges, query status to resume, and cancel an abandoned session. `M365UploadProgress` is a tagged union of accepted ranges and completed driveItem. | `GraphDriveItem`, plus a sanitized receipt of total bytes and range count. Never expose or log `uploadUrl`. |
| `createContact` | `M365CreateContactRequest` includes target mailbox, optional contact-folder id, and a decoded `GraphContactCreate` body. Add a separate `GraphContact` response schema. App-only requires an explicit user id; delegated may default to `/me`. | Created `GraphContact`. The driver does not invent a natural idempotency key; callers must query/deduplicate or carry an application marker before retrying a create. |
| `createMessageFromMime` | `M365CreateMimeMessageRequest` includes target mailbox, optional mail-folder id, and raw MIME bytes. The driver base64-encodes the bytes and sends `Content-Type: text/plain`; callers should not supply pre-encoded unchecked text. | Created `GraphMessage` draft. This verb does not send it. It does not claim to preserve historical mailbox semantics. |

The upload verb should be high-level. Exposing only `createUploadSession` would
push range arithmetic, 320 KiB alignment, bearer-token stripping, resume logic,
and session expiration into every caller. Microsoft requires sequential ranges,
less than 60 MiB per request, a multiple of 320 KiB for non-final fragments,
and no `Authorization` header on the preauthenticated upload URL. These are
driver invariants.

### Auth and configuration work

1. Introduce an `M365AuthLane` literal domain with `delegated` and `app-only`.
   Add the lane to `M365AuthShape`, which currently contains only
   `acquireToken` (`packages/drivers/m365/src/M365.auth.ts:262-282`).
2. Preserve `M365Auth.makeLayer` as the delegated PKCE constructor. Move its
   config to a delegated-specific schema. Keep the current public constructor
   compatible through a documented migration layer if callers exist.
3. Add `M365ConfidentialClientConfigInput`. Require tenant-specific authority,
   client id, and redacted client secret. Do not accept `common`, `consumers`, a
   redirect URI, an interactive authorizer, delegated scopes, or a user token
   cache path.
4. Add `M365Auth.makeConfidentialClientLayer`. Construct MSAL
   `ConfidentialClientApplication`, call `acquireTokenByClientCredential`,
   require a non-null result, and return a redacted access token. The token
   request scope is exactly `https://graph.microsoft.com/.default`; application
   permissions are statically configured and admin-consented in Entra.
5. Split Graph transport configuration from auth configuration so
   `M365.makeLayer` does not require delegated-only fields when supplied an
   app-only provider. The current combined model and unused secret are at
   `packages/drivers/m365/src/M365.config.ts:175-252`.
6. Add `M365.makeAppOnlyLiveLayer` or an auth-agnostic live composition that
   requires an explicit provider. Keep `M365.makeLayer` injectable for tests.
7. Replace the current write-scope blacklist with lane-specific allowlists or
   typed permission sets. A blacklist cannot prove read-only behavior as Graph
   adds scopes or callers supply write scopes missing from the four constants.

No client secret belongs in the desired-state file, plan artifact, receipt,
Pulumi state, test fixture, or log. The config schema should continue using
`Redacted`, and the host should inject the secret at runtime.

*Correction 2026-08-30 (review finding):* steps 3–4 above model the
confidential client as secret-based, which contradicts R3's and r7's own
conclusion that certificate-based credentials (`clientCertificate` /
`clientAssertion`) are the production lane and secrets are discouraged.
The goal generated from this section must model the app-only credential
schema-first as a tagged union with the certificate/assertion path primary
and any client-secret variant an explicitly limited dev/test fallback —
never the only shape.

### Permission split

| Verb or capability | Delegated PKCE lane | App-only client-credentials lane | Endpoint rule and caution |
| --- | --- | --- | --- |
| Existing reads | Keep the current read defaults: `offline_access`, `User.Read`, `Files.Read.All`, `Sites.Read.All`, `Mail.Read`, `Calendars.Read` (`packages/drivers/m365/src/M365.config.ts:95-120`). | Request only Graph `/.default`; grant only application roles needed by the particular runner. Do not mirror all delegated defaults automatically. | `/me` is delegated-only. App-only uses resource ids or `/users/{id}`. |
| Resumable driveItem upload | Least privileged for work/school is `Files.ReadWrite`; use `Files.ReadWrite.All` or `Sites.ReadWrite.All` only when the target requires it. | Microsoft lists `Sites.ReadWrite.All` as the application permission for this API. It is tenant-wide and requires admin consent. | Use `/drives/{driveId}/...` or another explicit resource route for app-only. Replacing sensitivity-labeled content is not supported app-only. Given Box is the document system of record, each actual use must justify why M365 receives the file. |
| Contact create | `Contacts.ReadWrite`. | `Contacts.ReadWrite` application role through `/.default`, with admin consent. | Delegated may use `/me/contacts`; app-only must use `/users/{id}/contacts`. The application role can reach contacts in all mailboxes unless constrained by Exchange application access policy/RBAC. |
| MIME draft create | `Mail.ReadWrite`. `Mail.Send` is not required to create the draft. | `Mail.ReadWrite` application role through `/.default`, with admin consent. | Delegated may use `/me/messages`; app-only must use `/users/{id}/messages`. Constrain app-only mailbox access. A later send operation is a different permission and goal. |

The current `M365_RESERVED_WRITE_SCOPES` should not simply gain three more
strings. The correct model is two decoded lanes. Delegated interactive config
accepts a typed set of approved delegated scopes. App-only config accepts no
individual scope strings because client credentials must use Graph `/.default`.

### HTTP and retry work

The read executor currently builds only signed GET requests and retries `429`
or `503` by replaying the request (`packages/drivers/m365/src/M365.service.ts:840-940`).
The goal should add:

- a method/body/content-type aware signed Graph request builder;
- an unsigned request builder for preauthenticated upload-session URLs;
- trusted-origin policy that permits the exact server-returned upload URL only
  inside the upload session and never persists it;
- body encoding helpers for JSON, MIME base64 text, and byte ranges;
- a retry-safety value such as `read`, `idempotent`, `resumable`, or
  `non-idempotent`; and
- Graph error-envelope decoding before mapping to `M365Error`.

Reads may keep the current throttle retry. Contact and MIME create must not be
blindly replayed after a transport failure because the server might have
committed the create. A write with an unknown outcome should fail as an
ambiguous write and force caller reconciliation. Upload chunks recover by
querying session status and following `nextExpectedRanges`, not by assuming the
last PUT failed. A `404` on the upload URL means the session expired; `416`
requires a status query; `409` and `412` are conflict/precondition failures,
not generic retry candidates.

### Error taxonomy extension

Keep `M365Error` sanitized and technical. Extend its reason domain and context
instead of leaking Graph bodies:

| Proposed reason | Trigger | Required sanitized context |
| --- | --- | --- |
| `permission denied` | Graph `401`/`403` after token acquisition | operation, auth lane, status, Graph code, request id, resource |
| `conflict` | `409`, including upload completion name conflict | operation, status, Graph code, item id when safe |
| `precondition failed` | `412` etag or conditional request failure | operation, status, item id; never the document body |
| `upload session` | expired session, malformed/contradictory ranges, `404`, or `416` | operation, status, expected-range summary, expiration time; never `uploadUrl` |
| `ambiguous write` | transport failure after a non-idempotent request may have been sent | operation, auth lane, resource, sanitized cause label |

Retain the existing `config`, `auth`, `request encoding`, `response decoding`,
`response status`, `transport`, and `throttled` reasons for cases they already
describe (`packages/drivers/m365/src/M365.errors.ts:35-62`). Add optional
`operation`, `authLane`, `graphCode`, and `requestId` fields to the error schema.
Do not put contact names, email addresses, subjects, MIME, file names, upload
URLs, token claims, or response bodies into the error.

### Goal phases and exit criteria

#### P0: contracts and auth lanes

- Add lane-specific config schemas and migrate the unused optional secret.
- Make the delegated read default backward compatible.
- Add the confidential MSAL provider and lane-aware static test layer.
- Unit-test null results, sanitized MSAL failures, `/.default`, lane endpoint
  restrictions, and scope rejection.

Exit: a test can inject either lane into the unchanged REST service boundary,
and no configuration shape can mix PKCE scopes with app-only credentials.

#### P1: write-safe HTTP core

- Add method/body builders, response/error envelope decoding, retry-safety
  classification, and sanitized request ids.
- Prove non-idempotent POSTs are not replayed.
- Prove unsigned preauthenticated requests never receive bearer tokens.

Exit: the existing read tests remain green and the new executor has fixture
proof for status, throttling, ambiguous writes, conflicts, and preconditions.

#### P2: resumable driveItem upload

- Add upload schemas and high-level verb.
- Implement create, sequential chunk PUT, progress decode, resume/status, final
  completion decode, expiration, and cancellation.
- Support interruption at every range boundary in deterministic tests.

Exit: recorded fixtures cover `202` progress, final `200`/`201`, `404`, `409`,
`412`, `416`, and `5xx` recovery; token stripping and range arithmetic are
asserted.

#### P3: contact and MIME draft create

- Add contact request/response schema and `createContact`.
- Add raw-MIME request schema and `createMessageFromMime`.
- Use explicit mailbox routes by lane.

Exit: request method, URL, content type, encoded body, returned schema, and
non-retry behavior are fixture-proven for delegated and app-only endpoints.

#### P4: live smoke and package proof

- Add separate credential gates for delegated and app-only smoke tests.
- Require an additional `M365_LIVE_WRITE=1`-style mutation opt-in and dedicated
  test mailbox/folder/contact target.
- Create uniquely marked resources, assert the response, and remove only those
  resources. If cleanup companions are not in the public verb set, decide and
  document a safe test-only cleanup boundary before enabling the smoke.
- Run the package's build, check, unit, integration, and lint scripts, then the
  required `bun run beep quality package-verify @beep/m365` handoff.

Exit: fixture tests are deterministic without credentials; delegated and
app-only live smoke skip cleanly when incomplete; an opted-in run leaves no
unowned contact, draft, or drive item.

### Test strategy

The existing driver pattern is more precise than the phrase "recorded
fixtures" suggests. Unit tests currently use inline fixture routes and a fake
Effect `HttpClient`; they are not generated recordings on disk
(`packages/drivers/m365/test/M365.service.test.ts:45-59,122-174,190-264`). The
live test is a separate environment-gated smoke that skips when any required
value or resolved cache path is missing
(`packages/drivers/m365/test/integration/M365.live.test.ts:15-83`).

The goal should preserve that architecture and improve the fixture source:

- store sanitized request/response fixtures for the new Graph operations in a
  local test fixture directory, with source URL, capture date, and redaction
  note;
- keep request assertions in the fake HTTP layer, extending `CapturedRequest`
  beyond its current method/URL/headers shape to include a safe body digest or
  decoded test body (`M365.service.test.ts:45-49,127-158`);
- include schema round-trip and arbitrary tests, matching the current package's
  schema-derived test style (`M365.service.test.ts:72-90,267-383`);
- test both auth lanes with static redacted tokens and no MSAL/network dependency;
- add focused auth-constructor tests through an injectable MSAL factory so
  confidential-client behavior is testable without a real secret;
- reuse the existing proof that bearer auth is present on Graph calls and absent
  on preauthenticated URLs (`M365.service.test.ts:385-432,568-605`); and
- keep live smoke credential-gated, mutation-gated, uniquely named, and
  self-cleaning.

Fixtures must not contain real mailbox addresses, contact data, MIME bodies,
document names, tenant ids, access tokens, request signatures, or upload-session
URLs. Replace them with deterministic examples and assert redaction separately.

## Open questions

1. Will the Box tenant be upgraded from Business to Business Plus with the
   required Governance add-on? Without that decision, enterprise metadata,
   cascade policies, and legal retention must remain explicit blocked plan
   actions. Folder naming is not a substitute for retention.
2. Which Box identity owns provisioning: the existing human account, an app
   service account through CCG, or both? Webhook ownership, collaboration
   visibility, Sign request ownership, and admin-only metadata operations depend
   on the actor.
3. What exact Box SDK version produced the checked-in generated files? The
   catalog/lock and trace constant disagree. Regeneration and the provenance
   marker should be repaired before growing the surface.
4. Does the Box generator remain within its type-instantiation budget after the
   proposed manager set is added? If not, which families need hand-written
   narrow operations rather than whole-manager generation?
5. Which existing tenant resources may the reconciler adopt, and which remain
   foreign? The answer is required before any prune/delete behavior can be
   enabled.
6. Are paid external collaborators acceptable on the Business plan, and what
   review threshold should the plan artifact use before adding them?
7. Is the Business plan's current custom-integration Box Sign allowance enough
   for engagement letters and fee agreements? What should happen when the plan
   projects quota exhaustion?
8. Will engagement letters use Box Sign templates? The API can list and read
   templates, but Box documents that template creation/editing remains in the
   Box web application. That is a real exception to the "no manual console"
   ideal unless template generation is moved to a supported API or document-tag
   workflow.
9. Why is M365 drive upload needed after Box was ratified as the document system
   of record? If it is only a temporary staging or migration capability, name
   the destination, lifetime, and cleanup policy so the write permission does
   not reintroduce split-brain documents.
10. Should app-only `Contacts.ReadWrite` and `Mail.ReadWrite` be constrained by
    Exchange application access policy/RBAC to one practice mailbox? The raw
    application roles otherwise authorize tenant-wide mailbox data.
11. How will app-only SharePoint writes be scoped? Microsoft lists
    `Sites.ReadWrite.All` for resumable upload. That is broad for a runner whose
    final document system is Box.
12. Is MIME draft creation the intended curated-email behavior? Microsoft Graph
    creates a draft and does not turn the verb into a historical received-mail
    import. The packet's PST lane remains the Outlook-history mechanism.
13. Where do plan and apply artifacts live, and which fields are redacted before
    they enter CI artifacts or source review? Tenant resource ids may be
    non-secret while client/matter names and collaborator addresses are still
    confidential.
14. What is the cleanup contract for credential-gated write smoke tests? The
    three requested create verbs do not include delete companions, but a
    production test cannot leave contacts, drafts, or files behind.

## Sources

### Repo and checkout sources

- `AGENTS.md:8-35` for schema-first, typed-error, explicit-service, and live
  source-reuse laws.
- `standards/ARCHITECTURE.md:47-60,92-130` for driver versus product ownership
  and Schema as the runtime contract.
- `explorations/practice-office-provisioning/DECISIONS.md:46-91,134-161` for Box
  as document system of record, the two auth lanes, the Business plan, versioned
  provisioning code, and Box Sign scope.
- `explorations/practice-office-provisioning/research/SOURCES.md:10-31` for the
  packet's starting source index and in-repo bricks.
- `packages/drivers/box/scripts/box.surface.ts:1-73` for demand-scoped Box
  manager generation and its type budget.
- `packages/drivers/box/src/_generated/Box.operations.gen.ts:41-108` for the
  complete current generated manager and verb contract.
- `packages/drivers/box/src/Box.service.ts:24-100,118-197` for service
  composition and developer-token/CCG layers.
- `packages/drivers/box/README.md:17-56` for compile-time absence, generator
  procedure, and remeasurement obligations.
- `package.json:92-96,145`, `bun.lock:5769`, and
  `packages/drivers/box/src/internal/Box.constants.ts:1-7` for Pulumi presence
  and Box SDK version drift.
- `packages/drivers/m365/src/M365.config.ts:18-151,175-327` for Graph endpoint,
  scopes, read-only guard, combined config, and the reserved secret.
- `packages/drivers/m365/src/M365.auth.ts:145-260,262-370` for PKCE acquisition,
  token-provider contract, static layer, and live public-client construction.
- `packages/drivers/m365/src/M365.errors.ts:35-168` for the current error reason
  and sanitized context schema.
- `packages/drivers/m365/src/M365.schemas.ts:370-625` for current Graph response
  schemas.
- `packages/drivers/m365/src/M365.service.ts:70-94,775-940,1036-1262` for runtime,
  public read contract, request executor, environment config, implementations,
  and Layer seams.
- `packages/drivers/m365/test/M365.service.test.ts:45-264,385-719` for the fake
  HTTP fixture/capture pattern and existing boundary proofs.
- `packages/drivers/m365/test/integration/M365.live.test.ts:15-83` for the
  credential-gated live smoke pattern.
- `infra/package.json:1-59`, `infra/Pulumi.yaml:1-5`, and
  `infra/src/internal/PulumiConfigSchema.ts:7-41` for the repo's existing Pulumi
  and Effect/Schema integration.

### External primary sources

- Box documentation index: <https://developer.box.com/llms.txt>
- Box metadata templates and Business Plus requirement:
  <https://developer.box.com/guides/search/quick-start/create-metadata-template/>
- Box metadata cascade policies:
  <https://developer.box.com/guides/metadata/cascades/>
- Box metadata cascade creation prerequisite:
  <https://developer.box.com/guides/metadata/cascades/create/>
- Box retention policies, Governance entitlement, assignments, and required
  scopes: <https://developer.box.com/guides/retention-policies/>
- Box collaboration create API:
  <https://developer.box.com/reference/post-collaborations/>
- Box V2 webhook creation and scope:
  <https://developer.box.com/guides/webhooks/v2/create-v2/>
- Box Sign request API:
  <https://developer.box.com/reference/post-sign-requests/>
- Box Sign API and template operation summary:
  <https://developer.box.com/sign/quick-start/api-basics/>
- Box Business external-collaborator seat accounting:
  <https://support.box.com/hc/en-us/articles/360043695374-I-Have-More-Users-Than-Seats-Error>
- Box Sign plan matrix and current custom-integration allowance:
  <https://support.box.com/hc/en-us/articles/8959729175827-Box-Sign-features-in-Box-Individual-and-Business-plans>
- Microsoft Graph resumable driveItem upload, permissions, range rules, token
  stripping, and recovery:
  <https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0>
- Microsoft Graph contact create and permissions:
  <https://learn.microsoft.com/en-us/graph/api/user-post-contacts?view=graph-rest-1.0>
- Microsoft Graph MIME draft create and permissions:
  <https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0>
- Microsoft Graph delegated versus app-only endpoint semantics:
  <https://learn.microsoft.com/en-us/graph/auth/auth-concepts>
- Microsoft Graph permission reference, including the tenant-wide meaning of
  application contact permissions:
  <https://learn.microsoft.com/en-us/graph/permissions-reference>
- Microsoft identity client-credentials flow and Graph `/.default`:
  <https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow>
- MSAL Node confidential-client initialization:
  <https://learn.microsoft.com/en-us/entra/msal/javascript/node/initialize-confidential-client-application>
- Pulumi Dynamic Provider behavior and current `read` limitation:
  <https://www.pulumi.com/docs/iac/concepts/providers/dynamic-providers/>
- Pulumi state and backend semantics:
  <https://www.pulumi.com/docs/iac/concepts/state-and-backends/>
- Pulumi secret and plaintext physical-id semantics:
  <https://www.pulumi.com/docs/iac/concepts/secrets/>
