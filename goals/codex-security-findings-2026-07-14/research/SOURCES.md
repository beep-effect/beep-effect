# Sources

## Repo Sources

- `AGENTS.md` / `CLAUDE.md` - repository law and security/tool routing.
- `goals/README.md` - goal packet standard and completion gate.
- `goals/_template/**` - base execution-capable packet shape.
- `goals/codex-security-findings-2026-07-08/**` - immediately prior Codex
  security remediation packet; structure, schemas, and closeout lessons reused
  here verbatim.
- `standards/ARCHITECTURE.md` and `standards/architecture/**` - doctrine for
  package ownership, helper placement, shared-kernel promotion, config, testing.

## External Sources

- Codex Cloud Security UI:
  `https://chatgpt.com/codex/cloud/security/findings/` (captured via codex's
  Chrome extension against the authenticated chatgpt.com session).

## Notes

- Raw Codex finding reports are local evidence under `raw/` (gitignored), not
  tracked sources.
- Browser capture and post-merge closure route through codex's Chrome extension,
  not Claude `claude-in-chrome`, per operator instruction.
