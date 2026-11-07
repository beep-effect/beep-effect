# Capture

<!--
Stage 0. Append-only raw dump. New material goes under a new dated heading at
the bottom.
-->

## 2026-11-06

Operator ask, paraphrased: do for the Nov-5 aggregation what we did for the
October corpus, and improve the workflow with `/adhd`, `/deep-research`, the
alphaXiv MCP, and VidBee transcript extraction. Traverse links in every
source and download contained sources, but only to 2-hop depth. Make the
workflow ontologically based. Also: Box holds research never downloaded.

### Local corpus: `<research-root>/Research Aggregation November 5th 2026/` (the operator research root under the home directory)

332 files, 5.5 GB, 835 unique URLs across its Markdown.

- 20 `beep-effect-nightly-*.md` (2026-10-17 to 2026-11-05; five variants of
  11-05 named `(1)`..`(4)`). None of these dates are in the library's two
  intakes (2026-10-06, 2026-10-14).
- 3 PDFs: `2604.27713v1.pdf`, "Deterministic Legal Agents: A Canonical
  Primitive API for Auditable Reasoning over Temporal Knowledge Graphs",
  "Multi-View Contract Graph".
- `OTHER_ALPHA.md`: a bare link list (Neo4j ontology spec, Anthropic
  harness/multi-agent posts, Advisor tool, Google sleep framework, ...).
- `Videos/`: 24 channel folders, 38 `.mkv`, 39 `.vtt`, 45 `.md`. The `.md`
  files are VidBee `generate-faq` outputs (frontmatter: `skill`, `model:
  gpt-6.1-sol`, `generated_at`, `media`, `source_url`). Most of the 5.5 GB is
  the `.mkv` files.
- `Research-11-5-26/`: a private Discord DM archive (50 messages, 9
  attachments, a silent walkthrough video sampled at 13 frames, two linked
  Claude artifacts, a 70-file repo snapshot, `MANIFEST.sha256`,
  `ANALYSIS.md` with proposed amendments to `protocol-as-value` and the
  oracle-loop POC). Its README says: do not publish into the public repo.

URL hosts (top): github.com 408, arxiv.org 213, effect.website 86,
youtube.com 56, discord.com 51, nextgov.com 35, x.com 30, harvey.ai 26,
npmjs.com 22, skillsovermcp.com 22, linkml.io 19, w3.org 16, jonesday.com 16,
newreleases.io 16, everpod.ai 16, beep-effect.com 15.

### Box (`https://app.box.com/folder/0`), surveyed via the Box MCP

- Root: 34 `beep-effect-nightly-*.md` from 2026-09-13 to 2026-11-05. 18
  dates exist nowhere on disk (09-13, 09-25, 09-28, 10-01, 10-02, 10-04 to
  10-12, 10-16, 10-21, 10-26, 11-01). One misnamed
  `beep-effect-nightly-26-11-04.md` has the same byte count as 11-04.
- `IP_LAW_ONTOLOGY_RESEARCH/`: 449 PDFs dated 2026-06-02, snake_case names,
  many hash-suffixed duplicates, some off-topic strays (virology, MIMO). Not
  the `academia-2026-07` corpus (0/5 filename probes matched its `srcPath`s);
  partial overlap with the local 153-file
  `legal-patent-ontology-knowledge-graph-and-related-research/`.
- `beep-spikes/arxiv-2610.01553v1-public-sample.pdf`.
- Not research: client and firm folders, four `.zip` archives, `pr1174-*`
  review artifacts, `claude-code-prompt-x-follow-fix.md`, an empty
  `beep-vault/`, QA evidence, one empty canvas.

### Observations worth keeping

- The library already has two intakes and maintained CLI
  (`beep research library ...`); the Nov corpus is a clean third intake.
- The VidBee `.md` files are ready-made import manifests: they carry
  `source_url`, `media`, model and timestamp.
- `OTHER_ALPHA.md` is hop-0 with zero prose: every link is a hop-1 source by
  construction.
- The 11-05 nightly variants and the hash-suffixed PDFs are two different
  duplicate shapes (near-duplicate revisions vs byte-identical copies).
