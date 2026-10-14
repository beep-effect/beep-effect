# Attorney Review Workspace — Sources & Provenance

- **Cluster / origin:** a six-facet research workflow on 2026-10-14 with a skeptic per facet
  (29 claims confirmed, 13 corrected, none refuted) and a synthesis. No client content was opened.
  Box tools were inspected by schema only.
- **Provenance:** [SYNTHESIS-2026-10-14.md](./SYNTHESIS-2026-10-14.md) (verified vs unverified
  lists in §7) and [FACET-VERDICTS-2026-10-14.md](./FACET-VERDICTS-2026-10-14.md). The raw facet
  output stays in the operator's local handoff folder.

## 2. Upstream repositories & licenses

No upstream code is ported at this stage. Anthropic's sample mods (`hello-tabs`, `token-weather`,
`blast-radius`) are named for spike S1 as reference only.

## 3. External research sources

The URLs and section anchors cited in the synthesis:
- Claude Code docs: code.claude.com/docs/en/desktop.md ("Arrange your workspace", "Ask a side
  question", "Preview your app", "Browse external sites", "Review changes with diff view"),
  code.claude.com/docs/en/deep-links.md, and the docs mods overview, reference and interface pages.
- The Claude Code mod type declarations bundled with 2.1.295 (`types/claude-code.d.ts`, line ranges
  in the synthesis §3 cell sources).
- The artifact-capabilities skill 0.2.77 type files (`comments.d.ts`, `db.d.ts`, `mcp.d.ts`,
  `sample.d.ts`), the ArtifactComments tool schema, and the Claude Docs connector guide (topics
  index, comments, tabs, uploads, sharing, editing).
- Box: support.box.com article 360048016153, developer.box.com/guides/embed/ui-elements/annotations,
  the developer.box.com reference index, and the Box connector tool schemas (`get_file_preview`,
  `get_preview_page`, `get_download_url`, `create_file_comment`, `list_file_comments`,
  `add_file_shared_link`).
- The W3C Web Annotation Data Model (w3.org/TR/annotation-model), for the TextQuoteSelector.
- claude.com/claude-for-word (fetched 2026-10-14).
- The legal AI vendor pages cited in the landscape facet. Vendor claims are marked separately from
  documented behaviour; see the facet verdicts.

## 4. In-repo capability references

See [RESEARCH.md](../RESEARCH.md), "In-Repo Capability Inventory".

## 5. Cross-links & provenance

- Sibling exploration and goal: `claude-mods-law-practice` → `goals/practice-claude-mod`
  (PR #1711).
- Consumer exploration: [claim-element-graph](../../claim-element-graph/README.md). Its shape
  review waits on this packet's verdict-surface decision.
- Prior attempts: `goals/practice-kg-mcp` (S15/D-29, P8 attorney session),
  `goals/practice-document-identification` (D8, D16), `goals/design-figure-review-loop`
  (T1/T2 markup intake), `goals/practice-box-onboarding`.
