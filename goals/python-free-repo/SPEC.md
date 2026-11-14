# Remove Python from the repo, port photo-face to onnxruntime-node, and ban Python in tracked source Spec

## Objective

No tracked `*.py` file remains in the repository, and none can be committed again. Python that
still has a runtime consumer (a workflow, systemd timer, skill, hook, package script or packet
`ops/` manifest) is ported to TypeScript: Effect code where it is repo tooling, vanilla
TypeScript where it is a packet-local script. One-shot probes whose outputs are already recorded
in their packet are deleted with a ledger note pointing at the retained output. The
`beep files match-person` feature is kept by porting the former Python photo-face worker into
`packages/tooling/tool/cli/src/commands/Files/internal/` as Effect code over `onnxruntime-node` and `sharp` with the same ONNX model pins. A `beep lint laws`
law, a lefthook pre-commit check and a hosted CI check fail on any tracked `*.py`.

Graduated 2026-11-06 from `explorations/pulumi-to-alchemy` (grill session decisions D4, D8, D15);
sibling of `infra-alchemy-rebuild` and `scripts-to-beep-cli`. Operator rationale: Python is a
separate dependency and supply-chain surface the repo should not carry; agents may still run
Python outside the repository, never commit it.

## Non-Goals

- Porting Python that lives in `infra/r2-cache` (deleted wholesale by `infra-alchemy-rebuild`).
- Rewriting the Python ONNX models themselves; the pinned model files and their checksums stay.
- Banning Python from agents' scratch directories or from `~/.cache/beep`.
- Shell scripts (`scripts-to-beep-cli` owns the shell allowlist law).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

Inventory at graduation (`git ls-files '*.py'`, 2026-11-06): about 290 files.
Completed ports below name their current TypeScript runner.

