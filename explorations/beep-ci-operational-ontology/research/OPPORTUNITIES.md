# Research friction receipts

## 2026-08-27: Firecrawl CLI lacks the research subcommand

- **Work:** finding and verifying the papers for the R3 scheduling-formalisms lane through the
  repository's required research-index workflow.
- **Evidence:** `firecrawl research search-papers ...` exited 1 with `unknown command 'research'`
  and suggested the unrelated `search` command.
- **Cost:** the lane had to use primary-source web search and inspect papers individually rather
  than use semantic paper search and citation-graph expansion.
- **Prevention:** install a Firecrawl CLI version that provides the documented `research
  search-papers`, `related-papers`, `inspect-paper`, and `read-paper` commands, or make the skill
  detect the installed CLI capabilities and name the supported paper-retrieval fallback.
