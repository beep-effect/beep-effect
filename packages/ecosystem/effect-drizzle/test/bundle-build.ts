import { build, version as esbuildVersion } from "esbuild";

const packageRoot = new URL("../", import.meta.url).pathname;

export const bundleConsumerEntrypointId = "test/bundle-pg-integer.consumer.ts";

// Peers stay external: the probe measures what this package adds to a consumer
// bundle, not the cost of effect or drizzle-orm themselves. esbuild is the
// build engine because Bun.build 1.3.14 tree-shakes this package's re-export
// graph down to a stub that exports a dropped binding (an invalid module), so
// its byte counts and absence assertions are vacuous.
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

export { esbuildVersion };
