/**
 * Hermetic fake of the AWS APIs this package calls.
 *
 * The fake sits behind an effect `HttpClient`, so every distilled operation
 * (request signing, protocol serialization and response parsing included)
 * runs for real against an in-memory account. It needs no credentials and no
 * network.
 */

import { AWSEnvironment } from "@alchemy.run/aws/Environment";
import * as Test from "@alchemy.run/test/Vitest";
import * as AwsExtras from "@beep/alchemy-aws-extras";
import { inMemoryState } from "alchemy/State";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Input } from "alchemy/Input";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";

export const accountId = "123456789012";
export const region = "us-east-1";

type Status = string;

interface LaunchTemplateRecord {
  defaultVersion: number;
  readonly id: string;
  readonly name: string;
  tags: Record<string, string>;
  readonly versions: Array<Record<string, string>>;
}

/** Mutable in-memory account the fake HTTP client serves. */
export interface FakeAccount {
  /** Every operation called, in order, as `<service>:<Operation>`. */
  readonly calls: Array<string>;
  computeOptimizer: { status: Status; memberAccountsEnrolled: boolean };
  /** Tag keys billing has ingested (only these may change status). */
  readonly costAllocationTags: MutableHashMap.MutableHashMap<string, Status>;
  costOptimizationHub: { status: Status; includeMemberAccounts: boolean };
  readonly launchTemplates: MutableHashMap.MutableHashMap<string, LaunchTemplateRecord>;
  nextLaunchTemplate: number;
}

const makeAccount = (seed?: {
  readonly costAllocationTags?: Record<string, Status>;
  readonly computeOptimizer?: Status;
  readonly costOptimizationHub?: Status;
}): FakeAccount => ({
  calls: [],
  costAllocationTags: MutableHashMap.fromIterable(R.toEntries(seed?.costAllocationTags ?? {})),
  computeOptimizer: { status: seed?.computeOptimizer ?? "Inactive", memberAccountsEnrolled: false },
  costOptimizationHub: { status: seed?.costOptimizationHub ?? "Inactive", includeMemberAccounts: false },
  launchTemplates: MutableHashMap.empty(),
  nextLaunchTemplate: 1,
});

/** Operation names the account served, without the service prefix. */
export const operations = (account: FakeAccount): Array<string> =>
  A.map(account.calls, (call) =>
    pipe(
      call,
      Str.split(":"),
      A.last,
      O.getOrElse(() => call)
    )
  );

/** Launch template stored under `name`, if any. */
const findLaunchTemplate = (account: FakeAccount, name: string): LaunchTemplateRecord | undefined =>
  pipe(
    MutableHashMap.values(account.launchTemplates),
    A.fromIterable,
    A.findFirst((template) => template.name === name),
    O.getOrUndefined
  );

/** Seed a launch template created outside the stack (no Alchemy tags). */
const seedLaunchTemplate = (account: FakeAccount, name: string, tags: Record<string, string> = {}) => {
  const id = `lt-${Str.padStart(17, "0")(`${account.nextLaunchTemplate++}`)}`;
  MutableHashMap.set(account.launchTemplates, id, { id, name, defaultVersion: 1, tags, versions: [{}] });
  return id;
};

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

interface FakeResponse {
  readonly body: string;
  readonly contentType: string;
  readonly json?: unknown;
  readonly status: number;
}

const json = (body: unknown, status = 200): FakeResponse => ({
  status,
  body: "",
  json: body,
  contentType: "application/x-amz-json-1.1",
});

const jsonError = (type: string, message: string): FakeResponse => json({ __type: type, message }, 400);

const escapeXml = (value: string) =>
  pipe(
    value,
    Str.replaceAll("&", "&amp;"),
    Str.replaceAll("<", "&lt;"),
    Str.replaceAll(">", "&gt;"),
    Str.replaceAll('"', "&quot;")
  );

