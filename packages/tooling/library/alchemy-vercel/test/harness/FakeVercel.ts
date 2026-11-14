/**
 * In-memory Vercel REST API for hermetic provider tests.
 *
 * The fake answers the fourteen project, env and domain routes the providers
 * call, keeping projects, environment variables and domains in mutable maps.
 * Responses carry the fields the distilled response schemas require.
 */

import * as BO from "@beep/utils/Option";
import * as Credentials from "@distilled.cloud/vercel/Credentials";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";

const ProjectRecord = S.Struct({
  id: S.String,
  name: S.String,
  accountId: S.String,
  nodeVersion: S.String,
  framework: S.optionalKey(S.String),
  buildCommand: S.optionalKey(S.String),
  installCommand: S.optionalKey(S.String),
  rootDirectory: S.optionalKey(S.String),
  autoExposeSystemEnvs: S.optionalKey(S.Boolean),
  ssoProtection: S.Struct({ deploymentType: S.String }).pipe(S.NullOr),
  repo: S.optionalKey(S.String),
  repoType: S.optionalKey(S.String),
});
type ProjectRecord = typeof ProjectRecord.Type;

const EnvRecord = S.Struct({
  id: S.String,
  projectId: S.String,
  key: S.String,
  value: S.String,
  type: S.String,
  target: S.Array(S.String),
  gitBranch: S.optionalKey(S.String),
  comment: S.optionalKey(S.String),
});
type EnvRecord = typeof EnvRecord.Type;

const DomainRecord = S.Struct({
  name: S.String,
  projectId: S.String,
  verified: S.Boolean,
  redirect: S.NullOr(S.String),
  redirectStatusCode: S.NullOr(S.Finite),
  gitBranch: S.NullOr(S.String),
});
type DomainRecord = typeof DomainRecord.Type;

const ProjectBody = S.Struct({
  name: S.optionalKey(S.String),
  framework: S.optionalKey(S.String),
  buildCommand: S.optionalKey(S.String),
  installCommand: S.optionalKey(S.String),
  rootDirectory: S.optionalKey(S.String),
  nodeVersion: S.optionalKey(S.String),
  autoExposeSystemEnvs: S.optionalKey(S.Boolean),
  ssoProtection: S.Struct({ deploymentType: S.String }).pipe(S.NullOr, S.optionalKey),
  gitRepository: S.optionalKey(S.Struct({ type: S.String, repo: S.String })),
});

const EnvBody = S.Struct({
  key: S.optionalKey(S.String),
  value: S.optionalKey(S.String),
  type: S.optionalKey(S.String),
  target: S.Array(S.String).pipe(S.optionalKey),
  gitBranch: S.String.pipe(S.NullOr, S.optionalKey),
  comment: S.optionalKey(S.String),
});

const DomainBody = S.Struct({
  name: S.optionalKey(S.String),
  projectId: S.optionalKey(S.String),
  redirect: S.String.pipe(S.NullOr, S.optionalKey),
  redirectStatusCode: S.Finite.pipe(S.NullOr, S.optionalKey),
  gitBranch: S.String.pipe(S.NullOr, S.optionalKey),
});

/** Domains ending in this suffix stay unverified: the fake refuses to verify them. */
export const PENDING_SUFFIX = ".pending.test";

/** Team every fake project belongs to. */
export const TEAM_ID = "team_fake";

const projectsById = MutableHashMap.empty<string, ProjectRecord>();
const envsById = MutableHashMap.empty<string, EnvRecord>();
const domainsByName = MutableHashMap.empty<string, DomainRecord>();
const dnsFixed = MutableHashSet.empty<string>();
const storedTypes = MutableHashMap.empty<string, string>();
/** Keys whose create the fake refuses, to model a create that fails mid-replacement. */
const refusedEnvCreates = MutableHashSet.empty<string>();
/**
 * Requests the fake answered, each tagged with the id of the project it targeted. Tests in a
 * file run concurrently, so assertions read one project's requests, never the whole log.
 */
