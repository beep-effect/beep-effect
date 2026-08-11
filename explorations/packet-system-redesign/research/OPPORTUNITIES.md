# Opportunities — friction receipts

## 2026-08-10 — Headless grok agents write files; orchestrator extraction clobbers them

- **What happened:** the six `grok -p` headless research lanes were assumed to
  be text-only (report = stdout stream). They actually have file tools and
  wrote their reports directly into the packet tree — at inconsistent paths
  (`grok/reports/`, `grok/`, `research/`) and names. The orchestrator's
  stream-extraction (`jq` over text events) then overwrote lane 1's full
  30 KB report with its 3 KB chat summary; recovered only because the raw
  streaming-json transcript retained the write tool-call payload
  (`research/grok/raw/1-spec-driven-dev.jsonl`).
- **Evidence:** `research/grok/raw/*.jsonl` tool_call events; lane 1 file
  timestamps (18:14 overwrite, 18:15 recovery).
- **What would have prevented it:** the lane prompt should pin an explicit
  output contract — exact report path + "write the file yourself; final chat
  message is a pointer, not the report" — and the orchestrator should check
  the target path on disk before extracting from the stream. Keep raw
  transcripts always: they are the recovery layer.
- **Disposition:** convention fix — fold the output-contract line into the
  grok fan-out recipe (memory `grok-x-search-headless-primitives`) and any
  future lane-prompt template.
- **Owner:** operator / next grok fan-out session.
