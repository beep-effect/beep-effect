# Status-Token Census — P0 Ground Truth

Freshness: 2026-07-11, branch `feat/goals-doctor` (from `main` @ 53f5bb53a2).
This census is the migration's ground truth per `SPEC.md`; it supersedes the
approximate figures in `SOURCES.md`. Re-run by copying the script block below
into a shell at the repo root.

Oracle check: `total_packet_dirs=83` equals `with_manifest=78` +
`without_manifest=5`. ✔

## Census script

```bash
#!/usr/bin/env bash
# Status-token census over goals/ — P0 ground truth for goals/goals-doctor.
# All globs exclude goals/_template (it is a scaffold, not a packet).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

manifests() {
  for f in goals/*/ops/manifest.json; do
    case "$f" in goals/_template/*) continue ;; esac
    echo "$f"
  done
}

echo "## 1. Packet directories (excluding _template)"
PACKETS=$(find goals -mindepth 1 -maxdepth 1 -type d ! -name _template | sort)
TOTAL=$(echo "$PACKETS" | wc -l)
echo "total_packet_dirs=$TOTAL"
echo

echo "## 2. Manifest presence"
MISSING=()
HAVE=0
for d in $PACKETS; do
  if [ -f "$d/ops/manifest.json" ]; then HAVE=$((HAVE+1)); else MISSING+=("$d"); fi
done
echo "with_manifest=$HAVE"
echo "without_manifest=${#MISSING[@]}"
for m in "${MISSING[@]:-}"; do [ -n "$m" ] && echo "  missing: $m"; done
echo

echo "## 3. initiative.status token distribution"
manifests | while read -r f; do jq -r '.initiative.status // empty' "$f"; done \
  | sort | uniq -c | sort -rn
echo

echo "## 4. Packets using a bare top-level status field (no initiative.status)"
manifests | while read -r f; do
  jq -r 'select((.initiative.status // "") == "")
    | input_filename + "\tstatus=" + (.status // "ABSENT" | tostring)' "$f"
done
echo

echo "## 5. lifecycle field distribution and disagreement with status"
echo "### lifecycle values:"
manifests | while read -r f; do jq -r '.lifecycle // "ABSENT"' "$f"; done \
  | sort | uniq -c | sort -rn
echo "### disagreements (initiative.status or bare status != lifecycle, both present):"
manifests | while read -r f; do
  jq -r 'select(.lifecycle != null)
    | (.initiative.status // .status // "") as $s
    | select($s != "" and $s != .lifecycle)
    | input_filename + "\t" + $s + " != " + .lifecycle' "$f"
done
echo

echo "## 6. Phase status token distribution (array- and object-shaped phases)"
manifests | while read -r f; do
  jq -r '(.phases // []) | if type == "array" then .[] else .[] end
    | .status // "ABSENT"' "$f" 2>/dev/null
done | sort | uniq -c | sort -rn
echo "### manifests with object-shaped (record) phases:"
manifests | while read -r f; do
  t=$(jq -r 'if has("phases") then (.phases | type) else "none" end' "$f")
  if [ "$t" = "object" ]; then echo "  $f"; fi
done
echo

echo "## 7. schemaVersion distribution"
manifests | while read -r f; do jq -r '.schemaVersion // "ABSENT"' "$f"; done \
  | sort | uniq -c | sort -rn
echo

echo "## 8. Manifests with no initiative object at all"
manifests | while read -r f; do
  jq -r 'select(.initiative == null) | input_filename' "$f"
done
echo

echo "## 9. Active-ish packets missing GOAL.md"
manifests | while read -r f; do
  d=$(dirname "$(dirname "$f")")
  s=$(jq -r '.initiative.status // .status // .lifecycle // "unknown"' "$f")
  case "$s" in
    active*|v2-active|in-progress|pending*|bootstrapped*)
      [ -f "$d/GOAL.md" ] || echo "  $d (status=$s)" ;;
  esac
done
echo

echo "## 10. README Lifecycle-line coverage"
echo "### READMEs with no recognizable 'Lifecycle:' status line:"
NOLINE=0
for d in $PACKETS; do
  [ -f "$d/README.md" ] || { echo "  NO README: $d"; continue; }
  if ! grep -Eq '^Lifecycle: ?.+' "$d/README.md"; then
    echo "  $d"
    NOLINE=$((NOLINE+1))
  fi
done
echo "readmes_without_lifecycle_line=$NOLINE"
echo "### README token != manifest token (raw comparison):"
for d in $PACKETS; do
  f="$d/ops/manifest.json"
  [ -f "$f" ] && [ -f "$d/README.md" ] || continue
  m=$(jq -r '.initiative.status // .status // .lifecycle // ""' "$f")
  r=$(grep -Eom1 '^Lifecycle: ?`?[A-Za-z0-9_-]+`?' "$d/README.md" \
    | sed -E 's/^Lifecycle: ?`?([A-Za-z0-9_-]+)`?/\1/' || true)
  if [ -n "$r" ] && [ "$m" != "$r" ]; then echo "  $d: manifest=$m readme=$r"; fi
done
echo

echo "## 11. GOAL.md size violations (>4000 chars)"
VIOL=0
for d in $PACKETS; do
  [ -f "$d/GOAL.md" ] || continue
  n=$(wc -m < "$d/GOAL.md")
  if [ "$n" -gt 4000 ]; then echo "  $d: $n chars"; VIOL=$((VIOL+1)); fi
done
echo "goal_md_size_violations=$VIOL"
echo
echo "(census done)"
```

