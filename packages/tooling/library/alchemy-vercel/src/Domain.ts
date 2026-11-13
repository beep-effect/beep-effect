/**
 * The `Vercel.Domain` resource: a domain attached to a Vercel project, with
 * redirect and git-branch options and its verification state.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyVercelId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as O from "@beep/utils/Option";
import * as projects from "@distilled.cloud/vercel/projects";
import { Unowned } from "alchemy/AdoptPolicy";
import { isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { teamScope } from "./internal/scope.ts";
import type { DeclaredResource } from "./internal/resource.ts";
import type { Providers } from "./Providers.ts";

const $I = $AlchemyVercelId.create("Domain");

/**
 * HTTP status a redirecting domain answers with.
 *
 * **Example** (Permanent redirect)
 *
 * ```ts
 * import { RedirectStatusCode } from "@beep/alchemy-vercel/Domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RedirectStatusCode)(308)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RedirectStatusCode = LiteralKit([301, 302, 307, 308]).pipe(
  $I.annoteSchema("RedirectStatusCode", {
    description: "HTTP status code of a Vercel domain redirect.",
  })
);

/**
 * Type-level member of {@link RedirectStatusCode}.
 *
 * @category models
 * @since 0.0.0
 */
export type RedirectStatusCode = typeof RedirectStatusCode.Type;

/**
 * Props of {@link Domain}.
 *
 * **Details**
 *
 * `project` may change: the domain then moves to the new project with
 * `moveProjectDomain`, keeping its verification. `moveFrom` names the project
 * that holds the domain before this stack takes it over (the cutover flip);
 * with `adopt(true)` the first deploy moves the domain from there into
 * `project`. Changing `name` or `teamId` replaces the domain.
 *
 * **Example** (A redirecting www domain)
 *
 * ```ts
 * import { DomainProps } from "@beep/alchemy-vercel/Domain"
 * import * as S from "effect/Schema"
 *
 * const props = S.decodeUnknownOption(DomainProps)({
 *   project: "prj_1",
 *   name: "www.example.com",
 *   redirect: "example.com",
 *   redirectStatusCode: 308
 * })
 * console.log(props._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DomainProps = S.Struct({
  project: S.NonEmptyString.annotateKey({ description: "Id or name of the project the domain serves." }),
  teamId: S.optionalKey(S.NonEmptyString.annotateKey({ description: "Team that owns the project." })),
  name: S.NonEmptyString.annotateKey({ description: "Fully qualified domain name." }),
  redirect: S.optionalKey(S.NonEmptyString.annotateKey({ description: "Domain this one redirects to." })),
  redirectStatusCode: S.optionalKey(RedirectStatusCode),
  gitBranch: S.optionalKey(
    S.NonEmptyString.annotateKey({ description: "Git branch whose latest deployment the domain serves." })
  ),
  moveFrom: S.optionalKey(
    S.NonEmptyString.annotateKey({
      description: "Id or name of the project that holds the domain before adoption; the domain is moved from it.",
    })
  ),
}).pipe(
  $I.annoteSchema("DomainProps", {
    description: "Desired state of a domain attached to a Vercel project.",
  })
);

/**
 * Type-level member of {@link DomainProps}.
 *
 * @category models
 * @since 0.0.0
 */
export type DomainProps = typeof DomainProps.Type;

/**
 * One verification challenge Vercel requires before it serves a domain.
 *
 * **Example** (A TXT challenge)
 *
 * ```ts
 * import { DomainVerification } from "@beep/alchemy-vercel/Domain"
 * import * as S from "effect/Schema"
 *
 * const challenge = S.decodeUnknownOption(DomainVerification)({
 *   type: "TXT",
 *   domain: "_vercel.example.com",
 *   value: "vc-domain-verify=example.com,abc",
 *   reason: "pending_domain_verification"
 * })
 * console.log(challenge._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DomainVerification = S.Struct({
  type: S.String,
  domain: S.String,
  value: S.String,
  reason: S.String,
}).pipe(
  $I.annoteSchema("DomainVerification", {
    description: "DNS record Vercel asks for before it verifies a project domain.",
  })
);

/**
 * Type-level member of {@link DomainVerification}.
 *
 * @category models
 * @since 0.0.0
 */