const requests: Array<{ readonly projectId: string; readonly call: string }> = [];
/** The env body fields, alphabetical, as {@link FakeVercel.envPatchFieldsFor} reports them. */
const envPatchFieldNames = ["comment", "gitBranch", "key", "target", "type", "value"] as const;
/** Field names of every env PATCH body, per project, in order: what an in-place edit sent. */
const envPatchFields: Array<{ readonly projectId: string; readonly fields: ReadonlyArray<string> }> = [];
let sequence = 0;

const nextId = (prefix: string): string => {
  sequence += 1;
  return `${prefix}_${sequence}`;
};

/** Read-only views and seeding helpers for assertions. */
export const FakeVercel = {
  project: (idOrName: string): O.Option<ProjectRecord> => findProject(idOrName),
  env: (id: string): O.Option<EnvRecord> => MutableHashMap.get(envsById, id),
  envsOf: (projectId: string): ReadonlyArray<EnvRecord> =>
    A.filter(
      A.map(A.fromIterable(envsById), ([, env]) => env),
      (env) => env.projectId === projectId
    ),
  domain: (name: string): O.Option<DomainRecord> => MutableHashMap.get(domainsByName, name),
  /** Refuse every `POST /env` for this key with 400 until {@link FakeVercel.allowEnvCreate}. */
  refuseEnvCreate: (key: string): void => {
    MutableHashSet.add(refusedEnvCreates, key);
  },
  allowEnvCreate: (key: string): void => {
    MutableHashSet.remove(refusedEnvCreates, key);
  },
  /** Field names of each env PATCH body sent for one project, in order. */
  envPatchFieldsFor: (projectId: string): ReadonlyArray<ReadonlyArray<string>> =>
    A.map(
      A.filter(envPatchFields, (entry) => entry.projectId === projectId),
      (entry) => entry.fields
    ),
  /** `METHOD Route` calls the fake answered for one project, in order. */
  requestsFor: (projectId: string): ReadonlyArray<string> =>
    A.map(
      A.filter(requests, (entry) => entry.projectId === projectId),
      (entry) => entry.call
    ),
  seedProject: (name: string, repo?: string, repoType?: string): ProjectRecord => {
    const project: ProjectRecord = {
      id: nextId("prj"),
      name,
      accountId: TEAM_ID,
      nodeVersion: "22.x",
      ssoProtection: null,
      ...(repo === undefined ? {} : { repo }),
      ...(repoType === undefined ? {} : { repoType }),
    };
    MutableHashMap.set(projectsById, project.id, project);
    return project;
  },
  seedEnv: (env: Omit<EnvRecord, "id">): EnvRecord => {
    const record: EnvRecord = { ...env, id: nextId("env") };
    MutableHashMap.set(envsById, record.id, record);
    return record;
  },
  /** Model a team policy: variables with this key are stored as `type` whatever is requested. */
  storeTypeAs: (key: string, type: string): void => {
    MutableHashMap.set(storedTypes, key, type);
  },
  /** Put a pending domain's DNS in place, so the next verification succeeds. */
  fixDns: (name: string): void => {
    MutableHashSet.add(dnsFixed, name);
  },
  seedDomain: (name: string, projectId: string): DomainRecord => {
    const record: DomainRecord = {
      name,
      projectId,
      verified: true,
      redirect: null,
      redirectStatusCode: null,
      gitBranch: null,
    };
    MutableHashMap.set(domainsByName, name, record);
    return record;
  },
};

const findProject = (idOrName: string): O.Option<ProjectRecord> =>
  O.orElse(MutableHashMap.get(projectsById, idOrName), () =>
    A.findFirst(A.fromIterable(projectsById), ([, project]) => project.name === idOrName).pipe(O.map(([, p]) => p))
  );

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));

const respond = (request: HttpClientRequest.HttpClientRequest, status: number, body: unknown) =>
  encodeJson(body).pipe(
    Effect.map((text) =>
      HttpClientResponse.fromWeb(
        request,
        new Response(text, { status, headers: { "content-type": "application/json" } })
      )
    ),
    Effect.orDie
  );