## Census output (2026-07-11)

```text
## 1. Packet directories (excluding _template)
total_packet_dirs=83

## 2. Manifest presence
with_manifest=78
without_manifest=5
  missing: goals/agentic-cad-patent-tooling
  missing: goals/dedup-clone-engine
  missing: goals/knowledge-workspace
  missing: goals/repo-codegraph-jsdoc
  missing: goals/trustgraph-port

## 3. initiative.status token distribution
     29 completed-retained
     17 active
      9 complete
      5 superseded
      2 superseded-reference
      1 v2-active
      1 v1-closed
      1 reference
      1 phase1-complete
      1 pending-implementation
      1 p0-p6-implemented-runpod-10-packet-evidence-complete
      1 bootstrapped-phase-1-pending
      1 active-p3-ready
      1 active-p1d-with-open-p1-windows-proof-debt

## 4. Packets using a bare top-level status field (no initiative.status)
goals/agent-governance-control-plane/ops/manifest.json	status=pending
goals/ip-law-knowledge-graph/ops/manifest.json	status=PENDING
goals/nlp-adjunct-port/ops/manifest.json	status=DONE
goals/oip-web-launch/ops/manifest.json	status=implementation_complete_review_pending
goals/oip-web-production-hardening/ops/manifest.json	status=local_hardening_and_oip_s3_rename_applied_provider_dns_gates_remaining
goals/repo-quality-convergence/ops/manifest.json	status=local-proof-complete
goals/trustgraph-doc-ontology/ops/manifest.json	status=pending

## 5. lifecycle field distribution and disagreement with status
### lifecycle values:
     31 completed-retained
     21 ABSENT
     16 active
      6 complete
      4 reference
### disagreements (initiative.status or bare status != lifecycle, both present):
goals/ontology-modeling-foundation/ops/manifest.json	superseded-reference != reference
goals/ontology-workbench/ops/manifest.json	completed-retained != active
goals/repo-cli-modularization/ops/manifest.json	complete != completed-retained
goals/repo-context-topology/ops/manifest.json	superseded != reference
goals/repo-crispening-orchestration/ops/manifest.json	complete != completed-retained
goals/repo-quality-acceleration/ops/manifest.json	superseded-reference != reference
goals/schema-first-zero-actionables/ops/manifest.json	complete != completed-retained
goals/unified-ai-toolchain/ops/manifest.json	v2-active != active
goals/yeet-operator-clarity/ops/manifest.json	superseded != active
goals/yeet-pr-closeout-loop/ops/manifest.json	superseded != active

## 6. Phase status token distribution (array- and object-shaped phases)
    126 completed
    111 complete
     73 pending
     30 done
      6 seeded
      5 planned
      5 PENDING
      5 in_progress
      5 in-progress
      5 DONE
      1 selected
      1 active
### manifests with object-shaped (record) phases:
  goals/effect-native-migration/ops/manifest.json
  goals/ip-law-knowledge-graph/ops/manifest.json
  goals/nlp-adjunct-port/ops/manifest.json

## 7. schemaVersion distribution
     65 initiative-manifest/v1
      7 ABSENT
      6 1.0.0

## 8. Manifests with no initiative object at all
goals/agent-governance-control-plane/ops/manifest.json
goals/ip-law-knowledge-graph/ops/manifest.json
goals/nlp-adjunct-port/ops/manifest.json
goals/oip-web-launch/ops/manifest.json
goals/oip-web-production-hardening/ops/manifest.json
goals/repo-quality-convergence/ops/manifest.json
goals/trustgraph-doc-ontology/ops/manifest.json

## 9. Active-ish packets missing GOAL.md
  goals/agent-governance-control-plane (status=pending)
  goals/agentic-professional-runtime (status=active)
  goals/ai-metrics-stack (status=active)
  goals/beep-schema-topology (status=active)
  goals/canvas (status=active-p3-ready)
  goals/effect-native-migration (status=bootstrapped-phase-1-pending)
  goals/file-processing-capability (status=active)
  goals/repo-codegraph (status=active)
  goals/stack-installer (status=active-p1d-with-open-p1-windows-proof-debt)
  goals/trustgraph-doc-ontology (status=pending)

## 10. README Lifecycle-line coverage
### READMEs with no recognizable 'Lifecycle:' status line:
  goals/agent-effectiveness-loop
  goals/agent-effectiveness-phoenix-enrichment
  goals/agent-effectiveness-workflow-integration
  goals/agent-governance-control-plane
  goals/agentic-cad-patent-tooling
  goals/agentic-professional-runtime
  goals/agent-reflection-loop
  goals/ai-metrics-stack
  goals/beep-schema-topology
  goals/box-driver
  goals/canonical-slice-factory
  goals/canvas
  goals/dedup-clone-engine
  goals/effect-native-migration
  goals/fallow-quality-enforcement
  goals/file-processing-capability
  goals/firecrawl-driver
  goals/ip-law-knowledge-graph
  goals/jsdoc-worker-eval
  goals/knowledge-workspace
  goals/nlp-adjunct-port
  goals/oip-web-launch
  goals/oip-web-production-hardening
  goals/repo-cli-modularization
  goals/repo-codegraph
  goals/repo-codegraph-jsdoc
  goals/repo-context-topology
  goals/repo-quality-convergence
  goals/schema-first-v4-capabilities
  goals/stack-installer
  goals/trustgraph-doc-ontology
  goals/trustgraph-port
  goals/unified-ai-toolchain
  goals/yeet-pr-closeout-loop
readmes_without_lifecycle_line=34
### README token != manifest token (raw comparison):
  goals/codex-security-findings-2026-06-17: manifest=complete readme=active
  goals/ontology-modeling-foundation: manifest=superseded-reference readme=reference
  goals/repo-crispening-orchestration: manifest=complete readme=completed-retained
  goals/repo-quality-acceleration: manifest=superseded-reference readme=reference
  goals/schema-first-zero-actionables: manifest=complete readme=completed
  goals/yeet-operator-clarity: manifest=superseded readme=active

## 11. GOAL.md size violations (>4000 chars)
goal_md_size_violations=0

(census done)
```

