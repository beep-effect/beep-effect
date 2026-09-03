# Yeet PR resume footer — Sources & Provenance

- **Source exploration:** none — graduated directly from speed-loop
  `goals/speed-loop/research/OPPORTUNITIES.md` #79 after a 2026-09-03
  `/grill-with-docs` session.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| PR #637 (`4ec4cd15cd`) | stamp yeet PRs with a provenance footer | beep-effect | `packages/tooling/tool/cli/src/commands/Yeet/internal/Provenance.ts` | original footer with paths + resume block | superseded |
| PR #650 (`4fe0670d5b`) | redact the operator home directory | beep-effect | same | home-prefix tokenization (CSF-005) | superseded |
| PR #685 (`5745327c2f`) | restrict public provenance | beep-effect | same | public model = branch + harness (CSF-007) | baseline for this packet |
| CSF-005 | Yeet PR footer leaks local paths and AI session IDs | beep-effect | `goals/codex-security-findings-2026-08-10/findings/CSF-005.md` | already-fixed disposition | context |
| CSF-007 | Yeet PR footer leaks local paths and AI session IDs | beep-effect | `goals/codex-security-findings-2026-08-13/findings/CSF-007.md` | confirmed; the constraint this packet designs against | follow-up note lands in PR 1 |
| speed-loop #79 | PR provenance + resume footer, stamped by yeet publish | beep-effect | `goals/speed-loop/research/OPPORTUNITIES.md:939` | operator pain; session-home ≠ work-clone correction | graduated here |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| effect-smol (`.repos/effect`) | MIT | validate every API against the checkout | `effect/unstable/process` ChildProcess `inherit` stdio + `cwd`; `FileSystem` append; `Config`/`ConfigProvider` |

## 3. External research sources

- Claude Code 2.1.259 `--help`: `-r, --resume [value]` (session ID or picker
  search term), `--from-pr [value]` (resume a session linked to a PR by
  number/URL), `-n, --name <name>` (display name).
- Codex 0.153 `codex resume --help`: `[SESSION_ID]` is a UUID or session name
  (names resolve as keys); `--all` disables cwd filtering.

## 4. In-repo capability references

- `@beep/repo-ai-metrics`: `repoPathToClaudeProjectName`, `shellQuote`, Codex
  session-store discovery (`the Codex session store`).
- `packages/tooling/tool/cli/src/internal/cli/Flags.ts`: `aiMetricsDataRootFlag`
  precedent for an XDG state root through `Config`.
- `standards/architecture/06-configuration-boundaries.md`: env only through
  `Config`/`ConfigProvider`.
- `standards/git-worktrees.md`: `<checkout-root>-worktrees` sibling layout.

## 5. Cross-links & provenance

- `research/2026-09-03-exploration.md` — verified facts (sanitized; no session ids).
- `research/2026-09-03-design-panel.md` — three-lens panel, red-team critiques, judge synthesis (sanitized).
- `DECISIONS.md` — ratified decisions and Fable calls.
