/**
 * Hermetic fake of every AWS API the `CostControls` stack calls: Budgets,
 * Cost Explorer (anomaly monitors and subscriptions, resource tags, cost
 * allocation tags), Compute Optimizer and Cost Optimization Hub.
 *
 * The fake sits behind an effect `HttpClient`, so every distilled operation
 * (signing, awsJson serialization and response parsing included) runs for
 * real against an in-memory account. Same pattern as
 * `@beep/alchemy-aws-extras`'s test support.
 */

import { AWSEnvironment } from "@alchemy.run/aws/Environment";
import * as Test from "@alchemy.run/test/Vitest";
import { providers as costControlsProviders } from "@beep/infra-cost-controls/Providers";
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

/** The account `prod` expects; already public in the repository. */
const productionAccountId = "832907639880";
const region = "us-east-1";

type Tags = Record<string, string>;

interface Subscriber {
  readonly Address: string;
  readonly SubscriptionType: string;
}

interface BudgetNotification {
  readonly notification: Record<string, unknown>;
  subscribers: Array<Subscriber>;
}

export interface BudgetRecord {
  budget: Record<string, unknown>;
  readonly notifications: Array<BudgetNotification>;
  tags: Tags;
}

export interface MonitorRecord {
  readonly arn: string;
  readonly dimension: string | undefined;
  name: string;
  tags: Tags;
  readonly type: string;
}

export interface SubscriptionRecord {
  readonly arn: string;
  body: Record<string, unknown>;
  tags: Tags;
}

/** Mutable in-memory account the fake HTTP client serves. */
export interface FakeAccount {
  readonly accountId: string;
  readonly budgets: MutableHashMap.MutableHashMap<string, BudgetRecord>;
  /** Every operation called, in order, as `<service>:<Operation>`. */
  readonly calls: Array<string>;
  computeOptimizer: { status: string; memberAccountsEnrolled: boolean };
  /** Tag keys billing has ingested (only these may change status). */
  readonly costAllocationTags: MutableHashMap.MutableHashMap<string, string>;
  costOptimizationHub: { status: string; includeMemberAccounts: boolean };
  readonly monitors: MutableHashMap.MutableHashMap<string, MonitorRecord>;
  nextId: number;
  readonly subscriptions: MutableHashMap.MutableHashMap<string, SubscriptionRecord>;
}

export interface Seed {
  readonly accountId?: string;
  /** Budgets created outside the stack, by name. */
  readonly budgets?: ReadonlyArray<string>;
  readonly computeOptimizer?: string;
  readonly costAllocationTags?: Record<string, string>;
  readonly costOptimizationHub?: string;
  /** Anomaly monitors created outside the stack (no Alchemy tags). */
  readonly monitors?: ReadonlyArray<{ readonly name: string; readonly dimension: string }>;
  readonly region?: string;
}

/** The live account as read on 2026-11-13, owned by Pulumi. */
export const liveAccount: Seed = {
  costAllocationTags: {
    App: "Active",
    "beep-ci": "Active",
    DataClass: "Active",
    "ghr:environment": "Active",
    ManagedBy: "Active",
    Project: "Active",
  },
  computeOptimizer: "Active",
  costOptimizationHub: "Active",
  budgets: ["Monthly Budget"],
  monitors: [{ name: "beep-account-services", dimension: "SERVICE" }],
};

const monitorArn = (account: FakeAccount, id: number) =>
  `arn:aws:ce::${account.accountId}:anomalymonitor/${Str.padStart(8, "0")(`${id}`)}`;

