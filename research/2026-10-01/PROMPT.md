# PROMPT — ready-to-fire kickoffs (2026-10-01)

## 1) Effect 4.0.0 consumer audit
```
Audit beep-effect (and any Effect tip consumers) against effect@4.0.0 stable LTS just published 2026-10-01.
- Diff vs prior pin effect@4.0.0-rc.118: SchemaJIT, HttpApi paths, unstable-path removals, TaggedError callers.
- Note drizzle-orm #6162 still OPEN — list any Schema.TaggedErrorClass usages that will break on Effect 4.
- Propose a minimal upgrade PR checklist; do not open the PR unless asked.
```

## 2) CA SB 574 + competitor MCP clocks
```
Draft a one-page compliance note for Tom/solo: California SB 574 (signed 2026-09-30) duties (no delegating practice of law to genAI; verify citations; restrict confidential inputs) vs current competitor MCP clocks (Harvey–Everlaw fall 2026; iManage/TR coming soon; Patlytics MCP live foil). Cite primary bill text + Harvey/iManage HOLD pages. No legal advice disclaimer footer.
```

## 3) Skill-security paper cluster → product gates
```
Summarize Pretext (2609.39607), ActionGuard (2609.39450), and TrustProbe (2609.39065) into three product gates for any skill-install path (scanner evasion, execution-boundary auth, taint/trust). Map each gate to SEP-2640 SDK ship status (go#1238 / py#3485 / ts#2818 still OPEN). Output a markdown table only.
```
