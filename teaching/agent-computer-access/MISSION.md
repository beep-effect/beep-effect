# Mission: Getting Claude Code approved past a compliance reviewer

## Why
Benjamin's friend is a wealth manager who wants to automate the paperwork around her job
(reporting, meeting prep, reconciliation, filing, ticklers). Her firm has Claude
Enterprise; Cowork is available, but real automation needs Claude Code on her machine.
The material Benjamin produces here is what she hands her compliance officer. The
outcome: compliance approves Claude Code on her Enterprise seat, ideally as a scoped
pilot under managed settings.

## Success looks like
- She can deliver the playroom/house explanation in under two minutes, and answer the
  "but our systems of record are connected to Cowork" rebuttal.
- The compliance officer's actual concerns are addressed head-on: where files live,
  what bounds the agent (managed policy, allowlists, permission prompts), what's out of
  scope (advice, trading), and what the audit story is.
- The ask is concrete enough to say yes to: a scoped 60-day pilot with a managed
  permission policy, not blanket approval.

## Constraints
- Two audiences in one document: the friend (needs ELI5 retellability) and the
  compliance officer (needs governance facts with citations).
- Every governance claim must cite Anthropic's own published docs — a compliance reader
  will check.
- Finance framing must be careful: automation targets the paperwork around the job;
  investment decisions and trading stay with the licensed human.

## Out of scope
- Sandbox-escape security research (undermines credibility of the pitch's tone).
- Actually configuring the firm's managed-settings policy (that's post-approval work).
- Claude API / Agent SDK internals.

---
Superseded mission (2026-09-11, same day): originally framed as Benjamin pitching his
own (law-firm) colleagues. See learning record 0001.