const makeAccount = (seed: Seed = {}): FakeAccount => {
  const account: FakeAccount = {
    accountId: seed.accountId ?? productionAccountId,
    calls: [],
    budgets: MutableHashMap.empty(),
    monitors: MutableHashMap.empty(),
    subscriptions: MutableHashMap.empty(),
    costAllocationTags: MutableHashMap.fromIterable(R.toEntries(seed.costAllocationTags ?? {})),
    computeOptimizer: { status: seed.computeOptimizer ?? "Inactive", memberAccountsEnrolled: false },
    costOptimizationHub: { status: seed.costOptimizationHub ?? "Inactive", includeMemberAccounts: false },
    nextId: 1,
  };
  for (const name of seed.budgets ?? []) {
    MutableHashMap.set(account.budgets, name, {
      budget: { BudgetName: name, BudgetType: "COST", TimeUnit: "MONTHLY" },
      notifications: [],
      tags: {},
    });
  }
  for (const monitor of seed.monitors ?? []) {
    const arn = monitorArn(account, account.nextId++);
    MutableHashMap.set(account.monitors, arn, {
      arn,
      name: monitor.name,
      type: "DIMENSIONAL",
      dimension: monitor.dimension,
      tags: {},
    });
  }
  return account;
};

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

/** Operations that change account state. */
export const mutations = (account: FakeAccount): Array<string> =>
  A.filter(operations(account), (operation) => !/^(Describe|Get|List)/u.test(operation));

const budget = (account: FakeAccount, name: string) => O.getOrUndefined(MutableHashMap.get(account.budgets, name));

const valuesOf = <K, V>(map: MutableHashMap.MutableHashMap<K, V>): Array<V> =>
  map.pipe(MutableHashMap.values, A.fromIterable);

const monitorByName = (account: FakeAccount, name: string) =>
  pipe(
    valuesOf(account.monitors),
    A.findFirst((monitor) => monitor.name === name),
    O.getOrUndefined
  );

const subscriptionByName = (account: FakeAccount, name: string) =>
  pipe(
    valuesOf(account.subscriptions),
    A.findFirst((subscription) => subscription.body.SubscriptionName === name),
    O.getOrUndefined
  );

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

interface FakeResponse {
  readonly json: unknown;
  readonly status: number;
}

const ok = (json: unknown): FakeResponse => ({ status: 200, json });
const fail = (type: string, message: string): FakeResponse => ({ status: 400, json: { __type: type, message } });

// ---------------------------------------------------------------------------
// Input decoding
// ---------------------------------------------------------------------------

const Loose = S.Record(S.String, S.Unknown);
type Loose = typeof Loose.Type;
const decodeInput = S.decodeUnknownEffect(S.fromJsonString(Loose));
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const str = (input: Loose, key: string): string | undefined => (P.isString(input[key]) ? input[key] : undefined);
const strings = (input: Loose, key: string): Array<string> => {
  const value = input[key];
  return A.isArray(value) ? A.filter(value, P.isString) : [];
};
const record = (value: unknown): Loose => (P.isObject(value) && !A.isArray(value) ? { ...value } : {});
const records = (value: unknown): Array<Loose> => (A.isArray(value) ? A.map(value, record) : []);
const tagList = (value: unknown): Tags =>
  R.fromEntries(
    A.flatMap(records(value), (tag) => {
      const key = str(tag, "Key");
      return key === undefined ? [] : [[key, str(tag, "Value") ?? ""] as const];
    })
  );
const toTagList = (tags: Tags) => A.map(R.toEntries(tags), ([Key, Value]) => ({ Key, Value }));
const subscriber = (value: Loose): Subscriber => ({
  SubscriptionType: str(value, "SubscriptionType") ?? "EMAIL",
  Address: str(value, "Address") ?? "",
});
const notificationKey = (notification: Loose) =>
  `${str(notification, "NotificationType")}|${str(notification, "ComparisonOperator")}|${String(notification.Threshold)}|${str(notification, "ThresholdType") ?? "PERCENTAGE"}`;

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

type Handler = (account: FakeAccount, input: Loose) => FakeResponse;

const budgetNotFound = (name: string | undefined) => fail("NotFoundException", `Budget ${name} not found`);

const withBudget =
  (handle: (record: BudgetRecord, input: Loose) => FakeResponse): Handler =>
  (account, input) => {
    const name = str(input, "BudgetName");
    const found = name === undefined ? undefined : budget(account, name);
    return found === undefined ? budgetNotFound(name) : handle(found, input);
  };

