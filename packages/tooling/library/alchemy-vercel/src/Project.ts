/**
 * The `Vercel.Project` resource: a Vercel project with its framework, build
 * settings, linked git repository and deployment protection.
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
import { createPhysicalName } from "alchemy/PhysicalName";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Match from "effect/Match";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { teamScope } from "./internal/scope.ts";
import type { DeclaredResource } from "./internal/resource.ts";
import type { Providers } from "./Providers.ts";

const $I = $AlchemyVercelId.create("Project");

/**
 * Git provider of a project's linked repository.
 *
 * **Example** (Guard a git provider)
 *
 * ```ts
 * import { GitProvider } from "@beep/alchemy-vercel/Project"
 *
 * console.log(GitProvider.is.github("github")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GitProvider = LiteralKit(["github", "gitlab", "bitbucket"]).pipe(
  $I.annoteSchema("GitProvider", {
    description: "Git provider of a Vercel project's linked repository.",
  })
);

/**
 * Type-level member of {@link GitProvider}.
 *
 * @category models
 * @since 0.0.0
 */
export type GitProvider = typeof GitProvider.Type;

/**
 * Who must sign in to Vercel before a deployment answers (Vercel
 * Authentication, the API's `ssoProtection`).
 *
 * **Details**
 *
 * `none` turns protection off. The other values are the API's own:
 * `all` protects every deployment, `preview` only preview deployments,
 * `prod_deployment_urls_and_all_previews` the Pulumi provider's
 * `standardProtection`, and `all_except_custom_domains` its
 * `standardProtectionNew`.
 *
 * **Example** (Turn protection off)
 *
 * ```ts
 * import { DeploymentProtection } from "@beep/alchemy-vercel/Project"
 *
 * console.log(DeploymentProtection.Enum.none) // "none"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeploymentProtection = LiteralKit([
  "none",
  "all",
  "preview",
  "prod_deployment_urls_and_all_previews",
  "all_except_custom_domains",
]).pipe(
  $I.annoteSchema("DeploymentProtection", {
    description: "Vercel Authentication scope for a project's deployments; `none` disables it.",
  })
);

/**
 * Type-level member of {@link DeploymentProtection}.
 *
 * @category models
 * @since 0.0.0
 */
export type DeploymentProtection = typeof DeploymentProtection.Type;

/**
 * Node.js major line a project builds and runs on.
 *
 * **Example** (Pin Node 22)
 *
 * ```ts
 * import { NodeVersion } from "@beep/alchemy-vercel/Project"
 *
 * console.log(NodeVersion.Enum["22.x"]) // "22.x"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NodeVersion = LiteralKit(["24.x", "22.x", "20.x", "18.x"]).pipe(
  $I.annoteSchema("NodeVersion", {
    description: "Node.js major line accepted by Vercel for builds and functions.",
  })
);

/**
 * Type-level member of {@link NodeVersion}.
 *
 * @category models
 * @since 0.0.0
 */
export type NodeVersion = typeof NodeVersion.Type;