const xml = (operation: string, inner: string): FakeResponse => ({
  status: 200,
  body: `<?xml version="1.0" encoding="UTF-8"?><${operation}Response xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><requestId>fake</requestId>${inner}</${operation}Response>`,
  contentType: "text/xml;charset=UTF-8",
});

const ec2Error = (code: string, message: string): FakeResponse => ({
  status: 400,
  body: `<?xml version="1.0" encoding="UTF-8"?><Response><Errors><Error><Code>${code}</Code><Message>${escapeXml(message)}</Message></Error></Errors><RequestID>fake</RequestID></Response>`,
  contentType: "text/xml;charset=UTF-8",
});

const tagSetXml = (tags: Record<string, string>) =>
  `<tagSet>${A.join(
    A.map(
      R.toEntries(tags),
      ([key, value]) => `<item><key>${escapeXml(key)}</key><value>${escapeXml(value)}</value></item>`
    ),
    ""
  )}</tagSet>`;

const launchTemplateXml = (template: LaunchTemplateRecord) =>
  `<launchTemplateId>${template.id}</launchTemplateId><launchTemplateName>${escapeXml(template.name)}</launchTemplateName><defaultVersionNumber>${template.defaultVersion}</defaultVersionNumber><latestVersionNumber>${template.versions.length}</latestVersionNumber>${tagSetXml(template.tags)}`;

// ---------------------------------------------------------------------------
// JSON services
// ---------------------------------------------------------------------------

const JsonInput = S.Struct({
  TagKeys: S.String.pipe(S.Array, S.optionalKey),
  CostAllocationTagsStatus: S.Struct({ TagKey: S.String, Status: S.String }).pipe(S.Array, S.optionalKey),
  status: S.optionalKey(S.String),
  includeMemberAccounts: S.optionalKey(S.Boolean),
});
type JsonInput = typeof JsonInput.Type;
const decodeJsonInput = S.decodeUnknownEffect(S.fromJsonString(JsonInput));
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

type JsonHandler = (account: FakeAccount, input: JsonInput) => FakeResponse;

const listCostAllocationTags: JsonHandler = (account, input) =>
  json({
    CostAllocationTags: pipe(
      A.fromIterable(account.costAllocationTags),
      A.filter(([key]) => input.TagKeys === undefined || A.contains(input.TagKeys, key)),
      A.map(([TagKey, Status]) => ({ TagKey, Status, Type: "UserDefined" }))
    ),
  });

const updateCostAllocationTagsStatus: JsonHandler = (account, input) => {
  const entries = input.CostAllocationTagsStatus ?? [];
  const isKnown = (entry: { readonly TagKey: string }) => MutableHashMap.has(account.costAllocationTags, entry.TagKey);
  const known = A.filter(entries, isKnown);
  const unknown = A.filter(entries, (entry) => !isKnown(entry));
  for (const entry of known) MutableHashMap.set(account.costAllocationTags, entry.TagKey, entry.Status);
  const errors = A.map(unknown, (entry) => ({
    TagKey: entry.TagKey,
    Code: "TagKeysNotFoundException",
    Message: "Tag key not found",
  }));
  return json(A.isArrayNonEmpty(errors) ? { Errors: errors } : {});
};

const getComputeOptimizerEnrollment: JsonHandler = (account) => json(account.computeOptimizer);

const updateComputeOptimizerEnrollment: JsonHandler = (account, input) => {
  account.computeOptimizer = {
    status: input.status ?? "Inactive",
    memberAccountsEnrolled: input.includeMemberAccounts ?? false,
  };
  return json({ status: input.status });
};

const listHubEnrollments: JsonHandler = (account) =>
  json({
    items: [{ accountId, status: account.costOptimizationHub.status }],
    includeMemberAccounts: account.costOptimizationHub.includeMemberAccounts,
  });

const updateHubEnrollment: JsonHandler = (account, input) => {
  account.costOptimizationHub = {
    status: input.status ?? "Inactive",
    includeMemberAccounts: input.includeMemberAccounts ?? false,
  };
  return json({ status: input.status });
};

