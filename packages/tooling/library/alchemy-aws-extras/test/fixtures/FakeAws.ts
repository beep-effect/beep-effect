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

export const makeAccount = (seed?: {
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

const costExplorer = (account: FakeAccount, operation: string, input: JsonInput): FakeResponse => {
  switch (operation) {
    case "ListCostAllocationTags": {
      const keys = input.TagKeys;
      const tags = A.filter(
        A.fromIterable(account.costAllocationTags),
        ([key]) => keys === undefined || A.contains(keys, key)
      );
      return json({
        CostAllocationTags: A.map(tags, ([TagKey, Status]) => ({ TagKey, Status, Type: "UserDefined" })),
      });
    }
    case "UpdateCostAllocationTagsStatus": {
      const errors: Array<unknown> = [];
      for (const entry of input.CostAllocationTagsStatus ?? []) {
        if (MutableHashMap.has(account.costAllocationTags, entry.TagKey)) {
          MutableHashMap.set(account.costAllocationTags, entry.TagKey, entry.Status);
        } else {
          errors.push({ TagKey: entry.TagKey, Code: "TagKeysNotFoundException", Message: "Tag key not found" });
        }
      }
      return json(A.isArrayNonEmpty(errors) ? { Errors: errors } : {});
    }
    default:
      return jsonError("UnknownOperationException", operation);
  }
};

const computeOptimizer = (account: FakeAccount, operation: string, input: JsonInput): FakeResponse => {
  switch (operation) {
    case "GetEnrollmentStatus":
      return json(account.computeOptimizer);
    case "UpdateEnrollmentStatus":
      account.computeOptimizer = {
        status: input.status ?? "Inactive",
        memberAccountsEnrolled: input.includeMemberAccounts ?? false,
      };
      return json({ status: input.status });
    default:
      return jsonError("UnknownOperationException", operation);
  }
};

const costOptimizationHub = (account: FakeAccount, operation: string, input: JsonInput): FakeResponse => {
  switch (operation) {
    case "ListEnrollmentStatuses":
      return json({
        items: [{ accountId, status: account.costOptimizationHub.status }],
        includeMemberAccounts: account.costOptimizationHub.includeMemberAccounts,
      });
    case "UpdateEnrollmentStatus":
      account.costOptimizationHub = {
        status: input.status ?? "Inactive",
        includeMemberAccounts: input.includeMemberAccounts ?? false,
      };
      return json({ status: input.status });
    default:
      return jsonError("UnknownOperationException", operation);
  }
};

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
const tagParams = (params: Record<string, string>, prefix: string): Record<string, string> => {
  const tags: Record<string, string> = {};
  for (const [key, value] of R.toEntries(params)) {
    const match = new RegExp(`^${prefix}\\.(\\d+)\\.Key$`).exec(key);
    if (match !== null) tags[value] = params[`${prefix}.${match[1]}.Value`] ?? "";
  }
  return tags;
};

/** The `LaunchTemplateData.*` params with the prefix removed. */
const templateData = (params: Record<string, string>): Record<string, string> =>
  pipe(
    R.toEntries(params),
    A.filter(([key]) => Str.startsWith("LaunchTemplateData.")(key)),
    A.map(([key, value]) => [Str.slice("LaunchTemplateData.".length)(key), value] as const),
    R.fromEntries
  );

const ec2 = (account: FakeAccount, operation: string, params: Record<string, string>): FakeResponse => {
  const byId = (id: string | undefined) =>
    id === undefined ? undefined : pipe(account.launchTemplates, MutableHashMap.get(id), O.getOrUndefined);
  switch (operation) {
    case "DescribeLaunchTemplates": {
      const ids = listParam(params, "LaunchTemplateId");
      const names = listParam(params, "LaunchTemplateName");
      const all = pipe(account.launchTemplates, MutableHashMap.values, A.fromIterable);
      const found = A.filter(
        all,
        (template) =>
          (A.isArrayEmpty(ids) || A.contains(ids, template.id)) &&
          (A.isArrayEmpty(names) || A.contains(names, template.name))
      );
      if (A.isArrayNonEmpty(names) && A.isArrayEmpty(found)) {
        return ec2Error(
          "InvalidLaunchTemplateName.NotFoundException",
          "At least one of the launch templates specified in the request does not exist."
        );
      }
      if (A.isArrayNonEmpty(ids) && A.isArrayEmpty(found)) {
        return ec2Error("InvalidLaunchTemplateId.NotFound", "The specified launch template does not exist.");
      }
      return xml(
        operation,
        `<launchTemplates>${A.join(
          A.map(found, (template) => `<item>${launchTemplateXml(template)}</item>`),
          ""
        )}</launchTemplates>`
      );
    }
    case "CreateLaunchTemplate": {
      const name = params.LaunchTemplateName ?? "";
      if (findLaunchTemplate(account, name) !== undefined) {
        return ec2Error(
          "InvalidLaunchTemplateName.AlreadyExistsException",
          `Launch template name already in use: ${name}`
        );
      }
      const id = seedLaunchTemplate(account, name, tagParams(params, "TagSpecification.1.Tag"));
      const template = byId(id)!;
      template.versions[0] = templateData(params);
      return xml(operation, `<launchTemplate>${launchTemplateXml(template)}</launchTemplate>`);
    }
    case "CreateLaunchTemplateVersion": {
      const template = byId(params.LaunchTemplateId);
      if (template === undefined) return ec2Error("InvalidLaunchTemplateId.NotFound", "not found");
      template.versions.push(templateData(params));
      return xml(
        operation,
        `<launchTemplateVersion><launchTemplateId>${template.id}</launchTemplateId><versionNumber>${template.versions.length}</versionNumber></launchTemplateVersion>`
      );
    }
    case "ModifyLaunchTemplate": {
      const template = byId(params.LaunchTemplateId);
      if (template === undefined) return ec2Error("InvalidLaunchTemplateId.NotFound", "not found");
      template.defaultVersion = Number(params.SetDefaultVersion ?? params.DefaultVersion ?? template.defaultVersion);
      return xml(operation, `<launchTemplate>${launchTemplateXml(template)}</launchTemplate>`);
    }
    case "DeleteLaunchTemplate": {
      const template = byId(params.LaunchTemplateId);
      if (template === undefined) return ec2Error("InvalidLaunchTemplateId.NotFound", "not found");
      MutableHashMap.remove(account.launchTemplates, template.id);
      return xml(operation, `<launchTemplate>${launchTemplateXml(template)}</launchTemplate>`);
    }
    case "CreateTags":
    case "DeleteTags": {
      const tags = tagParams(params, "Tag");
      for (const resourceId of listParam(params, "ResourceId")) {
        const template = byId(resourceId);
        if (template === undefined) continue;
        template.tags =
          operation === "CreateTags"
            ? { ...template.tags, ...tags }
            : R.filter(template.tags, (_, key) => !(key in tags));
      }
      return xml(operation, "<return>true</return>");
    }
    default:
      return ec2Error("InvalidAction", `unsupported operation ${operation}`);
  }
};

// ---------------------------------------------------------------------------
// HTTP routing
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();

const bodyText = (request: HttpClientRequest.HttpClientRequest): string =>
  request.body._tag === "Uint8Array" ? decoder.decode(request.body.body) : "";

const route = Effect.fn("FakeAws.route")(function* (
  account: FakeAccount,
  request: HttpClientRequest.HttpClientRequest,
  url: URL
) {
  const target = request.headers["x-amz-target"];
  const text = bodyText(request);
  if (target !== undefined) {
    const operation = pipe(
      target,
      Str.split("."),
      A.last,
      O.getOrElse(() => target)
    );
    const input = yield* decodeJsonInput(text === "" ? "{}" : text);
    const host = url.hostname;
    if (Str.startsWith("ce.")(host)) {
      account.calls.push(`ce:${operation}`);
      return costExplorer(account, operation, input);
    }
    if (Str.startsWith("compute-optimizer.")(host)) {
      account.calls.push(`compute-optimizer:${operation}`);
      return computeOptimizer(account, operation, input);
    }
    if (Str.startsWith("cost-optimization-hub.")(host)) {
      account.calls.push(`cost-optimization-hub:${operation}`);
      return costOptimizationHub(account, operation, input);
    }
    return jsonError("UnknownServiceException", host);
  }
  const params = R.fromEntries(new URLSearchParams(text).entries());
  const operation = params.Action ?? "";
  account.calls.push(`ec2:${operation}`);
  return ec2(account, operation, params);
});

/** An effect `HttpClient` that serves `account`. */
export const httpClient = (account: FakeAccount): HttpClient.HttpClient =>
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
export const providers = (account: FakeAccount) =>
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
