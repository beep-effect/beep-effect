/**
 * An in-memory GitHub REST API for one repository, served through an
 * `HttpClient` layer, and the `GitHub.Providers` collection wired to it. It
 * models just the endpoints the stack's resource providers call, records every
 * request, and never reaches the network: hosted CI runs these tests without a
 * token.
 */
import * as GitHub from "@alchemy.run/github";
import * as Provider from "alchemy/Provider";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import census from "../fixtures/census.json" with { type: "json" };
import type * as HttpClientRequest from "effect/http/HttpClientRequest";

type Json = Record<string, unknown>;

/** A response: HTTP status and JSON body (`undefined` for an empty body). */
type Reply = readonly [number, unknown];

const notFound: Reply = [404, { message: "Not Found" }];

/** A page past the first is always empty: every list fits one page. */
const isLaterPage = (method: string, query: URLSearchParams) =>
  method === "GET" && Number(query.get("page") ?? "1") > 1;

const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));
const decodeBody = S.decodeUnknownEffect(JsonObject);
const encodeBody = S.encodeEffect(S.fromJsonString(S.Unknown));
const textDecoder = new TextDecoder();

/** One recorded request: method and path (no query string). */
export interface Call {
  readonly body: Json;
  readonly method: string;
  readonly path: string;
}

/**
 * GitHub Apps installed on the organization: GitHub Actions (15368), the
 * runner fleet's orchestrator (5309624, a ruleset bypass actor) and
 * beep-reviewer (5321138, a required check). A ruleset naming any other App,
 * as a bypass actor or as a check binding, is refused, as the live rehearsal
 * showed on a repository without those Apps.
 */
const installedApps = HashSet.make(15_368, 5_309_624, 5_321_138);

const rulesetRefusal = (body: Json): O.Option<Reply> => {
  const bypass = (body.bypass_actors as ReadonlyArray<Json> | undefined) ?? [];
  const foreignBypass = A.findFirst(
    bypass,
    (actor) => actor.actor_type === "Integration" && !HashSet.has(installedApps, Number(actor.actor_id))
  );
  if (O.isSome(foreignBypass)) {
    return O.some([
      422,
      {
        message: "Validation Failed",
        errors: [
          `Actor ${String(foreignBypass.value.actor_id)} integration must be part of the ruleset source or owner organization`,
        ],
      },
    ]);
  }
  const checks = A.flatMap((body.rules as ReadonlyArray<Json> | undefined) ?? [], (rule) =>
    rule.type === "required_status_checks"
      ? (((rule.parameters as Json | undefined)?.required_status_checks as ReadonlyArray<Json> | undefined) ?? [])
      : []
  );
  const unbound = A.some(
    checks,
    (check) => check.integration_id !== undefined && !HashSet.has(installedApps, Number(check.integration_id))
  );
  return unbound
    ? O.some([
        422,
        {
          message: "Validation Failed",
          errors: [
            "Invalid rule 'required_status_checks': Invalid parameter required_status_checks: Invalid integration ids",
          ],
        },
      ])
    : O.none();
};

/** The live objects of one fake repository. */
export class FakeRepository {
  readonly owner = "beep-effect";
  readonly name = "beep-effect";
  readonly calls: Array<Call> = [];
  repo: Json = {};
  topics: ReadonlyArray<string> = [];
  readonly rulesets = MutableHashMap.empty<number, Json>();
  readonly labels = MutableHashMap.empty<string, Json>();
  readonly environments = MutableHashMap.empty<string, Json>();
  readonly branchPolicies = MutableHashMap.empty<string, Array<Json>>();
  readonly variables = MutableHashMap.empty<string, Json>();
  nextId = 900_000;

  /** A repository seeded from the committed census snapshot (names and non-secret settings). */
  static fromCensus(): FakeRepository {
    return new FakeRepository().seed();
  }

  /** Forgets every object and request, then loads the census snapshot again. */
  seed(): this {
    this.calls.length = 0;
    MutableHashMap.clear(this.rulesets);
    MutableHashMap.clear(this.labels);
    MutableHashMap.clear(this.environments);
    MutableHashMap.clear(this.branchPolicies);
    MutableHashMap.clear(this.variables);
    this.repo = {
      id: 1_035_190_071,
      node_id: "R_fake",
      name: "beep-effect",
      owner: { login: "beep-effect" },
      ...census.repository,
    };
    this.topics = census.repository.topics;
    MutableHashMap.set(this.rulesets, 10_240_248, { id: 10_240_248, ...census.rulesets[0] });
    MutableHashMap.set(this.rulesets, 26_917_133, { id: 26_917_133, ...census.rulesets[1] });
    for (const label of census.labels) MutableHashMap.set(this.labels, label.name, { ...label });
    for (const environment of census.environments) {
      MutableHashMap.set(this.environments, environment.name, {
        id: this.nextId++,
        name: environment.name,
        deployment_branch_policy: environment.deployment_branch_policy,
      });
      MutableHashMap.set(
        this.branchPolicies,
        environment.name,
        A.map(environment.branch_policies, (policy) => ({ id: this.nextId++, ...policy }))
      );
      for (const variable of environment.variables)
        MutableHashMap.set(this.variables, `${environment.name}/${variable.name}`, { ...variable });
    }
    for (const variable of census.variables_owned_values)
      MutableHashMap.set(this.variables, variable.name, { ...variable });
    return this;
  }