const error = (status: number, code: string, message: string = code) => ({
  status,
  body: { error: { code, message } },
});
const ok = (body: unknown) => ({ status: 200, body });
const notFound = error(404, "not_found");

const projectResponse = (project: ProjectRecord) => ({
  id: project.id,
  name: project.name,
  accountId: project.accountId,
  nodeVersion: project.nodeVersion,
  alias: [],
  defaultResourceConfig: { functionDefaultRegions: [] },
  resourceConfig: { functionDefaultRegions: [] },
  deploymentExpiration: {},
  directoryListing: false,
  ssoProtection: project.ssoProtection,
  ...(project.framework === undefined ? {} : { framework: project.framework }),
  ...(project.buildCommand === undefined ? {} : { buildCommand: project.buildCommand }),
  ...(project.installCommand === undefined ? {} : { installCommand: project.installCommand }),
  ...(project.rootDirectory === undefined ? {} : { rootDirectory: project.rootDirectory }),
  ...(project.autoExposeSystemEnvs === undefined ? {} : { autoExposeSystemEnvs: project.autoExposeSystemEnvs }),
  ...(project.repo === undefined
    ? {}
    : {
        link: linkOf(project.repo, project.repoType ?? "github"),
      }),
});

const linkOf = (repo: string, type: string) => {
  const [owner = "", name = ""] = Str.split("/")(repo);
  const common = { type, productionBranch: "main", deployHooks: [], gitCredentialId: "cred" };
  return type === "gitlab"
    ? {
        ...common,
        projectId: "1",
        projectName: name,
        projectNamespace: owner,
        projectNameWithNamespace: repo,
        projectUrl: `https://gitlab.com/${repo}`,
      }
    : { ...common, org: owner, repo: name };
};

const apexOf = (name: string): string => A.join(A.takeRight(Str.split(".")(name), 2), ".");

const domainResponse = (domain: DomainRecord) => ({
  name: domain.name,
  apexName: apexOf(domain.name),
  projectId: domain.projectId,
  verified: domain.verified,
  verification: domain.verified
    ? []
    : [
        {
          type: "TXT",
          domain: `_vercel.${apexOf(domain.name)}`,
          value: `vc-domain-verify=${domain.name}`,
          reason: "pending_domain_verification",
        },
      ],
  redirect: domain.redirect,
  redirectStatusCode: domain.redirectStatusCode,
  gitBranch: domain.gitBranch,
});

const envResponse = (env: EnvRecord) => ({
  id: env.id,
  key: env.key,
  // Sensitive values are never returned, like the real API.
  value: env.type === "sensitive" ? "" : env.value,
  type: env.type,
  target: env.target,
  securityIssues: [],
  ...(env.gitBranch === undefined ? {} : { gitBranch: env.gitBranch }),
  ...(env.comment === undefined ? {} : { comment: env.comment }),
});

type Route =
  | { readonly _tag: "Projects" }
  | { readonly _tag: "Project"; readonly project: string }
  | { readonly _tag: "Envs"; readonly project: string }
  | { readonly _tag: "Env"; readonly project: string; readonly id: string }
  | { readonly _tag: "Domains"; readonly project: string }
  | { readonly _tag: "Domain"; readonly project: string; readonly domain: string }
  | { readonly _tag: "Verify"; readonly project: string; readonly domain: string }
  | { readonly _tag: "Move"; readonly project: string; readonly domain: string }
  | { readonly _tag: "Unknown" };

const unknownRoute: Route = { _tag: "Unknown" };

/** Routes under `/projects/{idOrName}`, keyed by the path shape after the project. */
const projectRoutes: Record<string, (project: string, id: string) => Route> = {
  "": (project) => ({ _tag: "Project", project }),
  env: (project) => ({ _tag: "Envs", project }),
  "env/:id": (project, id) => ({ _tag: "Env", project, id }),
  domains: (project) => ({ _tag: "Domains", project }),
  "domains/:id": (project, domain) => ({ _tag: "Domain", project, domain }),
  "domains/:id/verify": (project, domain) => ({ _tag: "Verify", project, domain }),
  "domains/:id/move": (project, domain) => ({ _tag: "Move", project, domain }),
};

