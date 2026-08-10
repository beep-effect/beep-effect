/**
 * Workspace slice entity-id registry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import * as EntityId from "../entity/EntityId.ts";

const $I = $WorkspaceDomainId.create("identity/Workspace");
const make = EntityId.factory("workspace", $I);

/**
 * Workspace entity identifier.
 *
 * **Example** (Log WorkspaceId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.WorkspaceId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const WorkspaceId = make("workspace", {
  description: "Identifier for a workspace entity.",
});

/**
 * Runtime type for {@link WorkspaceId}.
 *
 * **Example** (Decode WorkspaceId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.WorkspaceId = yield* S.decodeUnknownEffect(Workspace.WorkspaceId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type WorkspaceId = typeof WorkspaceId.Type;

/**
 * Email artifact entity identifier.
 *
 * **Example** (Log EmailArtifactId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.EmailArtifactId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const EmailArtifactId = make("email_artifact", {
  description: "Identifier for a normalized email artifact entity.",
});

/**
 * Runtime type for {@link EmailArtifactId}.
 *
 * **Example** (Decode EmailArtifactId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.EmailArtifactId = yield* S.decodeUnknownEffect(Workspace.EmailArtifactId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type EmailArtifactId = typeof EmailArtifactId.Type;

/**
 * Candidate project entity identifier.
 *
 * **Example** (Log CandidateProjectId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.CandidateProjectId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CandidateProjectId = make("candidate_project", {
  description: "Identifier for a candidate project entity.",
});

/**
 * Runtime type for {@link CandidateProjectId}.
 *
 * **Example** (Decode CandidateProjectId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.CandidateProjectId = yield* S.decodeUnknownEffect(Workspace.CandidateProjectId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type CandidateProjectId = typeof CandidateProjectId.Type;

/**
 * Candidate task entity identifier.
 *
 * **Example** (Log CandidateTaskId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.CandidateTaskId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CandidateTaskId = make("candidate_task", {
  description: "Identifier for a candidate task entity.",
});

/**
 * Runtime type for {@link CandidateTaskId}.
 *
 * **Example** (Decode CandidateTaskId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.CandidateTaskId = yield* S.decodeUnknownEffect(Workspace.CandidateTaskId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type CandidateTaskId = typeof CandidateTaskId.Type;

/**
 * Candidate draft entity identifier.
 *
 * **Example** (Log CandidateDraftId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.CandidateDraftId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CandidateDraftId = make("candidate_draft", {
  description: "Identifier for a candidate draft entity.",
});

/**
 * Runtime type for {@link CandidateDraftId}.
 *
 * **Example** (Decode CandidateDraftId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.CandidateDraftId = yield* S.decodeUnknownEffect(Workspace.CandidateDraftId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type CandidateDraftId = typeof CandidateDraftId.Type;

/**
 * Approval gate entity identifier.
 *
 * **Example** (Log ApprovalGateId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.ApprovalGateId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ApprovalGateId = make("approval_gate", {
  description: "Identifier for an approval gate entity.",
});

/**
 * Runtime type for {@link ApprovalGateId}.
 *
 * **Example** (Decode ApprovalGateId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.ApprovalGateId = yield* S.decodeUnknownEffect(Workspace.ApprovalGateId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ApprovalGateId = typeof ApprovalGateId.Type;

/**
 * Context packet entity identifier.
 *
 * **Example** (Log ContextPacketId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.ContextPacketId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ContextPacketId = make("context_packet", {
  description: "Identifier for a bounded context packet entity.",
});

/**
 * Runtime type for {@link ContextPacketId}.
 *
 * **Example** (Decode ContextPacketId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.ContextPacketId = yield* S.decodeUnknownEffect(Workspace.ContextPacketId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ContextPacketId = typeof ContextPacketId.Type;

/**
 * Thread entity identifier.
 *
 * **Example** (Log ThreadId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.ThreadId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ThreadId = make("thread", {
  description: "Identifier for a durable workspace conversation thread.",
});

/**
 * Runtime type for {@link ThreadId}.
 *
 * **Example** (Decode ThreadId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.ThreadId = yield* S.decodeUnknownEffect(Workspace.ThreadId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ThreadId = typeof ThreadId.Type;

/**
 * Turn entity identifier.
 *
 * **Example** (Log TurnId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.TurnId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const TurnId = make("turn", {
  description: "Identifier for a workspace conversation turn aggregate.",
});

/**
 * Runtime type for {@link TurnId}.
 *
 * **Example** (Decode TurnId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.TurnId = yield* S.decodeUnknownEffect(Workspace.TurnId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type TurnId = typeof TurnId.Type;

/**
 * Message entity identifier.
 *
 * **Example** (Log MessageId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.MessageId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const MessageId = make("message", {
  description: "Identifier for md-aligned workspace message content.",
});

/**
 * Runtime type for {@link MessageId}.
 *
 * **Example** (Decode MessageId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.MessageId = yield* S.decodeUnknownEffect(Workspace.MessageId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type MessageId = typeof MessageId.Type;