  /** Requests other than reads. */
  writes(): ReadonlyArray<Call> {
    return A.filter(this.calls, (call) => call.method !== "GET");
  }

  ruleset(id: number): Json {
    return O.getOrThrow(MutableHashMap.get(this.rulesets, id));
  }

  handle(method: string, path: string, query: URLSearchParams, body: Json): Reply {
    const [root, owner, repo, kind, ...rest] = A.map(
      A.filter(Str.split(path, "/"), Str.isNonEmpty),
      decodeURIComponent
    );
    if (isLaterPage(method, query)) return [200, []];
    if (root !== "repos") return this.accountRoute(root, owner);
    return owner === this.owner && repo === this.name ? this.repoRoute(method, kind ?? "", rest, body) : notFound;
  }

  private repoRoute(method: string, kind: string, rest: ReadonlyArray<string>, body: Json): Reply {
    const route = this.routes[kind];
    return route === undefined ? notFound : route(method, rest, body);
  }

  /** Routes below `/repos/{owner}/{repo}/<kind>`. */
  private readonly routes: Record<string, (method: string, rest: ReadonlyArray<string>, body: Json) => Reply> = {
    "": (method, _rest, body) => {
      if (method === "PATCH") this.repo = { ...this.repo, ...body };
      return [200, this.repoBody()];
    },
    topics: (_method, _rest, body) => {
      this.topics = (body.names as ReadonlyArray<string> | undefined) ?? [];
      return [200, { names: this.topics }];
    },
    rulesets: (method, rest, body) => this.rulesetRoute(method, rest, body),
    labels: (method, rest, body) => this.labelRoute(method, rest, body),
    environments: (method, rest, body) => this.environmentRoute(method, rest, body),
    actions: (method, rest, body) =>
      rest[0] === "variables" ? this.variableRoute(method, "", A.drop(rest, 1), body) : notFound,
  };

  /** `/users`, `/repositories` and the create endpoints, which the stack never needs to succeed. */
  private accountRoute(root: string | undefined, owner: string | undefined): Reply {
    if (root === "users") return [200, { login: owner, id: 1, type: "Organization" }];
    if (root === "repositories") return [200, this.repoBody()];
    return root === "orgs" || root === "user" ? [422, { message: "name already exists" }] : notFound;
  }

  private repoBody(): Json {
    return { ...this.repo, topics: this.topics, full_name: `${this.owner}/${this.name}` };
  }

  private rulesetRoute(method: string, rest: ReadonlyArray<string>, body: Json): Reply {
    const [id] = rest;
    if (id === undefined) return this.rulesetCollectionRoute(method, body);
    const key = Number(id);
    return O.isNone(MutableHashMap.get(this.rulesets, key)) ? notFound : this.rulesetObjectRoute(method, key, body);
  }

  private rulesetCollectionRoute(method: string, body: Json): Reply {
    if (method === "GET") {
      return [200, A.map(this.rulesets.pipe(MutableHashMap.values, A.fromIterable), ({ id, name }) => ({ id, name }))];
    }
    return O.getOrElse(rulesetRefusal(body), (): Reply => {
      const created = { ...body, id: this.nextId++ };
      MutableHashMap.set(this.rulesets, created.id, created);
      return [201, created];
    });
  }

  private rulesetObjectRoute(method: string, key: number, body: Json): Reply {
    if (method === "DELETE") {
      MutableHashMap.remove(this.rulesets, key);
      return [204, undefined];
    }
    if (method !== "PUT") return [200, this.ruleset(key)];
    return O.getOrElse(rulesetRefusal(body), (): Reply => {
      MutableHashMap.set(this.rulesets, key, { ...body, id: key });
      return [200, this.ruleset(key)];
    });
  }

  private labelRoute(method: string, rest: ReadonlyArray<string>, body: Json): Reply {
    const [name] = rest;
    if (name === undefined) {
      if (method === "GET") return [200, this.labels.pipe(MutableHashMap.values, A.fromIterable)];
      const created = { name: body.name, color: body.color, description: body.description ?? null };
      MutableHashMap.set(this.labels, String(body.name), created);
      return [201, created];
    }
    const found = MutableHashMap.get(this.labels, name);
    if (O.isNone(found)) return notFound;
    if (method === "DELETE") {
      MutableHashMap.remove(this.labels, name);
      return [204, undefined];
    }
    if (method === "PATCH") {
      const updated = { ...found.value, ...body, name: body.new_name ?? name };
      MutableHashMap.remove(this.labels, name);
      MutableHashMap.set(this.labels, String(updated.name), updated);
      return [200, updated];
    }
    return [200, found.value];
  }

