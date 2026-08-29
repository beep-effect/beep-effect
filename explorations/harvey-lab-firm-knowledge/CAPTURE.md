# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-08-08

Benjamin's ask (session, 2026-08-08): read the X post
https://x.com/ItsJulioPereyra/status/2085772997944803682 announcing the
harvey-labs firm-knowledge dataset; clone is local at
`harvey-labs`, outside this repo. "I want you to use claude opus-5 sub agents
in a workflow to mine it for knowledge, information, 'gold' that we could
leverage, use or benefit from and put them in a new exploration packet for
further deepening."

Scraped X post (firecrawl, full text + thread):
[assets/x-post-itsjuliopereyra-2085772997944803682.md](./assets/x-post-itsjuliopereyra-2085772997944803682.md)

Key links from the post / repo:

- Repo: https://github.com/harveyai/harvey-labs (MIT)
- Dataset: https://github.com/harveyai/harvey-labs/tree/main/tasks/firm-knowledge
- Announcement blog: https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark
- Collaborator: Engram (@engramlab) — Dan Biderman, Jessy Lin, Mayee Chen,
  Neel Guha (Columbia Law / Engram), Shizhe He

Raw recon facts from first-pass exploration (Fable, live clone):

- Synthetic law firm "Calderwood & Harkness" (C&H): 46 clients, 266 matters,
  ~100M tokens, 250 firm-knowledge tasks. Full LAB repo: 1,671 tasks across
  24 practice areas + contracts + diligence; firm-knowledge slice is 517MB of
  the 5.3GB clone.
- Corpus census (`tasks/firm-knowledge/dms/matters/`): 9,288 files — 8,055
  docx / 615 eml / 573 xlsx / 45 pptx. Real Office binaries (Word 2007+ zip),
  NOT plain text. Harness grep reads raw bytes ⇒ grep over the corpus is
  near-blind by design. Jeff Huber's "ripgrep 100M tokens in <500ms" thread
  reply misses this.
- Matters generated from ~1,000-token specs carrying "features" (10% escrow,
  HSR second request, dismissed litigation) pinned to specific documents;
  ground truths computed from feature mix. Generation pipeline NOT in repo —
  only rendered output.
- Eval: rubric inline in task.json; all-pass LLM-judge scoring
  (claude-sonnet-4-6 default, optional dual-judge with gpt-5.5);
  criterion-scoped deliverables. "A diligence memo that catches 95% of issues
  but misses one material one is not 95% useful — it's wrong."
- Baselines (GPT-5.6-sol, Opus-4.8): ~half criteria satisfied, 5+ min/task,
  regress to 0% all-pass as enumeration size grows. Diagnosis: stopping
  failure, not search failure — agents lack an intermediate model of corpus
  contents. Harvey/Engram's proposed direction: amortized indexes / summaries
  / memory over the persistent corpus.
- Task 200 is literally a conflicts check ("have we ever been adverse to
  Vantor Holdings Corp.?") — a real OIP-practice workflow shape.
- Harness: 151-line agent loop, sandboxed tools (read parses
  docx/xlsx/pptx/pdf), per-format skill manuals (Anthropic-skills style),
  adapters for 6 providers (anthropic, openai, google, mistral, fireworks,
  baseten).

Initial gold hypotheses (to be mined properly by the workflow):

1. Free graded testbed for the beep knowledge-engine bet (cognee / knowledge
   vault / legal-patent-kg / epistemic) — external benchmark that measures our
   differentiator (amortized corpus representations).
2. Spec→feature→render synthetic corpus generation is a schema-first pattern
   to port to Effect Schema — could generate patent-prosecution-shaped
   synthetic corpora for OIP evals with zero confidentiality exposure.
3. Eval methodology (all-pass, criterion-scoped judges, dual-judge, rubric
   discipline) ports to beep qa / evidence-loop judge inventories.
4. The 250 task.jsons are a product-requirements catalog for legal DMS /
   knowledge tooling (precedent banks, conflicts checks, client-preference
   mining).
5. Harness itself is a clean minimal reference; Engram collaboration is prior
   art for agent-memory-tiers-bitemporal-edges.

Constraint: corpus is 100M tokens — mining agents must work the code / docs /
task set and only sample `dms/` matters, never sweep it.

## 2026-08-08 — mid-run directive (Benjamin, while the mining workflow ran)

Verbatim: "I think it worth our time to potentially leave a record in the
exploration & any graduated goals that this knowledge corpus can and should
be leveraged to test various aspects of our project against. Injestion,
retrieval, etc. I think it's the right move to use their eval code as
reference material for an even better one we roll our selves."

→ recorded as two pre-seeded decisions in [DECISIONS.md](./DECISIONS.md)
(standing-test-asset; eval-as-reference-for-roll-our-own).
