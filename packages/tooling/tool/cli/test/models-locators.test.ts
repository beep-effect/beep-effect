import {
  expectedLocatorValue,
  extractGeneratedBlock,
  generatedBlockBegin,
  ModelBinding,
  ModelsLocatorReader,
  ModelsLocatorReaderLive,
  renderGeneratedBlockBody,
} from "@beep/repo-cli/commands/Models";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertNone, assertSome, strictEqual } from "@effect/vitest/utils";
import { Effect, Layer, Option as O } from "effect";
import { readFixtureText } from "./helpers/models-fixtures.ts";
import type { Locator, ModelId, ModelsTargetFile } from "@beep/repo-cli/commands/Models";

const modelId = (value: string): ModelId => value as ModelId;

const codexHeavy = ModelBinding.make({
  role: "codex.heavy",
  surface: "codex-cli",
  modelId: modelId("gpt-6-astra"),
  effort: O.some("medium"),
  supersedes: [],
  note: O.none(),
});

const seat = ModelBinding.make({
  role: "cursor.volume",
  surface: "cursor-seat",
  modelId: modelId("composer-2.5"),
  effort: O.none(),
  supersedes: [],
  note: O.none(),
});

const verbatim = { _tag: "verbatim" } as const;
const labels = {
  _tag: "effort-display-label",
  labels: [{ effort: "medium", label: "Medium" } as const],
} as const;

const binding = (field: "model" | "effort" | "model-effort-suffix") =>
  ({ role: "codex.heavy", surface: "codex-cli", field }) as const;

const file = (content: string): ModelsTargetFile => ({
  root: "home",
  absolutePath: "/home/op/fixture",
  content,
});

const readFixture = Effect.fnUntraced(function* (name: string, locator: Locator) {
  const reader = yield* ModelsLocatorReader;
  return yield* reader.read(file(yield* readFixtureText(name)), locator);
});

