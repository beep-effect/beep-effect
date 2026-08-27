# Exploration & Goal Packet System Redesign — Sources & Provenance

- **Cluster / origin:** Notion parking-lot page (three research passes done in
  place, 2026-08-10) + Codex deep-research revision of the same page + six
  Grok CLI research lanes (web/GitHub/x.com) dispatched 2026-08-10 + six
  Session B amendment lanes dispatched 2026-08-26.
- **Provenance:** imports copied verbatim under `research/`; Grok raw
  streaming-json transcripts under `research/grok/raw/`, extracted reports
  under `research/grok/`.

## 1. Mined source corpus

Not applicable — no upstream code corpus is mined by this packet; it redesigns
in-repo process machinery.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| github/spec-kit | MIT | reference-only | gate/checklist/clarification structure comparisons |
| mattpocock/skills | MIT | port-with-attribution | grilling frontier-rounds protocol; two-axis code-review; handoff; writing-for-agents (local clone `~/YeeBois/dev/mattpocock-skills` @ 84fdeff; drift audit in [`2026-08-10-pocock-skills-comparison.md`](./2026-08-10-pocock-skills-comparison.md)) |
| sigstore/gitsign | Apache-2.0 | reference-only | keyless commit signing; `gitsign verify` identity semantics |
| in-toto/attestation | Apache-2.0 | reference-only | subject+predicate statement model for receipts |
| ZhangHanDong/agent-spec | (unverified) | reference-only | derived liveness; contract-bound test verdicts |
| qq3g7bad/shtracer, joernpreuss/pytreqt, mafron/tdm, nozomi-koborinai/contextlint | (unverified) | reference-only | anchor conventions + orphan lints for derived trace matrices |
| Priivacy-ai/spec-kitty | (unverified) | reference-only | JSONL-in-git merge-conflict failure case (#569) |
| boshu2/agentops | (unverified) | reference-only | merge-door queueing analysis; two-phase done |
| MrLesk/Backlog.md, antopolskiy/kanban-md, zerowand01/markplane, chr15m/kanban-todo | (unverified) | reference-only | markdown-native board family; dual-writer anti-pattern evidence (lane 7) |
| xyflow/xyflow, dagrejs/dagre, remarkjs/react-markdown | MIT | port-with-attribution (as deps) | v2 dashboard stack candidates (lane 7) |
| humanlayer/humanlayer | Apache-2.0 | reference-only | create_plan/research command shapes; FIC workflow |
| MareaSW/ontoskills (local clone `~/YeeBois/dev/ontoskills` @ f15690a, 2026-05-05) | MIT | reference-only | Violation/Warning SHACL tiers with forward refs as warnings; breaking/additive/cosmetic drift diff with affected-set queries; fleet-wide linter separate from per-node shapes ([`2026-08-25-ontology-tooling-recon.md`](./2026-08-25-ontology-tooling-recon.md)) |
| fabio-rovai/open-ontologies (local clone `~/YeeBois/dev/open-ontologies` @ 339db9a, 2026-08-25) | MIT | reference-only | typed gate certificate shape (Amendment J); plans persisted with owner/id; evidence inside the promoted artifact; validators report reach; probe-actual-shape migrations (same note) |
| SenolIsci/mykg (local clone `~/YeeBois/dev/mykg` @ 5ab1c1b, 2026-08-19) | MIT | reference-only | structurally read-only graph layer; content-addressed shards + `--append`; response-hardening ladder; locked base schema; contrast cases for frontmatter discard, `type+name` identity, path-only provenance (same note) |
| AgentO (w3id.org/agentic-ai/onto, rev 0.2) | CC BY 4.0 | reference-only | design-time agent/task/tool/workflow vocabulary layered on PROV-O, P-Plan, BEAM; four-part prompt split; mapping targets for the JSON-LD projection lane (Amendment I); the Sect. 4 translate-review-amend-rerun migration method ([`2026-08-25-agento-ontology-mapping.md`](./2026-08-25-agento-ontology-mapping.md)) |

## 3. External research sources

Carried inside the two imported documents (each claim is cited inline there):

- [`2026-08-10-notion-strict-planning-three-pass.md`](./2026-08-10-notion-strict-planning-three-pass.md)
  — Software Factory gist, HumanLayer advanced context engineering, OpenAI
  ExecPlans, Anthropic skill best practices, Matt Pocock skills, GitHub
  Spec Kit, EARS, Temporal workflow docs, NASA SE handbook, in-toto/SLSA,
  GitHub artifact attestations, sigstore/gitsign, LeSS queueing theory,
  Mountain Goat DoR critique, TLA+ conformance-test generation.
- [`2026-08-10-codex-deep-research-redesign.md`](./2026-08-10-codex-deep-research-redesign.md)
  — Overeem et al. event-sourcing study, Nygard ADRs, NIST SSDF, GitHub
  protected-review mechanics, gitsign identity-verification warning, OWASP
  XSS/Mermaid securityLevel, WCAG 2.2, GDPR retention tension, fast-check
  model-based testing, StrykerJS.
- [`2026-08-10-pocock-skills-comparison.md`](./2026-08-10-pocock-skills-comparison.md)
  — workflow comparison + vendored-skill drift audit against
  https://www.aihero.dev/skills (scraped 2026-08-10) and the local
  mattpocock/skills clone @ 84fdeff.
- [`2026-08-25-agento-ontology-mapping.md`](./2026-08-25-agento-ontology-mapping.md)
  — Ekelhart, Kurniawan, Ekaputra, Kiesling, "AgentO: An Ontology for
  Modeling Agentic AI Systems", ESWC 2026, LNCS 16550, pp. 298–320
  (doi:10.1007/978-3-032-25159-6_16); ontology Turtle fetched 2026-08-25
  from https://sepses.ifs.tuwien.ac.at/onto/ontology.ttl.
- [`2026-08-25-ontology-tooling-recon.md`](./2026-08-25-ontology-tooling-recon.md)
  — reader + refuting-verifier lanes over the three local clones above;
  operator spot check of the verifiers' "missed" items.
- [`2026-08-26-session-b/README.md`](./2026-08-26-session-b/README.md)
  — index and caveats for three repository audits and three external prior-art
  sweeps behind D20–D23. The six reports preserve their per-claim file/line or
  fetched-link evidence and source logs: H (`C3`, `G3`), I (`C4`, `G1`), and J
  (`C2`, `G2`). All external material is reference-only; no upstream code is
  copied. Primary source families include CWLProv/Workflow Run RO-Crate and
  Nextflow lineage (I), in-toto, EARL/ACT, SARIF, OpenSSF Scorecard,
  CycloneDX, SHACL, and Terraform plan semantics (J), and LangGraph, Google
  ADK, Semantic Kernel, DSPy, GitHub Actions, and OpenInference (H).
- Grok lane reports (all six completed 2026-08-10, each with URLs, dated
  x.com citations, and contrarian evidence): `grok/reports/1-spec-driven-dev.md`,
  `2-agent-plan-gates.md`, `3-event-sourced-control.md`,
  `4-attestation-approvals.md`, `5-traceability.md`, `6-gate-economics.md`.
  Raw streaming-json transcripts + prompts under `grok/raw/` and
  `grok/prompts/`. Synthesis: [`../RESEARCH.md`](../RESEARCH.md).

## 4. In-repo capability references

| Capability | Path | Disposition |
|------------|------|-------------|
| Exploration pipeline convention | `explorations/README.md` | extend |
| Goal packet contract + doctor/index | `goals/` + `beep goals` CLI | extend |
| Hash-chained execution ledger doctrine | `goals/agent-execution-authority` | reuse pattern |
| Yeet attempt journal (JSONL crash/corruption test matrix) | Yeet internals | reuse pattern |
| Docgen proof-manifest memoization | `beep docgen check --reuse-proof-manifest` | reuse pattern |
| Run-state machine | `goals/goal-portfolio-driver` | boundary — packet truth vs driver loop state |
| Property-law lane (`fcRuns`) | `@beep/test-utils` | reuse |
| Ratchet adoption precedent | fallow / schema-first / jsdoc gates | reuse pattern |
| Materialization compiler design | `goals/knowledge-surface-automation` Workstream E | extend, not duplicate |

## 5. Cross-links & provenance

- This packet's `CAPTURE.md` records import provenance.
- Notion `Development Todo's` row is the non-normative mirror of this packet
  (per full-document-editor D27 precedent); this packet is normative.
- Related goal packets: `goals/knowledge-surface-automation` (bootstrap
  compiler), `goals/goal-portfolio-driver` (run state), `goals/goals-doctor`.
