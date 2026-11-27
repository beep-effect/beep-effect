import {
  AttributeKey,
  AttributeKeyName,
  allowedAttributes,
  Browser,
  CiRunner,
  CloudProviderName,
  CloudVm,
  DuplicateInstrumentName,
  EmitterContext,
  EventInstrument,
  EventName,
  effectiveTier,
  HostName,
  InstrumentCatalog,
  InstrumentDeclarations,
  isStricterTier,
  MetricInstrument,
  MetricName,
  mergeDeclarations,
  ObservabilityInstruments,
  PackageName,
  ProtocolSpanName,
  packageOf,
  Server,
  Serverless,
  SpanInstrument,
  SpanName,
  StrictDesktop,
  stricterTier,
  TelemetryTier,
  tierCeiling,
  UcumUnit,
  VcsRevision,
  Workstation,
} from "@beep/observability/catalog";
import { ScopedPackageName } from "@beep/package-json/PackageName";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe } from "@effect/vitest";
import {
  assertFailure,
  assertFalse,
  assertNone,
  assertSome,
  assertTrue,
  deepStrictEqual,
  strictEqual,
} from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CatalogConflict } from "@beep/observability/catalog";

const CatalogOwner = S.Struct({ owner: PackageName });
const pkgA = PackageName.make("@beep/a");
const pkgB = PackageName.make("@beep/b");
const matterId = AttributeKeyName.make("beep.matter_id");
const source = AttributeKeyName.make("beep.docket.source");
const spanOnly = AttributeKeyName.make("beep.span_only");

const attribute = (
  key: AttributeKeyName,
  overrides: Partial<Pick<AttributeKey, "signals" | "cardinality" | "minTier" | "owner">> = {}
): AttributeKey =>
  AttributeKey.make({
    key,
    type: "string",
    signals: overrides.signals ?? ["span", "metric", "event", "log"],
    cardinality: overrides.cardinality ?? "bounded",
    minTier: overrides.minTier ?? "shape-only",
    owner: overrides.owner ?? pkgA,
    description: "Test attribute.",
  });

const span = (
  name: string,
  overrides: Partial<Pick<SpanInstrument, "owner" | "attributes" | "minTier" | "origin">> = {}
): SpanInstrument =>
  SpanInstrument.make({
    name: SpanName.make(name),
    owner: overrides.owner ?? pkgA,
    family: "foundation",
    attributes: overrides.attributes ?? [],
    minTier: overrides.minTier ?? "shape-only",
    description: "Test span.",
    kind: "internal",
    origin: overrides.origin ?? "declared",
  });

const metric = (attributes: ReadonlyArray<AttributeKeyName>): MetricInstrument =>
  MetricInstrument.make({
    name: MetricName.make("beep.docket.intake_runs"),
    owner: pkgA,
    attributes,
    minTier: "shape-only",
    description: "Test metric.",
    kind: "counter",
    unit: UcumUnit.make("{run}"),
  });

const declarations = (
  attributes: ReadonlyArray<AttributeKey>,
  instruments: InstrumentDeclarations["instruments"]
): InstrumentDeclarations => InstrumentDeclarations.make({ attributes, instruments });

const conflictTags = (
  result: Result.Result<InstrumentCatalog, A.NonEmptyReadonlyArray<CatalogConflict>>
): ReadonlyArray<CatalogConflict["_tag"]> =>
  Result.match(result, {
    onSuccess: () => [],
    onFailure: (conflicts) => A.map(conflicts, (conflict) => conflict._tag),
  });

const decodeSpan = S.decodeOption(SpanInstrument);
const decodeMetric = S.decodeOption(MetricInstrument);
const decodeCatalog = S.decodeOption(InstrumentCatalog);
const decodeContext = S.decodeUnknownOption(EmitterContext);

const successOf = <A>(result: Result.Result<A, unknown>): O.Option<A> => Result.getSuccess(result);