export type DomainVerification = typeof DomainVerification.Type;

/**
 * Attributes of a deployed {@link Domain}.
 *
 * **Example** (Decode attributes)
 *
 * ```ts
 * import { DomainAttributes } from "@beep/alchemy-vercel/Domain"
 * import * as S from "effect/Schema"
 *
 * const attrs = S.decodeUnknownOption(DomainAttributes)({
 *   name: "example.com",
 *   apexName: "example.com",
 *   projectId: "prj_1",
 *   verified: true,
 *   verification: []
 * })
 * console.log(attrs._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DomainAttributes = S.Struct({
  name: S.String,
  apexName: S.String,
  projectId: S.String,
  verified: S.Boolean,
  verification: S.Array(DomainVerification),
  redirect: S.optionalKey(S.String),
  redirectStatusCode: S.optionalKey(S.Finite),
  gitBranch: S.optionalKey(S.String),
}).pipe(
  $I.annoteSchema("DomainAttributes", {
    description: "Observed state of a Vercel project domain, verification included.",
  })
);

/**
 * Type-level member of {@link DomainAttributes}.
 *
 * @category models
 * @since 0.0.0
 */
export type DomainAttributes = typeof DomainAttributes.Type;

/**
 * Resource type of {@link Domain}.
 *
 * @category resources
 * @since 0.0.0
 */
export interface Domain extends Resource<"Vercel.Domain", DomainProps, DomainAttributes, never, Providers> {}

const DomainClass = Resource<Domain>("Vercel.Domain");

/**
 * A domain attached to a Vercel project.
 *
 * **Details**
 *
 * A domain belongs to one project at a time. Domains carry no ownership
 * marker, so a domain this stack did not create reads as foreign, on its own
 * project or on the `moveFrom` project, and needs `adopt(true)`. Adoption
 * from `moveFrom` moves the domain with `moveProjectDomain`. Each deploy asks
 * Vercel to verify an unverified domain; a domain whose DNS is not in place
 * yet stays `verified: false` with its challenges in `verification`.
 *
 * **Example** (Take over a domain from the old project)
 *
 * ```ts
 * import * as Vercel from "@beep/alchemy-vercel"
 * import { adopt } from "alchemy/AdoptPolicy"
 * import * as Effect from "effect/Effect"
 *
 * export const program = Effect.gen(function* () {
 *   const project = yield* Vercel.Project("Web", { name: "web" })
 *   yield* Vercel.Domain("Apex", {
 *     project: project.projectId,
 *     name: "example.com",
 *     moveFrom: "web-legacy"
 *   }).pipe(adopt(true))
 * })
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const Domain: DeclaredResource<Domain> = DomainClass;

type ObservedDomain = projects.GetProjectDomainResponse;

const toAttributes = (domain: ObservedDomain): DomainAttributes => ({
  name: domain.name,
  apexName: domain.apexName,
  projectId: domain.projectId,
  verified: domain.verified,
  verification: A.map(domain.verification ?? [], (challenge) => ({
    type: challenge.type,
    domain: challenge.domain,
    value: challenge.value,
    reason: challenge.reason,
  })),
  ...O.getSomesStruct({
    redirect: O.fromNullishOr(domain.redirect),
    redirectStatusCode: O.fromNullishOr(domain.redirectStatusCode),
    gitBranch: O.fromNullishOr(domain.gitBranch),
  }),
});

const readDomain = Effect.fn("Vercel.Domain.read")(function* (
  project: string,
  name: string,
  teamId: string | undefined
) {
  return yield* projects.getProjectDomain({ idOrName: project, domain: name, ...teamScope(teamId) }).pipe(
    Effect.map(toAttributes),
    Effect.catchTag("NotFound", () => Effect.undefined)
  );
});

/**
 * The domain on its target project, else on the `moveFrom` project.
 */
