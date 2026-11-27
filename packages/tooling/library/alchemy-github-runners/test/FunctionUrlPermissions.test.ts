/**
 * The function URL permission reconcile the repo patches into
 * `@alchemy.run/aws` (`patches/@alchemy.run%2Faws@2.0.0-beta.87.patch`).
 *
 * The webhook function's URL has auth NONE and needs two resource policy
 * statements. The unpatched provider removed and re-added both on every
 * deploy, so the URL answered 403 between the calls and GitHub, which does
 * not retry a failed delivery, lost the `workflow_job` events sent then. The
 * patched provider reads the policy first and writes only what differs; these
 * tests pin the calls it makes, through the real distilled serialization
 * against a fake Lambda policy API, and the pure plan behind them.
 *
 * The package ships the provider twice: `src` (what Bun, and so the deploy,
 * loads) and `lib` (what the package's default export condition resolves to).
 * The patch edits both, so every test here runs against each copy, loaded by
 * path, and one test holds the two to the same answers.
 */

import { FunctionUrlPublicAccessStatementId, FunctionUrlPublicInvokeStatementId } from "@alchemy.run/aws/Lambda";
import * as AwsCredentials from "@distilled.cloud/aws/Credentials";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity, pipe } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as AwsLambda from "@alchemy.run/aws/Lambda";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";

type Provider = Pick<
  typeof AwsLambda,
  | "functionPolicyStatements"
  | "planFunctionUrlPermissionCalls"
  | "publicFunctionUrlPermissions"
  | "reconcileFunctionUrlPermissions"
>;

const packageMarker = "/@alchemy.run/aws/";
const resolvedEntry = import.meta.resolve("@alchemy.run/aws/Lambda");
const resolvedCopyPackageRoot = `${pipe(resolvedEntry, Str.split(packageMarker), A.headNonEmpty)}${packageMarker}`;
const copyPath = { src: "src/Lambda/Function.ts", lib: "lib/Lambda/Function.js" } as const;
const srcProvider: Provider = await import(/* @vite-ignore */ `${resolvedCopyPackageRoot}${copyPath.src}`);
const libProvider: Provider = await import(/* @vite-ignore */ `${resolvedCopyPackageRoot}${copyPath.lib}`);
const RawText = S.Struct({ default: S.String });
const decodeRawText = S.decodeUnknownEffect(RawText);
const copyTextViaViteRawImport = (copy: keyof typeof copyPath) =>
  Effect.promise(() => import(/* @vite-ignore */ `${resolvedCopyPackageRoot}${copyPath[copy]}?raw`)).pipe(
    Effect.flatMap(decodeRawText),
    Effect.map((module) => module.default)
  );
const providerCopies = [
  ["src", srcProvider],
  ["lib", libProvider],
] as const;

const functionName = "beep-fleet-prod-webhook";
const functionArn = `arn:aws:lambda:us-east-1:123456789012:function:${functionName}`;
const policyPath = `/2015-03-31/functions/${functionName}/policy`;

type GetPolicyStatement = Readonly<Record<string, unknown>> & {
  readonly Sid: string;
  readonly Condition: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
};

const accessStatement = (resource = functionArn): GetPolicyStatement => ({
  Sid: FunctionUrlPublicAccessStatementId,
  Effect: "Allow",
  Principal: "*",
  Action: "lambda:InvokeFunctionUrl",
  Resource: resource,
  Condition: { StringEquals: { "lambda:FunctionUrlAuthType": "NONE" } },
});

const invokeStatement = (resource = functionArn): GetPolicyStatement => ({
  Sid: FunctionUrlPublicInvokeStatementId,
  Effect: "Allow",
  Principal: "*",
  Action: "lambda:InvokeFunction",
  Resource: resource,
  Condition: { Bool: { "lambda:InvokedViaFunctionUrl": "true" } },
});

const AddPermissionBody = S.Struct({
  StatementId: S.String,
  Action: S.String,
  Principal: S.String,
  FunctionUrlAuthType: S.optionalKey(S.String),
  InvokedViaFunctionUrl: S.optionalKey(S.Boolean),
});
type AddPermissionBody = typeof AddPermissionBody.Type;
const decodeAddPermissionBody = S.decodeUnknownEffect(S.fromJsonString(AddPermissionBody));
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const statementLambdaStoresForAdd = (body: AddPermissionBody, resource: string): GetPolicyStatement => ({
  Sid: body.StatementId,
  Effect: "Allow",
  Principal: body.Principal,
  Action: body.Action,
  Resource: resource,
  Condition:
    body.FunctionUrlAuthType === undefined
      ? { Bool: { "lambda:InvokedViaFunctionUrl": `${body.InvokedViaFunctionUrl ?? false}` } }
      : { StringEquals: { "lambda:FunctionUrlAuthType": body.FunctionUrlAuthType } },
});