describe("catalog names", () => {
  it("accepts Concept(.Sub)*.action span names only", () => {
    const isSpanName = S.is(SpanName);
    assertTrue(isSpanName("Parcels.read"));
    assertTrue(isSpanName("Parcels.Docket.readAll"));
    assertFalse(isSpanName("parcels.read"));
    assertFalse(isSpanName("Parcels.Read"));
    assertFalse(isSpanName("Parcels"));
    assertFalse(isSpanName("Parcels.read.${id}"));
  });

  it("accepts trimmed non-empty protocol span names", () => {
    const isProtocolSpanName = S.is(ProtocolSpanName);
    assertTrue(isProtocolSpanName("GET /parcels/:id"));
    assertFalse(isProtocolSpanName(""));
    assertFalse(isProtocolSpanName("GET "));
  });

  it("accepts beep.<area>.<noun> metric names without unit or _total suffix", () => {
    const isMetricName = S.is(MetricName);
    assertTrue(isMetricName("beep.docket.intake_runs"));
    assertTrue(isMetricName("beep.docket.queue.depth"));
    assertFalse(isMetricName("beep.docket"));
    assertFalse(isMetricName("docket.intake.runs"));
    assertFalse(isMetricName("beep.docket.runs_total"));
    assertFalse(isMetricName("beep.docket.duration_seconds"));
    assertFalse(isMetricName("beep.docket.payload_bytes"));
    assertFalse(isMetricName("beep.Docket.runs"));
  });

  it("accepts Concept.event_happened event names only", () => {
    const isEventName = S.is(EventName);
    assertTrue(isEventName("Docket.intake_completed"));
    assertTrue(isEventName("Session.started"));
    assertFalse(isEventName("Docket.intakeCompleted"));
    assertFalse(isEventName("docket.intake_completed"));
  });

  it("accepts lowercase dotted attribute keys only", () => {
    const isAttributeKeyName = S.is(AttributeKeyName);
    assertTrue(isAttributeKeyName("beep.privacy_tier"));
    assertTrue(isAttributeKeyName("http.request.method"));
    assertFalse(isAttributeKeyName("beep"));
    assertFalse(isAttributeKeyName("Beep.package"));
    assertFalse(isAttributeKeyName("beep..package"));
  });

  it("checks package, unit, host, cloud provider and revision shapes", () => {
    assertTrue(S.is(PackageName)("@beep/observability"));
    assertFalse(S.is(PackageName)("observability"));
    assertTrue(S.is(UcumUnit)("{request}"));
    assertFalse(S.is(UcumUnit)("per second"));
    assertTrue(S.is(HostName)("build-01.tailnet"));
    assertFalse(S.is(HostName)("-host"));
    assertTrue(S.is(CloudProviderName)("alibaba_cloud"));
    assertFalse(S.is(CloudProviderName)("AWS"));
    assertTrue(S.is(VcsRevision)("4e66575c64"));
    assertFalse(S.is(VcsRevision)("main"));
  });

  it("follows the npm scoped-name rules of @beep/package-json (3-A9)", () => {
    const isPackageName = S.is(PackageName);
    assertTrue(isPackageName("@-scope/name"), "npm accepts a leading `-`");
    assertTrue(isPackageName("@scope/-name"));
    assertTrue(isPackageName(`@beep/${Str.repeat(208)("a")}`));
    assertFalse(isPackageName(`@beep/${Str.repeat(209)("a")}`), "npm caps package names at 214 characters");
    assertFalse(isPackageName("@Beep/observability"));
    assertFalse(isPackageName("@beep/"));
  });

  it("shares the ScopedPackageName brand and its decode message (3-A9)", () => {
    const owner: PackageName = ScopedPackageName.make("@beep/observability");
    const scoped: ScopedPackageName = PackageName.make("@beep/observability");
    strictEqual(owner, scoped, "a @beep/package-json ScopedPackageName is a catalog owner name, and back");
    const decoded = S.decodeResult(CatalogOwner)({ owner: "observability" });
    assertFailure(
      Result.mapError(decoded, (error) => error.message),
      'Expected a string matching the RegExp ^@[a-z0-9-][a-z0-9._-]*\\/[a-z0-9-][a-z0-9._-]*$\n  at ["owner"]'
    );
  });
});