const locateDomain = Effect.fn("Vercel.Domain.locate")(function* (props: DomainProps) {
  const onTarget = yield* readDomain(props.project, props.name, props.teamId);
  if (onTarget !== undefined || props.moveFrom === undefined) return onTarget;
  return yield* readDomain(props.moveFrom, props.name, props.teamId);
});

const routing = (news: DomainProps) => ({
  gitBranch: news.gitBranch ?? null,
  redirect: news.redirect ?? null,
  redirectStatusCode: news.redirectStatusCode ?? null,
});

const routingDiffers = (news: DomainProps, current: DomainAttributes): boolean =>
  news.gitBranch !== current.gitBranch ||
  news.redirect !== current.redirect ||
  news.redirectStatusCode !== current.redirectStatusCode;

/**
 * Provider layer for {@link Domain}.
 *
 * **Example** (Register the provider)
 *
 * ```ts
 * import { DomainProvider } from "@beep/alchemy-vercel/Domain"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(DomainProvider)) // true
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const DomainProvider = Provider.succeed(DomainClass, {
  stables: ["name", "apexName"],
  read: Effect.fn("Vercel.Domain.provider.read")(function* ({ olds, output, previous }) {
    if (output !== undefined) return yield* readDomain(output.projectId, output.name, olds.teamId);
    const state = yield* locateDomain(olds);
    if (state === undefined) return undefined;
    // Domains carry no ownership marker: without prior state the domain is foreign,
    // unless it is this resource's own previous generation (a delete-first replacement).
    return state.name === previous?.name && state.projectId === previous.projectId ? state : Unowned(state);
  }),
  diff: Effect.fn("Vercel.Domain.provider.diff")(function* ({ news, olds }) {
    if (!isResolved(news)) return undefined;
    if (news.name !== olds.name || news.teamId !== olds.teamId) {
      // A domain belongs to one project at a time: a same-name replacement deletes first.
      return { action: "replace", deleteFirst: news.name === olds.name } as const;
    }
    return undefined;
  }),
  reconcile: Effect.fn("Vercel.Domain.provider.reconcile")(function* ({ news, output, session }) {
    const scope = teamScope(news.teamId);
    const target = yield* projects.getProject({ idOrName: news.project, ...scope });
    const current =
      (output === undefined ? undefined : yield* readDomain(output.projectId, news.name, news.teamId)) ??
      (yield* locateDomain(news));
    if (current === undefined) {
      yield* projects.addProjectDomain({ idOrName: target.id, ...scope, name: news.name, ...routing(news) });
      yield* session.note(`Added ${news.name} to Vercel project ${target.name}`);
    } else if (current.projectId !== target.id) {
      yield* projects.moveProjectDomain({
        idOrName: current.projectId,
        domain: news.name,
        ...scope,
        projectId: target.id,
        ...routing(news),
      });
      yield* session.note(`Moved ${news.name} from ${current.projectId} to Vercel project ${target.name}`);
    } else if (routingDiffers(news, current)) {
      yield* projects.updateProjectDomain({ idOrName: target.id, domain: news.name, ...scope, ...routing(news) });
    }
    const placed = yield* readDomain(target.id, news.name, news.teamId);
    if (placed === undefined) {
      return yield* Effect.die(`Vercel domain ${news.name} is missing from project ${target.id} after reconcile`);
    }
    if (placed.verified) return placed;
    // An unverified domain waits on DNS; a refused verification leaves the challenges in the output.
    return yield* projects.verifyProjectDomain({ idOrName: target.id, domain: news.name, ...scope }).pipe(
      Effect.map(toAttributes),
      Effect.catchTag("BadRequest", () => Effect.succeed(placed))
    );
  }),
  delete: Effect.fn("Vercel.Domain.provider.delete")(function* ({ olds, output, session }) {
    yield* projects
      .removeProjectDomain({ idOrName: output.projectId, domain: output.name, ...teamScope(olds?.teamId) })
      .pipe(Effect.catchTag("NotFound", () => Effect.void));
    yield* session.note(`Removed ${output.name} from Vercel project ${output.projectId}`);
  }),
});
