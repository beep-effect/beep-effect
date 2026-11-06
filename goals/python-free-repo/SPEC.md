# Remove Python from the repo, port photo-face to onnxruntime-node, and ban Python in tracked source Spec

## Objective

No tracked `*.py` file remains in the repository, and none can be committed again. Python that
still has a runtime consumer (a workflow, systemd timer, skill, hook, package script or packet
`ops/` manifest) is ported to TypeScript: Effect code where it is repo tooling, vanilla
TypeScript where it is a packet-local script. One-shot probes whose outputs are already recorded
in their packet are deleted with a ledger note pointing at the retained output. The
`beep files match-person` feature is kept by porting `packages/tooling/tool/cli/python/photo-face`
to Effect over `onnxruntime-node` and `sharp` with the same ONNX model pins. A `beep lint laws`
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

| Location | Count | Default disposition (triage confirms per file) |
| --- | --- | --- |
| `packages/tooling/tool/cli/python/photo-face` | 13 | port to `@beep/repo-cli` Files commands over `onnxruntime-node` (new `packages/tooling/library/face-embedding` if the surface warrants it) |
| `packages/foundation/modeling/markdown/scripts/extract-gfm-corpora.py` | 1 | port to a package script in TypeScript |
| `.claude/skills/plasma-sensitive-entry/scripts/*.py` | 4 | port to TypeScript over `effect/process` driving `kdialog`; the skill's install step updates |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1 | port to TypeScript (`bun` runnable from the skill) |
| `apps/labs/ciops/scripts/*.py` | 2 | port to the app's test or script surface |
| `scripts/test-gitleaks-observation-digest.py` | 1 | vitest in the owning package (`scripts-to-beep-cli` coordinates) |
| `goals/*/ops/*.py` still run by timers or commands | triage | port |
| `goals/*/ops`, `goals/*/research`, `explorations/*` one-shot probes | majority | delete, ledger note per packet naming the retained outputs |

New: lint law `no-tracked-python` in `beep lint laws`; lefthook pre-commit rule; hosted check
(cheap tier) running the law; `AGENTS.md` Code Laws line: "No Python in tracked source; run it
outside the repo if you must, never commit it."

## Constraints

- Triage is evidence-based: a file is "still run" only if `rg` finds a consumer in workflows,
  `scripts/systemd`, `~/.config/systemd/user` units committed to the repo, skill `SKILL.md`
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

_No decision files yet._

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
