# Run 4 blinded alternative seat — launch log

Run `orun-2026-10-06T15:51:01Z`, pin `71c7357adc`. Authority: launch sitting Ruling 8 and recorded calls
(s), (x) and (ab) in `goals/ciops-ontology-pipeline/research/decisions.md`; procedure:
`research/run4-lanes/p3-seat-blinded-brief.md` Part B. Roots live under `~/.cache/beep/run4-blinded/<prefix>`
and are removed after each pass; no session id, host path or working-directory value is recorded here.

## Command shape (call (s))

From the root, with an environment of `HOME`, `PATH` and `TERM` only:
`claude -p <launch file> --model claude-opus-5-5 --settings '{"effortLevel":"medium"}' --strict-mcp-config
--mcp-config '{"mcpServers":{}}' --restricted --tools "Read,Write" --permission-mode acceptEdits
--permission-prompts none --setting-sources project,local --no-session-persistence --output-format
stream-json --verbose`. Init assertions before a run is trusted: `permissionMode` is `acceptEdits`, the tool
list is exactly Read and Write, no MCP server is attached.

## Pre-launch checks (call (x); blinded brief B3 step 3)

- (a) User-level instruction files: the user `CLAUDE.md` and the four user rule files carry 0 lines that
  mention this ontology, its runs, proposals or categories. The user-level auto-memory directory holds 93
  files (of 575) that do; check (c) shows the headless seat does not load it.
- (b) Per-root memory directory: asserted absent or empty by the launcher before every pass.
- (c) Memory canary, 2026-10-06: a throwaway root holding only its input manifest, launched with the exact
  command shape, asked to name every instruction, rule or memory content in its context. Answer: "none".
  Init: model `claude-opus-5-5`, CLI 2.1.291, `permissionMode` `acceptEdits`, tools Read and Write, 0 MCP
  servers, no memory path, 18 built-in skills and no Skill tool. No ontology term appears anywhere in the
  canary's stream. The canary root was removed and no harness project directory for it remains.
- Sanctioned exposure (call (x)): identifiers of earlier ratifications, flags or archived record ids that
  appear inside quoted prose observations are quoted text, never a category verdict.

## Passes

| Prefix | Pass | Init | Pairs written | Denials | Outcome |
| --- | --- | --- | --- | --- | --- |
| `chg` | 1 | held (claude-opus-5-5, CLI 2.1.291, acceptEdits, Read and Write, 0 MCP, no memory path) | 1 (2 records) | 0 | stands; copied back with no clobber, byte-checked; no record outside the alternative grammar; no citation outside its manifest; residue and gitleaks clean |
| `vfy` | 1 | held (same facts) | 16 (32 records) | 0 | stands; copied back with no clobber, byte-checked; no record outside the alternative grammar; no citation outside its manifest; residue and gitleaks clean |