/**
 * The git repository a project deploys from.
 *
 * **Example** (A GitHub repository)
 *
 * ```ts
 * import { ProjectGitRepository } from "@beep/alchemy-vercel/Project"
 * import * as S from "effect/Schema"
 *
 * const repo = S.decodeUnknownOption(ProjectGitRepository)({ type: "github", repo: "acme/web" })
 * console.log(repo._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProjectGitRepository = S.Struct({
  type: GitProvider,
  repo: S.NonEmptyString.annotateKey({ description: "Repository as `owner/name`." }),
}).pipe(
  $I.annoteSchema("ProjectGitRepository", {
    description: "Git repository a Vercel project is linked to at creation.",
  })
);

/**
 * Type-level member of {@link ProjectGitRepository}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProjectGitRepository = typeof ProjectGitRepository.Type;

/**
 * Props of {@link Project}.
 *
 * **Details**
 *
 * Every setting except `name` is optional; an omitted setting is left to
 * Vercel and never reset. `teamId` and `gitRepository` are part of the
 * project's identity: changing either replaces the project, because the
 * project API has no call that moves a project between teams or relinks
 * its repository.
 *
 * **Example** (Next.js project props)
 *
 * ```ts
 * import { ProjectProps } from "@beep/alchemy-vercel/Project"
 * import * as S from "effect/Schema"
 *
 * const props = S.decodeUnknownOption(ProjectProps)({ name: "web", framework: "nextjs" })
 * console.log(props._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProjectProps = S.Struct({
  name: S.optionalKey(
    S.NonEmptyString.annotateKey({
      description: "Project name. Generated from the stack, stage and logical id when omitted.",
    })
  ),
  teamId: S.optionalKey(
    S.NonEmptyString.annotateKey({ description: "Team that owns the project; omit for a personal account." })
  ),
  framework: S.optionalKey(
    S.NonEmptyString.annotateKey({ description: "Framework preset slug, for example `nextjs`." })
  ),
  buildCommand: S.optionalKey(S.String.annotateKey({ description: "Build command." })),
  installCommand: S.optionalKey(S.String.annotateKey({ description: "Install command." })),
  rootDirectory: S.optionalKey(
    S.String.annotateKey({ description: "Directory, relative to the repository root, holding the app." })
  ),
  gitRepository: S.optionalKey(ProjectGitRepository),
  deploymentProtection: S.optionalKey(DeploymentProtection),
  nodeVersion: S.optionalKey(NodeVersion),
  autoExposeSystemEnvs: S.optionalKey(
    S.Boolean.annotateKey({ description: "Expose Vercel's system environment variables to builds." })
  ),
}).pipe(
  $I.annoteSchema("ProjectProps", {
    description: "Desired configuration of a Vercel project.",
  })
);

/**
 * Type-level member of {@link ProjectProps}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProjectProps = typeof ProjectProps.Type;

/**
 * The repository link Vercel reports for a project.
 *
 * **Example** (A reported link)
 *
 * ```ts
 * import { ProjectLink } from "@beep/alchemy-vercel/Project"
 * import * as S from "effect/Schema"
 *
 * const link = S.decodeUnknownOption(ProjectLink)({ type: "github", repo: "acme/web", productionBranch: "main" })
 * console.log(link._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProjectLink extends S.Opaque<ProjectLink, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.String,
    repo: S.String,
    productionBranch: S.String,
  }).pipe(
    $I.annoteSchema("ProjectLink", {
      description: "Git repository link reported by Vercel, with its production branch.",
    })
  )
) {}

/**
 * Attributes of a deployed {@link Project}.
 *
 * **Example** (Decode attributes)
 *
 * ```ts
 * import { ProjectAttributes } from "@beep/alchemy-vercel/Project"
 * import * as S from "effect/Schema"
 *
 * const attrs = S.decodeUnknownOption(ProjectAttributes)({
 *   projectId: "prj_1",
 *   name: "web",
 *   accountId: "team_1",
 *   nodeVersion: "22.x",
 *   deploymentProtection: "none"
 * })
 * console.log(attrs._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProjectAttributes extends S.Opaque<ProjectAttributes, { readonly brand: unique symbol }>()(
  S.Struct({
    projectId: S.String,
    name: S.String,
    accountId: S.String,
    framework: S.optionalKey(S.String),
    buildCommand: S.optionalKey(S.String),
    installCommand: S.optionalKey(S.String),
    rootDirectory: S.optionalKey(S.String),
    nodeVersion: S.String,
    deploymentProtection: DeploymentProtection,
    autoExposeSystemEnvs: S.optionalKey(S.Boolean),
    link: S.optionalKey(ProjectLink),
  }).pipe(
    $I.annoteSchema("ProjectAttributes", {
      description: "Observed state of a Vercel project.",
    })
  )
) {}

/**
 * Resource type of {@link Project}.
 *
 * @category resources
 * @since 0.0.0
 */
export interface Project extends Resource<"Vercel.Project", ProjectProps, ProjectAttributes, never, Providers> {}

const ProjectClass = Resource<Project>("Vercel.Project");

