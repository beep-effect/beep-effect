# Agent Computer Access Resources

## Knowledge

- [Claude Cowork architecture overview — Anthropic Help Center](https://support.claude.com/en/articles/14479288-claude-cowork-architecture-overview)
  Primary source. Cloud sessions run in a per-session sandbox on Anthropic infrastructure,
  "created when the session starts and destroyed when it ends"; device files reach it only
  through a brokered connection to explicitly connected folders; outbound network goes
  through a mandatory allow-list proxy; connector tokens never enter the sandbox. Use for:
  every factual claim about what Cowork can and cannot touch.
- [Claude Code documentation](https://code.claude.com/docs)
  Primary source for the other side: Claude Code runs on the user's machine with the
  permissions of whoever launched it — filesystem, shell, git, installed tools, schedulers.
  Use for: what "agent with a computer" concretely means.
- [Claude Cowork vs Claude Code: Same Engine, Two Jobs — DataCamp](https://www.datacamp.com/blog/claude-cowork-vs-claude-code)
  Good third-party framing: same agent harness, different containment posture. Use for:
  the "same brain, different room" framing.
- [Claude Cowork vs Claude Code: Security Differences — MintMCP](https://www.mintmcp.com/blog/claude-cowork-vs-claude-code)
  Enterprise-security angle: blast radius vs reach trade-off, stated plainly. Use for:
  answering the "isn't local access dangerous?" rebuttal honestly.
- [Set up Claude Code for your organization — Claude Code docs](https://code.claude.com/docs/en/admin-setup)
  Primary source for the governance case: managed policy settings that override user
  config, permission allow/deny lists, org administration. Use for: every "compliance
  can set the scope" claim.
- [Claude Code and new admin controls for business plans — Anthropic](https://www.anthropic.com/news/claude-code-on-team-and-enterprise)
  Anthropic's own announcement of enterprise controls: managed settings deployment,
  seat management, spend controls, usage analytics. Use for: citing that administration
  is a supported product surface, not a workaround.

## Wisdom (Communities)

- [r/ClaudeAI](https://reddit.com/r/ClaudeAI)
  Active practitioner community; many "Cowork vs Code" threads from real deployments.
  Use for: testing the pitch against people who run both daily.

## Gaps

- No fetched-and-verified Claude Code scheduling/hooks doc page yet (cron-style routines,
  hooks, background tasks). Needed before lesson 0002 if the audience asks "show me a real
  automation".
