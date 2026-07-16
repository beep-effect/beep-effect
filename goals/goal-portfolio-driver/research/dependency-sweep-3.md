# Dependency Sweep — Group 3

## `law-docketing-patent-spine`

- **Slug:** `law-docketing-patent-spine`
- **Remaining phases:** PLAN has P0 Research, P1 Implement, P2 Verify, and P3 Close, all pending ([PLAN.md](../../law-docketing-patent-spine/PLAN.md#L7-L14)). The manifest instead splits closeout into pending P3 “Yeet: PR to mergeable” and P4 “Close”; reconcile this phase drift before status updates ([ops/manifest.json](../../law-docketing-patent-spine/ops/manifest.json#L60-L85)).
- **Proposed PR units (3):** (1) P0 authority/fixture research plus the lifecycle/records contract; (2) P1 complete patent approval-spine implementation; (3) P2 proof plus P3 closeout/mergeability. These boundaries follow the distinct research, implementation, verification, and close goals in the PLAN ([PLAN.md](../../law-docketing-patent-spine/PLAN.md#L11-L14)).
- **Frontend:** no. The named surfaces are law-practice domain/use-cases/tables/server plus driver boundaries; no `apps/**`, `packages/**/ui/**`, or `.tsx` surface is named ([SPEC.md](../../law-docketing-patent-spine/SPEC.md#L39-L50)).
- **dependsOn:** `m365-driver`, `law-docketing-reliability`, `law-doc-structure-oa-slice`.

  > “\"dependencies\": [ \"goals/m365-driver\", \"goals/law-docketing-reliability\", \"goals/law-doc-structure-oa-slice\" ]” ([ops/manifest.json](../../law-docketing-patent-spine/ops/manifest.json#L15-L19)).

- **Special execution notes:** This is paired acceptance with `law-docketing-reliability`; the patent packet supplies the lifecycle/records seam, but v1 cannot pass until the sibling kill-app and restore/backfill/reconciliation proof passes ([SPEC.md](../../law-docketing-patent-spine/SPEC.md#L78-L83)). ODP calls must remain sequential per API key ([SPEC.md](../../law-docketing-patent-spine/SPEC.md#L62-L63)); persistence/restart proof uses file-backed PGlite and delivery is one-way through Outlook/M365. Commercial vendor credentials/access remain unproven and CPI/LawToolBox evaluation is deferred ([SPEC.md](../../law-docketing-patent-spine/SPEC.md#L66-L70)). Stop if authorities are stale/contradictory, paired reliability cannot be proven, or verification needs unnamed credentials, cost, destructive effects, or policy approval ([SPEC.md](../../law-docketing-patent-spine/SPEC.md#L154-L165)).

## `law-docketing-reliability`

- **Slug:** `law-docketing-reliability`
- **Remaining phases:** PLAN has P0 Research, P1 Implement, P2 Verify, and P3 Close, all pending ([PLAN.md](../../law-docketing-reliability/PLAN.md#L7-L14)). The manifest instead splits closeout into pending P3 “Yeet: PR to mergeable” and P4 “Close”; reconcile this phase drift before status updates ([ops/manifest.json](../../law-docketing-reliability/ops/manifest.json#L51-L76)).
- **Proposed PR units (3):** (1) P0 dependency/monitor selection and acceptance-harness contract; (2) P1 polling, heartbeat, alert, acknowledgment, and recovery implementation; (3) P2 kill/restore proof plus P3 closeout/mergeability ([PLAN.md](../../law-docketing-reliability/PLAN.md#L11-L14)).
- **Frontend:** no. The target surfaces are the patent-spine seam, law-practice use-cases/tables/server, existing drivers, and an external monitor adapter; no `apps/**`, `packages/**/ui/**`, or `.tsx` surface is named ([SPEC.md](../../law-docketing-reliability/SPEC.md#L37-L47)).
- **dependsOn:** `law-docketing-patent-spine`.

  > “This packet depends on `law-docketing-patent-spine` for the lifecycle and records contract” ([SPEC.md](../../law-docketing-reliability/SPEC.md#L71-L72)).

- **Special execution notes:** P0 must validate an external monitor’s production access, terms, channels, credentials, cost, and failure-domain independence ([SPEC.md](../../law-docketing-reliability/SPEC.md#L79-L81)). The monitor must work with both app and desktop off, alert after at most 20 minutes of stale heartbeat, and cannot share the app/desktop failure domain ([SPEC.md](../../law-docketing-reliability/SPEC.md#L51-L67)). ODP polling is sequential per key every 15 minutes; recovery starts at the durable cursor and reconciles open deadlines and Outlook before heartbeat resumes. Stop if the patent contract is missing/contradictory, no qualifying external path exists, or verification needs unnamed credentials, cost, destructive effects, or policy approval ([SPEC.md](../../law-docketing-reliability/SPEC.md#L147-L158)).

## `law-time-capture-spine`

- **Slug:** `law-time-capture-spine`
- **Remaining phases:** PLAN has P0 Research, P1 Implement, P2 Verify, and P3 Close, all pending ([PLAN.md](../../law-time-capture-spine/PLAN.md#L7-L14)). The manifest instead splits closeout into pending P3 “Yeet: PR to mergeable” and P4 “Close”; reconcile this phase drift before status updates ([ops/manifest.json](../../law-time-capture-spine/ops/manifest.json#L50-L75)).
- **Proposed PR units (3):** (1) P0 native-task and privacy/deletion contracts; (2) P1 manual timer-to-approved-preview vertical; (3) P2 restart/deletion/idempotency proof and two-week pilot plus P3 closeout/mergeability ([PLAN.md](../../law-time-capture-spine/PLAN.md#L11-L14)).
- **Frontend:** yes. The SPEC explicitly targets `apps/professional-desktop` for the visible timer, association, review/history, and preview UI ([SPEC.md](../../law-time-capture-spine/SPEC.md#L49-L61)).
- **dependsOn:** none.
- **Special execution notes:** P0 is human-input-gated: Tom must supply representative real matters and approve the bounded native prosecution task set ([PLAN.md](../../law-time-capture-spine/PLAN.md#L11-L11), [PLAN.md](../../law-time-capture-spine/PLAN.md#L30-L31)). Keep fixtures/pilot evidence redacted and protect privileged content. Slice 1 is deliberately network-free: no vendor account, OAuth grant, or live service ([SPEC.md](../../law-time-capture-spine/SPEC.md#L81-L85)); FreshBooks belongs to a separate packet ([PLAN.md](../../law-time-capture-spine/PLAN.md#L35-L36)). Stop if safe representative matters are unavailable, the privacy/deletion contract cannot be made testable, scope requires a vendor/network, or verification needs unnamed credentials, cost, destructive effects, or policy approval ([SPEC.md](../../law-time-capture-spine/SPEC.md#L178-L189)).

## `uspto-prosecution-read`

- **Slug:** `uspto-prosecution-read`
- **Remaining phases:** P0 Four contract spikes, P1 Implement, P2 Verify, and P3 Close, all pending ([PLAN.md](../../uspto-prosecution-read/PLAN.md#L7-L14)).
- **Proposed PR units (3):** (1) P0 four dated contract-spike evidence notes; (2) P1 observation, vocabulary generator, transport adoption, and MCP exposure; (3) P2 proof plus P3 closeout/mergeability ([PLAN.md](../../uspto-prosecution-read/PLAN.md#L11-L14)).
- **Frontend:** no. All named implementation surfaces are driver, transport-capability, and MCP packages; no `apps/**`, `packages/**/ui/**`, or `.tsx` surface is named ([SPEC.md](../../uspto-prosecution-read/SPEC.md#L51-L59)).
- **dependsOn:** none.
- **Special execution notes:** P0 is a hard gate: do not infer OA endpoints/envelopes, vocabulary retrieval/checksums, PTMNFEE2 layout, or authenticated ODP retry/rate/idempotency facts ([PLAN.md](../../uspto-prosecution-read/PLAN.md#L11-L11), [PLAN.md](../../uspto-prosecution-read/PLAN.md#L35-L43)). Credentialed captures are optional, sanitized evidence; routine CI/acceptance stays network-free and credentials never imply matter consent ([SPEC.md](../../uspto-prosecution-read/SPEC.md#L78-L86)). `uspto-ptmnfee2-ingest` is a dependent consumer of the shared generator, while polling/cursor orchestration stays above this driver ([SPEC.md](../../uspto-prosecution-read/SPEC.md#L89-L95)). Stop on unresolved P0 contracts, legal-interpretation/scheduler leakage, generator forks, or verification requiring unnamed credentials, cost, destructive effects, or policy approval ([SPEC.md](../../uspto-prosecution-read/SPEC.md#L152-L161)).

## `uspto-ptmnfee2-ingest`

- **Slug:** `uspto-ptmnfee2-ingest`
- **Remaining phases:** P0 Current-release discovery, P1 Implement, P2 Verify, and P3 Close, all pending ([PLAN.md](../../uspto-ptmnfee2-ingest/PLAN.md#L7-L14)).
- **Proposed PR units (3):** (1) P0 authorized current-release evidence and generator-fit gate; (2) P1 staged download/parser/full-replacement implementation after the shared generator is available; (3) P2 adversarial/rollback/consumer-contract proof plus P3 closeout/mergeability ([PLAN.md](../../uspto-ptmnfee2-ingest/PLAN.md#L11-L14)).
- **Frontend:** no. The target is `packages/drivers/uspto`, the prosecution packet’s generation mechanism, and package tests/fixtures/manifests; no `apps/**`, `packages/**/ui/**`, or `.tsx` surface is named ([SPEC.md](../../uspto-ptmnfee2-ingest/SPEC.md#L41-L47)).
- **dependsOn:** `uspto-prosecution-read`.

  > “Hard dependency: `goals/uspto-prosecution-read` supplies the single shared four-vocabulary generation/refresh/drift mechanism.” ([SPEC.md](../../uspto-ptmnfee2-ingest/SPEC.md#L81-L84)).

- **Special execution notes:** P0 requires an authorized session/API key and a current release capture; secrets stay redacted and signed/ephemeral URLs must never be committed ([SPEC.md](../../uspto-ptmnfee2-ingest/SPEC.md#L53-L63)). The file is cumulative, so refresh must stage, validate, and atomically replace rather than append. Scheduling/recovery belongs to `law-docketing-reliability`, while this packet owns one refresh execution ([SPEC.md](../../uspto-ptmnfee2-ingest/SPEC.md#L76-L88), [PLAN.md](../../uspto-ptmnfee2-ingest/PLAN.md#L39-L41)). Stop if source/access/licensing facts cannot be verified, the shared generator cannot fit without a fork, atomic replacement cannot be proven, or verification needs unnamed credentials, cost, destructive effects, or policy approval ([SPEC.md](../../uspto-ptmnfee2-ingest/SPEC.md#L136-L145)).

## `gov-legal-mcp`

- **Slug:** `gov-legal-mcp`
- **Remaining phases:** P0 Contract and naming audit, P1 Implement thin host, P2 Verify, and P3 Close, all pending ([PLAN.md](../../gov-legal-mcp/PLAN.md#L7-L14)).
- **Proposed PR units (3):** (1) P0 live-export/auth/naming/collision contract; (2) P1 bounded read-only stdio host and deterministic collision-report implementation; (3) P2 regeneration/auth/schema/span proof plus P3 closeout/mergeability ([PLAN.md](../../gov-legal-mcp/PLAN.md#L11-L14)).
- **Frontend:** no. The only new target is `packages/drivers/gov-legal-mcp`, consuming existing driver/kit/transport exports; no `apps/**`, `packages/**/ui/**`, or `.tsx` surface is named ([SPEC.md](../../gov-legal-mcp/SPEC.md#L39-L46)).
- **dependsOn:** `gov-legal-data-driver-codegen`, `mcp-kit`.

  > “\"dependencies\": [\"goals/gov-legal-data-driver-codegen\", \"goals/mcp-kit\"]” ([ops/manifest.json](../../gov-legal-mcp/ops/manifest.json#L21-L22)).

- **Special execution notes:** Use live public exports during P0, not the exploration snapshot ([PLAN.md](../../gov-legal-mcp/PLAN.md#L23-L28)). This is an offline-tested stdio host: eCFR is keyless, GovInfo is a hard gate that disappears without its optional secret, and tests inject configuration without real credentials ([SPEC.md](../../gov-legal-mcp/SPEC.md#L50-L72)). Stop if a proven driver lacks a stable public operation surface, collision safety becomes unstable/order-dependent, scope expands into delivery/write persistence/general generation, or installed MCP contracts invalidate the shipped kit conventions ([SPEC.md](../../gov-legal-mcp/SPEC.md#L101-L109)).

## Summary

| slug | remaining | prUnits | frontend | dependsOn |
| --- | --- | ---: | :---: | --- |
| `law-docketing-patent-spine` | PLAN P0–P3; manifest P0–P4 drift | 3 | no | `m365-driver`, `law-docketing-reliability`, `law-doc-structure-oa-slice` |
| `law-docketing-reliability` | PLAN P0–P3; manifest P0–P4 drift | 3 | no | `law-docketing-patent-spine` |
| `law-time-capture-spine` | PLAN P0–P3; manifest P0–P4 drift | 3 | yes | none |
| `uspto-prosecution-read` | P0–P3 | 3 | no | none |
| `uspto-ptmnfee2-ingest` | P0–P3 | 3 | no | `uspto-prosecution-read` |
| `gov-legal-mcp` | P0–P3 | 3 | no | `gov-legal-data-driver-codegen`, `mcp-kit` |