const toRoute = (segments: ReadonlyArray<string>): Route => {
  const [resource, project, sub, id, action] = A.drop(segments, 1);
  if (resource !== "projects") return unknownRoute;
  if (project === undefined) return { _tag: "Projects" };
  const shape = A.join(A.filter([sub ?? "", id === undefined ? "" : ":id", action ?? ""], Str.isNonEmpty), "/");
  return O.match(R.get(projectRoutes, shape), {
    onNone: () => unknownRoute,
    onSome: (make) => make(project, id ?? ""),
  });
};

const newProject = (name: string, accountId: string, body: typeof ProjectBody.Type): ProjectRecord => ({
  id: nextId("prj"),
  name,
  accountId,
  nodeVersion: "22.x",
  ssoProtection: { deploymentType: "prod_deployment_urls_and_all_previews" },
  ...BO.getSomesStruct({
    framework: O.fromUndefinedOr(body.framework),
    buildCommand: O.fromUndefinedOr(body.buildCommand),
    installCommand: O.fromUndefinedOr(body.installCommand),
    rootDirectory: O.fromUndefinedOr(body.rootDirectory),
    repo: O.map(O.fromUndefinedOr(body.gitRepository), (repository) => repository.repo),
  }),
});

const sharesTarget = (env: EnvRecord, key: string, gitBranch: string | undefined, target: ReadonlyArray<string>) =>
  env.key === key && env.gitBranch === gitBranch && A.some(env.target, (t) => A.contains(target, t));

/** `POST /projects/{id}/env`: with `upsert`, a same-key variable on any shared target is replaced. */
const upsertEnv = (project: ProjectRecord, body: typeof EnvBody.Type, upsert: boolean) => {
  if (body.key === undefined || body.value === undefined || body.target === undefined) return error(400, "bad_request");
  const { key, value, target } = body;
  if (MutableHashSet.has(refusedEnvCreates, key)) return error(400, "bad_request", "create refused by the test");
  const gitBranch = O.getOrUndefined(O.fromNullishOr(body.gitBranch));
  const existing = A.findFirst(FakeVercel.envsOf(project.id), (env) => sharesTarget(env, key, gitBranch, target));
  if (O.isSome(existing) && !upsert) return error(400, "env_already_exists");
  const record: EnvRecord = {
    id: O.match(existing, { onNone: () => nextId("env"), onSome: (env) => env.id }),
    projectId: project.id,
    key,
    value,
    type: O.getOrElse(MutableHashMap.get(storedTypes, key), () => body.type ?? "encrypted"),
    target,
    ...BO.getSomesStruct({ gitBranch: O.fromUndefinedOr(gitBranch), comment: O.fromUndefinedOr(body.comment) }),
  };
  MutableHashMap.set(envsById, record.id, record);
  return ok({ created: envResponse(record), failed: [] });
};

/**
 * What the real `PATCH /v9/projects/{id}/env/{envId}` refuses, as observed or documented:
 * - any `key` on a sensitive variable, even the identical key (observed 2026-11-14, run 43585534113);
 * - a `type` on a sensitive variable that is not `sensitive` (no in-place conversion, Vercel docs);
 * - a `gitBranch` without the `preview` target (the request schema's own constraint).
 */
const refuseSensitiveEdit = (env: EnvRecord, body: typeof EnvBody.Type) =>
  env.type !== "sensitive"
    ? O.none()
    : body.key !== undefined
      ? O.some(error(400, "bad_request", "You cannot change the key of a Sensitive Environment Variable."))
      : body.type !== undefined && body.type !== "sensitive"
        ? O.some(error(400, "bad_request", "You cannot change the type of a Sensitive Environment Variable."))
        : O.none();

const refuseBranchWithoutPreview = (env: EnvRecord, body: typeof EnvBody.Type) => {
  const gitBranch = body.gitBranch === undefined ? env.gitBranch : body.gitBranch;
  return P.isString(gitBranch) && !A.contains(body.target ?? env.target, "preview")
    ? O.some(error(400, "bad_request", "gitBranch requires the preview target"))
    : O.none();
};