  private environmentRoute(method: string, rest: ReadonlyArray<string>, body: Json): Reply {
    const [name, sub, ...tail] = rest;
    if (name === undefined) {
      const environments = this.environments.pipe(MutableHashMap.values, A.fromIterable);
      return [200, { total_count: environments.length, environments }];
    }
    if (sub === "variables") return this.variableRoute(method, `${name}/`, tail, body);
    if (sub === "deployment-branch-policies") return this.branchPolicyRoute(method, name, tail, body);
    return this.environmentObjectRoute(method, name, body);
  }

  private branchPolicyRoute(method: string, name: string, tail: ReadonlyArray<string>, body: Json): Reply {
    const policies = O.getOrElse(MutableHashMap.get(this.branchPolicies, name), A.empty<Json>);
    if (method === "POST") {
      const created = { id: this.nextId++, name: body.name, type: body.type ?? "branch" };
      MutableHashMap.set(this.branchPolicies, name, [...policies, created]);
      return [200, created];
    }
    if (method === "DELETE") {
      const [policyId] = tail;
      MutableHashMap.set(
        this.branchPolicies,
        name,
        A.filter(policies, (policy) => String(policy.id) !== policyId)
      );
      return [204, undefined];
    }
    return [200, { total_count: policies.length, branch_policies: policies }];
  }

  private environmentObjectRoute(method: string, name: string, body: Json): Reply {
    const found = MutableHashMap.get(this.environments, name);
    if (method === "PUT") {
      const updated = {
        ...O.getOrElse(found, () => ({ id: this.nextId++, name })),
        deployment_branch_policy: body.deployment_branch_policy ?? null,
      };
      MutableHashMap.set(this.environments, name, updated);
      return [200, updated];
    }
    if (O.isNone(found)) return notFound;
    if (method === "DELETE") {
      MutableHashMap.remove(this.environments, name);
      MutableHashMap.remove(this.branchPolicies, name);
      return [204, undefined];
    }
    return [200, found.value];
  }

  private variableRoute(method: string, scope: string, rest: ReadonlyArray<string>, body: Json): Reply {
    const [name] = rest;
    if (name === undefined) {
      if (method === "POST") {
        MutableHashMap.set(this.variables, `${scope}${String(body.name)}`, { name: body.name, value: body.value });
        return [201, {}];
      }
      const variables = A.filter(A.fromIterable(this.variables), ([key]) =>
        scope === "" ? !Str.includes("/")(key) : Str.startsWith(scope)(key)
      );
      return [200, { total_count: variables.length, variables: A.map(variables, ([, value]) => value) }];
    }
    const key = `${scope}${name}`;
    const found = MutableHashMap.get(this.variables, key);
    if (O.isNone(found)) return notFound;
    if (method === "DELETE") {
      MutableHashMap.remove(this.variables, key);
      return [204, undefined];
    }
    if (method === "PATCH") {
      MutableHashMap.set(this.variables, key, { ...found.value, ...body });
      return [204, undefined];
    }
    return [200, found.value];
  }
}

const bodyOf = (request: HttpClientRequest.HttpClientRequest): Effect.Effect<Json> => {
  const body = request.body;
  if (body._tag === "Uint8Array") return decodeBody(textDecoder.decode(body.body)).pipe(Effect.orDie);
  if (body._tag === "Raw" && typeof body.body === "string") return decodeBody(body.body).pipe(Effect.orDie);
  return Effect.succeed({});
};

/** An `HttpClient` answering every request from the fake repository. */
const fakeHttpClient = (fake: FakeRepository) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(
      Effect.fnUntraced(function* (request, url) {
        const body = yield* bodyOf(request);
        fake.calls.push({ method: request.method, path: url.pathname, body });
        const [status, payload] = fake.handle(request.method, url.pathname, url.searchParams, body);
        const encoded = payload === undefined ? null : yield* encodeBody(payload).pipe(Effect.orDie);
        return HttpClientResponse.fromWeb(
          request,
          new Response(encoded, { status, headers: { "content-type": "application/json" } })
        );
      })
    )
  );

/**
 * The real `@alchemy.run/github` providers for the resource classes the stack
 * declares, authenticated with a dummy token and served by the fake.
 */
export const fakeProviders = (fake: FakeRepository) =>
  Layer.effect(
    GitHub.Providers,
    Provider.collection([GitHub.Repository, GitHub.Ruleset, GitHub.Environment, GitHub.Variable, GitHub.Label])
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        GitHub.RepositoryProvider(),
        GitHub.RulesetProvider(),
        GitHub.EnvironmentProvider(),
        GitHub.VariableProvider(),
        GitHub.LabelProvider()
      )
    ),
    Layer.provideMerge(GitHub.fromToken("fake-token-for-tests")),
    Layer.provideMerge(fakeHttpClient(fake))
  );