/**
 * A Vercel project.
 *
 * **Details**
 *
 * Vercel projects carry no tags or labels, so a project this stack did not
 * create reads as foreign: deploying over an existing project of the same
 * name fails with `OwnedBySomeoneElse` unless the resource is wrapped in
 * `adopt(true)` (or the deploy passes `--adopt`). An adopted project is
 * then updated to the declared settings.
 *
 * **Example** (A Next.js project linked to GitHub)
 *
 * ```ts
 * import * as Vercel from "@beep/alchemy-vercel"
 * import * as Effect from "effect/Effect"
 *
 * export const program = Effect.gen(function* () {
 *   const project = yield* Vercel.Project("Web", {
 *     name: "web",
 *     framework: "nextjs",
 *     rootDirectory: "apps/web",
 *     installCommand: "cd ../.. && bun install",
 *     gitRepository: { type: "github", repo: "acme/web" },
 *     deploymentProtection: "none",
 *     nodeVersion: "22.x"
 *   })
 *   return project.projectId
 * })
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const Project: DeclaredResource<Project> = ProjectClass;

const gitRepositoryEquivalence = S.toEquivalence(S.UndefinedOr(ProjectGitRepository));

/**
 * A team or linked-repository change replaces the project: the project API cannot move a
 * project between teams or relink its repository.
 */
const replacesProject = (news: ProjectProps, olds: ProjectProps): boolean =>
  news.teamId !== olds.teamId || !gitRepositoryEquivalence(news.gitRepository, olds.gitRepository);

const projectName = Effect.fn("Vercel.Project.name")(function* (
  id: string,
  props: ProjectProps | undefined,
  instanceId?: string
) {
  return yield* O.fromUndefinedOr(props?.name).pipe(
    O.match({
      onSome: Effect.succeed,
      onNone: () =>
        createPhysicalName({
          id,
          maxLength: 100,
          lowercase: true,
          ...O.getSomesStruct({ instanceId: O.fromUndefinedOr(instanceId) }),
        }),
    })
  );
});

const toLink = Match.type<projects.GetProjectResponseLink>().pipe(
  Match.discriminatorsExhaustive("type")({
    github: (link) => ({
      type: link.type,
      repo: `${link.org}/${link.repo ?? ""}`,
      productionBranch: link.productionBranch,
    }),
    "github-limited": (link) => ({
      type: link.type,
      repo: `${link.org}/${link.repo ?? ""}`,
      productionBranch: link.productionBranch,
    }),
    "github-custom-host": (link) => ({
      type: link.type,
      repo: `${link.org}/${link.repo ?? ""}`,
      productionBranch: link.productionBranch,
    }),
    gitlab: (link) => ({
      type: link.type,
      repo: link.projectNameWithNamespace,
      productionBranch: link.productionBranch,
    }),
    bitbucket: (link) => ({
      type: link.type,
      repo: `${link.owner}/${link.slug}`,
      productionBranch: link.productionBranch,
    }),
    vercel: (link) => ({ type: link.type, repo: "", productionBranch: link.productionBranch }),
    v0: (link) => ({ type: link.type, repo: "", productionBranch: link.productionBranch }),
    "cursor-origin": (link) => ({ type: link.type, repo: "", productionBranch: link.productionBranch }),
  })
);

const toProtection = (protection: projects.GetProjectResponse["ssoProtection"]): DeploymentProtection =>
  O.fromNullishOr(protection).pipe(
    O.map((sso) => sso.deploymentType),
    O.filter(S.is(DeploymentProtection)),
    O.getOrElse(() => DeploymentProtection.Enum.none)
  );

const toAttributes = (project: projects.GetProjectResponse): ProjectAttributes =>
  ProjectAttributes.make({
    projectId: project.id,
    name: project.name,
    accountId: project.accountId,
    nodeVersion: project.nodeVersion,
    deploymentProtection: toProtection(project.ssoProtection),
    ...O.getSomesStruct({
      framework: O.fromNullishOr(project.framework),
      buildCommand: O.fromNullishOr(project.buildCommand),
      installCommand: O.fromNullishOr(project.installCommand),
      rootDirectory: O.fromNullishOr(project.rootDirectory),
      autoExposeSystemEnvs: O.fromUndefinedOr(project.autoExposeSystemEnvs),
      link: O.map(O.fromUndefinedOr(project.link), flow(toLink, ProjectLink.make)),
    }),
  });

const readProject = Effect.fn("Vercel.Project.read")(function* (idOrName: string, teamId: string | undefined) {
  return yield* projects.getProject({ idOrName, ...teamScope(teamId) }).pipe(
    Effect.map(toAttributes),
    Effect.catchTag("NotFound", () => Effect.undefined)
  );
});

