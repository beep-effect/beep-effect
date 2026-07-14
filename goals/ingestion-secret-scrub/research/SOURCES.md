# Ingestion Secret Scrub — Sources & Provenance

This implementation ledger reproduces only the source-exploration entries
relevant to the credential/private-tag scrub, canonical pattern bank,
non-secret evidence, coverage/residue, and prompt gate. The exploration ledger
remains primary:
[`explorations/ingestion-security-secret-governance/research/SOURCES.md`](../../../explorations/ingestion-security-secret-governance/research/SOURCES.md).

- **Source exploration:** `explorations/ingestion-security-secret-governance`
- **Primary provenance ledger:** `explorations/ingestion-security-secret-governance/research/SOURCES.md`
- **Ratified contract:** exploration `DECISIONS.md`, `BRIEF.md`, and `MAP.md`

## 1. Relevant mined source corpus

| Nugget | Title | Upstream | Source (`file:line`) | License stance | Disposition here |
| --- | --- | --- | --- | --- | --- |
| `agentmemory#11` | Secret/PII redaction pass for ethical-wall private tags and provider keys | agentmemory | `src/functions/privacy.ts:3-29` | Apache-2.0 | port with attribution; fold credential/private-tag categories into the canonical bank, preserve NOTICE |
| `LegalEase#3` | Position-tracked redaction matches | LegalEase | `src/utils/redaction.ts:161-181` | MIT | port only the non-secret location/evidence shape; PII recognizers remain gated |
| `doc-haus#13` | OOXML scrub plus residue verification | doc-haus | `dochaus/lib/redactions.ts:86-128` | MIT | reference the honest residue-reporting contract only; OOXML implementation remains gated |

**Implementation bearing:** consolidate the two live in-repo banks rather than
copying a third. Adapt only credential/private-tag detection needed by this
slice; emit non-secret location/count proof; make coverage and residue explicit;
and leave PII/OOXML recognizers outside the implementation.

## 2. Upstream repositories and licenses

| Repo | License | Port discipline | What informs this goal |
| --- | --- | --- | --- |
| agentmemory | Apache-2.0 | port with attribution; preserve NOTICE | private-tag and provider-key scrub categories |
| LegalEase | MIT | port with attribution | position-tracked evidence shape without retained raw match |
| doc-haus | MIT | port with attribution when later authorized | residue honesty only; no OOXML implementation here |
| gitleaks | MIT | reference/port with attribution after rule audit | provider-key regex comparison and fixture inspiration; not a second runtime bank |

No AGPL donor is needed for this slice. If later research consults one, it is
clean-room reference only and must not enter the implementation.

## 3. Relevant external research sources

These sources already appear on disk in the exploration ledger and scrub/audit
dossier:

- [Gitleaks default configuration](https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml)
- [GitHub token formats](https://github.blog/engineering/platform-security/behind-githubs-new-authentication-token-formats/)
- [Microsoft Presidio license](https://github.com/microsoft/presidio/blob/main/LICENSE)
- [Microsoft Presidio anonymizer](https://presidio.dataprivacystack.org/anonymizer/)

Presidio is contract research only in this packet; PII recognition and its
service/runtime are not dependencies.

## 4. In-repo capability references

| Capability | Exact path | Disposition |
| --- | --- | --- |
| `AiMetricsRedactionResult` counted redaction proof | `packages/tooling/library/ai-metrics/src/privacy.ts` | reuse/generalize the counted-proof shape; audit its bank and consumers in P0 |
| Observability error/log pattern bank | `packages/foundation/capability/observability/src/CauseRedaction.ts` | consolidate inputs into the same canonical versioned bank; no divergent observability copy |
| File-processing boundary | `packages/foundation/capability/file-processing/src/` | extend with the narrow scrub transform, proof envelope, and coverage/residue contract |
| Neutral `TextAnchor` | `packages/foundation/modeling/provenance/src/TextAnchor.ts` | reuse non-secret offsets only; never place a matched secret in `quote` |
| Repo secret rules | `.gitleaks.toml` | compare supported categories during P0; do not treat scan rules as an unversioned runtime bank |

## 5. Cross-links and provenance

- Source exploration:
  [`README`](../../../explorations/ingestion-security-secret-governance/README.md) ·
  [`BRIEF`](../../../explorations/ingestion-security-secret-governance/BRIEF.md) ·
  [`MAP`](../../../explorations/ingestion-security-secret-governance/MAP.md) ·
  [`DECISIONS`](../../../explorations/ingestion-security-secret-governance/DECISIONS.md) ·
  [`primary ledger`](../../../explorations/ingestion-security-secret-governance/research/SOURCES.md)
- Goal contract: [`SPEC.md`](../SPEC.md) and [`PLAN.md`](../PLAN.md).
- The five gated candidates remain in the exploration map; no product prose
  page was graduated.