describe("instrument schemas", () => {
  it("defaults span protocol, origin and attributes", () => {
    const entry = decodeSpan({
      _tag: "SpanInstrument",
      name: "Parcels.read",
      owner: "@beep/a",
      family: "slice",
      minTier: "standard",
      description: "Reads a parcel.",
      kind: "server",
    }).pipe(O.map(({ protocol, origin, attributes }) => ({ protocol, origin, attributes })));
    assertSome(entry, { protocol: false, origin: "declared", attributes: [] });
  });

  it("allows protocol names only on protocol spans", () => {
    const base: SpanInstrument.Encoded = {
      _tag: "SpanInstrument",
      name: "GET /parcels/:id",
      owner: "@beep/a",
      family: "slice",
      minTier: "standard",
      description: "HTTP route.",
      kind: "server",
    };
    assertNone(decodeSpan(base));
    assertSome(decodeSpan({ ...base, protocol: true }).pipe(O.map(({ protocol }) => protocol)), true);
  });

  it("keeps legacy harvested names only with conforms: false", () => {
    const base: SpanInstrument.Encoded = {
      _tag: "SpanInstrument",
      name: "db.query",
      owner: "@beep/a",
      family: "driver",
      minTier: "shape-only",
      description: "Harvested span literal.",
      kind: "internal",
    };
    assertSome(
      decodeSpan({ ...base, origin: "harvested", conforms: false }).pipe(O.map(({ conforms }) => conforms)),
      false
    );
    assertNone(decodeSpan({ ...base, origin: "harvested" }));
    assertNone(decodeSpan({ ...base, origin: "declared", conforms: false }));
    assertNone(decodeSpan({ ...base, name: "Parcels.read", origin: "harvested", conforms: false }));
  });

  it("allows strictly ascending boundaries on histograms only", () => {
    const ascending: A.NonEmptyReadonlyArray<number> = [1, 10, 100];
    const base: MetricInstrument.Encoded = {
      _tag: "MetricInstrument",
      name: "beep.docket.intake_duration",
      owner: "@beep/a",
      minTier: "shape-only",
      description: "Intake duration.",
      kind: "histogram",
      unit: "ms",
    };
    assertSome(
      decodeMetric({ ...base, boundaries: ascending }).pipe(O.map(({ boundaries }) => boundaries)),
      O.some(ascending)
    );
    assertNone(decodeMetric({ ...base, boundaries: [10, 10] }));
    assertNone(decodeMetric({ ...base, kind: "counter", boundaries: [1, 10] }));
  });
});

describe("mergeDeclarations", () => {
  it("merges the kernel declarations into a sorted catalog", () => {
    const keys = successOf(mergeDeclarations([ObservabilityInstruments], [])).pipe(
      O.map((catalog) => A.map(catalog.attributes, (entry) => entry.key))
    );
    assertSome(keys, [
      AttributeKeyName.make("beep.duration_bucket"),
      AttributeKeyName.make("beep.family"),
      AttributeKeyName.make("beep.identity_source"),
      AttributeKeyName.make("beep.outcome"),
      AttributeKeyName.make("beep.package"),
      AttributeKeyName.make("beep.privacy_tier"),
      AttributeKeyName.make("beep.schema_failure_tag"),
    ]);
  });

  it("preserves the error name independently of the instrument payload", () => {
    const conflict = DuplicateInstrumentName.make({
      signal: "span",
      instrumentName: SpanName.make("Parcels.read"),
      owners: [pkgA, pkgB],
    });
    strictEqual(conflict.name, DuplicateInstrumentName.identifier);
    strictEqual(conflict.instrumentName, "Parcels.read");
  });

  it("reports a duplicate instrument name across packages", () => {
    const merged = mergeDeclarations(
      [declarations([], [span("Parcels.read")]), declarations([], [span("Parcels.read", { owner: pkgB })])],
      []
    );
    deepStrictEqual(conflictTags(merged), ["DuplicateInstrumentName"]);
  });

  it("allows the same protocol span name in two packages", () => {
    const protocolSpan = (owner: PackageName): SpanInstrument =>
      SpanInstrument.make({
        name: ProtocolSpanName.make("GET /health"),
        owner,
        family: "app",
        minTier: "shape-only",
        description: "Health route.",
        kind: "server",
        protocol: true,
      });
    const merged = mergeDeclarations(
      [declarations([], [protocolSpan(pkgA)]), declarations([], [protocolSpan(pkgB)])],
      []
    );
    deepStrictEqual(conflictTags(merged), []);
    const twice = mergeDeclarations([declarations([], [protocolSpan(pkgA), protocolSpan(pkgA)])], []);
    deepStrictEqual(conflictTags(twice), ["DuplicateInstrumentName"]);
  });

  it("reports a duplicate attribute key", () => {
    const merged = mergeDeclarations(
      [declarations([attribute(source)], []), declarations([attribute(source, { owner: pkgB })], [])],
      []
    );
    deepStrictEqual(conflictTags(merged), ["DuplicateAttributeKey"]);
  });

  it("lets a declared span replace the harvested span of the same owner", () => {
    const attributes = mergeDeclarations(
      [declarations([attribute(source)], [span("Parcels.read", { attributes: [source] })])],
      [span("Parcels.read", { origin: "harvested" })]
    ).pipe(
      successOf,
      O.map((catalog) => A.map(catalog.instruments, (entry) => entry.attributes))
    );
    assertSome(attributes, [[source]]);
  });

  it("reports a harvested span that collides with another package's span", () => {
    const merged = mergeDeclarations(
      [declarations([], [span("Parcels.read")])],
      [span("Parcels.read", { owner: pkgB, origin: "harvested" })]
    );
    deepStrictEqual(conflictTags(merged), ["DuplicateInstrumentName"]);
  });

  it("reports a missing attribute key", () => {
    const merged = mergeDeclarations([declarations([], [span("Parcels.read", { attributes: [source] })])], []);
    deepStrictEqual(conflictTags(merged), ["MissingAttributeKey"]);
  });

  it("reports an attribute that does not allow the instrument's signal", () => {
    const merged = mergeDeclarations(
      [declarations([attribute(spanOnly, { signals: ["span"] })], [metric([spanOnly])])],
      []
    );
    deepStrictEqual(conflictTags(merged), ["SignalNotAllowed"]);
  });

  it("reports an unbounded metric label", () => {
    const merged = mergeDeclarations(
      [declarations([attribute(matterId, { cardinality: "unbounded" })], [metric([matterId])])],
      []
    );
    deepStrictEqual(conflictTags(merged), ["UnboundedMetricLabel"]);
  });

  it("allows an unbounded attribute on a span", () => {
    const merged = mergeDeclarations(
      [
        declarations(
          [attribute(matterId, { cardinality: "unbounded" })],
          [span("Parcels.read", { attributes: [matterId] })]
        ),
      ],
      []
    );
    deepStrictEqual(conflictTags(merged), []);
  });

  it("reports an instrument tier looser than its attribute", () => {
    const merged = mergeDeclarations(
      [
        declarations(
          [attribute(matterId, { minTier: "standard" })],
          [span("Parcels.read", { attributes: [matterId], minTier: "shape-only" })]
        ),
      ],
      []
    );
    deepStrictEqual(conflictTags(merged), ["TierLooserThanAttribute"]);
  });

  it("accepts an instrument whose tier is no looser than its attributes", () => {
    const merged = mergeDeclarations(
      [
        declarations(
          [attribute(matterId, { minTier: "standard" })],
          [span("Parcels.read", { attributes: [matterId], minTier: "dev-verbose" })]
        ),
      ],
      []
    );
    deepStrictEqual(conflictTags(merged), []);
  });

  it("rejects a conflicting catalog at decode time", () => {
    const decoded = decodeCatalog({
      version: 1,
      attributes: [],
      instruments: [
        {
          _tag: "EventInstrument",
          name: "Docket.intake_completed",
          owner: "@beep/a",
          attributes: ["beep.missing"],
          minTier: "shape-only",
          description: "Intake finished.",
        },
      ],
    });
    assertNone(decoded);
  });
});

