/**
 * The shared domain identity module - Contains modules for slice entity ids.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { IdentityComposer as IdentityComposerType } from "@beep/identity";

const $I = $SharedDomainId.create("identity/index");

const identityComposerProbeSegment = "IdentityComposerProbe";

const identityComposerMethodKeys = [
  "annote",
  "annoteHttp",
  "annoteKey",
  "annoteSchema",
  "compose",
  "create",
  "make",
  "string",
  "symbol",
] as const;

type IdentityComposerMethod = (typeof identityComposerMethodKeys)[number];

type IdentityComposerCandidate = ((...args: ReadonlyArray<unknown>) => unknown) & {
  readonly identifier?: unknown;
  readonly value?: unknown;
} & {
  readonly [K in IdentityComposerMethod]?: unknown;
};

const hasFunctionMember = (value: IdentityComposerCandidate, key: IdentityComposerMethod): boolean =>
  P.isFunction(value[key]);

const hasIdentityMembers = (value: IdentityComposerCandidate, identifier: string): boolean =>
  value.value === identifier && A.every(identityComposerMethodKeys, (key) => hasFunctionMember(value, key));

const passesIdentityComposerSmokeTest = (value: IdentityComposerCandidate, identifier: string): boolean => {
  const composer = value as IdentityComposerType<string>;
  const expectedProbeIdentity = `${identifier}/${identityComposerProbeSegment}`;

  try {
    return (
      composer.string() === identifier &&
      composer.symbol() === Symbol.for(identifier) &&
      composer.make(identityComposerProbeSegment) === expectedProbeIdentity &&
      composer([identityComposerProbeSegment] as unknown as TemplateStringsArray) === expectedProbeIdentity
    );
  } catch {
    return false;
  }
};

/**
 * Guard for runtime identity composer values.
 *
 * **Details**
 *
 * Identity composers are callable functions decorated with composer methods,
 * so validation uses a runtime declaration rather than an object struct.
 *
 * **Example** (Check composer versus object)
 *
 * ```ts
 * import { $SharedDomainId } from "@beep/identity"
 * import { isIdentityComposer } from "@beep/shared-domain/identity"
 *
 * console.log(isIdentityComposer($SharedDomainId)) // true
 * console.log(isIdentityComposer({ identifier: "@beep/shared-domain" })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isIdentityComposer = (value: unknown): value is IdentityComposerType<string> => {
  if (!P.isFunction(value)) {
    return false;
  }

  const candidate = value as IdentityComposerCandidate;
  const identifier = candidate.identifier;

  return (
    P.isString(identifier) &&
    Str.isNonEmpty(identifier) &&
    pipe(identifier, Str.startsWith("@beep")) &&
    hasIdentityMembers(candidate, identifier) &&
    passesIdentityComposerSmokeTest(candidate, identifier)
  );
};

/**
 * Effect Schema for validating any runtime {@link IdentityComposerType} value.
 *
 * **Example** (Schema-check identity composers)
 *
 * ```ts
 * import { $SharedDomainId } from "@beep/identity"
 * import { AnyIdentityComposer } from "@beep/shared-domain/identity"
 * import * as S from "effect/Schema"
 *
 * const isComposer = S.is(AnyIdentityComposer)
 *
 * console.log(isComposer($SharedDomainId)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AnyIdentityComposer = S.declare<IdentityComposerType<string>>(isIdentityComposer).pipe(
  $I.annoteSchema("AnyIdentityComposer", {
    description: "Runtime schema for callable identity composer values.",
  })
);

/**
 * Runtime type for {@link AnyIdentityComposer}.
 *
 * **Example** (Read composer identifier)
 *
 * ```ts
 * import type { AnyIdentityComposer } from "@beep/shared-domain/identity"
 *
 * const readIdentifier = (composer: AnyIdentityComposer) => composer.identifier
 * console.log(readIdentifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AnyIdentityComposer = typeof AnyIdentityComposer.Type;

/**
 * Agents entity-id registry namespace.
 *
 * **Example** (Log AgentId table name)
 *
 * ```ts
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 *
 * console.log(Agents.AgentId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export * as Agents from "./Agents/index.ts";
/**
 * Architecture Lab entity-id registry namespace.
 *
 * **Example** (Log WorkerId table name)
 *
 * ```ts
 * import * as ArchitectureLab from "@beep/shared-domain/identity/ArchitectureLab"
 *
 * console.log(ArchitectureLab.WorkerId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export * as ArchitectureLab from "./ArchitectureLab/index.ts";
/**
 * Documents entity-id registry namespace.
 *
 * **Example** (Log SyncItemId table name)
 *
 * ```ts
 * import * as Documents from "@beep/shared-domain/identity/Documents"
 *
 * console.log(Documents.SyncItemId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export * as Documents from "./Documents/index.ts";
/**
 * Epistemic entity-id registry namespace.
 *
 * **Example** (Log CandidateClaimId table name)
 *
 * ```ts
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * console.log(Epistemic.CandidateClaimId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export * as Epistemic from "./Epistemic/index.ts";
/**
 * Law-practice entity-id registry namespace.
 *
 * **Example** (Log LegalClientId table name)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.LegalClientId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export * as LawPractice from "./LawPractice/index.ts";
/**
 * Shared entity-id registry namespace.
 *
 * **Example** (Log OrganizationId table name)
 *
 * ```ts
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 *
 * console.log(Shared.OrganizationId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export * as Shared from "./Shared/index.ts";
/**
 * Workspace entity-id registry namespace.
 *
 * **Example** (Log WorkspaceId table name)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.WorkspaceId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export * as Workspace from "./Workspace/index.ts";
