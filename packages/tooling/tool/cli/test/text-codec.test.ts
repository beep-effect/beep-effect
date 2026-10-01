import { decodeTomlTextWith, decodeYamlTextWith } from "@beep/repo-cli/test/SharedInternals";
import { describe, it } from "@effect/vitest";
import { assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Workflow = S.Struct({ name: S.String, on: S.Array(S.String) });
const CodexConfig = S.Struct({ model: S.String, features: S.Struct({ web_search: S.Boolean }) });
const decodeWorkflow = decodeYamlTextWith(S.decodeUnknownEffect(Workflow));
const decodeCodexConfig = decodeTomlTextWith(S.decodeUnknownEffect(CodexConfig));

describe("TextCodec", () => {
  it.effect("decodes YAML text into the target schema", () =>
    Effect.gen(function* () {
      deepStrictEqual(yield* decodeWorkflow("name: ci\non:\n  - push\n  - pull_request\n"), {
        name: "ci",
        on: ["push", "pull_request"],
      });
    })
  );

  it.effect("decodes TOML text into the target schema", () =>
    Effect.gen(function* () {
      deepStrictEqual(yield* decodeCodexConfig('model = "o3"\n\n[features]\nweb_search = true\n'), {
        model: "o3",
        features: { web_search: true },
      });
    })
  );

  it.effect("reports malformed YAML as a schema error", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeWorkflow("name: [ci"));
      error.pipe(S.isSchemaError, assertTrue);
      assertTrue(Str.includes("Invalid YAML input")(error.message));
    })
  );

  it.effect("reports malformed TOML as a schema error", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeCodexConfig('model = "o3'));
      error.pipe(S.isSchemaError, assertTrue);
      assertTrue(Str.includes("Invalid TOML input")(error.message));
    })
  );

  it.effect("reports a parsed value that misses the target schema", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeWorkflow("name: ci\n"));
      error.pipe(S.isSchemaError, assertTrue);
    })
  );
});
