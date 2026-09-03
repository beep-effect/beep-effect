import { BunRuntime } from "@effect/platform-bun";
import { layer as bunServicesLayer } from "@effect/platform-bun/BunServices";
import { fail, flatMap, fnUntraced, gen, provide, scoped, succeed, sync, tryPromise } from "effect/Effect";
import { FileSystem } from "effect/FileSystem";
import { build as buildLayer } from "effect/Layer";
import { String as StringSchema, TaggedError, Unknown } from "effect/Schema";
import { buildBundleConsumer, bundleConsumerEntrypointId, esbuildVersion } from "./bundle-build.ts";
import committedBaseline from "./bundle-size.baseline.json" with { type: "json" };
import { compareBundleSize, formatBundleSizeLine, minimumBundleRawBytes } from "./bundle-size.ts";

const baselinePath = new URL("./bundle-size.baseline.json", import.meta.url).pathname;
const testBaselineArgumentPrefix = "--test-baseline-raw-bytes=";

class BundleProbeError extends TaggedError<BundleProbeError>("@beep/effect-drizzle/test/BundleProbeError")(
  "BundleProbeError",
  { message: StringSchema, cause: Unknown }
) {}

const measureBundleConsumer = fnUntraced(function* () {
  const artifact = yield* tryPromise({
    try: buildBundleConsumer,
    catch: (cause) => BundleProbeError.make({ message: "Bundle build rejected", cause }),
  });
  if (!artifact.text.includes("integer")) {
    return yield* fail(
      BundleProbeError.make({
        message: "Bundle artifact lost the consumer surface (no integer symbol) — over-shaken stub",
        cause: { rawBytes: artifact.rawBytes },
      })
    );
  }
  return artifact;
});

const validateBaselineIdentity = () => {
  const mismatches: Array<string> = [];
  if (committedBaseline.schemaVersion !== 1) {
    mismatches.push(`schemaVersion ${committedBaseline.schemaVersion} (expected 1)`);
  }
  if (committedBaseline.entrypoint !== bundleConsumerEntrypointId) {
    mismatches.push(`entrypoint ${committedBaseline.entrypoint} (expected ${bundleConsumerEntrypointId})`);
  }
  if (committedBaseline.esbuildVersion !== esbuildVersion) {
    mismatches.push(`esbuildVersion ${committedBaseline.esbuildVersion} (installed ${esbuildVersion})`);
  }
  return mismatches.length === 0
    ? succeed(undefined)
    : fail(
        BundleProbeError.make({
          message: `Committed baseline identity does not match this probe; re-baseline deliberately: ${mismatches.join("; ")}`,
          cause: committedBaseline,
        })
      );
};

const renderBaseline = (rawBytes: number): string => `{
  "schemaVersion": 1,
  "entrypoint": "${bundleConsumerEntrypointId}",
  "esbuildVersion": "${esbuildVersion}",
  "rawBytes": ${rawBytes}
}
`;

const writeBaseline = fnUntraced(function* (rawBytes: number) {
  const fs = yield* FileSystem;
  yield* fs.writeFileString(baselinePath, renderBaseline(rawBytes));
});

const injectedBaseline = (): number | undefined => {
  const argument = Bun.argv.find((value) => value.startsWith(testBaselineArgumentPrefix));
  if (argument === undefined) return undefined;
  const value = Number(argument.slice(testBaselineArgumentPrefix.length));
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
};

const resolveBaseline = () => {
  const argument = Bun.argv.find((value) => value.startsWith(testBaselineArgumentPrefix));
  const baseline = injectedBaseline();
  if (argument !== undefined && baseline === undefined) {
    return fail(BundleProbeError.make({ message: "Invalid injected test baseline", cause: argument }));
  }
  return succeed(baseline ?? committedBaseline.rawBytes);
};

const reportComparison = fnUntraced(function* (currentRawBytes: number, baselineRawBytes: number) {
  const comparison = compareBundleSize(currentRawBytes, {
    baselineRawBytes,
    minimumRawBytes: minimumBundleRawBytes,
  });
  const line = formatBundleSizeLine(currentRawBytes, baselineRawBytes);
  yield* sync(() => {
    process.stdout.write(`${line}\n`);
  });
  const summaryPath = Bun.env.GITHUB_STEP_SUMMARY;
  if (summaryPath !== undefined) {
    const fs = yield* FileSystem;
    yield* fs.writeFileString(summaryPath, `- ${line}\n`, { flag: "a" });
  }
  if (comparison.isCollapse) {
    return yield* fail(
      BundleProbeError.make({
        message: "Bundle raw byte size fell below the stub-collapse floor",
        cause: comparison,
      })
    );
  }
  if (comparison.isRegression) {
    return yield* fail(
      BundleProbeError.make({
        message: "Bundle raw byte size exceeds the committed baseline",
        cause: comparison,
      })
    );
  }
});

const program = gen(function* () {
  const artifact = yield* measureBundleConsumer();
  if (Bun.argv.includes("--write-baseline")) {
    yield* writeBaseline(artifact.rawBytes);
    return yield* reportComparison(artifact.rawBytes, artifact.rawBytes);
  }
  yield* validateBaselineIdentity();
  const baselineRawBytes = yield* resolveBaseline();
  return yield* reportComparison(artifact.rawBytes, baselineRawBytes);
});

const main = bunServicesLayer.pipe(
  buildLayer,
  flatMap((context) => program.pipe(provide(context))),
  scoped
);

if (import.meta.main) {
  BunRuntime.runMain(main);
}