## Locked migration mapping (D1/D2 applied to the census)

Canonical domain: `active | paused | completed-retained | superseded | reference`.
Every changed token records its original in top-level `statusNote`
(`legacy status: <token>`); already-canonical tokens are left untouched and get
no `statusNote`.

### `initiative.status` tokens (14 observed)

| Legacy token | Count | Canonical | Note |
| --- | --- | --- | --- |
| `completed-retained` | 29 | `completed-retained` | unchanged |
| `active` | 17 | `active` | unchanged |
| `complete` | 9 | `completed-retained` | D1 |
| `superseded` | 5 | `superseded` | unchanged |
| `superseded-reference` | 2 | `superseded` | D1 |
| `v2-active` | 1 | `active` | bespoke progress string |
| `v1-closed` | 1 | `completed-retained` | D1 |
| `reference` | 1 | `reference` | unchanged |
| `phase1-complete` | 1 | `completed-retained` | D1 |
| `pending-implementation` | 1 | `paused` | D1 |
| `p0-p6-implemented-runpod-10-packet-evidence-complete` | 1 | `completed-retained` | bespoke; reads complete |
| `bootstrapped-phase-1-pending` | 1 | `paused` | D1 (`bootstrapped-*`) |
| `active-p3-ready` | 1 | `active` | bespoke progress string |
| `active-p1d-with-open-p1-windows-proof-debt` | 1 | `active` | bespoke progress string |

### Bare top-level `status` packets (7; migrate to `initiative.status`)

