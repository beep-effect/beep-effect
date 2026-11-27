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

const lines = (...rows: ReadonlyArray<string>): string => A.join([IMPORT, ...rows, ""], "\n");

const hintsOf = (text: string, file = "src/Fixture.ts", written: O.Option<string> = O.none()) =>
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

  it("does not follow an imported identifier or a second hop", () => {
    expect(
      hintsOf(
        A.join(
          [
            IMPORT,
            'import { Millis } from "./Millis.ts";',
            "const Inner = S.Number;",
            "const Outer = Inner;",
            "export const Wire = S.Struct({ timeoutMs: Millis, delayMs: Outer, retryDelay: Unknown });",
            "",
          ],
          "\n"
        )
      )
    ).toEqual([]);
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
    ]);
  });

  it("leaves schemas that already convert or use a rich codec alone", () => {
    expect(
      hintsOf(
        lines(
          "const Delay = S.Number.pipe(S.decodeTo(S.Duration, transformation));",
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
          "  sizeBytes: S.Number.annotate({ codec: ByteSizeCodec }),",
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
          "});",
          "// const Commented = S.Struct({ timeoutMs: S.Number })"
        )
      )
    ).toEqual([]);
  });

  it("hints only fields on a line of the written text", () => {
    const text = lines("export const Wire = S.Struct({", "  timeoutMs: S.Number,", "  listenPort: S.Int,", "});");
    expect(hintsOf(text, "src/Fixture.ts", O.some("  listenPort: S.Int,\n"))).toEqual(["L4 listenPort port number"]);
  });

  it("skips files without an effect/Schema namespace import", () => {
    expect(hintsOf('import { Number } from "effect/Schema";\nconst W = { timeoutMs: S.Number };\n')).toEqual([]);
  });

  it("parses tsx files", () => {
    expect(
      hintsOf(lines("export const W = S.Struct({ port: S.Int });", "export const C = () => <div />;"), "src/W.tsx")
    ).toEqual(["L2 port port number"]);
  });

  it("skips generated, declaration, test and non-TypeScript paths", () => {
    const text = lines("export const W = S.Struct({ port: S.Int });");
    expect(hintsOf(text, "src/Wire.gen.ts")).toEqual([]);
    expect(A.map(["src/a.ts", "src/a.tsx", "src/a.mts"], isSchemaIdiomHintPath)).toEqual([true, true, true]);
    expect(
      A.map(
        [
          "src/_generated/a.ts",
          "test/a.ts",
          "src/a.test.ts",
          "src/a.spec.tsx",
          "src/a.d.ts",
          "src/a.md",
          "pkg/__tests__/a.ts",
        ],
        isSchemaIdiomHintPath
      )
    ).toEqual([false, false, false, false, false, false, false]);
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
