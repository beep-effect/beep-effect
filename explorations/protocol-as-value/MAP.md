# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

Decomposed 2026-11-10 from [`BRIEF.md`](./BRIEF.md) and the 2026-11-10 entry
in [`DECISIONS.md`](./DECISIONS.md).

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `canonical-digest-owner` (promised now) | RFC 8785 is the one canonical byte form, `@beep/jsonc` owns it, digests share one `sha256:` grammar, and the hand-rolled encoders are replaced with proof that no stored digest changes. | none | see the table below |
| definition digest (gated) | Digest of a normalized definition under a versioned normalizer, with the limited guarantees of the 2026-11-05 decision. | the goal above; a first consumer that hashes a definition | `effect/SchemaRepresentation` (`toJson`, `fromJson`); normalizer NET-NEW |
| chain kit (gated) | Shared schemas for a parent-linked journal, a fenced register and a verify function. | the goal above; a third parent-linked journal; a written comparison with `effect/eventlog` | `verifyExecutionDecisionChain` in `packages/execution-authority/domain/src/entities/ExecutionRecord/ExecutionRecord.model.ts`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketEventStore.ts`; kit NET-NEW |
| protocol kit (gated) | A global protocol value, per-role projections and a conformance fold over journals. | the goal above; the consumer gate of the 2026-11-05 decision | `packages/foundation/modeling/identity/src/Fibered.ts`; `goals/oracle-loop-poc/QUESTION-BINDING.md` for request contracts; projection and fold NET-NEW |

Components of `canonical-digest-owner`:

| Phase | Component | Existing brick | Status |
| --- | --- | --- | --- |
| P0 | census of sorted-key encoders and digest preimages | the 2026-11-10 inventory in [`RESEARCH.md`](./RESEARCH.md) | extend into a tracked table |
| P0 | differential property test | [`research/encoder-differential-2026-11-10.md`](./research/encoder-differential-2026-11-10.md) (method and first result) | test NET-NEW |
| P0 | stored-digest replay | PacketCore's read-time digest check in `PacketEventStore.ts`; `verifyExecutionDecisionChain` | reuse |
| P1 | canonical bytes with refusals | `JsoncFingerprint.canonicalizeResult` and `hashResult` in `packages/foundation/modeling/jsonc/src/JsoncFingerprint.ts` | reuse |
| P1 | the `undefined`-member pre-pass | none in `@beep/jsonc` | NET-NEW, small |
| P1 | one `sha256:` grammar | `Sha256Hex` in `packages/foundation/modeling/schema/src/Sha256.ts`; `ContentDigest`; `SourceTextDigest` | extend; the two derive from it |
| P2 | epistemics swap | `packages/foundation/modeling/epistemics/src/internal/CanonicalJson.ts` and its `canonicalDetectionJson` export | replace body, keep export |
| P2 | PacketCore swap | `canonicalJsonText` in `PacketDigest.ts` (`@beep/repo-cli` already depends on `@beep/jsonc`) | replace body, keep export |
| P2 | semantica swap | `apps/labs/semantica/src/corpus/Canonical.ts` | replace |
| P2 | PartyKey v1 ruling | `packages/party/domain/src/values/PartyKey/PartyKey.behavior.ts` | prove parity or record as pinned; bytes unchanged |
| P3 | guard against a new encoder | the GritQL rules under `packages/tooling/policy-pack/lint-rules/rules/` | rule NET-NEW |

## Sequencing

1. **P0 before any swap.** The census and the replay are what make the swaps
   safe. If a stored digest turns out to depend on a coerced value, the plan
   for that record class changes before code does.
2. **P1 next.** The pre-pass and the grammar are additive and touch two
   foundation packages. They land alone.
3. **P2 one encoder per commit.** Each swap keeps its public export and is
   held by the differential test, so a revert is one commit.
4. **P3 last.** The guard goes in once nothing in the tree would trip it.

The three gated candidates are re-entry points. A fired gate reopens this
exploration at decompose; none becomes a goal directly.

Gate triggers, stated so they can be checked:

- **Definition digest:** a goal or exploration names a consumer that must
  compare two definitions by digest.
- **Chain kit:** a third parent-linked journal is proposed or lands (the
  execution ledger and PacketCore are the two), and the proposal says why
  `effect/eventlog` does not carry it.
- **Protocol kit:** the 2026-11-05 consumer gate. Candidates on record: the
  MCP tool surfaces, the agents slice, the pull-request lifecycle (lane
  owner, orchestrator, reviewer, merge gate), and any joint scope with
  foldlab's author. Fleet messaging is withdrawn.

## First Vertical Slice

P0 for one encoder: the epistemics encoder against `JsoncFingerprint`.

- A property test generates plain JSON and asserts byte equality between
  `canonicalDetectionJson` and `JsoncFingerprint.canonicalizeResult`.
- A second test lists the non-JSON inputs and asserts what each side does
  today, so the refusal policy is a visible diff when the swap lands.
- The execution-record fixtures recompute every seal through both encoders.

That slice proves the method on the encoder with the most seal consumers and
changes no production code.

## Open Risks Inherited From The Brief

- A stored digest may depend on a coerced value. P0 finds it; the fallback is
  a named legacy function for that record class.
- Callers may pass objects with `undefined` members on purpose. The pre-pass
  covers that case and nothing wider.
- The owner's hashing entry points need a `Digest` service or a supplied
  digest function, while several seals hash synchronously. The goal swaps
  the encoder and leaves each seal's hashing backend alone.
- `@beep/epistemics` and the semantica lab do not depend on `@beep/jsonc`
  today. Adding the edge is allowed within foundation/modeling; the goal
  confirms it against the architecture standard before P2.
- The differential pools in the probe were small. The property test widens
  them.