/** awsJson services by endpoint host prefix, each with its operation table. */
const jsonServices: ReadonlyArray<{
  readonly prefix: string;
  readonly service: string;
  readonly operations: Readonly<Record<string, JsonHandler>>;
}> = [
  {
    prefix: "ce.",
    service: "ce",
    operations: {
      ListCostAllocationTags: listCostAllocationTags,
      UpdateCostAllocationTagsStatus: updateCostAllocationTagsStatus,
    },
  },
  {
    prefix: "compute-optimizer.",
    service: "compute-optimizer",
    operations: {
      GetEnrollmentStatus: getComputeOptimizerEnrollment,
      UpdateEnrollmentStatus: updateComputeOptimizerEnrollment,
    },
  },
  {
    prefix: "cost-optimization-hub.",
    service: "cost-optimization-hub",
    operations: { ListEnrollmentStatuses: listHubEnrollments, UpdateEnrollmentStatus: updateHubEnrollment },
  },
];

// ---------------------------------------------------------------------------
// EC2 (query protocol)
// ---------------------------------------------------------------------------

/** Values of `<prefix>.1`, `<prefix>.2`, ... in request order. */
const listParam = (params: Record<string, string>, prefix: string): Array<string> =>
  pipe(
    R.toEntries(params),
    A.filter(([key]) => new RegExp(`^${prefix}\\.\\d+$`).test(key)),
    A.map(([, value]) => value)
  );

/** `<prefix>.N.Key` / `<prefix>.N.Value` pairs as a record. */
const tagParams = (params: Record<string, string>, prefix: string): Record<string, string> =>
  pipe(
    R.toEntries(params),
    A.flatMap(([key, value]) => {
      const match = new RegExp(`^${prefix}\\.(\\d+)\\.Key$`).exec(key);
      return match === null ? [] : [[value, params[`${prefix}.${match[1]}.Value`] ?? ""] as const];
    }),
    R.fromEntries
  );

/** The `LaunchTemplateData.*` params with the prefix removed. */
const templateData = (params: Record<string, string>): Record<string, string> =>
  pipe(
    R.toEntries(params),
    A.filter(([key]) => Str.startsWith("LaunchTemplateData.")(key)),
    A.map(([key, value]) => [Str.slice("LaunchTemplateData.".length)(key), value] as const),
    R.fromEntries
  );

const templateById = (account: FakeAccount, id: string | undefined): LaunchTemplateRecord | undefined =>
  id === undefined ? undefined : pipe(account.launchTemplates, MutableHashMap.get(id), O.getOrUndefined);

const templateNotFound = () =>
  ec2Error("InvalidLaunchTemplateId.NotFound", "The specified launch template does not exist.");

const templateResponse = (operation: string, template: LaunchTemplateRecord) =>
  xml(operation, `<launchTemplate>${launchTemplateXml(template)}</launchTemplate>`);

type Ec2Handler = (account: FakeAccount, operation: string, params: Record<string, string>) => FakeResponse;

const matchesFilter = (filter: ReadonlyArray<string>, value: string) =>
  A.isReadonlyArrayEmpty(filter) || A.contains(filter, value);

const describeLaunchTemplates: Ec2Handler = (account, operation, params) => {
  const ids = listParam(params, "LaunchTemplateId");
  const names = listParam(params, "LaunchTemplateName");
  const found = pipe(
    account.launchTemplates,
    MutableHashMap.values,
    A.fromIterable,
    A.filter((template) => matchesFilter(ids, template.id) && matchesFilter(names, template.name))
  );
  if (A.isArrayEmpty(found) && A.isArrayNonEmpty(names)) {
    return ec2Error(
      "InvalidLaunchTemplateName.NotFoundException",
      "At least one of the launch templates specified in the request does not exist."
    );
  }
  if (A.isArrayEmpty(found) && A.isArrayNonEmpty(ids)) return templateNotFound();
  const items = A.join(
    A.map(found, (template) => `<item>${launchTemplateXml(template)}</item>`),
    ""
  );
  return xml(operation, `<launchTemplates>${items}</launchTemplates>`);
};