const findNotification = (found: BudgetRecord, input: Loose) =>
  A.findFirst(
    found.notifications,
    (entry) => notificationKey(entry.notification) === notificationKey(record(input.Notification))
  );

const budgetsOperations: Readonly<Record<string, Handler>> = {
  DescribeBudget: withBudget((found) => ok({ Budget: found.budget })),
  DescribeBudgets: (account) => ok({ Budgets: A.map(valuesOf(account.budgets), (b) => b.budget) }),
  CreateBudget: (account, input) => {
    const body = record(input.Budget);
    const name = str(body, "BudgetName") ?? "";
    if (MutableHashMap.has(account.budgets, name)) return fail("DuplicateRecordException", `Budget ${name} exists`);
    MutableHashMap.set(account.budgets, name, {
      budget: body,
      notifications: A.map(records(input.NotificationsWithSubscribers), (entry) => ({
        notification: record(entry.Notification),
        subscribers: A.map(records(entry.Subscribers), subscriber),
      })),
      tags: tagList(input.ResourceTags),
    });
    return ok({});
  },
  UpdateBudget: (account, input) => {
    const body = record(input.NewBudget);
    const found = budget(account, str(body, "BudgetName") ?? "");
    if (found === undefined) return budgetNotFound(str(body, "BudgetName"));
    found.budget = body;
    return ok({});
  },
  DeleteBudget: (account, input) => {
    const name = str(input, "BudgetName") ?? "";
    if (!MutableHashMap.has(account.budgets, name)) return budgetNotFound(name);
    MutableHashMap.remove(account.budgets, name);
    return ok({});
  },
  DescribeNotificationsForBudget: withBudget((found) =>
    ok({ Notifications: A.map(found.notifications, (entry) => entry.notification) })
  ),
  CreateNotification: withBudget((found, input) => {
    if (O.isSome(findNotification(found, input))) return fail("DuplicateRecordException", "Notification exists");
    found.notifications.push({
      notification: record(input.Notification),
      subscribers: A.map(records(input.Subscribers), subscriber),
    });
    return ok({});
  }),
  DeleteNotification: withBudget((found, input) => {
    const index = A.findFirstIndex(
      found.notifications,
      (entry) => notificationKey(entry.notification) === notificationKey(record(input.Notification))
    );
    if (O.isNone(index)) return fail("NotFoundException", "Notification not found");
    found.notifications.splice(index.value, 1);
    return ok({});
  }),
  DescribeSubscribersForNotification: withBudget((found, input) =>
    O.match(findNotification(found, input), {
      onNone: () => fail("NotFoundException", "Notification not found"),
      onSome: (entry) => ok({ Subscribers: entry.subscribers }),
    })
  ),
  CreateSubscriber: withBudget((found, input) =>
    O.match(findNotification(found, input), {
      onNone: () => fail("NotFoundException", "Notification not found"),
      onSome: (entry) => {
        entry.subscribers.push(subscriber(record(input.Subscriber)));
        return ok({});
      },
    })
  ),
  DeleteSubscriber: withBudget((found, input) =>
    O.match(findNotification(found, input), {
      onNone: () => fail("NotFoundException", "Notification not found"),
      onSome: (entry) => {
        const gone = subscriber(record(input.Subscriber));
        entry.subscribers = A.filter(entry.subscribers, (s) => s.Address !== gone.Address);
        return ok({});
      },
    })
  ),
  ListTagsForResource: (account, input) => {
    const found = budget(
      account,
      pipe(
        str(input, "ResourceARN") ?? "",
        Str.split("/"),
        A.last,
        O.getOrElse(() => "")
      )
    );
    return found === undefined
      ? fail("NotFoundException", "Resource not found")
      : ok({ ResourceTags: toTagList(found.tags) });
  },
  TagResource: (account, input) => {
    const found = budget(
      account,
      pipe(
        str(input, "ResourceARN") ?? "",
        Str.split("/"),
        A.last,
        O.getOrElse(() => "")
      )
    );
    if (found === undefined) return fail("NotFoundException", "Resource not found");
    found.tags = { ...found.tags, ...tagList(input.ResourceTags) };
    return ok({});
  },
  UntagResource: (account, input) => {
    const found = budget(
      account,
      pipe(
        str(input, "ResourceARN") ?? "",
        Str.split("/"),
        A.last,
        O.getOrElse(() => "")
      )
    );
    if (found === undefined) return fail("NotFoundException", "Resource not found");
    const removed = strings(input, "ResourceTagKeys");
    found.tags = R.filter(found.tags, (_, key) => !A.contains(removed, key));
    return ok({});
  },
};

