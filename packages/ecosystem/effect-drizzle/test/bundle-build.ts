import * as NodeURL from "node:url";
import { sort } from "effect/Array";
import { fnUntraced, tryPromise } from "effect/Effect";
import { FileSystem } from "effect/FileSystem";
import { keys } from "effect/Record";
import { String as StringSchema, TaggedError, Unknown } from "effect/Schema";
import { Order as StringOrder } from "effect/String";
import { build, version as esbuildVersion } from "esbuild";

const packageRoot = NodeURL.fileURLToPath(new URL("../", import.meta.url));

export const bundleConsumerEntrypointId = "test/bundle-pg-integer.consumer.ts";

export const bundleConsumerExportName = "integer";

// decision: bundle-probe-esbuild-peers-external
const externalPeers = ["effect", "effect/*", "drizzle-orm", "drizzle-orm/*"] as const;

export type BundleConsumerArtifact = {
  readonly rawBytes: number;
  readonly text: string;
};

export const buildBundleConsumer = (): Promise<BundleConsumerArtifact> =>
  build({
    entryPoints: [`${packageRoot}${bundleConsumerEntrypointId}`],
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    external: [...externalPeers],
    alias: {
      "@beep/effect-drizzle/pg": `${packageRoot}src/pg/index.ts`,
      "@beep/effect-drizzle/sqlite": `${packageRoot}src/sqlite/index.ts`,
      "@beep/effect-drizzle": `${packageRoot}src/index.ts`,
    },
  }).then((result) => {
    const output = result.outputFiles[0];
    if (result.outputFiles.length !== 1 || output === undefined) {
      throw new Error(`bundle build produced ${result.outputFiles.length} outputs instead of exactly one`);
    }
    return { rawBytes: output.contents.byteLength, text: output.text };
  });

class BundleImportError extends TaggedError<BundleImportError, { readonly brand: unique symbol }>(
  "@beep/effect-drizzle/test/BundleImportError"
)("BundleImportError", { message: StringSchema, cause: Unknown }) {}

// decision: bundle-probe-esbuild-peers-external
export const makeBundleImportDirectory = fnUntraced(function* () {
  const fs = yield* FileSystem;
  const scratchRoot = `${packageRoot}.beep/bundle-probe`;
  yield* fs.makeDirectory(scratchRoot, { recursive: true });
  return yield* fs.makeTempDirectoryScoped({ directory: scratchRoot, prefix: "import-" });
});

// decision: bundle-probe-esbuild-peers-external
export const importBundleConsumer = fnUntraced(function* (text: string, directory: string) {
  const fs = yield* FileSystem;
  const modulePath = `${directory}/consumer.mjs`;
  yield* fs.writeFileString(modulePath, text);
  const namespace = yield* tryPromise({
    try: (): Promise<Readonly<Record<string, unknown>>> => import(NodeURL.pathToFileURL(modulePath).href),
    catch: (cause) => BundleImportError.make({ message: "Bundle artifact is not an importable module", cause }),
  });
  const exportNames = sort(keys(namespace), StringOrder);
  if (typeof namespace[bundleConsumerExportName] !== "function") {
    return yield* BundleImportError.make({
      message: `Bundle artifact does not export ${bundleConsumerExportName} as a function`,
      cause: { exportNames },
    });
  }
  return exportNames;
});

export { esbuildVersion };