describe("allowedAttributes", () => {
  const catalog = InstrumentCatalog.make({
    attributes: [
      attribute(source, { minTier: "shape-only" }),
      attribute(matterId, { minTier: "standard", cardinality: "unbounded" }),
      attribute(spanOnly, { signals: ["span"], minTier: "dev-verbose" }),
    ],
    instruments: [],
  });

  it("returns the closed key set for a signal at a tier", () => {
    deepStrictEqual(A.fromIterable(allowedAttributes(catalog, "span", "shape-only")), [source]);
    strictEqual(HashSet.size(allowedAttributes(catalog, "span", "dev-verbose")), 3);
    assertTrue(HashSet.has(allowedAttributes(catalog, "metric", "standard"), matterId));
    assertFalse(HashSet.has(allowedAttributes("metric", "dev-verbose")(catalog), spanOnly));
  });
});

describe("emitter context tiers", () => {
  const host = HostName.make("dankstation");
  const contexts: ReadonlyArray<readonly [EmitterContext, TelemetryTier]> = [
    [Workstation.make({ identitySource: "self-claimed", hostName: host }), "dev-verbose"],
    [Server.make({ identitySource: "vouched", hostName: host }), "standard"],
    [StrictDesktop.make({ identitySource: "vouched" }), "shape-only"],
    [
      CiRunner.make({ identitySource: "vouched", pipelineRunId: "42", vcsRevision: VcsRevision.make("4e66575c64") }),
      "standard",
    ],
    [CloudVm.make({ identitySource: "self-claimed", cloudProvider: CloudProviderName.make("aws") }), "standard"],
    [
      Serverless.make({
        identitySource: "vouched",
        cloudProvider: CloudProviderName.make("gcp"),
        faasName: "docket-intake",
        deploymentEnvironment: "production",
      }),
      "standard",
    ],
    [Browser.make({ identitySource: "self-claimed" }), "shape-only"],
  ];

  it("gives each variant its ceiling", () => {
    for (const [context, ceiling] of contexts) {
      strictEqual(tierCeiling(context), ceiling);
    }
  });

  it("takes the stricter of the requested tier and the ceiling", () => {
    const workstation = Workstation.make({ identitySource: "self-claimed", hostName: host });
    const server = Server.make({ identitySource: "vouched", hostName: host });
    const browser = Browser.make({ identitySource: "self-claimed" });
    strictEqual(effectiveTier(workstation, "dev-verbose"), "dev-verbose");
    strictEqual(effectiveTier(workstation, "shape-only"), "shape-only");
    strictEqual(effectiveTier(server, "dev-verbose"), "standard");
    strictEqual(effectiveTier(server, "shape-only"), "shape-only");
    strictEqual(effectiveTier("standard")(browser), "shape-only");
    for (const tier of TelemetryTier.literals) {
      strictEqual(effectiveTier(browser, tier), "shape-only");
    }
  });

  it.prop(
    "never emits looser than the ceiling or the requested tier",
    [Arbitrary.schema(EmitterContext), Arbitrary.schema(TelemetryTier)],
    ([context, requested]) => {
      const tier = effectiveTier(context, requested);
      strictEqual(tier, stricterTier(tierCeiling(context), requested));
      assertFalse(isStricterTier(tierCeiling(context), tier));
      assertFalse(isStricterTier(requested, tier));
      return true;
    },
    { arbitrary: fcRuns(50) }
  );

  it("requires the variant's fields when decoding", () => {
    assertNone(decodeContext({ _tag: "Server", identitySource: "vouched" }));
    assertNone(decodeContext({ _tag: "CiRunner", identitySource: "vouched", pipelineRunId: "1" }));
    assertSome(
      decodeContext({ _tag: "StrictDesktop", identitySource: "vouched" }).pipe(O.map(tierCeiling)),
      "shape-only"
    );
  });
});