const protectionBody = (protection: DeploymentProtection): projects.UpdateProjectRequestSsoProtection | null =>
  DeploymentProtection.is.none(protection) ? null : { deploymentType: protection };

/**
 * The settings in `news` that differ from what Vercel reports.
 */
const projectPatch = (name: string, news: ProjectProps, current: ProjectAttributes) => {
  const differs = <A>(desired: A | undefined, observed: A | undefined): O.Option<A> =>
    O.filter(O.fromUndefinedOr(desired), (value) => value !== observed);
  return O.getSomesStruct({
    name: differs(name, current.name),
    framework: differs(news.framework, current.framework),
    buildCommand: differs(news.buildCommand, current.buildCommand),
    installCommand: differs(news.installCommand, current.installCommand),
    rootDirectory: differs(news.rootDirectory, current.rootDirectory),
    nodeVersion: differs<string>(news.nodeVersion, current.nodeVersion),
    autoExposeSystemEnvs: differs(news.autoExposeSystemEnvs, current.autoExposeSystemEnvs),
    ssoProtection: O.map(differs(news.deploymentProtection, current.deploymentProtection), protectionBody),
  });
};

/**
 * Provider layer for {@link Project}.
 *
 * **Example** (Register the provider)
 *
 * ```ts
 * import { ProjectProvider } from "@beep/alchemy-vercel/Project"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ProjectProvider)) // true
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const ProjectProvider = Provider.succeed(ProjectClass, {
  stables: ["projectId", "accountId"],
  read: Effect.fn("Vercel.Project.provider.read")(function* ({ id, instanceId, olds, output, previous }) {
    const idOrName = output?.projectId ?? (yield* projectName(id, olds, instanceId));
    const state = yield* readProject(idOrName, olds?.teamId);
    if (state === undefined) return undefined;
    // Projects carry no ownership marker: without prior state the project is foreign,
    // unless it is this resource's own previous generation (a delete-first replacement).
    return output !== undefined || state.projectId === previous?.projectId ? state : Unowned(state);
  }),
  diff: Effect.fn("Vercel.Project.provider.diff")(function* ({ news, olds }) {
    if (!isResolved(news) || !replacesProject(news, olds)) return undefined;
    // Names are unique within a team, so a replacement that keeps its team and name deletes first.
    return { action: "replace", deleteFirst: news.teamId === olds.teamId && news.name === olds.name } as const;
  }),
  reconcile: Effect.fn("Vercel.Project.provider.reconcile")(function* ({ id, instanceId, news, output, session }) {
    const name = output?.name ?? (yield* projectName(id, news, instanceId));
    const desiredName = news.name ?? name;
    const scope = teamScope(news.teamId);
    const observed =
      (output === undefined ? undefined : yield* readProject(output.projectId, news.teamId)) ??
      (yield* readProject(name, news.teamId));
    const current =
      observed ??
      (yield* projects
        .createProject({
          ...scope,
          name,
          ...O.getSomesStruct({
            framework: O.fromUndefinedOr(news.framework),
            buildCommand: O.fromUndefinedOr(news.buildCommand),
            installCommand: O.fromUndefinedOr(news.installCommand),
            rootDirectory: O.fromUndefinedOr(news.rootDirectory),
            gitRepository: O.fromUndefinedOr(news.gitRepository),
          }),
        })
        .pipe(
          Effect.flatMap((created) => projects.getProject({ idOrName: created.id, ...scope })),
          Effect.map(toAttributes)
        ));
    const patch = projectPatch(desiredName, news, current);
    const reconciled = R.isEmptyRecord<string, unknown>(patch)
      ? current
      : yield* projects.updateProject({ idOrName: current.projectId, ...scope, ...patch }).pipe(
          Effect.flatMap(() => projects.getProject({ idOrName: current.projectId, ...scope })),
          Effect.map(toAttributes)
        );
    yield* session.note(`Vercel project ${reconciled.name} (${reconciled.projectId})`);
    return reconciled;
  }),
  delete: Effect.fn("Vercel.Project.provider.delete")(function* ({ olds, output, session }) {
    yield* projects
      .deleteProject({ idOrName: output.projectId, ...teamScope(olds?.teamId) })
      .pipe(Effect.catchTag("NotFound", () => Effect.void));
    yield* session.note(`Deleted Vercel project ${output.name}`);
  }),
});
