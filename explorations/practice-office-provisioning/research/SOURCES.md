# Practice Office Provisioning — Sources & Provenance

- **Cluster / origin:** 2026-08-30 /grill-with-docs session (decisions in
  [`../DECISIONS.md`](../DECISIONS.md)) plus the five-lane research sweep
  (R1–R5) recorded in `ops/manifest.json` `openQuestions`; lane reports land
  beside this file.
- **Provenance:** operator scratch prompt reproduced verbatim in
  [`../CAPTURE.md`](../CAPTURE.md).

## 3. External citations

| Source | URL | What it grounds | Verified |
|--------|-----|-----------------|----------|
| Box developer docs llms.txt index | https://developer.box.com/llms.txt | Canonical Box API/docs map seeded to lanes R1/R3/R4 (operator-supplied 2026-08-30); 292-line index incl. API reference + guides | 2026-08-30 |
| Pulumi "Any Terraform Provider" | https://www.pulumi.com/docs/iac/concepts/providers/any-terraform-provider/ | Bridge mechanism exists, but no Box Terraform provider to bridge (searched 2026-08-30) | 2026-08-30 |
| Pulumi terraform-provider registry page | https://www.pulumi.com/registry/packages/terraform-provider/ | Same — grounds the "no Box IaC provider" finding behind DECISIONS "provisioning-as-code shape" | 2026-08-30 |
| Purview PST import overview | https://learn.microsoft.com/en-us/purview/pst-import-overview | Network vs drive shipping, 100 GB archive-import ceiling, 24 GB/day, retention hold, 150 MB skip | 2026-08-30 |
| Purview network-upload runbook | https://learn.microsoft.com/en-us/purview/pst-import-network-upload | AzCopy + SAS, mapping CSV schema, TargetRootFolder, job UI | 2026-08-30 |
| Purview service description (email archiving licenses) | https://learn.microsoft.com/en-us/office365/servicedescriptions/microsoft-365-service-descriptions/microsoft-365-tenantlevel-services-licensing-guidance/microsoft-purview-service-description#licenses-for-email-archiving | Bulk-PST-import user rights: EXO P2 / E3/E5 / Purview Suite / IP+G — not Business SKUs | 2026-08-30 |
| Exchange Online limits | https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-service-description/exchange-online-limits | User/archive/shared quotas by SKU | 2026-08-30 |
| Auto-expanding archiving | https://learn.microsoft.com/en-us/purview/autoexpanding-archiving | 1.5 TB, 30-day provision, 1 GB/day, classic Outlook search does not hit auxiliaries | 2026-08-30 |
| Hidden archive PST content | https://learn.microsoft.com/en-us/troubleshoot/exchange/administration/imported-pst-file-content-hidden-in-archive-mailbox | IsArchive=TRUE + TargetRootFolder=/ lands in non-IPM folders | 2026-08-30 |
| PST import troubleshoot (quota) | https://learn.microsoft.com/en-us/troubleshoot/microsoft-365/purview/pst-import-service/issues-with-pst-import-job | Conflicts with overview: claims auto-expand does not support PST import | 2026-08-30 |
| FreshBooks API authentication | https://www.freshbooks.com/api/authentication | OAuth2 auth-code; exact-match HTTPS redirect URI, localhost allowed for dev — grounds the R6 dev-app redirect answer | 2026-08-30 |

## 4. In-repo bricks

| Brick | Path | Role here |
|-------|------|-----------|
| `@beep/box` driver | `packages/drivers/box/` | Complete generated Box SDK surface (goals/box-driver 10/10); provisioning verbs ride it |
| `@beep/m365` driver | `packages/drivers/m365/` | Read-only Graph driver, write-ready shape; write-verbs goal graduates from this packet |
| `@beep/m365-mcp` | `packages/drivers/m365-mcp/` | Read-verb MCP exposure precedent |
| Corpus CLI family | `packages/tooling/tool/cli/src/commands/Corpus/` | Source of extracted client/matter entities at population time |
| Salvage-restoration packet | `goals/oppold-corpus-salvage-restoration/` | Upstream gate for historical population (G1) |

## 5. Lane reports

| Report | Lane | Status (2026-08-30) |
|--------|------|---------------------|
| `r1-box-legal-dms.md` | Grok 4.6 + firecrawl/x-search | Original lane crashed at turn 167 (stream cutoff, no report); standing report is a codex salvage distillation over the crashed session's evidence log, provenance-noted inline |
| `r2-purview-pst-import.md` | Grok 4.6 + firecrawl/x-search | Complete, 56 citations |
| `r3-graph-write-surface.md` | GPT-5.6 Sol xhigh | Complete |
| `r4-provisioning-code-shape.md` | GPT-5.6 Sol xhigh, repo cwd | Complete, `file:line` evidence |
| `r5-sku-preflight-and-process.md` | GPT-5.6 Sol medium | Complete, 41 citations |
| `r7-sol-pro-gap-report.md` | GPT-5.6 Sol Pro (operator-run, prompt: `sol-pro-oracle-prompt.md`) | Complete same day — 26 cited sources, CONFIRMED/LIKELY/UNVERIFIED tagging, six deltas to lane findings |

Live tenant probes (Box/M365 MCP connectors, `az rest` Graph reads) are
recorded in [`../CAPTURE.md`](../CAPTURE.md) and distilled in
[`../RESEARCH.md`](../RESEARCH.md); they are observations, not citations.
