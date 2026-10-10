# Provider spike factual and reproduction review

Terminal result: **0 actionable findings** after the reproduction fix below.

Reviewed `research/spike/README.md`, top-level `RESEARCH.md`, `README.md` and
`DECISIONS.md` against the captured Cursor and Agent Relay receipts, plus their
packaged probe sources and reproduction notes. Review scope is the factual
Cursor/Relay claims, comparison fairness, input boundaries and source
reproducibility. Other provider measurements are outside this receipt's
independent validation scope.

## Resolved finding

**P2 — copied probes did not use the promised fresh cache.** The top-level
recipe instructed a new owned cache, while Cursor/Relay sources wrote to their
original fixed capture directories. The packaged copies now require explicit
`BEEP_SPIKE_ROOT`, constrain its resolved location strictly below
`~/.cache/beep`, and refuse the original captured provider directory. The
provider recipes create fresh roots and install/copy the scripts there. Cursor
loads its exchange source beside the script. Session-only retains only its own
identity, and resume-only no longer stamps the historical plan barrier into a
future load result. These changes preserve the original measured receipts.
Packaged sources were hardened after the original run; no operational success
is claimed for the hardened copies.

## Factual conclusions

- Cursor initialization, session creation, exact model selection and explicit
  ask-mode setting are supported by the receipts. One prompt produced the plan
  barrier and `end_turn`; successful generation, five idle exchanges, busy
  queue/steer/cancel and existing IDE attachment remain unproved. The owned
  restart/load failure is specific to the denied session.
- Relay results use the actual npm 13.2.0 broker in local-only mode and the
  published harness session class with synthetic fixtures. Local acceptance,
  durable deferred queue recovery and duplicate suppression do not establish
  provider/model delivery, task completion or existing app attachment.
- Relay's disabled remote capabilities, rejected absent recipient, audit-only
  retention and missing full backend comparison are explicit. The comparison
  supports a scoped native-first decision without claiming a full Relay
  deployment failed an equivalent benchmark.
- npm release 13.2.0 and source reference
  `5b30a69d7ac62190e89f8b1e13ccbd9a38a3a2db` remain distinct provenance;
  byte equivalence is unproved. Top-level pins are reproducible, while the
  omitted lockfile means transitive resolution may vary.
- Existing app sessions, ChatGPT Desktop/Work backing identity, cloud/web
  conversations, managed new sessions and persisted resume remain separate
  claims. Neither Cursor nor Relay establishes the existing-app gate.

## Validation boundary

No models, broker, provider tools or existing sessions were rerun during this
review or packaging correction. Only static validation was performed:

- Python AST parsing: five probe sources passed.
- `node --check`: both Relay `.mjs` sources passed.
- Targeted `biome check --write`: two Relay sources checked, exit 0; style and
  formatting findings repaired. Two `noUndeclaredEnvVars` warnings remain for
  standalone `BEEP_SPIKE_ROOT` usage. These scripts are explicitly outside
  Turbo tasks; no Turbo/global configuration was changed.
- Cursor/Relay publication scan: no absolute home path, literal UUID,
  credential-shaped API key or generated broker token matched. Raw private
  logs and installed dependencies are absent from the packaged sources.

These checks validate syntax, source boundaries and sanitized publication;
they do not validate runtime behavior of the hardened copies or replace the
original captured measurements.