| Location | Count | Default disposition (triage confirms per file) |
| --- | --- | --- |
| Former Python photo-face worker, ported into `packages/tooling/tool/cli/src/commands/Files/internal/` | 13 | port to `@beep/repo-cli` Files commands over `onnxruntime-node` (new `@beep/face-embedding` if the surface warrants it) |
| `packages/foundation/modeling/markdown/scripts/extract-gfm-corpora.ts` (ported from the former Python script) | 1 | port to a package script in TypeScript |
| `.claude/skills/plasma-sensitive-entry/scripts/*.ts` | 4 | ported to TypeScript over `effect/process` driving `kdialog`; the skill's install step updated |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.ts` | 1 | ported from Python to TypeScript (`bun` runnable from the skill) |
| `apps/labs/ciops/scripts/*.py` | 2 | port to the app's test or script surface |
| `test-gitleaks-observation-digest.py` (retired) | 1 | ported to `packages/tooling/tool/cli/test/gitleaks-observation-digest.test.ts` (`scripts-to-beep-cli` PR #2860) |
| `goals/*/ops/*.py` still run by timers or commands | triage | port |
| `goals/*/ops`, `goals/*/research`, `explorations/*` one-shot probes | majority | delete, ledger note per packet naming the retained outputs |

New: lint law `no-tracked-python` in `beep lint laws`; lefthook pre-commit rule; hosted check
(cheap tier) running the law; `AGENTS.md` Code Laws line: "No Python in tracked source; run it
outside the repo if you must, never commit it."

## Constraints

- Triage is evidence-based: a file is "still run" only if `rg` finds a consumer in workflows,
  `packages/tooling/tool/cli/src/internal/repo-run/AgentRunsSlice.ts`, `~/.config/systemd/user` units committed to the repo, skill `SKILL.md`
  text, hooks, package scripts or a packet `ops/manifest.json`; record the consumer in the
  triage table under `research/`.
- Ports are behaviour-preserving: each ported script carries a test that replays a recorded
  input/output pair from the original where one exists.
- photo-face parity: embeddings produced by the TypeScript port for the saved fixture faces
  match the Python embeddings within a recorded cosine tolerance; detection boxes and quality
  scores are compared on the same fixtures. Model downloads stay checksum-pinned under
  `XDG_CACHE_HOME/beep/photo-face`.
- Deletions of packet Python are one commit per packet with the ledger note in that packet's
  `research/OPPORTUNITIES.md` or `history/`.
- The ban is a law with no allowlist. A future need for Python is a new decision, not an exception row.

## Acceptance Criteria

- [ ] `git ls-files '*.py'` is empty on `main`.
- [ ] `bun run beep lint laws` fails on a fixture repo containing a tracked `.py` and passes on `main`;
      lefthook blocks a commit adding one; the hosted cheap-tier check runs the law.
- [ ] `beep files match-person` runs end to end without Python on Linux x64 with parity evidence
      recorded under `research/`.
- [ ] The `plasma-sensitive-entry` and `ontology-foundational-auditor` skills work from their
      TypeScript scripts.
- [ ] A triage table under `research/` lists every deleted or ported file with its consumer (or
      "none, output retained at <path>").
- [ ] `AGENTS.md` carries the one-line law.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/python-free-repo/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/python-free-repo/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/python-free-repo` | Passes |
| No Python | `test -z "$(git ls-files '*.py')"` | Passes |
| Law | `bun run beep lint laws` | Passes |
| photo-face parity | `bun run beep files match-person --fixtures test/fixtures/photo-face` evidence | within tolerance |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add python-free-repo --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug python-free-repo`; add a `kind: decision` file there, never edit this block._

### Paused by operator ruling (finish board, 2026-11-13): Hygiene work with no execution yet and no urgency, 2026-11-13

Operator ruling on 2026-11-13 (about 05:20Z, in the orchestrator session, from the Goal Finish Board triage). The ruling sets this packet to `paused`.

Triage rationale: Hygiene work with no execution yet and no urgency.

No lane is working on it. Resume with `bun run beep goals set-status python-free-repo active` when it is picked up.

Lane chore/finish-board-pause-b1

Reverse: goals set-status python-free-repo active when it is picked up

### Split the work into three PRs plus a final law PR, 2026-11-13

The packet allows three concurrently open PRs. Lane 1 (chore/python-free-repo): triage, per-packet probe deletion, small ports (ciops CQ checks into vitest, markdown corpus extractor, cloud-agent-readiness helpers, compute-profile renderer), the heavy.yml/fleet-shadow-check workflow Python and infra/r2-cache. Lane 2 (Codex Sol): photo-face to onnxruntime-node. Lane 3 (Codex Sol): .claude/skills scripts. The no-tracked-python law, lefthook, cheap-tier check and AGENTS.md line land last on chore/python-free-repo-law, because the law fails on main until every lane has merged and heavy.yml is consumed at @main (its old script can only be deleted after the switch merges).

Lane chore/python-free-repo

Reverse: Fold remaining lanes into one PR

### Generate fixed AdaFace ONNX graphs from the existing safetensors pins, 2026-11-13

Port the fixed DFA MobileNet and 24-block ViT KP-RPE inference graphs to a typed TypeScript ONNX writer. Retain the exact source SHA-256 pins, generate graphs locally, and key the cache by both source hashes and graph version. Preserve the 25% context crop and 0.20 confidence floor. No remote executable code or separately hosted graph is admitted.

Lane t3/python-free-photo-face

Reverse: Restore the prior photo-face implementation from the parent commit.

### Preserve Buffalo preprocessing and pinned artifact provenance, 2026-11-13

Run the original det_10g.onnx and w600k_r50.onnx pins with CPUExecutionProvider. Port SCRFD decoding and NMS, five-point similarity alignment, OpenCV-compatible bilinear resampling, embedding normalization, quality flags and aggregate scoring. Keep existing report schemas and failure reasons, extending AdaFace runtime provenance to admit ONNX while retaining decoding of historical PyTorch reports. Photo-face parity evidence is in research/photo-face-parity.md.

Lane t3/python-free-photo-face

Reverse: Restore the prior Buffalo worker from the parent commit and its retained external parity reference.

### Run photo-face on CPU with onnxruntime-node and sharp, 2026-11-13

Add onnxruntime-node 1.31.1 through the root catalog and use the existing sharp catalog dependency. CPUExecutionProvider is the sole provider. Delete compute and devices CLI flags and the ROCm/uv environment machinery; retain actual CPU provenance in reports. Buffalo uses the unchanged det_10g and w600k_r50 ONNX pins with SCRFD decoding, NMS, similarity alignment and normalized embeddings.

The fixed CPU graphs execute one face per call. Remove the batch-size flag as well, and report the actual batch size of one rather than retain a no-op batch control. Historical report schemas remain readable.

Lane t3/python-free-photo-face

Reverse: Revert this lane and restore its Python environment and CLI flags.

### Add native CPU inference and bounded ZIP decoding dependencies, 2026-11-13

Pin onnxruntime-node 1.31.1 in the root catalog and add it to repo-cli. Reuse catalog sharp and fflate 0.8.3; fflate extracts only the bounded checksum-pinned Buffalo entries from the original verified ZIP. No new model hosting or model artifact is introduced. Python implementation scripts are package-owned implementation hooks rather than generated task aliases; remove those two dead hooks and regenerate the remaining scripts through package-scripts --write.

Lane t3/python-free-photo-face

Reverse: Revert the lane catalog, dependency and lockfile changes together.

### Port the live infra/r2-cache Python in this goal instead of waiting for infra-alchemy-rebuild P6, 2026-11-13

SPEC lists infra/r2-cache Python as a non-goal because infra-alchemy-rebuild deletes it. That packet is at P1 and deletes r2-cache only at P6, while policy_runtime.py (spawned by Cache.adapter.ts) and probe.py (cache-warm.yml) are live. Waiting would hold acceptance item 1 (no tracked .py on main) open indefinitely. This goal ports the live scripts to repo-cli TypeScript and deletes the one-shot ones; infra-alchemy-rebuild later deletes TypeScript instead of Python. Details: research/r2-cache-port.md.

Lane chore/python-free-repo

Reverse: Restore infra/r2-cache/*.py from 05ed8bc6b6cc and point Cache.adapter.ts and cache-warm.yml back at them

### Retire the Python-only validators named by completed packets instead of porting them, 2026-11-13

Three checks could only be regenerated by deleted Python. (1) ciops-ontology-pipeline (completed-retained): its completionGate.statement names the explorations validate_packet.py runs (base, --s5, --s6) and run_cq_suite.py. That gate passed when the packet closed, so it is historical evidence; the four Python verificationCommands are dropped and provenance.note points at explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md. (2) citation:parity-check: the ledgers and divergences components print RETIRED. Their pinned digests of TypeScript proof sources were already stale on main before this goal (for example Dump.ts and use-cases/src/server.ts hash the same on origin/main and on this branch, but not as the fixtures pin), and only the deleted export-ledgers.py and export-divergences.py regenerate those projections. (3) The other parity components and the law-practice-server citation tests now compare the recorded producer digests against constants from the recovery commit instead of reading the deleted bytes.

Lane chore/python-free-repo · PR #3296

Reverse: git show 05ed8bc6b6cc:<path> restores any retired validator; port it to TypeScript before running it

### Run standalone skill ports and parity tests with Bun, 2026-11-13

This lane ports only the Python in the four assigned skills. No existing TypeScript skill-script test precedent was found. Use bun:test, strict standalone TypeScript checking, and root node_modules without a workspace build. Preserve the validator checks through a direct TypeScript lowering with a local data-semantics namespace in the same digest-locked file; no Python interpreter or source evaluator remains. Retain all 103 original self-test assertions and replay recorded Python output digests for normal, gate, and repository-fidelity runs on the existing beep-ci-ops extraction tree. Its existing violations are parity evidence, not a green ontology acceptance. Harness plan output and original synthetic host classifiers are replayed offline.

The YAML boundary also replays 25 scalar results from the original loader. Preserve integer versus
float identity, the original exponent and sexagesimal grammars, Python whitespace and Unicode
ordering, rejection of unsupported tags and merge keys, and shared/cyclic alias identity. Authority
UTF-8 decoding remains strict. These details feed the validator's existing exact-type guards;
coercing a YAML float such as `1.0` into a JavaScript integer would weaken those guards.

Reverse: Revert this lane commit to restore the Python skills and their commands

### Preserve Plasma FIFO delivery and sandbox TypeScript adapters, 2026-11-13

Use the current Effect process leaves and scoped owned-process cleanup for kdialog. Linux pipe2 creates an actual inherited FIFO because generic child-process extra pipes can be sockets; only the write descriptor is inherited, with no secret in argv, env, logs, or files. Bun FFI is limited to pipe2, fcntl, and the harness flock lock. Bun native PTYs replace Python openpty for fleet auth. Tests use synthetic dialogs only. The ontology sandbox binds the resolved native Bun executable read-only, runs TS adapters with --smol under the existing 2 GiB address-space limit, and disables automatic env-file and bunfig loading. Repository adapters stay provenance copies; only externally authored, owned, non-writable trusted adapters execute.

Reverse: Revert the skill transport and sandbox changes together with their documentation

### Migrate the validator CLI regression consumer with its runner, 2026-11-13

The operator explicitly included packages/tooling/tool/cli/test/ontology-validator-cli-boundary.test.ts in this lane after final-check exposed its reference to the deleted validator. Replace all embedded Python with Bun probes against injected TypeScript argument and rendering boundaries. Preserve missing-repo-operand rejection before validation, valid argument forwarding, control-free flag and violation output, exact escape preservation, and stderr routing for unreadable manifests. The probes never validate ontology artifacts. Run the focused three-test suite and quality package-verify @beep/repo-cli --quick before publishing.

Reverse: Restore the regression consumer together with the prior validator runner

### Accept the new Cache files' coverage rows, as for photo-face, 2026-11-14

Same route as 2026-11-14-photo-face-coverage-rows-accepted. The ratchet flags any uncovered unit in a file with no baseline identity. After the model- and network-free tests, hosted CI (job 132315765397) measures the five new Cache files at or above the repo-cli tier (lines/statements/branches/functions): Cache.adapter.host.ts 96.66/96.13/100/89.87, Cache.diagnostics.ts 98.59/97.33/94.24/94.48, Cache.r2.command.ts 100/96.15/100/85.71, Cache.r2.live.ts 97.89/97.14/94.44/92.1, Cache.r2.ts 100/99.35/91.66/100. What is left uncovered is fallback thunks, error paths that need timing races, and the portable hash fallback the test runtime never takes. beep-reviewer scored that state 5/5 (round 10). The hosted rows are recorded verbatim; later regressions are judged against them.

Lane chore/python-free-repo · PR #3296

Reverse: Delete the five Cache.* rows from standards/coverage.regression-baseline.jsonc and add tests until the ratchet passes without them

### Accept the photo-face new-file coverage rows instead of chasing unreachable units, 2026-11-14

The coverage ratchet flags any uncovered unit in a file with no baseline identity. After the model-free wave-4 tests, the two new files measure on hosted CI (job 132280047144): MatchPerson.onnx.ts 100 / 99.56 / 93.44 / 100 and MatchPerson.inference.ts 97.42 / 97.36 / 98.3 / 91.07 (lines/statements/branches/functions). Both are above the repo-cli tier. The leftover units are fallback thunks and error paths that need native-runtime races; beep-reviewer scored that state 5/5. The ratchet's remediation allows recording reviewer-accepted rows, so the hosted rows are recorded verbatim. Later regressions are still judged against these floors.

Lane feat/python-free-photo-face · PR #3283

Reverse: Delete the two MatchPerson.inference.ts and MatchPerson.onnx.ts rows from standards/coverage.regression-baseline.jsonc and add tests until the ratchet passes without them

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
