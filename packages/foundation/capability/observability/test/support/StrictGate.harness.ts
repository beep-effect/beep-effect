import {
  AttributeKey,
  AttributeKeyName,
  InstrumentCatalog,
  MetricInstrument,
  MetricName,
  ObservabilityInstruments,
  PackageName,
  UcumUnit,
} from "@beep/observability/catalog";
import { layerInMemoryStrictSalt, StrictGateConfig } from "@beep/observability/strict";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { GateRules } from "@beep/observability/strict";
import type * as HttpBody from "effect/http/HttpBody";

const owner = PackageName.make("@beep/observability-strict-test");
const textDecoder = new TextDecoder();

const demoToolKey = AttributeKeyName.make("beep.demo.tool");

const demoKeyWithoutValues = AttributeKeyName.make("beep.demo.bounded");

const demoCalls = MetricInstrument.make({
  name: MetricName.make("beep.demo.calls"),
  owner,
  attributes: [demoToolKey],
  minTier: "shape-only",
  description: "Demo tool calls by tool.",
  kind: "counter",
  unit: UcumUnit.make("{call}"),
});

const demoLatency = MetricInstrument.make({
  name: MetricName.make("beep.demo.latency"),
  owner,
  attributes: [demoToolKey],
  minTier: "shape-only",
  description: "Demo tool latency by tool.",
  kind: "histogram",
  unit: UcumUnit.make("ms"),
  boundaries: O.some([10, 100]),
});

const demoCatalog = InstrumentCatalog.make({
  attributes: [
    ...ObservabilityInstruments.attributes,
    AttributeKey.make({
      key: demoToolKey,
      type: "string",
      signals: ["span", "metric"],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(["lookup", "search"]),
      owner,
      description: "Demo tool id.",
    }),
    AttributeKey.make({
      key: demoKeyWithoutValues,
      type: "string",
      signals: ["span"],
      cardinality: "bounded",
      minTier: "shape-only",
      owner,
      description: "Bounded demo key with no literal value list.",
    }),
  ],
  instruments: [...ObservabilityInstruments.instruments, demoCalls, demoLatency],
});

/** Gate configuration over {@link demoCatalog}. */
export const demoConfig = (rules?: GateRules): StrictGateConfig =>
  StrictGateConfig.make({
    serviceName: "demo-mcp",
    serviceVersion: "0.0.0",
    keyEpoch: "1",
    toolIds: ["lookup", "search"],
    toolSpanPrefixes: ["mcp.tool.call.", "DemoTools."],
    toolKey: demoToolKey,
    catalog: demoCatalog,
    ...(rules === undefined ? {} : { rules }),
  });

/** In-memory salt keyed with `Bun.CryptoHasher`, as the practice host keys it. */
export const layerTestSalt = layerInMemoryStrictSalt((key, value) =>
  new Bun.CryptoHasher("sha256", key).update(value).digest("hex")
);

const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));

/** Text of a serialized body; the gate always serializes JSON bytes. */
export const bodyText = (body: HttpBody.HttpBody): string =>
  P.isTagged(body, "Uint8Array") ? textDecoder.decode(body.body) : "";

/** Parsed JSON of a serialized body. */
export const bodyJson = (body: HttpBody.HttpBody) => decodeJson(bodyText(body));

const isKeyValue = S.is(S.Struct({ key: S.String, value: S.Unknown }));

const keyPaths = (value: unknown, path: string): ReadonlyArray<string> => {
  if (A.isArray(value)) {
    return A.flatMap(value, (item) => keyPaths(item, `${path}[]`));
  }
  if (!P.isObject(value)) {
    return [];
  }
  const attribute = isKeyValue(value) ? [`attribute ${path}: ${value.key}`] : [];
  return [
    ...attribute,
    ...A.flatMap(R.toEntries(value), ([key, child]) => [`${path}.${key}`, ...keyPaths(child, `${path}.${key}`)]),
  ];
};

/** Every object key path and attribute key in some exported JSON, sorted and unique. */
export const exportedKeySet = (values: ReadonlyArray<unknown>): ReadonlyArray<string> =>
  A.sort(A.dedupe(A.flatMap(values, (value) => keyPaths(value, "$"))), Order.String);
