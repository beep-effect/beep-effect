import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CapabilityGrant } from "./Capability.ts";
import { DelegationId, GrantId, PrincipalId, RunId } from "./Ids.ts";

/**
 * Where an invocation's authority starts: a human principal, or an agent run
 * that names the human accountable for it. There is no process case: a
 * process only ever relays an invocation that started with one of these.
 *
 * **Example** (A reviewer at the boundary)
 * ```ts
 * import { PrincipalId } from "@proto/kernel/Ids";
 * import { Root } from "@proto/kernel/Invocation";
 *
 * const root = Root.cases.Human.make({ principal: PrincipalId.make("p_rev") });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Root = S.TaggedUnion({
  Human: { principal: PrincipalId },
  Agent: { run: RunId, accountable: PrincipalId },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Root = typeof Root.Type;

/**
 * Who carried an invocation one hop further: a process (a policy, a saga, a
 * poller) or an agent run acting inside a process.
 *
 * @category models
 * @since 0.0.0
 */
export const Relayer = S.TaggedUnion({
  Process: { process: S.String },
  Agent: { run: RunId },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Relayer = typeof Relayer.Type;

/**
 * Why a hop happened: a committed event a policy reacted to, a saga step,
 * the boundary admitting a process under a credential, or an integration
 * fact another context published.
 *
 * @category models
 * @since 0.0.0
 */
export const Cause = S.TaggedUnion({
  Event: { stream: S.String, seq: S.Int, event: S.String },
  SagaStep: { saga: S.String, key: S.String, step: S.String },
  Session: { scheme: S.String },
  Fact: { producer: S.String, contract: S.String, version: S.Int, fact: S.String },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Cause = typeof Cause.Type;

/**
 * One hop of the causal chain: who relayed, and why.
 *
 * @category models
 * @since 0.0.0
 */
export const Hop = S.Struct({ by: Relayer, cause: Cause });
/**
 * @category models
 * @since 0.0.0
 */
export type Hop = typeof Hop.Type;

/**
 * The authority a piece of work runs under. Only the authority context
 * builds one: at the boundary with an empty chain, and at each later hop by
 * re-admitting the provenance a policy or saga hands it. It cannot be built
 * without a root.
 *
 * **Details**
 *
 * - `root`: where the authority starts (a human, or an agent run with its
 *   accountable human).
 * - `onBehalfOf`: whose authority the work uses.
 * - `grants`: what the work may do, as the boundary read them.
 * - `chain`: every hop since the boundary. Who is operating now is the last
 *   hop's relayer, or the root when the chain is empty ({@link operatorOf}).
 *
 * @category models
 * @since 0.0.0
 */
export const Invocation = S.Struct({
  root: Root,
  onBehalfOf: PrincipalId,
  grants: S.Array(CapabilityGrant),
  chain: S.Array(Hop),
});
/**
 * @category models
 * @since 0.0.0
 */
export type Invocation = typeof Invocation.Type;

/**
 * Who is operating now: the root's human or agent, or a relaying process or agent.
 *
 * @category models
 * @since 0.0.0
 */
export const Operator = S.TaggedUnion({
  Human: { principal: PrincipalId },
  Agent: { run: RunId },
  Process: { process: S.String },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Operator = typeof Operator.Type;

const operatorOfRoot = Root.match({
  Human: ({ principal }): Operator => Operator.cases.Human.make({ principal }),
  Agent: ({ run }): Operator => Operator.cases.Agent.make({ run }),
});

const operatorOfRelayer = Relayer.match({
  Process: ({ process }): Operator => Operator.cases.Process.make({ process }),
  Agent: ({ run }): Operator => Operator.cases.Agent.make({ run }),
});

/**
 * Who is operating now: the last hop's relayer, or the root.
 *
 * **Example** (A policy operates after one relay)
 * ```ts
 * import { type Invocation, operatorOf } from "@proto/kernel/Invocation";
 *
 * declare const relayed: Invocation;
 * const operator = operatorOf(relayed)._tag;
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const operatorOf = (invocation: Invocation): Operator =>
  O.match(A.last(invocation.chain), {
    onNone: () => operatorOfRoot(invocation.root),
    onSome: (hop) => operatorOfRelayer(hop.by),
  });

/**
 * The agent run behind the work, if any: the latest agent hop, or an agent root.
 *
 * @category getters
 * @since 0.0.0
 */
export const runOf = (invocation: Invocation): O.Option<RunId> =>
  pipe(
    A.reverse(invocation.chain),
    A.findFirst((hop) => (Relayer.guards.Agent(hop.by) ? O.some(hop.by.run) : O.none())),
    O.orElse(() => (Root.guards.Agent(invocation.root) ? O.some(invocation.root.run) : O.none())),
  );

/**
 * The human accountable for an agent-rooted invocation; none for a human root.
 *
 * @category getters
 * @since 0.0.0
 */
export const accountableOf = (invocation: Invocation): O.Option<PrincipalId> =>
  Root.guards.Agent(invocation.root) ? O.some(invocation.root.accountable) : O.none();

/**
 * A grant as provenance names it: its id, and the delegation it reached the
 * caller through. No terms: re-admission reads them live.
 *
 * @category models
 * @since 0.0.0
 */
export const GrantRef = S.Struct({ grant: GrantId, delegation: S.OptionFromNullOr(DelegationId) });
/**
 * @category models
 * @since 0.0.0
 */
export type GrantRef = typeof GrantRef.Type;

/**
 * What an event records about the authority it was decided under: the root,
 * on whose behalf, the grants by id, and the causal chain. Never the grant
 * terms, and never enough to act on: a later hop asks the authority context
 * to re-admit it, which rebuilds an {@link Invocation} from live grants.
 *
 * @category models
 * @since 0.0.0
 */
export const Provenance = S.Struct({
  root: Root,
  onBehalfOf: PrincipalId,
  grants: S.Array(GrantRef),
  chain: S.Array(Hop),
});
/**
 * @category models
 * @since 0.0.0
 */
export type Provenance = typeof Provenance.Type;

/**
 * The provenance of an invocation: its root, on-behalf-of, chain and grant
 * ids, with the terms dropped.
 *
 * @category getters
 * @since 0.0.0
 */
export const provenanceOf = (invocation: Invocation): Provenance =>
  Provenance.make({
    root: invocation.root,
    onBehalfOf: invocation.onBehalfOf,
    grants: A.map(invocation.grants, ({ grant, delegation }) => GrantRef.make({ grant, delegation })),
    chain: invocation.chain,
  });

/**
 * Extend a provenance with one hop. It stays provenance: to act on it, a
 * policy or saga asks the authority context to re-admit it.
 *
 * @category constructors
 * @since 0.0.0
 */
export const extend: {
  (hop: Hop): (provenance: Provenance) => Provenance;
  (provenance: Provenance, hop: Hop): Provenance;
} = dual(
  2,
  (provenance: Provenance, hop: Hop): Provenance => Provenance.make({ ...provenance, chain: A.append(provenance.chain, hop) }),
);

/**
 * The one helper an event uses to carry where its authority came from: the
 * event's own fields plus `provenance`. When the library persists request
 * context on the envelope, this is the line that changes.
 *
 * **Example** (An event that carries its provenance)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import { carry } from "@proto/kernel/Invocation";
 * import * as S from "effect/Schema";
 *
 * export class ClaimRetracted extends Domain.Event("ClaimRetracted", carry({ reason: S.String })) {}
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const carry = <const F extends S.Struct.Fields>(fields: F): F & { readonly provenance: typeof Provenance } => ({
  ...fields,
  provenance: Provenance,
});

/**
 * A hop relayed by a process.
 *
 * @category constructors
 * @since 0.0.0
 */
export const byProcess: {
  (cause: Cause): (process: string) => Hop;
  (process: string, cause: Cause): Hop;
} = dual(2, (process: string, cause: Cause): Hop => Hop.make({ by: Relayer.cases.Process.make({ process }), cause }));

/**
 * A hop relayed by an agent run acting inside a process.
 *
 * @category constructors
 * @since 0.0.0
 */
export const byAgent: {
  (cause: Cause): (run: RunId) => Hop;
  (run: RunId, cause: Cause): Hop;
} = dual(2, (run: RunId, cause: Cause): Hop => Hop.make({ by: Relayer.cases.Agent.make({ run }), cause }));

/**
 * The cause of a hop a policy makes: the event it reacts to, by stream and sequence.
 *
 * @category constructors
 * @since 0.0.0
 */
export const eventCause = (trigger: {
  readonly event: { readonly _tag: string };
  readonly envelope: { readonly stream: string; readonly seq: number };
}): Cause =>
  Cause.cases.Event.make({ stream: trigger.envelope.stream, seq: trigger.envelope.seq, event: trigger.event._tag });

/**
 * The cause of a hop a saga step makes.
 *
 * @category constructors
 * @since 0.0.0
 */
export const sagaStep: {
  (key: string, step: string): (saga: string) => Cause;
  (saga: string, key: string, step: string): Cause;
} = dual(3, (saga: string, key: string, step: string): Cause => Cause.cases.SagaStep.make({ saga, key, step }));