interface FakeLambdaPolicy {
  readonly calls: Array<string>;
  readonly qualifiers: Array<string | null>;
  readonly racingWrites: Array<GetPolicyStatement>;
  readonly statements: MutableHashMap.MutableHashMap<string, GetPolicyStatement>;
}

const fakeLambdaPolicy = (...seed: ReadonlyArray<GetPolicyStatement>): FakeLambdaPolicy => ({
  calls: [],
  racingWrites: [],
  qualifiers: [],
  statements: MutableHashMap.fromIterable(A.map(seed, (statement) => [statement.Sid, statement] as const)),
});

interface FakeAnswer {
  readonly body: unknown;
  readonly errorType?: string;
  readonly status: number;
}

const lambdaError = (status: number, errorType: string): FakeAnswer => ({
  status,
  errorType,
  body: { Type: "User", message: errorType },
});

const decoder = new TextDecoder();

const getPolicy = Effect.fn("FakeLambdaPolicy.getPolicy")(function* (fake: FakeLambdaPolicy) {
  fake.calls.push("GetPolicy");
  const statements = fake.statements.pipe(MutableHashMap.values, A.fromIterable);
  for (const statement of fake.racingWrites.splice(0)) MutableHashMap.set(fake.statements, statement.Sid, statement);
  if (A.isArrayEmpty(statements)) return lambdaError(404, "ResourceNotFoundException");
  const policy = yield* encodeJson({ Version: "2012-10-17", Id: "default", Statement: statements });
  return { status: 200, body: { Policy: policy, RevisionId: "revision" } };
});

const addPermission = Effect.fn("FakeLambdaPolicy.addPermission")(function* (
  fake: FakeLambdaPolicy,
  request: HttpClientRequest.HttpClientRequest,
  resource: string
) {
  const body = yield* decodeAddPermissionBody(
    request.body._tag === "Uint8Array" ? decoder.decode(request.body.body) : ""
  );
  fake.calls.push(`AddPermission ${body.StatementId}`);
  if (MutableHashMap.has(fake.statements, body.StatementId)) return lambdaError(409, "ResourceConflictException");
  const statement = statementLambdaStoresForAdd(body, resource);
  MutableHashMap.set(fake.statements, body.StatementId, statement);
  return { status: 201, body: { Statement: yield* encodeJson(statement) } };
});

const removePermission = (fake: FakeLambdaPolicy, url: URL): FakeAnswer => {
  const sid = pipe(
    url.pathname,
    Str.split("/"),
    A.last,
    O.getOrElse(() => "")
  );
  fake.calls.push(`RemovePermission ${sid}`);
  if (!MutableHashMap.has(fake.statements, sid)) return lambdaError(404, "ResourceNotFoundException");
  MutableHashMap.remove(fake.statements, sid);
  return { status: 204, body: undefined };
};

const route = Effect.fn("FakeLambdaPolicy.route")(function* (
  fake: FakeLambdaPolicy,
  request: HttpClientRequest.HttpClientRequest,
  url: URL
) {
  if (!Str.startsWith(policyPath)(url.pathname)) return lambdaError(404, "UnknownOperationException");
  const qualifier = url.searchParams.get("Qualifier");
  fake.qualifiers.push(qualifier);
  const resource = qualifier === null ? functionArn : `${functionArn}:${qualifier}`;
  if (request.method === "GET") return yield* getPolicy(fake);
  if (request.method === "POST") return yield* addPermission(fake, request, resource);
  return removePermission(fake, url);
});

const fakeLambdaPolicyHttpClient = (fake: FakeLambdaPolicy): HttpClient.HttpClient =>
  HttpClient.make(
    Effect.fn("FakeLambdaPolicy.send")(function* (request, url) {
      const answer = yield* route(fake, request, url);
      const body = answer.body === undefined ? null : yield* encodeJson(answer.body);
      return HttpClientResponse.fromWeb(
        request,
        new Response(body, {
          status: answer.status,
          headers: {
            "content-type": "application/json",
            ...(answer.errorType === undefined ? {} : { "x-amzn-errortype": answer.errorType }),
          },
        })
      );
    }, Effect.orDie)
  );