// ---------------------------------------------------------------------------
// Cost Explorer
// ---------------------------------------------------------------------------

const monitorJson = (monitor: MonitorRecord) => ({
  MonitorArn: monitor.arn,
  MonitorName: monitor.name,
  MonitorType: monitor.type,
  ...(monitor.dimension === undefined ? {} : { MonitorDimension: monitor.dimension }),
});

const taggable = (account: FakeAccount, arn: string): { tags: Tags } | undefined =>
  O.getOrUndefined(MutableHashMap.get(account.monitors, arn)) ??
  O.getOrUndefined(MutableHashMap.get(account.subscriptions, arn));

const ceOperations: Readonly<Record<string, Handler>> = {
  GetAnomalyMonitors: (account, input) => {
    const arns = strings(input, "MonitorArnList");
    const missing = A.filter(arns, (arn) => !MutableHashMap.has(account.monitors, arn));
    if (A.isArrayNonEmpty(missing)) return fail("UnknownMonitorException", "Monitor not found");
    return ok({
      AnomalyMonitors: pipe(
        valuesOf(account.monitors),
        A.filter((monitor) => A.isArrayEmpty(arns) || A.contains(arns, monitor.arn)),
        A.map(monitorJson)
      ),
    });
  },
  CreateAnomalyMonitor: (account, input) => {
    const body = record(input.AnomalyMonitor);
    const dimension = str(body, "MonitorDimension");
    const services = A.some(valuesOf(account.monitors), (m) => m.dimension === "SERVICE");
    if (dimension === "SERVICE" && services) {
      return fail("ServiceQuotaExceededException", "Only one AWS services monitor is allowed per account");
    }
    const arn = monitorArn(account, account.nextId++);
    MutableHashMap.set(account.monitors, arn, {
      arn,
      name: str(body, "MonitorName") ?? "",
      type: str(body, "MonitorType") ?? "DIMENSIONAL",
      dimension,
      tags: tagList(input.ResourceTags),
    });
    return ok({ MonitorArn: arn });
  },
  UpdateAnomalyMonitor: (account, input) => {
    const found = O.getOrUndefined(MutableHashMap.get(account.monitors, str(input, "MonitorArn") ?? ""));
    if (found === undefined) return fail("UnknownMonitorException", "Monitor not found");
    found.name = str(input, "MonitorName") ?? found.name;
    return ok({ MonitorArn: found.arn });
  },
  DeleteAnomalyMonitor: (account, input) => {
    const arn = str(input, "MonitorArn") ?? "";
    if (!MutableHashMap.has(account.monitors, arn)) return fail("UnknownMonitorException", "Monitor not found");
    MutableHashMap.remove(account.monitors, arn);
    return ok({});
  },
  GetAnomalySubscriptions: (account, input) => {
    const arns = strings(input, "SubscriptionArnList");
    const missing = A.filter(arns, (arn) => !MutableHashMap.has(account.subscriptions, arn));
    if (A.isArrayNonEmpty(missing)) return fail("UnknownSubscriptionException", "Subscription not found");
    return ok({
      AnomalySubscriptions: pipe(
        valuesOf(account.subscriptions),
        A.filter((subscription) => A.isArrayEmpty(arns) || A.contains(arns, subscription.arn)),
        A.map((subscription) => subscription.body)
      ),
    });
  },
  CreateAnomalySubscription: (account, input) => {
    const arn = `arn:aws:ce::${account.accountId}:anomalysubscription/${account.nextId++}`;
    MutableHashMap.set(account.subscriptions, arn, {
      arn,
      body: { ...record(input.AnomalySubscription), SubscriptionArn: arn, AccountId: account.accountId },
      tags: tagList(input.ResourceTags),
    });
    return ok({ SubscriptionArn: arn });
  },
  UpdateAnomalySubscription: (account, input) => {
    const found = O.getOrUndefined(MutableHashMap.get(account.subscriptions, str(input, "SubscriptionArn") ?? ""));
    if (found === undefined) return fail("UnknownSubscriptionException", "Subscription not found");
    found.body = { ...found.body, ...R.filter(input, (_, key) => key !== "SubscriptionArn") };
    return ok({ SubscriptionArn: found.arn });
  },
  DeleteAnomalySubscription: (account, input) => {
    const arn = str(input, "SubscriptionArn") ?? "";
    if (!MutableHashMap.has(account.subscriptions, arn)) return fail("UnknownSubscriptionException", "Not found");
    MutableHashMap.remove(account.subscriptions, arn);
    return ok({});
  },
  ListTagsForResource: (account, input) => {
    const found = taggable(account, str(input, "ResourceArn") ?? "");
    return found === undefined
      ? fail("ResourceNotFoundException", "Not found")
      : ok({ ResourceTags: toTagList(found.tags) });
  },
  TagResource: (account, input) => {
    const found = taggable(account, str(input, "ResourceArn") ?? "");
    if (found === undefined) return fail("ResourceNotFoundException", "Not found");
    found.tags = { ...found.tags, ...tagList(input.ResourceTags) };
    return ok({});
  },
  UntagResource: (account, input) => {
    const found = taggable(account, str(input, "ResourceArn") ?? "");
    if (found === undefined) return fail("ResourceNotFoundException", "Not found");
    const removed = strings(input, "ResourceTagKeys");
    found.tags = R.filter(found.tags, (_, key) => !A.contains(removed, key));
    return ok({});
  },
  ListCostAllocationTags: (account, input) => {
    const keys = strings(input, "TagKeys");
    return ok({
      CostAllocationTags: pipe(
        A.fromIterable(account.costAllocationTags),
        A.filter(([key]) => A.isArrayEmpty(keys) || A.contains(keys, key)),
        A.map(([TagKey, Status]) => ({ TagKey, Status, Type: "UserDefined" }))
      ),
    });
  },
  UpdateCostAllocationTagsStatus: (account, input) => {
    const entries = A.map(records(input.CostAllocationTagsStatus), (entry) => ({
      TagKey: str(entry, "TagKey") ?? "",
      Status: str(entry, "Status") ?? "",
    }));
    const unknown = A.filter(entries, (entry) => !MutableHashMap.has(account.costAllocationTags, entry.TagKey));
    for (const entry of entries) {
      if (MutableHashMap.has(account.costAllocationTags, entry.TagKey)) {
        MutableHashMap.set(account.costAllocationTags, entry.TagKey, entry.Status);
      }
    }
    return ok(
      A.isArrayNonEmpty(unknown)
        ? { Errors: A.map(unknown, (entry) => ({ TagKey: entry.TagKey, Code: "TagKeysNotFoundException" })) }
        : {}
    );
  },
};

