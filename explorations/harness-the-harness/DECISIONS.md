# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-10-14 — D1 Open a packet instead of parking the Notion item

**Question:** The Notion item sat in Parking Lot. Park it, or open an
exploration?

**Answer:** Open `explorations/harness-the-harness` and carry it through
research into align.

**Rationale:** Operator ruling S23 (2026-10-14): "we don't need to 'park
things' I want things done." The orchestrator relayed it and the opening
session's recommended next step was this packet. Reversal: flip status to
`parked` with a dated reason here; nothing outside the packet depends on it.

## 2026-10-14 — D2 Wrap Claude Code, do not replace it

**Question:** Build our own agent environment, or sit on top of Claude Code?

**Answer:** Sit on top. Claude Code (and optionally Codex) is the engine on
the lawyer's own subscription; our layer wraps its developer surfaces and
harnesses its extension points.

**Rationale:** Operator: "We wouldn't be replacing claude code" and "how do
we wrap claude code so it is less technical for lawyers & how do we harness
the harness". Rejected: an own agent loop or hosted runtime. Whether the wrap
needs an own UI at all is Q1, explicitly left open by the operator.

## 2026-10-14 — D3 Human-steps boundary (agent-decided)

**Question:** How far may the onboarding agent go on the lawyer's behalf?

**Answer:** It does everything automatable: installs, configuration, opening
links, filling non-secret form fields, probing and repairing. The human
performs only consent screens, password and MFA entry, Windows admin (UAC)
prompts, reboots, and account creation where an account is truly needed. The
agent never types credentials or creates accounts.

**Rationale:** Matches the operator's "let them click buttons & enter their
password where 100% necessary." Computer-use credential entry and account
creation are brittle (UI drift, MFA, CAPTCHA) and a security liability.
Reversal: none needed; this is a floor, loosened only by an explicit new
decision.

## 2026-10-14 — D4 Windows Credential Manager is the default secret store

**Question:** Which secret store does a lawyer's stack use by default?

**Answer:** Windows Credential Manager, needing no account. A firm's existing
password manager is an optional provider only if adoption research shows
attorneys use it. 1Password stays the developer-side route.

**Rationale:** Operator: "definitely this. Not so sure about LastPass or
Bitwarden." A single lawyer's stack mainly holds OAuth tokens, which the OS
store holds safely; 1Password service accounts solve a multi-agent developer
problem. BitLocker is disk encryption: the doctor checks it is on, it is not a
store.

## 2026-10-14 — D5 Provider priority follows solo/small-firm adoption

**Question:** In what order do we add provider adapters?

**Answer:** By measured adoption among solo and small firms, per capability
(documents, secrets, mail/calendar, practice/billing). Early data puts Clio
first for practice management; OneDrive/SharePoint and Dropbox may outrank
NetDocuments for solos. A named provider without an adapter is recorded as a
gap with a fallback and counted as demand.

**Rationale:** Operator: "choose the most popular options for solo & small
firms. We'll prioritize with that data." The operator's "NetSuite" example
meant NetDocuments. Whether to buy the ABA vendor-share volumes is Q5 (money).

## 2026-10-14 — D6 Extensions first, no own UI (Q1)

**Question:** What wraps Claude Code for the lawyer?

**Answer:** Extensions inside Anthropic's own clients: one gateway `.mcpb`
plus the `practice-claude-mod` plugin in Claude Desktop and Claude Code. An own
t3code-style app is revisited only if extensions hit a measured wall.

**Rationale:** Operator picked the recommended option. It reuses what already
ships on the attorney's PC (practice-kg-mcp is a `.mcpb`), and it sidesteps
the Agent SDK login-terms question, which only binds products that drive
Claude Code from outside. Rejected: an own app now (blocking terms question,
far larger surface); deciding after a proof (the doctor's tools are the same
either way, so nothing is lost by choosing now). Reversal: reopen Q1 at align
with the wall recorded; `apps/professional-desktop` remains available.

## 2026-10-14 — D7 A signed Windows bootstrapper (Q2)

**Question:** How does a lawyer get from nothing to a running onboarding
agent?

**Answer:** One signed Windows installer installs Claude Desktop/Code and the
gateway, then hands off to the onboarding agent inside Claude. One download,
at most one admin prompt.

**Rationale:** Operator picked the recommended option. Rejected: "install
Claude, then double-click our `.mcpb`" (two installs and a gap where the
lawyer is on their own); a human-assisted first install (does not scale and
hides the hiccups we need to learn from). Consequence: code signing is
required, which costs money (Q6).

## 2026-10-14 — D8 Prove on a clean Windows VM first (Q4)

**Question:** Where is onboarding proved first?

**Answer:** A from-zero Windows VM, re-runnable, with recorded evidence per
the stack-installer evidence contract; then the attorney's PC.

**Rationale:** Operator picked the recommended option. Repeatable and safe;
Windows proof has never landed for installer work in this repo, so it is the
first gate. Rejected: the attorney's PC first (not repeatable, risks a
working setup); a second firm first (needs a partner; a later proof).

## 2026-10-14 — D9 Adoption data from free sources and interviews (Q5)

**Question:** Buy the ABA 2024 Legal Technology Survey volumes?

**Answer:** No. Use free reports plus a short structured interview of a few
solo attorneys; the onboarding interview becomes the long-run adoption data
source (named providers, including ones without adapters).

**Rationale:** Operator picked the recommended option; no spend. Reversal:
buying the volumes later is a money decision for the operator.

## 2026-10-14 — D10 Gateway shape (Q3, agent-decided)

**Question:** Grow practice-kg-mcp into the one gateway, or build a new
gateway that mounts practice-kg as one provider?

**Answer:** A new gateway `.mcpb` that composes providers in process, with
practice-kg as the first provider (from `packages/law-practice/server`),
alongside Box, Microsoft 365, the secret store and the setup doctor.
practice-kg-mcp keeps serving the attorney unchanged until the gateway
replaces it on the attorney's machine.

**Rationale:** practice-kg-mcp has its own goal line (strict tier) and a
working install; folding setup, auth and other providers into it would couple
an evaluated knowledge-graph surface to new, unproven code. One installed
`.mcpb` is still the lawyer-facing outcome. Rejected: growing practice-kg-mcp
(coupling); several servers (the problem we are solving). Reversal: the
gateway's provider modules can be folded into practice-kg-mcp if the split
proves to be ceremony.

## 2026-10-14 — D11 Sign later; prove unsigned on the VM (Q6)

**Question:** When and how do we pay for Windows code signing?

**Answer:** Prove onboarding unsigned on the clean VM (D8). Set up Azure
Artifact Signing only before the first install on a real lawyer machine.

**Rationale:** Operator picked the recommended option; no spend until
signing buys something. Artifact Signing bills from account creation, a
reported Basic tier is about $10/month (unverified), individuals qualify in
the US/Canada, and even signed installers build SmartScreen reputation over
time ([pricing](https://azure.microsoft.com/pricing/details/artifact-signing/),
[quickstart](https://learn.microsoft.com/azure/artifact-signing/quickstart)).
Rejected: signing now (spend before value); an OV certificate (higher yearly
cost, same reputation curve). Reversal: none needed; the trigger is the first
real-machine install.

## 2026-10-14 — D12 The operator's own entity publishes (Q7)

**Question:** Whose name appears as the installer's publisher?

**Answer:** The operator's own entity, not the firm.

**Rationale:** Operator picked the recommended option. The product is meant
for many firms; the firm should not carry vendor liability. Rejected: the
firm as publisher (fits an internal tool only); deferring (the signing
identity validation needs it anyway).
