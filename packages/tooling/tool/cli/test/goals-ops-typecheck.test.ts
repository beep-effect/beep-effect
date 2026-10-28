import { githubCheckRepoSanityLanesForTesting } from "@beep/repo-cli/test/Quality";
import { globMatches } from "@beep/repo-cli/test/SharedInternals";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// goals/tsconfig.ops.json is the only compiler project over goals/*/ops scripts: root
// tsconfig.configs.json excludes goals/** and no package project reaches them. These tests keep
// every ops script inside that project and the project on the repo-sanity lane. The repository
// files are read through Vite's raw glob, so the suite needs no filesystem service.
const OPS_TSCONFIG = "goals/tsconfig.ops.json";
const GOALS_PREFIX = "../../../../../goals/";

const opsTsconfigText = import.meta.glob<string>("../../../../../goals/tsconfig.ops.json", {
  eager: true,
  import: "default",
  query: "?raw",
});
const opsManifestTexts = import.meta.glob<string>("../../../../../goals/*/ops/manifest.json", {
  eager: true,
  import: "default",
  query: "?raw",
});
// Raw text, so no script is ever imported; only the keys are read.
const opsTypeScriptModules = import.meta.glob<string>("../../../../../goals/*/ops/**/*.ts", {
  eager: true,
  import: "default",
  query: "?raw",
});

const OpsTsconfig = S.Struct({
  include: S.NonEmptyArray(S.String),
  exclude: S.Array(S.String),
});
const decodeOpsTsconfig = decodeJsoncTextAs(OpsTsconfig);

const OpsManifest = S.Struct({
  opsScripts: S.Array(S.Struct({ path: S.String })).pipe(S.optionalKey),
});
const decodeOpsManifest = decodeJsoncTextAs(OpsManifest);

type OpsTsconfig = typeof OpsTsconfig.Type;

const goalsRelative = (globKey: string): string => Str.slice(GOALS_PREFIX.length)(globKey);

// `include`/`exclude` patterns resolve against goals/, the directory holding the tsconfig.
const isCheckedBy =
  (config: OpsTsconfig) =>
  (goalsRelativePath: string): boolean =>
    A.some(config.include, (pattern) => globMatches(pattern)(goalsRelativePath)) &&
    !A.some(config.exclude, (pattern) => globMatches(pattern)(goalsRelativePath));

const loadOpsTsconfig = Effect.suspend(() =>
  decodeOpsTsconfig(O.getOrElse(A.head(R.values(opsTsconfigText)), () => ""))
);

// Registered `opsScripts` TypeScript entries, as goals-relative paths.
const registeredOpsScripts = Effect.forEach(
  A.sort(
    R.toEntries(opsManifestTexts),
    Order.mapInput(Order.String, ([key]: readonly [string, string]) => key)
  ),
  ([key, text]) =>
    Effect.map(decodeOpsManifest(text), (manifest) => {
      const slug = O.getOrElse(A.head(Str.split(goalsRelative(key), "/")), () => "");
      return A.map(manifest.opsScripts ?? A.empty(), (script) => `${slug}/${script.path}`);
    })
).pipe(Effect.map((perGoal) => A.filter(A.flatten(perGoal), Str.endsWith(".ts"))));

// Every TypeScript file under a goals/*/ops directory. Dot-leading segments are scratch space
// (beep goals doctor skips them) and node_modules is never source.
const opsTypeScriptFiles = A.filter(
  A.map(R.keys(opsTypeScriptModules), goalsRelative),
  (file) => !A.some(Str.split(file, "/"), (segment) => Str.startsWith(".")(segment) || segment === "node_modules")
);

describe("goals ops typecheck project", () => {
  it.effect(
    "includes every registered opsScripts TypeScript entry",
    Effect.fnUntraced(function* () {
      const config = yield* loadOpsTsconfig;
      const scripts = yield* registeredOpsScripts;

      assertTrue(A.isReadonlyArrayNonEmpty(scripts));
      deepStrictEqual(
        A.filter(scripts, (script) => !isCheckedBy(config)(script)),
        []
      );
    })
  );

  it.effect(
    "includes every TypeScript file under a goals ops directory",
    Effect.fnUntraced(function* () {
      const config = yield* loadOpsTsconfig;

      assertTrue(A.isReadonlyArrayNonEmpty(opsTypeScriptFiles));
      deepStrictEqual(
        A.filter(opsTypeScriptFiles, (file) => !isCheckedBy(config)(file)),
        []
      );
    })
  );

  it.effect(
    "reports a script outside the include globs as unchecked",
    Effect.fnUntraced(function* () {
      const checked = isCheckedBy(yield* loadOpsTsconfig);

      deepStrictEqual(
        A.map(
          [
            "effected-promotion/ops/lockfiles-oracle.ts",
            "lexical-playground-capability-atlas/ops/exercise/scenarios/dsl.ts",
            "effected-promotion/research/probe.ts",
            "effected-promotion/ops/node_modules/vendored.ts",
            "effected-promotion/ops/run.sh",
          ],
          checked
        ),
        [true, true, false, false, false]
      );
    })
  );

  it.effect(
    "runs the project on the repo-sanity lane",
    Effect.fnUntraced(function* () {
      const lane = A.findFirst(
        githubCheckRepoSanityLanesForTesting("/repo"),
        (candidate) => candidate.id === "repo-sanity:goals-ops-typecheck"
      );

      deepStrictEqual(
        O.map(lane, (spec) => [spec.step.command, ...spec.step.args]),
        O.some(["bunx", "tsrs", "-p", OPS_TSCONFIG, "--noEmit", "--pretty", "false"])
      );
    })
  );
});
