You are an inventory scanner for the beep-effect boolean-creep campaign. Work ONLY inside this repo checkout (your current working directory).

LANE: {{LANE}}
ROUND: {{ROUND}}
SOURCE SHA: {{SOURCE_SHA}}
CORPUS FOR THIS LANE — scan ONLY these paths: {{AREAS}}
Exclusions: test files (`*.test.*`, `*.spec.*`, any `test/` directory), generated surfaces (paths containing `_generated`, files whose header says they are generated/codegen), and anything outside the lane paths.

## OUTPUT CONTRACT (binding)

- Report file: `goals/boolean-creep/data/sweeps/{{ROUND}}/{{LANE}}.jsonl`
- CREATE the report file within your first 5 turns (create it empty first if you must) and APPEND one JSON record per line as you decide each suspect. Never buffer everything for the end.
- Do not modify ANY file other than your report file. Do not run package scripts, builds, tests, or installs.
- Before finishing, run the read-only packet validator: `bun goals/boolean-creep/ops/validate-inventory.ts goals/boolean-creep/data/sweeps/{{ROUND}}/{{LANE}}.jsonl`. Repair your report's schema, duplicate-cluster or source-anchor errors; never change canonical inventory to make a raw report pass.
- Your FINAL message must be a short pointer: report path, confirmed/disqualified counts, whether every assigned root was covered, and any seed drift or unresolved source question. Do NOT paste report content into the message.

## THE SMELL

"Boolean creep": code introduces parallel correlated booleans where the domain has ONE state variable. `n` correlated booleans represent `2^n` states; when the domain has `k < 2^n` legal states the type lies, and every reader must re-derive the exclusivity invariant from write sites.

## NET (what counts as a suspect)

Any set of >=2 boolean-typed members in one scope:
- fields of one `S.Struct` / `S.Class` (look for `S.Boolean`),
- members of one type literal or interface (`: boolean`),
- one React component's props,
- sibling boolean atoms/state fields in one module (e.g. several `useState<boolean>`/atom booleans that describe one thing).

Inspect actual instantiated data objects as `object-literal` carriers, including external API option objects for the D2 census. A descriptive locator must point to a real object; inventing a name does not turn unrelated expressions into a carrier. Boolean-valued atoms count by the values they own or compute. Standalone callable predicates, command descriptors and runtime handles are not Boolean members. For E3, inspect real co-carried optional/nullable payloads and their complete declared domains. Do not turn required strings, arrays or numbers into extra Boolean members using arbitrary predicates such as empty/nonempty or zero/nonzero.

Sweep method: use graft first for bounded source discovery and consumer tracing when available. Establish exhaustive lane coverage with the actual source-file inventory and targeted ripgrep for explicit and inferred Boolean/state shapes, including unindexed source. Group hits by their actual owner, then read each cluster's surrounding code before deciding. Chase writers and readers, including sibling files. A ranked graph answer or missing call edge does not establish exhaustive coverage or absence. Cover the whole lane; do not stop after the first few files.

## GATE (decide each suspect)

CONFIRMED requires at least one evidence class, proven by reading the code, with a `file:line` citation:

- E1 exclusive-write — a write site sets one flag true and siblings false in the same operation.
- E2 exclusive-read — `if/else-if` or match over the flags that never handles a combined-true case.
- E3 flag<->payload — a boolean duplicating a sibling field's presence (`{ isError: boolean, error?: E }`). A runtime coherence check is supporting evidence, not E3 by itself; cite E1 or E2 only when the writers/readers prove exclusivity.
- E4 phase implication — ordered flags where one implies another (`finished => started`): a state machine flattened into bits.

DISQUALIFIED (record it for the census, with its class):

- D1 independent flags — all `2^n` combos legal: config toggles, permissions, independently observed facts.
- D2 encoded/wire mirror — the shape mirrors an external SDK/DB/API contract at a driver boundary.

Count alone NEVER qualifies. Establish actual carrier eligibility and supported behavior before classifying. If the evidence does not resolve a classification, identify the unresolved source question in the completion pointer; do not invent either a qualification or a universal D1 legality claim. Function flag PARAMETERS are out of scope entirely — skip them, do not record them.

