# Brief — onboarding units B (2026-10-14)

Lane `feat/practice-gateway`, draft PR #1771. Contract: `SPEC.md`,
`explorations/harness-the-harness/BRIEF.md`, `history/p1/gateway-tools.md`.
Sibling goal `practice-claude-mod` (`apps/practice-claude-mod`, on main) owns
plain-language rows and the matter band; do not touch its surfaces.

## B1 Onboarding skill
An Agent Skill (agentskills.io format; repo law in AGENTS.md for
`SKILL.md` frontmatter) that Claude uses to onboard a lawyer:
interview → `PracticeProfile` → `setup_profile_save` → loop
`setup_status`/`setup_repair` until complete → plain summary.
- Interview covers: systems of record per capability (documents, mail and
  calendar, practice/billing, secrets, knowledge graph), firm IT limits
  (admin rights, proxy), providers named without an adapter (record as
  `CapabilityGap`, never promise them).
- Lawyer-facing voice per the 10-09 ruling: plain lawyer language, no tool
  names, one question at a time, recommended answer first.
- Human-steps boundary (D3): never ask for passwords, never create accounts.
- Decide where it ships: inside the `.mcpb` (if MCP bundles can carry
  prompts/skills Claude Desktop surfaces — check `effect/ai/McpServer`
  `prompt` and the mcpb manifest spec) and/or a Claude plugin skill. Record
  the decision with reasons in SPEC Decision Log. Prefer the path that works
  in Claude Desktop without the lawyer installing anything extra.

## B2 Bootstrapper (design + minimal build)
Research then build the smallest Windows bootstrapper (unsigned, D11) that:
installs Claude Desktop if missing, installs the gateway `.mcpb` into Claude
Desktop, then opens Claude with a first message that starts onboarding.
- Research with primary sources: how Claude Desktop is installed silently
  (official installer flags / winget id), whether an `.mcpb` can be installed
  without the double-click UI (file association, extensions dir), and whether
  Claude Desktop accepts a deep link/argument to open a new chat with text.
  Cite URLs in `goals/practice-gateway/research/`.
- Build target: a bun-compiled `practice-setup.exe` (reuse `@beep/mcpb-kit`
  compile helpers) or a PowerShell script if research shows it is simpler;
  keep it dumb (install, verify, hand off). No downloads in tests.

## Done when
Skill files and bootstrapper exist with tests where code exists;
package-verify for touched packages and cheap-gates pass; decisions recorded;
commit per unit. Do not push. Report what needs the operator (e.g. Claude
sign-in in the VM) for the full onboarding proof.