const computeOptimizerOperations: Readonly<Record<string, Handler>> = {
  GetEnrollmentStatus: (account) => ok(account.computeOptimizer),
  UpdateEnrollmentStatus: (account, input) => {
    account.computeOptimizer = {
      status: str(input, "status") ?? "Inactive",
      memberAccountsEnrolled: input.includeMemberAccounts === true,
    };
    return ok({ status: account.computeOptimizer.status });
  },
};

const hubOperations: Readonly<Record<string, Handler>> = {
  ListEnrollmentStatuses: (account) =>
    ok({
      items: [{ accountId: account.accountId, status: account.costOptimizationHub.status }],
      includeMemberAccounts: account.costOptimizationHub.includeMemberAccounts,
    }),
  UpdateEnrollmentStatus: (account, input) => {
    account.costOptimizationHub = {
      status: str(input, "status") ?? "Inactive",
      includeMemberAccounts: input.includeMemberAccounts === true,
    };
    return ok({ status: account.costOptimizationHub.status });
  },
};

/** awsJson services by endpoint host prefix. */
const services: ReadonlyArray<{
  readonly prefix: string;
  readonly service: string;
  readonly operations: Readonly<Record<string, Handler>>;
}> = [
  { prefix: "budgets.", service: "budgets", operations: budgetsOperations },
  { prefix: "ce.", service: "ce", operations: ceOperations },
  { prefix: "compute-optimizer.", service: "compute-optimizer", operations: computeOptimizerOperations },
  { prefix: "cost-optimization-hub.", service: "cost-optimization-hub", operations: hubOperations },
];

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
  const operation = pipe(
    request.headers["x-amz-target"] ?? "",
    Str.split("."),
    A.last,
    O.getOrElse(() => "")
  );
  const text = bodyText(request);
  const input = yield* decodeInput(text === "" ? "{}" : text);
  const service = A.findFirst(services, (candidate) => Str.startsWith(candidate.prefix)(url.hostname));
  if (O.isNone(service)) return fail("UnknownServiceException", url.hostname);
  account.calls.push(`${service.value.service}:${operation}`);
  const handler = service.value.operations[operation];
  return handler === undefined ? fail("UnknownOperationException", operation) : handler(account, input);
});

