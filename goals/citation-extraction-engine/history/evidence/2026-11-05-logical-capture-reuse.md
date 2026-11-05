# V0 logical capture reuse

The pinned regex V0 engine reuses one logical group number for repeated named
definitions. JavaScript requires distinct physical capture sites for this
lowering. The private compiler now retains source logical identities in its
program, renders subsequent occurrences without a duplicate JavaScript name,
and derives a bounded physical-to-logical capture plan from group-closing order.
The isolated evaluator projects participating native captures through that plan
before the existing bounded result codec serializes them.

Sequential reuse selects the later participating occurrence; nested reuse
selects the outer capture when it closes after its inner occurrence. Unmatched
occurrences do not erase an earlier participating alias. Empty participating
captures remain distinct from unmatched captures. Lookahead captures may extend
outside the whole match and retain their source group identity. Unnamed groups
after a reused name retain source numbering rather than physical numbering.

## Existing Effect ownership and limits

Effect MutableList supplies the bounded construction stack and closing-order
list; MutableHashSet tracks names already emitted. Existing Effect RegExp,
schema decoding, captured timing, typed RPC, process admission, acknowledged
retirement and result collection remain the execution owners. No worker or
transport is introduced. Capture plans are structural data, not an execution or
family-approval capability; workers rebind the original source bytes/profile.

The worker still rejects repeated captured groups, nullable multi-repeat,
nullable finditer and more than ten logical groups. Closing-order projection is
qualified only for the admitted non-repeated-capture profile. It does not model
capture history across iterations. Physical occurrence storage is additionally
bounded by the existing pattern policy, and native result arity must match the
derived plan before projection. The published result still contains exactly
the source logical groups.

The raw full-case pattern has 5524 units; directional wrappers have 5529. Source
qualification explicitly supplies the already permitted 8192-unit policy. The
default 4096-unit policy still refuses it, and a focused test retains that
refusal. No default, absolute ceiling, exclusion, workflow or semantic waiver
changes. The full-case source pattern has twelve physical capture sites and
seven logical groups; the current result contract retains its existing bound.

## Independent source observations

probe-regex-capture-reuse.py verifies a clean oracle at commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, CPython 3.11.15 and regex
2023.12.25 V0. It captures 27 patterns across both engines, giving 54 source
success/error outcomes and 1215 original search/match/finditer observations.
The two ordinary controls parse in both engines; duplicate-name patterns retain
CPython's distinct source errors.

Actual V0 parse trees supply width, repetition and nullable facts, independently
of the TypeScript compiler. A separate tree walk counts syntactic physical
occurrences, resolves V0 Info.private_groups for nested aliases and records
closing order. All 29 successful source parse plans compare, including the two
repeated profiles that remain unqualified for execution. No TypeScript-derived
plan or expected-match stub supplies source outcomes.

Controls cover sequential, nested, disjoint, optional, participating-empty and
assertion reuse; intervening unnamed groups; scalar versus adjacent-surrogate
alternatives; and repeated profiles that still refuse. The exact raw/forward/
backward POST_FULL_CITATION_REGEX and raw/backward SUPRA_ANTECEDENT_REGEX are
included with original metadata-shaped inputs. Default-policy refusal and
source engine identity remain independent from successful matching.

Producer SHA-256:
`9748d537c73906e8447b81af54c31995580bbdb052bb0d9c6bd490b46f6695ec`.
Fixture SHA-256:
`b16b30ea812b82e4a1b7b6d2ab832014546cec43189f4cad4d829df77eedbe0c`.
The formatted fixture is 206002 bytes. Regeneration with PYTHONHASHSEED values
179 and 181 compares byte-identically.

## Focused verification and remaining proof

Both actual Bun and Node replay six CPython and 65 V0 admitted smoke operations,
including the forward full-case pattern with all seven logical captures. Each
runtime also confirms two worker-level unsupported-profile refusals for the
repeated captures: 73 independently acknowledged exits per runtime. Native
capacity returns to zero without quarantine. Existing compiler and worker
regressions pass alongside those controls.

The final focused wave passes 29 tests in four files, including metadata-string
regressions after sharing the actual exit/capacity assertion. Scoped server
lint/type checks, Oxlint, Effect-test/schema-first policy checks, deterministic
regeneration and new-only Fallow pass with zero introduced findings. Compound
capture validation and native projection were split into focused helpers;
there are no new suppressions or reduced quality floors.

On previous head 02182cd8c5, hosted integration job 127568103390 in run
42119179311 ended with the GitHub annotation that the self-hosted runner lost
communication with the server. There is no failed step or test diagnostic in
the job details. The job-log endpoint returns BlobNotFound while the overall
run remains in progress. This is an infrastructure receipt, not evidence of a
source test failure or a passing integration run. New-head hosted proof remains
pending; no speculative workflow or code change is attributed to that annotation.

The full hosted replay remains pending: ninety CPython and 1020 admitted V0
operations plus the two refusal controls, requiring 1112 acknowledged exits per
runtime. Nullable iterator and repeated-capture source observations remain in
the corpus with explicit unfinished dispositions, rather than being silently
treated as admitted operations. Functional replay does not approve the 110
regex family safety/scaling reviews.

The next full-case metadata stage must still apply source field updates and
court lookup; name/HTML helpers and public engine integration remain unfinished.
Whole-engine accounting, custom protocols, fresh-process hashing, public
schemas/service/Layer, dispositions, hosted coverage/quality, reflection and
exhaustive acceptance remain open. Broad local aggregate verification and
head-install preflight remain deferred under the operator's hosted-CI
publication instruction; normal hooks remain enabled.
