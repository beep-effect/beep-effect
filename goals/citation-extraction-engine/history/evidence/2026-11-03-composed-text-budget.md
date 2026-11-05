# Composed parent text reservations — 2026-11-03

Law metadata composition must retain one allocation ceiling across context,
capture slicing, parenthetical processing and numeric conversion. Independent
stage ceilings alone would let each stage restart the budget. TextBudget.ts
adds one invocation-owned Context.Service using Effect Ref.modify for atomic
reservation, with the existing schema-owned producedTextUtf16 ceiling and shared
admission-policy decoder. It introduces no lock, queue, scheduler or transport.

## Authority and accounting

A reservation atomically accepts only available units. Invalid or oversized
charges leave the counter unchanged. Successful charges are cumulative and
not refunded on downstream failure, interruption or an enclosing transaction
rollback: buffer allocation is external to transaction rollback. Ref is used
for this single external counter rather than adding nested transactional state.
Install a fresh owner per invocation; no global mutable counter is introduced.

RegexInput captures an optional reservation authority at installation. Receiving
source copies and slices reserve before allocation. Pattern installation keeps
its separate pattern budget and does not spend produced text. Later caller
contexts cannot substitute another budget for a captured owner. Standalone
stages preserve their own existing ceiling when no composed owner is installed.
This does not yet install the owner throughout the complete public pipeline.

The context planner previously checked cumulative retained word units after
copying each word. Reserved Unicode preparation now validates borrowed,
immutable native input and invokes its reservation callback before the receiving
copy. It independently validates the owned result and rejects a changed UTF-16
layout before success. Ordinary fromStorage keeps its prior copy-before-scan
snapshot behavior. Reserved text/native methods require no caller services and
accept only trusted allocation callbacks, not function-valued raw request data.

The planner reserves prefix/word copies and its concatenated context. It keeps
all source scanning, negative-index, stop-token and 300-point behavior. These
new word preflights use the existing Unicode owner rather than introducing
transport/source ceilings on words that only contribute a truncated context.
Transport framing, offset-map bytes and child memory remain separately bounded;
this is parent-owned text accounting, not complete physical-memory proof.

## Captured source calendar across invocations

MetadataYear now separates normal Clock/CurrentTimeZone capture from private
installation using an already captured ceiling. A composed invocation can bind
a fresh allocation owner without changing the engine's source import-time year.
The private bound is schema data in 2..10000, exactly one more than a supported
Python date year. It adds no raw request mode or client surface. Existing
source observations parameterize the same source global; no oracle changes or
semantic waiver are introduced.

## Verification

Twenty-two tests pass across TextBudget, TokenContext, PythonUnicode,
MetadataYear and MetadataStrings. They retain the existing 2976 source context
observations, 1169 source year observations and 997 pincite comparisons, plus
actual runtime string-helper smokes. The six new budget tests additionally show:

- Concurrent six-unit charges against ten units admit exactly one; four further
  units reach the boundary. Invalid charges and invalid policies are rejected.
- A caller transaction failure does not refund three externally reserved units.
- Receiving and slicing share one counter; later caller budget substitution
  cannot reset it, and pattern installation leaves it unchanged.
- Two six-unit context words at limit ten stop with only six units charged;
  one six-unit word plus its context succeeds at exactly twelve.
- Reserved input whose borrowed layout changes is rejected before successful
  output; ordinary Unicode ownership regression checks remain unchanged.
- Metadata helpers share their counter with context and the actual worker.
  At limit 24, a four-unit pincite operation and twelve-unit parenthetical
  succeed. The next parenthetical refuses during preflight at 22 reserved
  units. Exactly one child was spawned and independently confirmed; native
  admission returns to zero without quarantine.
- A frozen year parser accepts/rejects at the captured bound while charging
  both receiving copies to its fresh invocation owner.

After the final policy-decoder reuse, all six budget tests pass again. Quick
server lint/source-and-test verification, scoped Oxlint and staged new-only
Fallow pass with zero introduced findings.

## Remaining integration

The law metadata compositor still needs to install one fresh owner, capture
its dependencies without retaining an outer Scope, and bind source patterns,
context captures, year and string helpers under that owner. Whole tokenizer /
extractor integration, public errors/Layer, all remaining source capabilities,
family safety/scaling and unfinished accounting rows remain open. New-head
hosted verification remains required; this local receipt is not a full green
claim for PR #2511.

Both final policy checks pass: schema-first introduces no ratchet rows and
Effect/Vitest introduces no findings. Portable divergence accounting remains
11 representation laws, four fidelity questions and fifteen unfinished proof
rows, with no semantic waiver. No new policy exception or reduced floor is
introduced by this wave.
