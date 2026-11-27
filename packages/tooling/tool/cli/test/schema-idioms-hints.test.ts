import {
  isSchemaIdiomHintPath,
  SCHEMA_IDIOM_TELLS,
  SCHEMA_INDEX_DIRECTORY,
  SCHEMA_PRIMITIVE_HEADS,
  SchemaIdiomHintInput,
  schemaIdiomHints,
} from "@beep/repo-cli/commands/SchemaIdioms";
import { findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { NodeTestLayer } from "./support/CommandTest.ts";

const indexLists = (text: string, name: string): boolean =>
  A.some(Str.split(text, "\n"), (line) => Str.startsWith(`- S.${name} `)(line) || Str.startsWith(`- S.${name}:`)(line));

const IMPORT = 'import * as S from "effect/Schema";';

const TRANSFORMATION_IMPORT = 'import * as T from "effect/SchemaTransformation";';

const lines = (...rows: ReadonlyArray<string>): string => A.join([IMPORT, ...rows, ""], "\n");

const hintsOf = (
  text: string,
  file = "src/Fixture.ts",
  written: O.Option<A.NonEmptyReadonlyArray<string>> = O.none()
) =>
  A.map(
    schemaIdiomHints(SchemaIdiomHintInput.make({ file, text, written })),
    (hint) =>
      `L${hint.line} ${hint.field}${O.getOrElse(
        O.map(hint.schemaIdentifier, (name) => ` (${name})`),
        () => ""
      )} ${hint.kind} ${hint.wire}`
  );

const OPUS_O3_REDUCED = A.join(
  [
    'import { $CiopsId } from "@beep/identity/packages";',
    'import { Port } from "@beep/schema/Port";',
    'import { SemanticVersion } from "@beep/schema/SemanticVersion";',
    'import { HttpsUrl } from "@beep/schema/URL";',
    'import * as S from "effect/Schema";',
    'import * as SchemaTransformation from "effect/SchemaTransformation";',
    "",
    'const $I = $CiopsId.create("fleet/RunnerFleet");',
    "",
    "/**",
    " * **Example** (Decode a runner)",
    " *",
    " * ```ts",
    " * const Wire = S.Struct({ timeoutMs: S.Number })",
    " * ```",
    " */",
    "export const RunnerHost = S.Trim.check(S.isNonEmpty()).pipe(",
    '  S.brand("RunnerHost"),',
    '  $I.annoteSchema("RunnerHost", {',
    '    description: "Address or host name a runner listens on.",',
    "  })",
    ");",
    "",
    "export const HeartbeatTimeout = S.Int.check(S.isGreaterThan(0)).pipe(",
    "  S.decodeTo(S.Duration, SchemaTransformation.durationFromMillis)",
    ");",
    "",
    "export const DiskFreeBytes = S.Natural.pipe(",
    '  S.brand("DiskFreeBytes"),',
    '  $I.annoteSchema("DiskFreeBytes", { description: "Free disk space in bytes." })',
    ");",
    "",
    "export class Runner extends S.Class<Runner>($I`Runner`)({",
    "  lastHeartbeatAt: S.DateTimeUtcFromString,",
    "  startedAt: S.DateTimeUtcFromMillis,",
    "  heartbeatTimeout: HeartbeatTimeout,",
    "  diskFreeBytes: DiskFreeBytes,",
    "  address: RunnerHost,",
    "  port: Port,",
    "  agentVersion: SemanticVersion,",
    "  dashboardUrl: HttpsUrl,",
    "  maintenanceUntil: S.OptionFromOptionalKey(S.DateTimeUtcFromString),",
    "}) {}",
    "",
  ],
  "\n"
);

const CODEX_C1_REDUCED = A.join(
  [
    'import * as S from "effect/Schema";',
    "",
    "const HeartbeatTimeout = S.Finite.check(S.isGreaterThan(0)).pipe(S.decodeTo(S.DurationFromMillis));",
    "",
    "export const Runner = S.Struct({",
    "  id: S.String.check(S.isUUID()),",
    "  lastHeartbeatAt: S.DateTimeUtcFromString,",
    "  startedAtMs: S.DateTimeUtcFromMillis,",
    "  heartbeatTimeoutMs: HeartbeatTimeout,",
    "  diskFreeBytes: S.ByteSizeFromNumber,",
    "  address: S.IpAddressFromString,",
    "  port: S.Port,",
    "  agentVersion: S.SemVerFromString,",
    "  dashboardUrl: S.URLFromString,",
    "  maintenanceUntil: S.OptionFromOptionalKey(S.DateTimeUtcFromString),",
    "});",
    "",
  ],
  "\n"
);

const DUPLICATE_LINE = lines(
  "export const Wire = S.Struct({",
  "  timeoutMs: S.Number,",
  "});",
  "/* Added documentation:",
  "timeoutMs: S.Number,",
  "*/"
);

describe("schema idiom hints", () => {
  it("hints the named byte-size schema of a builder output and not its bare address field", () => {
    expect(hintsOf(OPUS_O3_REDUCED)).toEqual(["L37 diskFreeBytes (DiskFreeBytes) byte-size number"]);
  });

  it("reads a network address only from host and ip names or a network-qualified address", () => {
    expect(
      hintsOf(
        lines(
          "export const Wire = S.Struct({",
          "  host: S.String,",
          "  ipAddress: S.String,",
          "  remoteAddress: S.String,",
          "  sourceIp: S.String,",
          "  upstreamHostname: S.String,",
          "  serverIPAddress: S.String,",
          "  primaryBindAddress: S.String,",
          "  address: S.String,",
          "  homeAddress: S.String,",
          "  billingAddress: S.String,",
          "  walletAddress: S.String,",
          "  emailAddress: S.String,",
          "  shippingAddress: S.String,",
          "});"
        )
      )
    ).toEqual([
      "L3 host network-address string",
      "L4 ipAddress network-address string",
      "L5 remoteAddress network-address string",
      "L6 sourceIp network-address string",
      "L7 upstreamHostname network-address string",
      "L8 serverIPAddress network-address string",
      "L9 primaryBindAddress network-address string",
    ]);
  });

  it("stays silent on a builder output that already uses shipped codecs", () => {
    expect(hintsOf(CODEX_C1_REDUCED)).toEqual([]);
  });

  it("reads each tell kind over its primitive heads", () => {
    expect(
      hintsOf(
        lines(
          "export const Wire = S.Struct({",
          "  startedAtMs: S.Number,",
          "  createdAt: S.String,",
          "  deletedAt: S.Date,",
          "  timeoutMs: S.Int,",
          "  pollInterval: S.NumberFromString,",
          "  sizeBytes: S.Finite,",
          "  homepageUrl: S.NonEmptyString,",
          "  host: S.String,",
          "  listenPort: S.Natural,",
          "  agentVersion: S.Trimmed,",
          "});"
        )
      )
    ).toEqual([
      "L3 startedAtMs instant number",
      "L4 createdAt instant string",
      "L5 deletedAt instant date",
      "L6 timeoutMs duration number",
      "L7 pollInterval duration string",
      "L8 sizeBytes byte-size number",
      "L9 homepageUrl url string",
      "L10 host network-address string",
      "L11 listenPort port number",
      "L12 agentVersion version string",
    ]);
  });

  it("a name tell over a primitive of another decoded type is not hinted", () => {
    expect(
      hintsOf(
        lines(
          "export const Wire = S.Struct({",
          "  listenPort: S.String,",
          "  timeoutMs: S.String,",
          "  homepageUrl: S.Number,",
          "  agentVersion: S.Int,",
          "  sizeBytes: S.String,",
          "});"
        )
      )
    ).toEqual([]);
  });

  it("lower-case words ending in a tell suffix are not hinted", () => {
    expect(
      hintsOf(
        lines(
          "export const Wire = S.Struct({",
          "  support: S.Number,",
          "  ghost: S.String,",
          "  zip: S.String,",
          "  format: S.String,",
          "  flat: S.Number,",
          "  transport: S.Number,",
          "  passport: S.Number,",
          "  expires: S.String,",
          "});"
        )
      )
    ).toEqual([]);
  });

  it("an interface member is not a schema field", () => {
    expect(
      hintsOf(
        lines(
          "export interface Options { readonly timeoutMs: number }",
          "export type Wire = { diskFreeBytes: number };",
          "export const defaults = { timeoutMs: 5000, port: Number(8080) };"
        )
      )
    ).toEqual([]);
  });

  it("hints only properties of a schema field container's fields argument", () => {
    expect(hintsOf(lines("export const codecRegistry = {", "  version: S.String,", "};"))).toEqual([]);
    expect(hintsOf(lines("export const Wire = S.String.annotate({", "  version: S.String,", "});"))).toEqual([]);
    expect(
      hintsOf(
        lines(
          "export const Wire = S.Struct({ timeoutMs: S.Number });",
          "export const defaults = { timeoutMs: S.Number.make(5000) };"
        )
      )
    ).toEqual(["L2 timeoutMs duration number"]);
    expect(hintsOf(lines("export const Wire = S.Struct({ timeoutMs: S.Number.make(5000) });"))).toEqual([]);
    expect(
      hintsOf(
        lines(
          'export class Runner extends S.Class<Runner>("Runner")({ timeoutMs: S.Number }, { version: S.String }) {}',
          "export const Plain = notSchema.Struct({ listenPort: S.Int });",
          "export const Optional = S.Struct?.({ listenPort: S.Int });"
        )
      )
    ).toEqual(["L2 timeoutMs duration number"]);
  });

  it("reads the fields argument of each recognized container", () => {
    expect(
      hintsOf(
        lines(
          'export const Tagged = S.TaggedStruct("Tagged", { timeoutMs: S.Number });',
          'export class Klass extends S.Class<Klass>("Klass")({ listenPort: S.Int }) {}',
          'export class Tag extends S.TaggedClass<Tag>()("Tag", { sizeBytes: S.Number }) {}',
          'export class Failure extends S.Error<Failure>("Failure")({ retryDelay: S.Number }) {}',
          'export class Tagged2 extends S.TaggedError<Tagged2>()("Tagged2", { homeUrl: S.String }) {}',
          "export class Wire extends S.Opaque<Wire, { readonly brand: unique symbol }>()(",
          "  S.Struct({ agentVersion: S.String })",
          ") {}",
          "export const Nested = S.Struct({ inner: S.Struct({ host: S.String }) });"
        )
      )
    ).toEqual([
      "L2 timeoutMs duration number",
      "L3 listenPort port number",
      "L4 sizeBytes byte-size number",
      "L5 retryDelay duration number",
      "L6 homeUrl url string",
      "L8 agentVersion version string",
      "L10 host network-address string",
    ]);
  });

  it("does not trust a namespace alias or const bound more than once in the file", () => {
    expect(
      hintsOf(lines("export function makeDefaults(S: { Number: number }) {", "  return { timeoutMs: S.Number };", "}"))
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          "const Timeout = S.Number;",
          "export function makeDefaults(Timeout: number) {",
          "  return { timeoutMs: Timeout };",
          "}"
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          "const Timeout = S.Number;",
          "export function makeWire() {",
          "  const Timeout = S.DurationFromMillis;",
          "  return S.Struct({ timeoutMs: Timeout });",
          "}"
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(lines("export const Wire = S.Struct({ timeoutMs: S.Number });", "try { run() } catch (S) { report(S) }"))
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          "const Timeout = S.Number;",
          "export const Wire = S.Struct({ timeoutMs: Timeout });",
          "{ let Timeout = 1; use(Timeout) }"
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          "const Timeout = S.Number;",
          "export const Wire = S.Struct({ timeoutMs: Timeout });",
          "const { a: [, ...Timeout2], b = Timeout } = source;",
          "function Timeout2Fn({ Timeout }: { Timeout: number }) { return Timeout }"
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(lines("export const Wire = S.Struct({ timeoutMs: S.Number });", "const [S2, ...S] = pair;"))
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          "export const make = (S: { Struct: (f: unknown) => unknown; Number: unknown }) => S.Struct({ timeoutMs: S.Number });"
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          "const Timeout = S.Number;",
          "export const f = (Timeout: number) => ({ timeoutMs: Timeout });",
          "export const Wire = S.Struct({ timeoutMs: Timeout });"
        )
      )
    ).toEqual([]);
  });

  it("hints an alias and const bound exactly once", () => {
    expect(
      hintsOf(
        lines(
          "const Timeout = S.Number;",
          "export const Wire = S.Struct({ timeoutMs: Timeout });",
          "export function makeDefaults(T: number) {",
          "  return { timeoutMs: T };",
          "}"
        )
      )
    ).toEqual(["L3 timeoutMs (Timeout) duration number"]);
  });

  it("follows one identifier hop through method calls and optional wrappers", () => {
    expect(
      hintsOf(
        lines(
          "const Timeout = S.Number.check(S.isGreaterThan(0));",
          "export const Wire = S.Struct({",
          '  timeoutMs: Timeout.annotateKey({ description: "timeout" }),',
          "  ttl: S.optionalKey(S.Int),",
          "  delay: S.OptionFromNullOr(S.Number),",
          '  "intervalMs": (S.Number as typeof S.Number),',
          "  retryDelay: S.NullOr(),",
          "  emailAddress: S.String,",
          "  remoteAddress: S.String,",
          "  homeUrl: (S.String satisfies unknown),",
          "  listenPort: S.Int!,",
          "  waitMs: S.optionalKey(Timeout),",
          "});"
        )
      )
    ).toEqual([
      "L4 timeoutMs (Timeout) duration number",
      "L5 ttl duration number",
      "L6 delay duration number",
      "L7 intervalMs duration number",
      "L10 remoteAddress network-address string",
      "L11 homeUrl url string",
      "L12 listenPort port number",
      "L13 waitMs (Timeout) duration number",
    ]);
  });

  it("a converted const stays converted inside an optional wrapper", () => {
    const converted = (field: string) =>
      lines(
        TRANSFORMATION_IMPORT,
        "const Timeout = S.Number.pipe(S.decodeTo(S.Duration, T.durationFromMillis));",
        `export const Wire = S.Struct({ timeoutMs: ${field} });`
      );
    expect(hintsOf(converted("S.optionalKey(Timeout)"))).toEqual([]);
    expect(hintsOf(converted("S.NullOr(Timeout)"))).toEqual([]);
    expect(hintsOf(converted("S.OptionFromOptionalKey(Timeout)"))).toEqual([]);
    expect(hintsOf(converted("Timeout.pipe(S.optionalKey)"))).toEqual([]);
  });

  it("keeps a primitive only through an allow-listed pipe", () => {
    expect(
      hintsOf(
        lines(
          TRANSFORMATION_IMPORT,
          "const convert = S.decodeTo(S.Duration, T.durationFromMillis);",
          "export const Wire = S.Struct({ timeoutMs: S.Number.pipe(convert) });"
        )
      )
    ).toEqual([]);
    expect(hintsOf(lines("export const Wire = S.Struct({ timeoutMs: S.Number.pipe(S.Array) });"))).toEqual([]);
    expect(
      hintsOf(
        lines(
          "export const Wire = S.Struct({",
          "  timeoutMs: S.Array(S.Number),",
          "  delayMs: S.Number.pipe(S.check(S.isGreaterThan(0)), S.Array),",
          "  ttl: S.Number.pipe(S.decodeTo(S.Duration, transformation)),",
          "  pollInterval: S.Number.pipe(...combinators),",
          '  waitMs: S.Number.pipe(S.brand?.("Wait")),',
          "  retryMs: S.Number.pipe(S.Struct.fields),",
          '  graceMs: S.Number.pipe(helper.annoteSchema("x")),',
          "  idleMs: S.Number.pipe(S.mutable),",
          "  fromMillisMs: S.Number.pipe(durations.fromMillis()),",
          "  localDecodeMs: S.Number.pipe(local.decodeTo(S.Duration)),",
          "});"
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          "const $I = { annoteSchema: (name: string) => name };",
          "export const Wire = S.Struct({",
          '  timeoutMs: S.Number.pipe(S.check(S.isGreaterThan(0)), S.brand("Timeout"), $I.annoteSchema("T")),',
          "  delayMs: S.Number.pipe(S.annotate({}), S.annotateKey({}), S.withConstructorDefault(make)),",
          "  ttl: S.Number.pipe(S.withDecodingDefault(make), S.withDecodingDefaultKey(make), S.optionalKey),",
          "  waitMs: S.Number.pipe(S.withDecodingDefaultType(make), S.withDecodingDefaultTypeKey(make)),",
          "});"
        )
      )
    ).toEqual([
      "L4 timeoutMs duration number",
      "L5 delayMs duration number",
      "L6 ttl duration number",
      "L7 waitMs duration number",
    ]);
  });

  it("an annotation helper keeps a primitive only on a $-prefixed identity composer bound once", () => {
    expect(
      hintsOf(
        lines(
          "const helper = {annoteSchema: (_: string) => (_: typeof S.Number) => S.DurationFromMillis};",
          'export const Wire = S.Struct({timeoutMs: S.Number.pipe(helper.annoteSchema("Timeout"))});'
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          "const helper = {annote: () => (_: typeof S.Number) => S.DurationFromMillis}; export const Wire=S.Struct({timeoutMs:S.Number.pipe(helper.annote())});"
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          "const $I = { annoteSchema: (name: string) => name };",
          'export const Wire = S.Struct({ timeoutMs: S.Number.pipe($I.annoteSchema("T")) });',
          "export const make = ($I: unknown) => $I;"
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(lines('export const Wire = S.Struct({ timeoutMs: S.Number.pipe($Undeclared.annoteSchema("T")) });'))
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          'const $I = $RepoCliId.create("demo");',
          'export const Wire = S.Struct({ timeoutMs: S.Number.pipe($I.annoteSchema("T")) });'
        )
      )
    ).toEqual(["L3 timeoutMs duration number"]);
  });

  it("a field overridden later in its object literal is not hinted", () => {
    expect(
      hintsOf(
        lines(
          "const fields = {timeoutMs: S.DurationFromMillis};",
          "export const Wire = S.Struct({timeoutMs: S.Number, ...fields});"
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          'const key = "timeoutMs";',
          "export const Wire = S.Struct({timeoutMs: S.Number, [key]: S.DurationFromMillis});"
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(lines("export const Wire = S.Struct({timeoutMs: S.Number, timeoutMs: S.DurationFromMillis});"))
    ).toEqual([]);
    expect(
      hintsOf(lines('export const Wire = S.Struct({ "timeoutMs": S.Number, timeoutMs: S.DurationFromMillis });'))
    ).toEqual([]);
    expect(
      hintsOf(lines('export const Wire = S.Struct({ timeoutMs: S.Number, ["timeoutMs"]: S.DurationFromMillis });'))
    ).toEqual([]);
    expect(hintsOf(lines('export const Wire = S.Struct({ ["other"]: S.String, listenPort: S.Int });'))).toEqual([]);
    expect(
      hintsOf(
        lines(
          "const fields = {timeoutMs: S.DurationFromMillis}; export const Wire = S.Struct({...fields, timeoutMs:S.Number});"
        )
      )
    ).toEqual(["L2 timeoutMs duration number"]);
  });

  it("a container whose fields are rewritten hints none of them", () => {
    expect(
      hintsOf(
        lines(
          "export const Wire = S.Struct({timeoutMs: S.Number}).mapFields(() => ({timeoutMs: S.DurationFromMillis}));"
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(
        lines("export const Wire = S.Struct({ timeoutMs: S.Number }).pipe(S.fieldsAssign({ timeoutMs: S.Duration }));")
      )
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          'import { pipe } from "effect/Function";',
          "export const Wire = pipe(S.Struct({ timeoutMs: S.Number }), S.fieldsAssign({ timeoutMs: S.Duration }));"
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          'const $I = $RepoCliId.create("demo");',
          'export const Wire = S.Struct({ timeoutMs: S.Number }).pipe($I.annoteSchema("Wire")).mapFields(rewrite);'
        )
      )
    ).toEqual([]);
    expect(
      hintsOf(
        lines(
          'const $I = $RepoCliId.create("demo");',
          "export class Wire extends S.Opaque<Wire, { readonly brand: unique symbol }>()(",
          '  S.Struct({ timeoutMs: S.Number }).pipe($I.annoteSchema("Wire"), S.annotate({}))',
          ") {}",
          'export const Checked = pipe(S.Struct({ listenPort: S.Int }), S.brand("Checked"));',
          "export const Annotated = S.Struct({ sizeBytes: S.Number }).annotate({}).check(S.makeFilter(isValid));",
          'export class Klass extends S.Class<Klass>("Klass")({ retryDelay: S.Number }) {}'
        )
      )
    ).toEqual([
      "L4 timeoutMs duration number",
      "L6 listenPort port number",
      "L7 sizeBytes byte-size number",
      "L8 retryDelay duration number",
    ]);
  });

  it("an identifier naming a rich value inside a check or annotation does not suppress the hint", () => {
    expect(
      hintsOf(
        lines(
          "const maximumDuration = 5000;",
          "export const Wire = S.Struct({ timeoutMs: S.Number.check(S.isLessThan(maximumDuration)) });"
        )
      )
    ).toEqual(["L3 timeoutMs duration number"]);
    expect(
      hintsOf(lines("export const Wire = S.Struct({ sizeBytes: S.Number.annotate({ codec: ByteSizeCodec }) });"))
    ).toEqual(["L2 sizeBytes byte-size number"]);
  });

  it("does not follow an imported identifier or a second hop", () => {
    expect(
      hintsOf(
        A.join(
          [
            IMPORT,
            'import { Millis } from "./Millis.ts";',
            "const Inner = S.Number;",
            "const Outer = Inner;",
            "const Wrapped = S.optionalKey(Inner);",
            "export const Wire = S.Struct({ timeoutMs: Millis, delayMs: Outer, retryDelay: Unknown, waitMs: Wrapped });",
            "",
          ],
          "\n"
        )
      )
    ).toEqual([]);
  });

  it("leaves schemas that already convert or use a rich codec alone", () => {
    expect(
      hintsOf(
        lines(
          "const Delay = S.Number.pipe(S.decodeTo(S.Duration, transformation));",
          "const Inner = S.Number.pipe(S.decodeTo(S.Duration, transformation));",
          "const Wrapped = S.optionalKey(Inner);",
          "const { Number: Destructured } = S;",
          "export declare const Declared: unknown;",
          "export const Wire = S.Struct({",
          "  retryDelay: Delay,",
          "  wrappedMs: Wrapped,",
          "  destructuredMs: Destructured,",
          "  declaredMs: Declared,",
          "  eighthMs: S(),",
          '  ninthMs: S["optionalKey"](S.Number),',
          "  tenthMs: S.optionalKey(1),",
          "  1: S.Int,",
          "  timeoutMs: S.Number.pipe(S.decode(toMillis)),",
          "  createdAt: S.DateTimeUtcFromString,",
          "  label: S.String,",
          "  [computedMs]: S.Number,",
          "  ...spread,",
          "  method() { return S.Number },",
          '  kind: S.Literal("a"),',
          "  fieldMs: unknownCall(S.Number),",
          "  otherMs: S.Struct.fields,",
          '  thirdMs: S["Number"],',
          "  fourthMs: notSchema.Number,",
          "  fifthMs: (() => S.Number)(),",
          "  sixthMs: S.optionalKey(...rest),",
          "  seventhMs: S.optionalKey(),",
          "  twoArgMs: S.optionalKey(S.Number, S.Number),",
          "  optionalCallMs: S.optionalKey?.(S.Number),",
          "  madeMs: S.Number.make(1),",
          "  rebuiltMs: S.Number.rebuild(ast),",
          "  durationMs: S.DurationFromMillis,",
          "});",
          "// const Commented = S.Struct({ timeoutMs: S.Number })"
        )
      )
    ).toEqual([]);
  });

  it("hints only fields inside a written fragment that occurs once", () => {
    const text = lines("export const Wire = S.Struct({", "  timeoutMs: S.Number,", "  listenPort: S.Int,", "});");
    expect(hintsOf(text, "src/Fixture.ts", O.some(["  listenPort: S.Int,\n"]))).toEqual(["L4 listenPort port number"]);
    expect(hintsOf(text, "src/Fixture.ts", O.some(["listenPort: S"]))).toEqual([]);
    expect(hintsOf(text, "src/Fixture.ts", O.some(["absent", "  timeoutMs: S.Number,"]))).toEqual([
      "L3 timeoutMs duration number",
    ]);
  });

  it("a comment-only edit that repeats a field line hints nothing", () => {
    expect(hintsOf(DUPLICATE_LINE)).toEqual(["L3 timeoutMs duration number"]);
    expect(
      hintsOf(DUPLICATE_LINE, "src/Fixture.ts", O.some(["/* Added documentation:\ntimeoutMs: S.Number,\n*/"]))
    ).toEqual([]);
  });

  it("a written fragment that occurs twice scopes nothing", () => {
    const text = lines(
      "export const A = S.Struct({",
      "  timeoutMs: S.Number,",
      "});",
      "export const B = S.Struct({",
      "  timeoutMs: S.Number,",
      "});"
    );
    expect(hintsOf(text)).toEqual(["L3 timeoutMs duration number", "L6 timeoutMs duration number"]);
    expect(hintsOf(text, "src/Fixture.ts", O.some(["  timeoutMs: S.Number,"]))).toEqual([]);
  });

  it("a namespace import of another module named S is not hinted", () => {
    expect(
      hintsOf('import * as S from "./MySchema.ts";\nexport const Wire = S.Struct({ timeoutMs: S.Number });\n')
    ).toEqual([]);
    expect(
      hintsOf('import type * as S from "effect/Schema";\nexport const Wire = S.Struct({ timeoutMs: S.Number });\n')
    ).toEqual([]);
  });

  it("named imports from effect/Schema are not hinted", () => {
    expect(
      hintsOf('import { Number, Struct } from "effect/Schema";\nexport const Wire = Struct({ timeoutMs: Number });\n')
    ).toEqual([]);
  });

  it("a file that does not parse is not hinted", () => {
    expect(hintsOf(lines("export const Wire = S.Struct({ timeoutMs: S.Number });", "const y = a ?? b || c;"))).toEqual(
      []
    );
  });

  it("parses tsx files", () => {
    expect(
      hintsOf(lines("export const W = S.Struct({ port: S.Int });", "export const C = () => <div />;"), "src/W.tsx")
    ).toEqual(["L2 port port number"]);
  });

  it("skips generated, declaration, test and non-TypeScript paths", () => {
    const text = lines("export const W = S.Struct({ port: S.Int });");
    expect(hintsOf(text, "src/Wire.gen.ts")).toEqual([]);
    expect(hintsOf(text, "src/Wire.mts")).toEqual(["L2 port port number"]);
    expect(hintsOf(text, "src/Wire.cts")).toEqual(["L2 port port number"]);
    expect(A.map(["src/a.ts", "src/a.tsx", "src/a.mts", "src/a.cts"], isSchemaIdiomHintPath)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(
      A.map(
        [
          "src/_generated/a.ts",
          "test/a.ts",
          "src/a.test.ts",
          "src/a.spec.tsx",
          "src/a.d.ts",
          "src/a.d.mts",
          "src/a.test.mts",
          "src/a.gen.cts",
          "src/a.md",
          "pkg/__tests__/a.ts",
        ],
        isSchemaIdiomHintPath
      )
    ).toEqual([false, false, false, false, false, false, false, false, false, false]);
  });
});

it.layer(NodeTestLayer, { timeout: "30 seconds" })((it) => {
  it.effect("every suggested schema and primitive head exists in the generated index", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const read = (slice: string) => fs.readFileString(path.join(repoRoot, SCHEMA_INDEX_DIRECTORY, `${slice}.md`));
      const slices = yield* Effect.forEach(
        ["wire-string", "wire-number", "wire-bigint", "wire-date", "wire-other"],
        read,
        { concurrency: 1 }
      );
      const whole = A.join(slices, "\n");
      const shipped = A.flatMap(SCHEMA_IDIOM_TELLS, (tell) => tell.shipped);
      expect(A.filter(shipped, (name) => !indexLists(whole, name))).toEqual([]);
      const heads = yield* Effect.forEach(
        SCHEMA_PRIMITIVE_HEADS,
        (head) =>
          Effect.map(read(`wire-${head.wire}`), (text) => (indexLists(text, head.name) ? O.none() : O.some(head.name))),
        { concurrency: 1 }
      );
      expect(A.getSomes(heads)).toEqual([]);
    })
  );
});