const httpClient = (account: FakeAccount): HttpClient.HttpClient =>
  HttpClient.make(
    Effect.fn("FakeAws.send")(function* (request, url) {
      const response = yield* route(account, request, url);
      const body = yield* encodeJson(response.json);
      return HttpClientResponse.fromWeb(
        request,
        new Response(body, { status: response.status, headers: { "content-type": "application/x-amz-json-1.1" } })
      );
    }, Effect.orDie)
  );

const environment = (account: FakeAccount, environmentRegion: string) =>
  Layer.succeed(
    AWSEnvironment,
    Effect.succeed({
      accountId: account.accountId,
      region: environmentRegion,
      credentials: Effect.succeed({
        accessKeyId: Redacted.make("test"),
        secretAccessKey: Redacted.make("test"),
        sessionToken: undefined,
        region: environmentRegion,
      }),
    })
  );

const providers = (account: FakeAccount, environmentRegion: string) =>
  costControlsProviders.pipe(
    Layer.provide(environment(account, environmentRegion)),
    Layer.provideMerge(environment(account, environmentRegion)),
    Layer.provideMerge(Layer.succeed(HttpClient.HttpClient, httpClient(account)))
  );

/** Failure surfaced by a scratch deploy or destroy. */
export interface StackFailure {
  readonly _tag: string;
}

/** Typed view of the harness scratch stack. */
export interface TypedStack {
  deploy<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<Input.Resolve<A>, StackFailure>;
  destroy(options?: { readonly include?: never; readonly exclude?: never }): Effect.Effect<void, StackFailure>;
}

/**
 * One isolated fake account plus the `@alchemy.run/test` API bound to it, at
 * `stage`. Test cases run concurrently, so each takes its own harness.
 */
export const harness = (options: { readonly seed?: Seed; readonly stage: string }) => {
  const { seed, stage } = options;
  const account = makeAccount(seed);
  const { test } = Test.make({
    providers: providers(account, seed?.region ?? region),
    state: inMemoryState(),
    stage,
  });
  const provider = (name: string, body: (stack: TypedStack) => Effect.Effect<void, StackFailure>) =>
    test.provider(name, (stack) => {
      const typed: TypedStack = stack;
      return body(typed);
    });
  return {
    account,
    provider,
    budget: (name: string) => budget(account, name),
    monitor: (name: string) => monitorByName(account, name),
    subscription: (name: string) => subscriptionByName(account, name),
  };
};

/** Run a deploy expected to fail and return its failure. */
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