const createLaunchTemplate: Ec2Handler = (account, operation, params) => {
  const name = params.LaunchTemplateName ?? "";
  if (findLaunchTemplate(account, name) !== undefined) {
    return ec2Error("InvalidLaunchTemplateName.AlreadyExistsException", `Launch template name already in use: ${name}`);
  }
  const id = seedLaunchTemplate(account, name, tagParams(params, "TagSpecification.1.Tag"));
  const template = templateById(account, id);
  if (template === undefined) return templateNotFound();
  template.versions[0] = templateData(params);
  return templateResponse(operation, template);
};

const createLaunchTemplateVersion: Ec2Handler = (account, operation, params) => {
  const template = templateById(account, params.LaunchTemplateId);
  if (template === undefined) return templateNotFound();
  template.versions.push(templateData(params));
  return xml(
    operation,
    `<launchTemplateVersion><launchTemplateId>${template.id}</launchTemplateId><versionNumber>${template.versions.length}</versionNumber></launchTemplateVersion>`
  );
};

const modifyLaunchTemplate: Ec2Handler = (account, operation, params) => {
  const template = templateById(account, params.LaunchTemplateId);
  if (template === undefined) return templateNotFound();
  template.defaultVersion = Number(params.SetDefaultVersion ?? template.defaultVersion);
  return templateResponse(operation, template);
};

const deleteLaunchTemplate: Ec2Handler = (account, operation, params) => {
  const template = templateById(account, params.LaunchTemplateId);
  if (template === undefined) return templateNotFound();
  MutableHashMap.remove(account.launchTemplates, template.id);
  return templateResponse(operation, template);
};

const retag =
  (apply: (current: Record<string, string>, tags: Record<string, string>) => Record<string, string>): Ec2Handler =>
  (account, operation, params) => {
    const tags = tagParams(params, "Tag");
    const templates = A.flatMap(listParam(params, "ResourceId"), (id) => {
      const template = templateById(account, id);
      return template === undefined ? [] : [template];
    });
    for (const template of templates) template.tags = apply(template.tags, tags);
    return xml(operation, "<return>true</return>");
  };

const ec2Operations: Readonly<Record<string, Ec2Handler>> = {
  DescribeLaunchTemplates: describeLaunchTemplates,
  CreateLaunchTemplate: createLaunchTemplate,
  CreateLaunchTemplateVersion: createLaunchTemplateVersion,
  ModifyLaunchTemplate: modifyLaunchTemplate,
  DeleteLaunchTemplate: deleteLaunchTemplate,
  CreateTags: retag((current, tags) => ({ ...current, ...tags })),
  DeleteTags: retag((current, tags) => R.filter(current, (_, key) => !(key in tags))),
};

// ---------------------------------------------------------------------------
// HTTP routing
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();

const bodyText = (request: HttpClientRequest.HttpClientRequest): string =>
  request.body._tag === "Uint8Array" ? decoder.decode(request.body.body) : "";

const lastSegment = (target: string) =>
  pipe(
    target,
    Str.split("."),
    A.last,
    O.getOrElse(() => target)
  );

const routeJson = Effect.fn("FakeAws.routeJson")(function* (
  account: FakeAccount,
  target: string,
  text: string,
  host: string
) {
  const operation = lastSegment(target);
  const input = yield* decodeJsonInput(text === "" ? "{}" : text);
  const service = A.findFirst(jsonServices, (candidate) => Str.startsWith(candidate.prefix)(host));
  if (O.isNone(service)) return jsonError("UnknownServiceException", host);
  account.calls.push(`${service.value.service}:${operation}`);
  const handler = service.value.operations[operation];
  return handler === undefined ? jsonError("UnknownOperationException", operation) : handler(account, input);
});

