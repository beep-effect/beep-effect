import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ResolvedTsconfig } from "../../effected/tsconfig-json/ResolvedTsconfig.ts";

it.effect("same-directory inherited file entries keep their spelling and derived watch options work without a base", () => Effect.gen(function* () {
  const base: ResolvedTsconfig = { configPath: "/app/base.json", extendedPaths: ["/app/base.json"], compilerOptions: {}, files: ["main.ts"], include: ["src"], exclude: ["dist"] };
  const merged = ResolvedTsconfig.merge(base, { watchOptions: { excludeFiles: ["${configDir}/temp.ts"] } }, "/app/tsconfig.json");
  assert.deepStrictEqual(merged.files, ["main.ts"]);
  assert.deepStrictEqual(merged.include, ["src"]);
  assert.deepStrictEqual(merged.exclude, ["dist"]);
  assert.deepStrictEqual(merged.watchOptions, { excludeFiles: ["${configDir}/temp.ts"] });
  assert.deepStrictEqual(ResolvedTsconfig.substituteConfigDir(merged, "/app").watchOptions, { excludeFiles: ["/app/temp.ts"] });
}));

it.effect("derived omission preserves inherited watch options unchanged", () => Effect.gen(function* () {
  const watchOptions = { watchFile: "usefsevents", excludeDirectories: ["node_modules"] } as const;
  const base: ResolvedTsconfig = { configPath: "/app/base.json", extendedPaths: ["/app/base.json"], compilerOptions: {}, watchOptions };
  const merged = ResolvedTsconfig.merge(base, {}, "/app/tsconfig.json");
  assert.deepStrictEqual(merged.watchOptions, watchOptions);
  assert.strictEqual(merged.watchOptions, watchOptions);
}));