const reconcileWith = (provider: Provider) => (fake: FakeLambdaPolicy, qualifier?: string) =>
  Layer.mergeAll(Layer.succeed(HttpClient.HttpClient, fakeLambdaPolicyHttpClient(fake)), AwsCredentials.mock).pipe(
    Layer.build,
    Effect.flatMap((context) =>
      provider
        .reconcileFunctionUrlPermissions({
          functionName,
          qualifier,
          declared: provider.publicFunctionUrlPermissions,
          retry: identity,
        })
        .pipe(Effect.provideContext(context))
    )
  );

const forgetCallsKeepStatements = (fake: FakeLambdaPolicy) => {
  fake.calls.length = 0;
  fake.qualifiers.length = 0;
};

describe.each(providerCopies)("the %s copy of the patched provider", (copy, provider) => {
  const reconcile = reconcileWith(provider);
  const { functionPolicyStatements } = provider;

  describe("function URL permission reconcile over the Lambda API", () => {
    it.effect("no policy yet: GetPolicy, then one AddPermission per statement and no RemovePermission", () =>
      Effect.gen(function* () {
        const fake = fakeLambdaPolicy();
        yield* reconcile(fake);
        expect(fake.calls).toStrictEqual([
          "GetPolicy",
          `AddPermission ${FunctionUrlPublicAccessStatementId}`,
          `AddPermission ${FunctionUrlPublicInvokeStatementId}`,
        ]);
        expect(MutableHashMap.size(fake.statements)).toBe(2);
      })
    );

    it.effect("unchanged statements: a redeploy reads the policy and writes nothing", () =>
      Effect.gen(function* () {
        const fake = fakeLambdaPolicy();
        yield* reconcile(fake);
        forgetCallsKeepStatements(fake);
        const calls = yield* reconcile(fake);
        expect(fake.calls).toStrictEqual(["GetPolicy"]);
        expect(calls).toStrictEqual([]);
      })
    );

    it.effect("statements AWS stored itself, with another statement beside them, are left alone", () =>
      Effect.gen(function* () {
        const fake = fakeLambdaPolicy(
          {
            Sid: "AllowEventBridge",
            Effect: "Allow",
            Principal: { Service: "events.amazonaws.com" },
            Action: "lambda:InvokeFunction",
            Resource: functionArn,
            Condition: { ArnLike: { "AWS:SourceArn": "arn:aws:events:us-east-1:123456789012:rule/r" } },
          },
          accessStatement(),
          invokeStatement()
        );
        yield* reconcile(fake);
        expect(fake.calls).toStrictEqual(["GetPolicy"]);
      })
    );

    it.effect("one statement differs: RemovePermission then AddPermission for it, nothing for the other", () =>
      Effect.gen(function* () {
        const fake = fakeLambdaPolicy(accessStatement(), {
          ...invokeStatement(),
          Condition: { Bool: { "lambda:InvokedViaFunctionUrl": "false" } },
        });
        yield* reconcile(fake);
        expect(fake.calls).toStrictEqual([
          "GetPolicy",
          `RemovePermission ${FunctionUrlPublicInvokeStatementId}`,
          `AddPermission ${FunctionUrlPublicInvokeStatementId}`,
        ]);
        const condition = O.map(
          MutableHashMap.get(fake.statements, FunctionUrlPublicInvokeStatementId),
          (statement) => statement.Condition
        );
        assertSome(condition, { Bool: { "lambda:InvokedViaFunctionUrl": "true" } });
      })
    );

    it.effect("an add that conflicts with an equal statement written meanwhile re-reads and writes nothing more", () =>
      Effect.gen(function* () {
        const fake = fakeLambdaPolicy();
        fake.racingWrites.push(accessStatement());
        yield* reconcile(fake);
        expect(fake.calls).toStrictEqual([
          "GetPolicy",
          `AddPermission ${FunctionUrlPublicAccessStatementId}`,
          "GetPolicy",
          `AddPermission ${FunctionUrlPublicInvokeStatementId}`,
        ]);
        expect(MutableHashMap.size(fake.statements)).toBe(2);
      })
    );

    it.effect("an add that conflicts with a differing statement written meanwhile re-reads, removes and adds", () =>
      Effect.gen(function* () {
        const fake = fakeLambdaPolicy();
        fake.racingWrites.push({ ...accessStatement(), Action: "lambda:InvokeFunction" });
        yield* reconcile(fake);
        expect(fake.calls).toStrictEqual([
          "GetPolicy",
          `AddPermission ${FunctionUrlPublicAccessStatementId}`,
          "GetPolicy",
          `RemovePermission ${FunctionUrlPublicAccessStatementId}`,
          `AddPermission ${FunctionUrlPublicAccessStatementId}`,
          `AddPermission ${FunctionUrlPublicInvokeStatementId}`,
        ]);
        const action = O.map(
          MutableHashMap.get(fake.statements, FunctionUrlPublicAccessStatementId),
          (statement) => statement.Action
        );
        assertSome(action, "lambda:InvokeFunctionUrl");
      })
    );

    it.effect("an alias URL reads and writes the alias's policy", () =>
      Effect.gen(function* () {
        const fake = fakeLambdaPolicy();
        yield* reconcile(fake, "live");
        expect(fake.qualifiers).toStrictEqual(["live", "live", "live"]);
        forgetCallsKeepStatements(fake);
        yield* reconcile(fake, "live");
        expect(fake.calls).toStrictEqual(["GetPolicy"]);
      })
    );
  });

  const plan = (current: ReadonlyArray<unknown>, qualifier?: string) =>
    provider.planFunctionUrlPermissionCalls({
      current,
      declared: provider.publicFunctionUrlPermissions,
      functionName,
      qualifier,
    });

  const replaceInvoke = [
    { _tag: "RemovePermission", statementId: FunctionUrlPublicInvokeStatementId },
    { _tag: "AddPermission", statementId: FunctionUrlPublicInvokeStatementId },
  ];

  describe("planFunctionUrlPermissionCalls", () => {
    it("plans nothing for both statements held unchanged", () => {
      expect(plan([accessStatement(), invokeStatement()])).toStrictEqual([]);
    });

    it("compares AWS's stored form: key order, one-element lists, boolean strings, principal form, the ARN", () => {
      const access = {
        Condition: { StringEquals: { "lambda:FunctionUrlAuthType": ["NONE"] } },
        Resource: [functionArn],
        Action: ["lambda:InvokeFunctionUrl"],
        Principal: { AWS: "*" },
        Effect: "Allow",
        Sid: FunctionUrlPublicAccessStatementId,
      };
      const invoke = { ...invokeStatement(), Condition: { Bool: { "lambda:InvokedViaFunctionUrl": true } } };
      expect(plan([access, invoke])).toStrictEqual([]);
      expect(
        plan([accessStatement(`${functionArn}:live`), invokeStatement(`${functionArn}:live`)], "live")
      ).toStrictEqual([]);
      const otherAccount = Str.replace("123456789012", "210987654321")(functionArn);
      expect(plan([accessStatement(otherAccount), invokeStatement(otherAccount)])).toStrictEqual([]);
    });

    it("adds both statements when the function has none, and leaves statements with other Sids alone", () => {
      const adds = [
        { _tag: "AddPermission", statementId: FunctionUrlPublicAccessStatementId },
        { _tag: "AddPermission", statementId: FunctionUrlPublicInvokeStatementId },
      ];
      expect(plan([])).toStrictEqual(adds);
      expect(plan([{ ...accessStatement(), Sid: "Other" }, "not a statement", null])).toStrictEqual(adds);
    });

    it("adds only the missing statement", () => {
      expect(plan([accessStatement()])).toStrictEqual([
        { _tag: "AddPermission", statementId: FunctionUrlPublicInvokeStatementId },
      ]);
    });

    it("removes then adds a statement held under the Sid with other content", () => {
      const differing: ReadonlyArray<GetPolicyStatement> = [
        { ...invokeStatement(), Effect: "Deny" },
        { ...invokeStatement(), Principal: { AWS: "arn:aws:iam::123456789012:root" } },
        { ...invokeStatement(), Action: ["lambda:InvokeFunction", "lambda:GetFunction"] },
        { ...invokeStatement(), Condition: { Bool: { "lambda:InvokedViaFunctionUrl": "false" } } },
        {
          ...invokeStatement(),
          Condition: { ...invokeStatement().Condition, ArnLike: { "AWS:SourceArn": "arn:aws:s3:::bucket" } },
        },
        { ...invokeStatement(), NotPrincipal: "*" },
        invokeStatement(`${functionArn}-other`),
        invokeStatement(`${functionArn}:live`),
        invokeStatement("*"),
      ];
      for (const statement of differing) {
        expect(plan([accessStatement(), statement])).toStrictEqual(replaceInvoke);
      }
      expect(plan([accessStatement(`${functionArn}:live`), invokeStatement(functionArn)], "live")).toStrictEqual(
        replaceInvoke
      );
    });

    it("reads a policy document's statements", () => {
      const access = '{"Sid":"FunctionURLAllowPublicAccess","Effect":"Allow"}';
      expect(functionPolicyStatements(undefined)).toStrictEqual([]);
      expect(functionPolicyStatements('{"Version":"2012-10-17"}')).toStrictEqual([]);
      expect(functionPolicyStatements(`{"Statement":${access}}`)).toStrictEqual([
        { Sid: FunctionUrlPublicAccessStatementId, Effect: "Allow" },
      ]);
      expect(functionPolicyStatements(`{"Statement":[${access}]}`)).toStrictEqual([
        { Sid: FunctionUrlPublicAccessStatementId, Effect: "Allow" },
      ]);
      expect(functionPolicyStatements("{not json")).toBeUndefined();
      expect(functionPolicyStatements("[]")).toBeUndefined();
      expect(functionPolicyStatements('{"Statement":"x"}')).toBeUndefined();
    });

    it.effect("is what this copy of the provider runs for a public function URL", () =>
      Effect.gen(function* () {
        const source = yield* copyTextViaViteRawImport(copy);
        const body = pipe(
          source,
          Str.split("const upsertPublicFunctionUrlPermissions = Effect.fn("),
          A.get(1),
          O.map(Str.split("const deleteFunctionUrl = ")),
          O.flatMap(A.head),
          O.getOrElse(() => "")
        );
        expect(
          Str.includes("yield* reconcileFunctionUrlPermissions({")(body),
          "a patch regenerated without this hunk keeps every reconcile test above green"
        ).toBe(true);
        expect(Str.includes("declared: publicFunctionUrlPermissions")(body)).toBe(true);
        expect(Str.includes("removePermission")(body)).toBe(false);
        expect(Str.includes("yield* upsertPublicFunctionUrlPermissions(functionName, qualifier)")(source)).toBe(true);
      })
    );
  });
});