layer(Layer.mergeAll(NodeServices.layer, ModelsLocatorReaderLive))((it) => {
  it("renders each locator field", () => {
    assertSome(expectedLocatorValue(codexHeavy, "model", verbatim), "gpt-6-astra");
    assertSome(expectedLocatorValue(codexHeavy, "effort", verbatim), "medium");
    assertSome(expectedLocatorValue(codexHeavy, "model-effort-suffix", verbatim), "gpt-6-astra(medium)");
    assertSome(expectedLocatorValue(codexHeavy, "effort", labels), "Medium");
    // A seat carries no separate effort, so an effort-bearing field is
    // unrenderable rather than silently empty.
    assertNone(expectedLocatorValue(seat, "effort", verbatim));
    assertNone(expectedLocatorValue(seat, "model-effort-suffix", verbatim));
  });

  it.effect("reads a markdown generated block and misses an absent one", () =>
    Effect.gen(function* () {
      const found = yield* readFixture("locators.md", {
        _tag: "md-generated-block",
        blockId: "routing-doctrine",
        filter: { roles: [], surfaces: [] },
        includeSuperseded: false,
      } as Locator);
      assertSome(
        O.map(found, (body) => body.split("\n").length),
        3
      );

      assertNone(
        yield* readFixture("locators.md", {
          _tag: "md-generated-block",
          blockId: "absent",
          filter: { roles: [], surfaces: [] },
          includeSuperseded: false,
        } as Locator)
      );
    })
  );

  it.effect("reads TOML top-level keys without reaching into a table", () =>
    Effect.gen(function* () {
      assertSome(
        yield* readFixture("locators.toml", {
          _tag: "toml-top-level-key",
          binding: binding("model"),
          render: verbatim,
          key: "model",
        } as Locator),
        "gpt-6-astra"
      );
      assertSome(
        yield* readFixture("locators.toml", {
          _tag: "toml-top-level-key",
          binding: binding("effort"),
          render: verbatim,
          key: "plan_mode_reasoning_effort",
        } as Locator),
        "xhigh"
      );
    })
  );

  it.effect("strips a TOML inline comment but keeps a hash inside quotes", () =>
    Effect.gen(function* () {
      // `model = "gpt-6-astra" # ratified …` — the comment is not part of the
      // value, so a reader that kept it would report permanent drift.
      assertSome(
        yield* readFixture("locators.toml", {
          _tag: "toml-top-level-key",
          binding: binding("model"),
          render: verbatim,
          key: "model",
        } as Locator),
        "gpt-6-astra"
      );
      assertSome(
        yield* readFixture("locators.toml", {
          _tag: "toml-top-level-key",
          binding: binding("model"),
          render: verbatim,
          key: "hashed_model",
        } as Locator),
        "gpt-6-astra#pinned"
      );
      assertSome(
        yield* readFixture("locators.toml", {
          _tag: "toml-table-key",
          binding: binding("effort"),
          render: verbatim,
          table: "models",
          key: "default_reasoning_effort",
        } as Locator),
        "xhigh"
      );
    })
  );

  it.effect("reads a TOML table key inside its own table", () =>
    Effect.gen(function* () {
      assertSome(
        yield* readFixture("locators.toml", {
          _tag: "toml-table-key",
          binding: binding("model"),
          render: verbatim,
          table: "models",
          key: "default",
        } as Locator),
        "grok-4.6"
      );
      // `[tui] model` must stay invisible to a top-level read.
      assertSome(
        yield* readFixture("locators.toml", {
          _tag: "toml-table-key",
          binding: binding("model"),
          render: verbatim,
          table: "tui",
          key: "model",
        } as Locator),
        "never-read-me"
      );
    })
  );

  it.effect("reads yaml, json, and env locators", () =>
    Effect.gen(function* () {
      assertSome(
        yield* readFixture("locators.yaml", {
          _tag: "yaml-path",
          binding: binding("model"),
          render: verbatim,
          path: ["routing", "default"],
        } as Locator),
        "grok-4.6"
      );
      assertSome(
        yield* readFixture("locators.json", {
          _tag: "json-key",
          binding: binding("model"),
          render: verbatim,
          pointer: ["nested", "model"],
        } as Locator),
        "gpt-5.6-luna"
      );
      assertSome(
        yield* readFixture("locators.env", {
          _tag: "env-key",
          binding: binding("model"),
          render: verbatim,
          key: "GRAFT_MODEL",
        } as Locator),
        "claude-opus-5"
      );
    })
  );

  it.effect("scopes a shell assignment to its own function", () =>
    Effect.gen(function* () {
      assertSome(
        yield* readFixture("locators.sh", {
          _tag: "shell-assign",
          binding: binding("model-effort-suffix"),
          render: verbatim,
          variable: "--model",
          within: O.some("claudex"),
        } as Locator),
        "gpt-6-astra(xhigh)"
      );
      assertSome(
        yield* readFixture("locators.sh", {
          _tag: "shell-assign",
          binding: binding("model"),
          render: verbatim,
          variable: "--model",
          within: O.some("claudeg"),
        } as Locator),
        "grok-4.6"
      );
      assertSome(
        yield* readFixture("locators.sh", {
          _tag: "shell-assign",
          binding: binding("model"),
          render: verbatim,
          variable: "ANTHROPIC_DEFAULT_HAIKU_MODEL",
          within: O.none(),
        } as Locator),
        "gpt-5.6-luna"
      );
    })
  );

  it.effect("reads xml attributes and an escaped-json attribute", () =>
    Effect.gen(function* () {
      assertSome(
        yield* readFixture("locators.xml", {
          _tag: "xml-attribute",
          binding: binding("model"),
          render: verbatim,
          elementSelector: 'option[name="model"]',
          attribute: "value",
        } as Locator),
        "gpt-5.6-sol"
      );
      assertSome(
        yield* readFixture("locators.xml", {
          _tag: "xml-attribute",
          binding: binding("effort"),
          render: labels,
          elementSelector: 'option[name="modelReasoningEffort"]',
          attribute: "value",
        } as Locator),
        "Extra High"
      );
      assertSome(
        yield* readFixture("locators-rollout.xml", {
          _tag: "xml-escaped-json-attribute",
          binding: binding("model"),
          render: verbatim,
          elementSelector: 'option[name="options"]',
          attribute: "value",
          jsonPointer: ["0", "model"],
        } as Locator),
        "gpt-5.6-luna"
      );
    })
  );

  it.effect("reads an exported TypeScript literal", () =>
    Effect.gen(function* () {
      assertSome(
        yield* readFixture("locators-literal.ts.txt", {
          _tag: "ts-literal",
          binding: binding("model"),
          render: verbatim,
          symbol: "defaultJSDocMigrateTitlesModel",
        } as Locator),
        "grok-4.5"
      );
      assertNone(
        yield* readFixture("locators-literal.ts.txt", {
          _tag: "ts-literal",
          binding: binding("model"),
          render: verbatim,
          symbol: "noSuchSymbol",
        } as Locator)
      );
    })
  );

  it("renders and re-extracts a generated block body", () => {
    const body = renderGeneratedBlockBody([codexHeavy, seat], [], false);
    const content = `${generatedBlockBegin("x")}\n${body}\n<!-- beep-models:end x -->\n`;
    assertSome(extractGeneratedBlock(content, "x"), body);
    expect(body).toContain("| codex.heavy | codex-cli | `gpt-6-astra` | `medium` |");
    strictEqual(body.includes("superseded:"), false);
  });
});