describe("packageOf", () => {
  it("resolves a span name to its package and family", () => {
    const catalog = successOf(mergeDeclarations([], [span("Parcels.read", { origin: "harvested" })]));
    const owner = catalog.pipe(
      O.flatMap(packageOf("Parcels.read")),
      O.map(({ family, package: name }) => ({ family, name }))
    );
    assertSome(owner, { family: "foundation", name: pkgA });
    assertNone(catalog.pipe(O.flatMap(packageOf("Parcels.write"))));
  });

  it("does not resolve metric names", () => {
    const catalog = InstrumentCatalog.make({ attributes: [], instruments: [metric([])] });
    assertNone(packageOf(catalog, "beep.docket.intake_runs"));
  });
});

describe("kernel declarations", () => {
  it("declares the generic keys as shape-only, metric-safe keys", () => {
    deepStrictEqual(
      A.map(ObservabilityInstruments.attributes, ({ key, cardinality, minTier }) => ({ key, cardinality, minTier })),
      [
        { key: "beep.package", cardinality: "bounded", minTier: "shape-only" },
        { key: "beep.family", cardinality: "static", minTier: "shape-only" },
        { key: "beep.privacy_tier", cardinality: "static", minTier: "shape-only" },
        { key: "beep.identity_source", cardinality: "static", minTier: "shape-only" },
        { key: "beep.outcome", cardinality: "static", minTier: "shape-only" },
        { key: "beep.schema_failure_tag", cardinality: "static", minTier: "shape-only" },
        { key: "beep.duration_bucket", cardinality: "static", minTier: "shape-only" },
      ]
    );
    assertTrue(
      A.every(ObservabilityInstruments.attributes, (entry) =>
        HashSet.has(
          allowedAttributes(
            InstrumentCatalog.make({ attributes: ObservabilityInstruments.attributes, instruments: [] }),
            "metric",
            "shape-only"
          ),
          entry.key
        )
      )
    );
  });

  it("is not a conflict-free catalog when two EventInstruments share a name", () => {
    const event = EventInstrument.make({
      name: EventName.make("Docket.intake_completed"),
      owner: pkgA,
      minTier: "shape-only",
      description: "Intake finished.",
    });
    deepStrictEqual(conflictTags(mergeDeclarations([declarations([], [event, event])], [])), [
      "DuplicateInstrumentName",
    ]);
  });
});