| Packet | Legacy token | Canonical | Evidence |
| --- | --- | --- | --- |
| agent-governance-control-plane | `pending` | `paused` | D1 (`pending`) |
| ip-law-knowledge-graph | `PENDING` | `paused` | D1 (case-normalized) |
| nlp-adjunct-port | `DONE` | `completed-retained` | D1; shipped via PR #199 |
| oip-web-launch | `implementation_complete_review_pending` | `paused` | README: "Implementation complete; launch review pending" — resume condition is the launch review |
| oip-web-production-hardening | `local_hardening_and_oip_s3_rename_applied_provider_dns_gates_remaining` | `paused` | README: provider DNS/Cloudflare/Vercel cutover gates remaining — externally blocked |
| repo-quality-convergence | `local-proof-complete` | `completed-retained` | local proof done; completionGate advisory tracks the unshipped-PR gap |
| trustgraph-doc-ontology | `pending` | `paused` | D1 (`pending`) |

These 7 manifests have no `initiative` object at all (census section 8);
migration creates `initiative` with `id` (existing `slug`/`id`/`name`, else the
directory name), `title` (existing `title`/`name`, else the README H1), and the
canonical `status`, removes the bare `status` key, and leaves every other field
in place.

### Manifest-less packets (5; backfill v2 manifests)

| Packet | README evidence | Backfilled status |
| --- | --- | --- |
| agentic-cad-patent-tooling | "Research complete (2026-05-29)"; deliberately repo-agnostic buyer's guide; no SPEC/PLAN | `reference` |
| dedup-clone-engine | "Complete (V1)" — shipped and merged (PRs #180, #183, #187) | `completed-retained` (completionGate grandfathered: shipped pre-2026-06-30) |
| knowledge-workspace | "Active" — design/spec packet | `active` (GOAL.md/staleness advisories expected) |
| repo-codegraph-jsdoc | "Exploratory" — synthesis collection feeding a future slice | `reference` (`statusNote: legacy status: exploratory`) |
| trustgraph-port | "Pending" | `paused` |

### Phase status tokens (12 observed; D2 domain `pending | in-progress | complete`)

| Legacy | Count | Canonical |
| --- | --- | --- |
| `completed` | 126 | `complete` |
| `complete` | 111 | `complete` (unchanged) |
| `pending` | 73 | `pending` (unchanged) |
| `done` | 30 | `complete` |
| `seeded` | 6 | `pending` |
| `planned` | 5 | `pending` |
| `PENDING` | 5 | `pending` |
| `in_progress` | 5 | `in-progress` |
| `in-progress` | 5 | `in-progress` (unchanged) |
| `DONE` | 5 | `complete` |
| `selected` | 1 | `in-progress` |
| `active` | 1 | `in-progress` |

Phase normalization applies to both array-shaped `phases` (60 manifests) and
object-shaped `phases` records (3 manifests: effect-native-migration,
ip-law-knowledge-graph, nlp-adjunct-port). 15 manifests have no `phases` field;
their bespoke progress surfaces (`phase0`/`phase1`, `phaseStatus`,
`proofStages`, ...) keep their wire shape untouched.

## Structural notes feeding P1

- **schemaVersion:** 65 `initiative-manifest/v1`, 6 `1.0.0`, 7 absent. The
  `GoalManifest` decoder accepts all three plus `initiative-manifest/v2`;
  migration does not bump versions (non-v2 stays a doctor advisory), except
  the 5 backfilled manifests and this packet's own manifest, which are born v2.
- **lifecycle:** present on 57 manifests, 10 of them disagreeing with the
  status field today (census section 5). Migration rewrites `lifecycle` equal
  to the canonical status where the key exists and never adds it where absent.
- **README `Lifecycle:` lines:** 49 packets carry a recognizable
  `Lifecycle:` line (all consistent post-migration rewrite); 34 do not —
  those become baselined doctor findings, and `set-status` refuses them with a
  typed error until the line is added by hand (SPEC constraint: never guess an
  edit site).
- **GOAL.md:** 10 active-ish packets lack `GOAL.md` (census section 9 — the
  audit's 7 plus agent-governance-control-plane, effect-native-migration, and
  trustgraph-doc-ontology whose statuses map to `paused`; the advisory only
  fires for `active`). Zero GOAL.md size violations.
- **Wire-shape sprawl:** 60+ distinct top-level key sets across 78 manifests;
  `GoalManifest` therefore has a small required core (`initiative.id`,
  `initiative.status`) and optional/lenient everything else. Unknown keys are
  ignored on decode; migration edits JSON surgically (jsonc-parser
  modify/applyEdits) so untouched bytes stay untouched.
