# Lane R4 — live practice sweep (grok)

You are a live-web research lane for an exploration packet formalizing monorepo
CI/verification scheduling. Produce a current-practice sweep (2025-2026 weighted):

1. Turborepo internals as they stand NOW: `turbo query affected`, per-package external
   dependency hashing (hashOfExternalDependencies), bun.lock support maturity, global
   inputs semantics, cache posture flags — anything that changed in 2.x recently.
2. Fleet CI patterns at scale: merge queues (GitHub merge queue, Mergify), Bazel
   RBE/remote-cache fleets, Nx Cloud distributed task execution — how they arbitrate
   shared compute across many contributors/agents; admission and fairness mechanisms.
3. LLM agent fleets doing software verification, 2025-2026: published practice on many
   coding agents sharing CI on one repo/machine — scheduling, wasted-work handling,
   time-to-feedback optimization. X/Twitter engineering threads count as sources when
   attributed.
4. Anything on "ontology/knowledge-graph-driven CI" or semantic build systems — does
   prior art exist for computing CI pipelines from a reasoned domain model?

OUTPUT: a Markdown report, dated 2026-08-27, four sections matching the above, each with
attributed sources (author/handle + platform + date). CITATION DISCIPLINE: only sources
you actually saw; mark inference as [INFERENCE]; never fabricate a URL or a thread.
1200-2500 words. Wrap lines under 100 chars. Output ONLY the report markdown.
