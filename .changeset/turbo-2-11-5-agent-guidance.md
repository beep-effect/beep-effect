---
"@beep/schema": patch
---

Cover the legacy static installer path that replaces a configurable static
carrying a different value, restoring full coverage of the static descriptor
installer.

Cache review for the Turborepo 2.11.5 bump: the only global configuration change
is `"agentGuidance": false` in the root `turbo.json`, which stops turbo from
rewriting the managed block in `AGENTS.md` and does not affect task hashing,
inputs, environment or outputs. The workspace `turbo.json` schema URL moves to
v2-11-5 are source-digest review notices and are not rebaselined here. No
qualification scope, profile, epoch, lifecycle state or cache eligibility
changes.