const refuseEnvEdit = (env: EnvRecord, body: typeof EnvBody.Type) =>
  O.orElse(refuseSensitiveEdit(env, body), () => refuseBranchWithoutPreview(env, body));

const withProject = (idOrName: string, f: (project: ProjectRecord) => { status: number; body: unknown }) =>
  O.match(findProject(idOrName), { onNone: () => notFound, onSome: f });

const handle = (method: string, route: Route, query: URLSearchParams, body: unknown) => {
  const projectBody = S.decodeUnknownOption(ProjectBody)(body).pipe(O.getOrElse((): typeof ProjectBody.Type => ({})));
  const envBody = S.decodeUnknownOption(EnvBody)(body).pipe(O.getOrElse((): typeof EnvBody.Type => ({})));
  const domainBody = S.decodeUnknownOption(DomainBody)(body).pipe(O.getOrElse((): typeof DomainBody.Type => ({})));
  return Match.value(route).pipe(
    Match.tag("Projects", () => {
      if (method !== "POST" || projectBody.name === undefined) return error(400, "bad_request");
      if (O.isSome(findProject(projectBody.name))) return error(409, "conflict");
      const project = newProject(projectBody.name, query.get("teamId") ?? "user_fake", projectBody);
      MutableHashMap.set(projectsById, project.id, project);
      return ok(projectResponse(project));
    }),
    Match.tag("Project", ({ project: idOrName }) =>
      withProject(idOrName, (project) => {
        if (method === "GET") return ok(projectResponse(project));
        if (method === "DELETE") {
          MutableHashMap.remove(projectsById, project.id);
          return ok({});
        }
        const { gitRepository: _ignored, ...patch } = projectBody;
        const updated: ProjectRecord = { ...project, ...patch };
        MutableHashMap.set(projectsById, project.id, updated);
        return ok(projectResponse(updated));
      })
    ),
    Match.tag("Envs", ({ project: idOrName }) =>
      withProject(idOrName, (project) => {
        if (method === "GET") {
          return ok({ envs: A.map(FakeVercel.envsOf(project.id), envResponse), hiddenProductionEnvCount: 0 });
        }
        return upsertEnv(project, envBody, query.get("upsert") === "true");
      })
    ),
    Match.tag("Env", ({ project: idOrName, id }) =>
      withProject(idOrName, (project) =>
        O.match(
          O.filter(MutableHashMap.get(envsById, id), (env) => env.projectId === project.id),
          {
            onNone: () => notFound,
            onSome: (env) => {
              if (method === "DELETE") {
                MutableHashMap.remove(envsById, id);
                return ok([]);
              }
              envPatchFields.push({
                projectId: project.id,
                fields: A.filter(envPatchFieldNames, (field) => envBody[field] !== undefined),
              });
              const refusal = refuseEnvEdit(env, envBody);
              if (O.isSome(refusal)) return refusal.value;
              const { gitBranch, ...rest } = envBody;
              const { gitBranch: _old, ...base } = env;
              const updated: EnvRecord = {
                ...base,
                ...rest,
                ...(gitBranch === undefined || gitBranch === null ? {} : { gitBranch }),
                ...(gitBranch === undefined && env.gitBranch !== undefined ? { gitBranch: env.gitBranch } : {}),
              };
              MutableHashMap.set(envsById, id, updated);
              return ok({ key: updated.key, type: updated.type, value: updated.value });
            },
          }
        )
      )
    ),
    Match.tag("Domains", ({ project: idOrName }) =>
      withProject(idOrName, (project) => {
        if (domainBody.name === undefined) return error(400, "bad_request");
        if (MutableHashMap.has(domainsByName, domainBody.name)) return error(409, "domain_already_in_use");
        const record: DomainRecord = {
          name: domainBody.name,
          projectId: project.id,
          verified: !Str.endsWith(PENDING_SUFFIX)(domainBody.name),
          redirect: domainBody.redirect ?? null,
          redirectStatusCode: domainBody.redirectStatusCode ?? null,
          gitBranch: domainBody.gitBranch ?? null,
        };
        MutableHashMap.set(domainsByName, record.name, record);
        return ok(domainResponse(record));
      })
    ),
    Match.tag("Domain", ({ project: idOrName, domain: name }) =>
      withProject(idOrName, (project) =>
        O.match(
          O.filter(MutableHashMap.get(domainsByName, name), (domain) => domain.projectId === project.id),
          {
            onNone: () => notFound,
            onSome: (domain) => {
              if (method === "GET") return ok(domainResponse(domain));
              if (method === "DELETE") {
                MutableHashMap.remove(domainsByName, name);
                return ok({});
              }
              const updated: DomainRecord = {
                ...domain,
                redirect: domainBody.redirect === undefined ? domain.redirect : domainBody.redirect,
                redirectStatusCode:
                  domainBody.redirectStatusCode === undefined
                    ? domain.redirectStatusCode
                    : domainBody.redirectStatusCode,
                gitBranch: domainBody.gitBranch === undefined ? domain.gitBranch : domainBody.gitBranch,
              };
              MutableHashMap.set(domainsByName, name, updated);
              return ok(domainResponse(updated));
            },
          }
        )
      )
    ),
    Match.tag("Verify", ({ project: idOrName, domain: name }) =>
      withProject(idOrName, (project) =>
        O.match(
          O.filter(MutableHashMap.get(domainsByName, name), (domain) => domain.projectId === project.id),
          {
            onNone: () => notFound,
            onSome: (domain) => {
              if (Str.endsWith(PENDING_SUFFIX)(name) && !MutableHashSet.has(dnsFixed, name)) {
                return error(400, "missing_txt_record");
              }
              const verified: DomainRecord = { ...domain, verified: true };
              MutableHashMap.set(domainsByName, name, verified);
              return ok(domainResponse(verified));
            },
          }
        )
      )
    ),
    Match.tag("Move", ({ project: idOrName, domain: name }) =>
      withProject(idOrName, (source) =>
        O.match(
          O.filter(MutableHashMap.get(domainsByName, name), (domain) => domain.projectId === source.id),
          {
            onNone: () => notFound,
            onSome: (domain) =>
              O.match(findProject(domainBody.projectId ?? ""), {
                onNone: () => error(400, "bad_request"),
                onSome: (target) => {
                  const moved: DomainRecord = {
                    ...domain,
                    projectId: target.id,
                    redirect: domainBody.redirect ?? null,
                    redirectStatusCode: domainBody.redirectStatusCode ?? null,
                    gitBranch: domainBody.gitBranch ?? null,
                  };
                  MutableHashMap.set(domainsByName, name, moved);
                  return ok(domainResponse(moved));
                },
              }),
          }
        )
      )
    ),
    Match.tag("Unknown", () => error(404, "unknown_route")),
    Match.exhaustive
  );
};

const projectIdOf = (route: Route): string =>
  P.hasProperty(route, "project") && P.isString(route.project)
    ? O.match(findProject(route.project), { onNone: () => route.project, onSome: (project) => project.id })
    : "";

const client = HttpClient.make((request) =>
  Effect.gen(function* () {
    const url = new URL(request.url);
    const segments = A.filter(Str.split("/")(url.pathname), Str.isNonEmpty);
    const route = toRoute(segments);
    requests.push({ projectId: projectIdOf(route), call: `${request.method} ${route._tag}` });
    const text = request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : "";
    const body = Str.isEmpty(text) ? undefined : yield* decodeJson(text).pipe(Effect.orDie);
    const result = handle(request.method, route, url.searchParams, body);
    return yield* respond(request, result.status, result.body);
  })
);

/** HttpClient and credentials backed by the in-memory Vercel model. */
export const FakeVercelLayer = Layer.mergeAll(
  Layer.succeed(HttpClient.HttpClient, client),
  Credentials.credentials({ token: Redacted.make("fake-token") })
);