describe("the src and lib copies of the patched provider", () => {
  const arn = functionArn;
  const cases: ReadonlyArray<readonly [name: string, current: ReadonlyArray<unknown>, qualifier?: string]> = [
    ["unchanged", [accessStatement(), invokeStatement()]],
    ["no policy", []],
    ["one missing", [accessStatement()]],
    [
      "AWS stored form beside an unrelated statement",
      [
        { ...accessStatement(), Principal: { AWS: "*" }, Action: ["lambda:InvokeFunctionUrl"] },
        { ...invokeStatement(), Condition: { Bool: { "lambda:InvokedViaFunctionUrl": true } } },
        { Sid: "Events", Effect: "Allow" },
      ],
    ],
    ["a differing action", [accessStatement(), { ...invokeStatement(), Action: "lambda:*" }]],
    ["an extra key", [accessStatement(), { ...invokeStatement(), NotPrincipal: "*" }]],
    ["another function's ARN", [accessStatement(`${arn}-other`), invokeStatement()]],
    ["a qualifier", [accessStatement(`${arn}:live`), invokeStatement(`${arn}:live`)], "live"],
    ["a qualifier mismatch", [accessStatement(`${arn}:live`), invokeStatement()], "live"],
  ];
  const planOf = (provider: Provider) =>
    A.map(cases, ([name, current, qualifier]) => [
      name,
      provider.planFunctionUrlPermissionCalls({
        current,
        declared: provider.publicFunctionUrlPermissions,
        functionName,
        qualifier,
      }),
    ]);
  const policies = [undefined, '{"Version":"2012-10-17"}', '{"Statement":{"Sid":"x"}}', "{not json", "[]"];

  it("plan the same calls for every case and read a policy document alike", () => {
    expect(planOf(srcProvider)).toStrictEqual(planOf(libProvider));
    expect(A.map(planOf(srcProvider), ([, calls]) => A.isArray(calls) && calls.length)).toStrictEqual([
      0, 2, 1, 0, 2, 2, 2, 0, 2,
    ]);
    expect(A.map(policies, srcProvider.functionPolicyStatements)).toStrictEqual(
      A.map(policies, libProvider.functionPolicyStatements)
    );
    expect(srcProvider.publicFunctionUrlPermissions).toStrictEqual(libProvider.publicFunctionUrlPermissions);
  });
});