Judge the owner's actual contract. A raw request can deliberately represent conflicting selections whose specified result is a diagnostic, while a canonical output can reject an impossible stored state. Neither the existence of an error nor permissive schema construction decides that distinction. Read the declared purpose, public adapter, documented examples, diagnostic fixtures and downstream consumers. Do not substitute successful-operation pair counts for the legal input domain, or use request validation as a blanket exemption for other CLI models.

## RECORD SCHEMA

One JSON object per line (JSONL — no pretty printing, no trailing commas). Exactly these shapes:

Confirmed example:
{"schemaVersion":"boolean-creep-inventory/v1","id":"dock-tab-drag-phase","file":"packages/foundation/ui-system/dock-react/src/internal/Gesture.models.ts","line":24,"symbol":"TabDrag","kind":"schema-struct","members":["moved","concluded"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/foundation/ui-system/dock-react/src/DockviewReact.tsx","line":33},"note":"concluded is only written behind a moved guard; readers pair the flags as !moved || concluded."}],"cardinality":{"representable":4,"legal":3},"storage":"stored","exposure":"internal","targetShape":"literalkit","tier":1,"notes":"Phase literal pressed|dragging|concluded."}

Disqualified example:
{"schemaVersion":"boolean-creep-inventory/v1","id":"composer-send-input-gates","file":"apps/professional-desktop/src/chat/ui/ComposerPolicy.ts","line":319,"symbol":"ComposerSendInput","kind":"interface","members":["gateOpen","turnActive"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independent axes; the decideSend if-chain is a priority order over free combinations, not a masked union."}}

Field rules:
- `id`: kebab-case slug derived from the symbol, unique within your report; prefix with "{{LANE}}-" when the symbol name is generic.
- `line`: the line of the first boolean member (or the declaration line).
- `kind`: one of `schema-struct | type-literal | interface | object-literal | props | sibling-state | class-fields`.
- `status`: ONLY `confirmed` or `disqualified`.
- Confirmed records REQUIRE `evidence` (>=1 entries, each with `class`, `cite{file,line}`, `note`), `cardinality`, `storage`, `exposure`, `targetShape`, `tier`. For n Boolean members, `representable` is 2^n. When a real correlated literal domain or optional payload belongs to the cluster, count its actual alternatives: Boolean times three status values is six; optional Boolean can have absent/false/true. Retain every payload value inside its state. `legal` MUST be smaller than `representable` and supported by all relevant writers, readers, constructor defaults and legitimate fixtures.
- Disqualified records REQUIRE `disqualifier{class,note}` and MUST OMIT evidence/cardinality/storage/exposure/targetShape/tier.
- `storage`: `derived` when the booleans are projected from ONE upstream source (an AsyncResult, a date, draft strings, one config object); else `stored`.
- `exposure`: `internal` unless the encoded value is written to disk/db (`persisted`) or crosses an external API/SDK contract (`wire`).
- `targetShape`: `literalkit` (payload-free exclusive variants), `tagged-union` (variants carry different payloads — usually E3), `option-literal` ("none / at most one active" is legal).
- `tier`: 2 for persisted or wire exposure, including a shared internal model whose migration necessarily changes a coordinated encoded consumer. Explain that dependency instead of mislabeling the model's direct exposure. Otherwise 1.

## ALREADY RECORDED — revalidate, avoid duplicate reports

These seed entries are prior adjudications, not exemptions from source verification. Check each assigned declaration still exists, its members share the claimed owner, and its classification remains supported by current writers/readers and constructor contracts. Recheck D1 claims against actual supported behavior and relevant guards. Report corrections or newly encountered clusters; do not repeat unchanged records. A listed member cluster does not exempt other clusters in the same declaration. Keep stable IDs when correcting surviving clusters and explain ineligible seed withdrawals in the completion pointer.

{{SEEDS}}

## CALIBRATION (do not confirm lookalikes of these)

- Independent config/settings toggles, permission/capability flags, feature flags — D1 when their actual supported combinations establish independence.
- Independently observed facts (audit fields, telemetry, prosecution facts) — D1 when source evidence establishes independence; the telemetry label alone is not proof.
- Shapes mirroring GitHub/SDK/DB/upstream-tool wire contracts at driver boundaries — D2.
{{LANE_EXTRA}}