const routeEc2 = (account: FakeAccount, text: string): FakeResponse => {
  const params = R.fromEntries(new URLSearchParams(text).entries());
  const operation = params.Action ?? "";
  account.calls.push(`ec2:${operation}`);
  const handler = ec2Operations[operation];
  return handler === undefined
    ? ec2Error("InvalidAction", `unsupported operation ${operation}`)
    : handler(account, operation, params);
};

const route = Effect.fn("FakeAws.route")(function* (
  account: FakeAccount,
  request: HttpClientRequest.HttpClientRequest,
  url: URL
) {
  const target = request.headers["x-amz-target"];
  const text = bodyText(request);
  return target === undefined ? routeEc2(account, text) : yield* routeJson(account, target, text, url.hostname);
});

/** An effect `HttpClient` that serves `account`. */
const httpClient = (account: FakeAccount): HttpClient.HttpClient =>
  HttpClient.make(
    Effect.fn("FakeAws.send")(function* (request, url) {
      const response = yield* route(account, request, url);
      const body = response.json === undefined ? response.body : yield* encodeJson(response.json);
      return HttpClientResponse.fromWeb(
        request,
        new Response(body, { status: response.status, headers: { "content-type": response.contentType } })
      );
    }, Effect.orDie)
  );

const environment = Layer.succeed(
  AWSEnvironment,
  Effect.succeed({
    accountId,
    region,
    credentials: Effect.succeed({
      accessKeyId: Redacted.make("test"),
      secretAccessKey: Redacted.make("test"),
      sessionToken: undefined,
      region,
    }),
  })
);

/**
 * The package's providers pinned to a fake environment, with the fake HTTP
 * client merged into the lifecycle context so no request leaves the process.
 */
const providers = (account: FakeAccount) =>
  AwsExtras.providers.pipe(
    Layer.provide(environment),
    Layer.provideMerge(Layer.succeed(HttpClient.HttpClient, httpClient(account)))
  );

/**
 * One isolated fake account plus the `@alchemy.run/test` API bound to it.
 * Tests in a file run concurrently, so each test case takes its own harness.
 */
/** Failure surfaced by a scratch deploy or destroy (engine and provider errors are tagged). */
export interface StackFailure {
  readonly _tag: string;
}

/**
 * Typed view of the harness scratch stack. `ScratchStack` types its failures
 * as `any`; this view names them so test bodies stay inside the repo's Effect
 * diagnostics.
 */
export interface TypedStack {
  deploy<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<Input.Resolve<A>, StackFailure>;
  destroy(options?: { readonly include?: never; readonly exclude?: never }): Effect.Effect<void, StackFailure>;
}

export const harness = (seed?: Parameters<typeof makeAccount>[0]) => {
  const account = makeAccount(seed);
  const { test } = Test.make({ providers: providers(account), state: inMemoryState() });
  const provider = (name: string, body: (stack: TypedStack) => Effect.Effect<void, StackFailure>) =>
    test.provider(name, (stack) => {
      const typed: TypedStack = stack;
      return body(typed);
    });
  return {
    account,
    provider,
    findLaunchTemplate: (name: string) => findLaunchTemplate(account, name),
    seedLaunchTemplate: (name: string, tags?: Record<string, string>) => seedLaunchTemplate(account, name, tags),
  };
};

/**
 * Run a deploy expected to fail and return its failure; a success fails the
 * test with the deployed output.
 */
export const deployFailure =
  (stack: TypedStack) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<StackFailure, StackFailure> =>
    stack.deploy(effect).pipe(
      Effect.flip,
      Effect.mapError((): StackFailure => ({ _tag: "UnexpectedDeploySuccess" }))
    );

/** Every `_tag` in a failure and its nested causes, outermost first. */
export const failureTags = (failure: unknown): Array<string> => {
  const tags: Array<string> = [];
  let current: unknown = failure;
  while (P.hasProperty(current, "_tag") && P.isString(current._tag)) {
    tags.push(current._tag);
    current = P.hasProperty(current, "cause") ? current.cause : undefined;
  }
  return tags;
};
