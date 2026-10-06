# Practice Docket Intake — Sources & Provenance

- **Source exploration:** none. This goal was authored directly from the
  operator-ratified solo-practice alignment of 2026-10-06; the ledger below
  was built during P0 Research.
- **Provenance:** the sibling packets and explorations in section 5.

## 1. Mined source corpus

No external code is ported. The design composes in-repo packages only.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| None | N/A | N/A | N/A |

## 3. External research sources

The Microsoft Graph and Exchange RBAC-for-Applications research this packet
relies on is already on disk in
`explorations/practice-office-provisioning/research/r3-graph-write-surface.md`
and `r4-provisioning-code-shape.md`. No new external source is cited here.

## 4. In-repo capability references

| Brick | Path | Use |
| --- | --- | --- |
| `@beep/m365` | `packages/drivers/m365` | extend: app-only lane and write verbs |
| `@beep/m365-mcp` | `packages/drivers/m365-mcp` | test stubs only |
| `LocalDate` | `packages/foundation/modeling/schema/src/LocalDate` | reuse: calendar dates and month arithmetic |
| `LiteralKit` | `@beep/schema` | reuse: literal domains |
| `LanguageModel` | `effect/ai/LanguageModel` with `@beep/anthropic` | reuse: schema-typed agent calls (exemplar `packages/documents/server/src/aggregates/Document/FilingDecisionLlm.ts`) |
| `PracticeKgMatterLookup` | `@beep/law-practice-server` (workstream D, unmerged) | reuse through a port |
| systemd unit helpers | `packages/tooling/tool/cli/src/internal/systemd` | reference only: the repo CLI may not import slice packages |
| Docket intake values, ports, pipeline, adapters, app | `packages/law-practice/*`, `apps/docket-intake` | NET-NEW |

## 5. Cross-links & provenance

- `goals/m365-driver`, `goals/m365-mcp` — the driver and its MCP host.
- `goals/practice-m365-contacts` — the auth-lane constraints adopted in
  decision D-2.
- `goals/law-docketing-patent-spine`, `goals/law-docketing-reliability` —
  vocabulary and the cursor requirement; no contract or fixture exists there
  yet.
- `goals/practice-kg-mcp` — the lookup substrate.
- `goals/effect-v4-workflow-engine-spike` — see decision D-3.
- `explorations/solo-firm-docketing` — the overlay doctrine; see decision D-1.
- `explorations/practice-office-provisioning/DECISIONS.md` — auth lanes for
  egress.
