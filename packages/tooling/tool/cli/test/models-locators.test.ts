import {
  BindingFilter,
  BOUND_MODEL_SEGMENT,
  bindLocatorModel,
  EffortDisplayLabel,
  expectedLocatorValue,
  extractGeneratedBlock,
  generatedBlockBegin,
  LocatorBinding,
  ModelBinding,
  ModelsLocatorReader,
  ModelsLocatorReaderLive,
  ModelsTargetFile,
  renderGeneratedBlockBody,
} from "@beep/repo-cli/commands/Models";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertNone, assertSome, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readFixtureText } from "./helpers/models-fixtures.ts";
import type { Locator, ModelId } from "@beep/repo-cli/commands/Models";

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

const encodeJsonText = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const verbatim = { _tag: "verbatim" } as const;
const labels = {
  _tag: "effort-display-label",
  labels: [EffortDisplayLabel.make({ effort: "medium", label: "Medium" })],
} as const;

const binding = (field: "model" | "effort" | "model-effort-suffix") =>
  ({ role: "codex.heavy", surface: "codex-cli", field }) as const;

const assertRead = (actual: O.Option<string>, expected: string) => {
  if (expected === "Unsupported shell form") {
    expect(O.getOrThrow(actual)).toMatch(/^Unsupported shell form(?:: line [0-9]+)?/);
  } else if (expected === "Unsupported shell form: ambiguous function scope") {
    expect(O.getOrThrow(actual)).toMatch(/^Unsupported shell form: line [0-9]+; ambiguous function scope/);
  } else assertSome(actual, expected);
};

const file = (content: string): ModelsTargetFile =>
  ModelsTargetFile.make({
    root: "home",
    absolutePath: "/home/op/fixture",
    content,
  });

const readFixture = Effect.fnUntraced(function* (name: string, locator: Locator) {
  const reader = yield* ModelsLocatorReader;
  const readFixtureText1 = yield* readFixtureText(name);
  return yield* reader.read(file(readFixtureText1), locator);
});

layer(Layer.mergeAll(NodeServices.layer, ModelsLocatorReaderLive), { timeout: "30 seconds" })((it) => {
  it.effect("reads every distinct anchored example value without treating delimiters as regex", () =>
    Effect.gen(function* () {
      const reader = yield* ModelsLocatorReader;
      const locator: Locator = {
        _tag: "line-value",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        linePrefix: " *",
        before: 'model: "',
        after: '"',
      };
      const read2 = yield* reader.read(
        file(
          A.join(
            [
              ' * model: "gpt-6-astra", model: "gpt-daybreak-blue-latest"',
              ' * model: "gpt-6-astra"',
              'const model: "not-an-example" = value',
            ],
            "\n"
          )
        ),
        locator
      );
      assertRead(read2, "gpt-6-astra, gpt-daybreak-blue-latest");
      const read3 = yield* reader.read(file('const model: "not-an-example" = value'), locator);
      assertNone(read3);
      const read4 = yield* reader.read(file(' * model[0]="gpt-6-astra"'), {
        ...locator,
        before: 'model[0]="',
      });
      assertRead(read4, "gpt-6-astra");
    })
  );
  it.effect("scans repeated opening delimiters with no closer without backtracking", () =>
    Effect.gen(function* () {
      const reader = yield* ModelsLocatorReader;
      const read5 = yield* reader.read(file(Str.repeat(20_000)("task --model ")), {
        _tag: "line-value",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        linePrefix: "",
        before: "task --model ",
        after: " --effort ",
      });
      assertNone(read5);
    })
  );

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
        filter: BindingFilter.make({ roles: [], surfaces: [] }),
        includeSuperseded: false,
      } as Locator);
      assertSome(
        O.map(found, (body) => Str.split("\n")(body).length),
        3
      );

      const readFixture6 = yield* readFixture("locators.md", {
        _tag: "md-generated-block",
        blockId: "absent",
        filter: BindingFilter.make({ roles: [], surfaces: [] }),
        includeSuperseded: false,
      } as Locator);
      assertNone(readFixture6);
    })
  );

  it.effect("reads TOML top-level keys without reaching into a table", () =>
    Effect.gen(function* () {
      const readFixture7 = yield* readFixture("locators.toml", {
        _tag: "toml-top-level-key",
        binding: binding("model"),
        render: verbatim,
        key: "model",
      } as Locator);
      assertSome(readFixture7, "gpt-6-astra");
      const readFixture8 = yield* readFixture("locators.toml", {
        _tag: "toml-top-level-key",
        binding: binding("effort"),
        render: verbatim,
        key: "plan_mode_reasoning_effort",
      } as Locator);
      assertSome(readFixture8, "xhigh");
    })
  );

  it.effect("strips a TOML inline comment but keeps a hash inside quotes", () =>
    Effect.gen(function* () {
      // `model = "gpt-6-astra" # ratified …` — the comment is not part of the
      // value, so a reader that kept it would report permanent drift.
      const readFixture9 = yield* readFixture("locators.toml", {
        _tag: "toml-top-level-key",
        binding: binding("model"),
        render: verbatim,
        key: "model",
      } as Locator);
      assertSome(readFixture9, "gpt-6-astra");
      const readFixture10 = yield* readFixture("locators.toml", {
        _tag: "toml-top-level-key",
        binding: binding("model"),
        render: verbatim,
        key: "hashed_model",
      } as Locator);
      assertSome(readFixture10, "gpt-6-astra#pinned");
      const readFixture11 = yield* readFixture("locators.toml", {
        _tag: "toml-table-key",
        binding: binding("effort"),
        render: verbatim,
        table: "models",
        key: "default_reasoning_effort",
      } as Locator);
      assertSome(readFixture11, "xhigh");
    })
  );

  it.effect("reads a TOML table key inside its own table", () =>
    Effect.gen(function* () {
      const readFixture12 = yield* readFixture("locators.toml", {
        _tag: "toml-table-key",
        binding: binding("model"),
        render: verbatim,
        table: "models",
        key: "default",
      } as Locator);
      assertSome(readFixture12, "grok-4.6");
      // `[tui] model` must stay invisible to a top-level read.
      const readFixture13 = yield* readFixture("locators.toml", {
        _tag: "toml-table-key",
        binding: binding("model"),
        render: verbatim,
        table: "tui",
        key: "model",
      } as Locator);
      assertSome(readFixture13, "never-read-me");
    })
  );

  it.effect("reads yaml, json, and env locators", () =>
    Effect.gen(function* () {
      const readFixture14 = yield* readFixture("locators.yaml", {
        _tag: "yaml-path",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        path: ["routing", "default"],
      } as Locator);
      assertSome(readFixture14, "grok-4.6");
      const readFixture15 = yield* readFixture("locators.json", {
        _tag: "json-key",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        pointer: ["nested", "model"],
        fallbacks: [],
      } as Locator);
      assertSome(readFixture15, "gpt-5.6-luna");
      // An absent primary pointer falls through to the first fallback that
      // resolves; a present primary pointer wins over every fallback.
      const readFixture16 = yield* readFixture("locators.json", {
        _tag: "json-key",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        pointer: ["absent", "model"],
        fallbacks: [
          ["also", "absent"],
          ["nested", "model"],
        ],
      } as Locator);
      assertSome(readFixture16, "gpt-5.6-luna");
      const readFixture17 = yield* readFixture("locators.json", {
        _tag: "json-key",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        pointer: ["nested", "model"],
        fallbacks: [["absent", "model"]],
      } as Locator);
      assertSome(readFixture17, "gpt-5.6-luna");
      const readFixture18 = yield* readFixture("locators.env", {
        _tag: "env-key",
        binding: binding("model"),
        render: verbatim,
        key: "PROXY_MODEL",
      } as Locator);
      assertRead(readFixture18, "Unsupported shell form");
    })
  );

  it.effect("reads shell drift including expansions without failing the whole checker", () =>
    Effect.gen(function* () {
      const reader = yield* ModelsLocatorReader;
      const locator: Locator = {
        _tag: "shell-assign",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        variable: "MODEL",
        within: O.none(),
      };
      const read19 = yield* reader.read(file("MODEL=o\\ld\nMODEL=old\n"), locator);
      assertRead(read19, "old");
      const read20 = yield* reader.read(file('MODEL="gpt-6.1-sol(medium)";\n'), locator);
      assertRead(read20, "gpt-6.1-sol(medium)");
      const read21 = yield* reader.read(file('MODEL="$X"\n'), locator);
      assertRead(read21, "Unsupported shell form");
      const read22 = yield* reader.read(file("MODEL=old\nfoo \\\n  bar\nMODEL=other\n"), locator);
      assertRead(read22, "Unsupported shell form");
    })
  );

  it.effect("detects every operator-adjacent assignment and fails closed on unsupported shell words", () =>
    Effect.gen(function* () {
      const reader = yield* ModelsLocatorReader;
      const locator: Locator = {
        _tag: "shell-assign",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        variable: "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        within: O.none(),
      };
      for (const operator of [";", "&&", "||", "|", "&", "(", "\n"]) {
        const read23 = yield* reader.read(
          file(
            `:${operator}ANTHROPIC_DEFAULT_HAIKU_MODEL=wrong claude\nANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna claude\n`
          ),
          locator
        );
        assertRead(read23, "Unsupported shell form: conflicting values wrong, gpt-6-luna");
      }
      const model: Locator = { ...locator, variable: "MODEL" };
      const flag: Locator = { ...model, variable: "--model" };
      for (const text of [
        "claude '--model' wrong\nclaude --model old\n",
        "claude --mo\\del wrong\nclaude --model old\n",
        'claude "--model=wrong"\nclaude --model old\n',
        'claude --mo\\del="$X"\nclaude --model old\n',
      ]) {
        const read1 = yield* reader.read(file(text), flag);
        assertRead(read1, "Unsupported shell form");
      }
      const read24 = yield* reader.read(file("claude --model MODEL=old\n"), flag);
      assertRead(read24, "MODEL=old");

      for (const text of [
        "route() { MODEL=old; }\n",
        "route() {\nMODEL=old\n}\nro\\ute() {\nMODEL=wrong\n}\n",
        "route() { MODEL=wrong; }\nroute() {\nMODEL=old\n}\n",
        "route() {\nMODEL=old\n}\nroute() {\nMODEL=old\n}\n",
        "route() {\nchild() {\nMODEL=old\n}\nMODEL=wrong\n}\n",
        "route() {\nMODEL=old\n",
      ]) {
        const read6 = yield* reader.read(file(text), { ...model, within: O.some("route") });
        assertRead(read6, "Unsupported shell form: ambiguous function scope");
      }
      const read25 = yield* reader.read(file("route() {\nMODEL=old printf '{quoted}'\n}\n"), {
        ...model,
        within: O.some("route"),
      });
      assertRead(read25, "old");

      const read26 = yield* reader.read(file("cat <<'EOF'\nroute() {\nMODEL=old\n}\nEOF\n"), {
        ...model,
        within: O.some("route"),
      });
      assertRead(read26, "Unsupported shell form");
      for (const text of [
        "MODEL=old\r\n",
        "MODEL=old [xy]\n",
        "MODEL=old \u0000\n",
        "x\\ MODEL=old\n",
        'MODEL="$X"\n',
        "MODEL='old\n",
        "MODEL='old'-suffix\n",
        "MODEL=old\\\n-suffix\n",
        "cat <<'EOF'\nMODEL=old\nEOF\n",
        'MODEL=old "$@"\n',
        "MODEL=old $(echo old)\n",
        "MODEL=old{,suffix}\n",
      ]) {
        const read7 = yield* reader.read(file(text), model);
        assertRead(read7, "Unsupported shell form");
      }
      const read27 = yield* reader.read(file("echo 'MODEL=wrong';MODEL='old' # MODEL=wrong\n"), model);
      assertRead(read27, "Unsupported shell form");
    })
  );

  it.effect("accounts for every textual shell name occurrence, including comments and declarations", () =>
    Effect.gen(function* () {
      const reader = yield* ModelsLocatorReader;
      const locator: Locator = {
        _tag: "shell-assign",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        variable: "MODEL",
        within: O.none(),
      };
      for (const text of [
        "export 'MODEL=wrong'; claude\nMODEL=old claude\n",
        'export "MODEL=wrong"; claude\nMODEL=old claude\n',
        "MODEL=old\nMODEL+=wrong\n",
        ":;MODEL+=wrong\nMODEL=old\n",
        "MODEL=old\nunset MODEL\n",
        "MODEL=old\nlocal MODEL=wrong\n",
        "MODEL=old\ndeclare MODEL=wrong\n",
        "MODEL=old\ntypeset MODEL=wrong\n",
        "# MODEL=old\n",
        "echo MODEL\nMODEL=old\n",
        "OTHER_MODEL=old\nMODEL=old\n",
        "echo 'MODEL=wrong'\nMODEL=old\n",
      ]) {
        const read8 = yield* reader.read(file(text), locator);
        expect(O.getOrThrow(read8)).toMatch(/^Unsupported shell form: line [0-9]+/);
      }
      const read28 = yield* reader.read(file('export PATH="$HOME/bin"\nMODEL=old\n'), locator);
      assertSome(read28, "old");
      const read29 = yield* reader.read(file("MODEL=old\n"), locator);
      assertSome(read29, "old");
      const read30 = yield* reader.read(
        file('export PATH="$HOME/bin:$PATH"\nother() { echo native; }\nroute() {\nMODEL=old\n}\n'),
        {
          ...locator,
          within: O.some("route"),
        }
      );
      assertSome(read30, "old");
    })
  );

  it.effect("fails closed on unmatched YAML and XML name occurrences", () =>
    Effect.gen(function* () {
      const reader = yield* ModelsLocatorReader;
      const yaml: Locator = {
        _tag: "yaml-path",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        path: ["model"],
      };
      for (const text of [
        "# model: old\n",
        "model: old # model\n",
        "model: &shared old\nnative: *shared\n",
        "model: *shared\n",
        "'model': old\n",
        "{model: old}\n",
        "model: old\n---\nmodel: old\n",
        "model: !tag old\n",
        "model: |\n  old\n",
        "model: old\nlist:\n  - x\n",
      ]) {
        const read9 = yield* reader.read(file(text), yaml);
        expect(O.getOrThrow(read9)).toMatch(/^Unsupported YAML form: line [0-9]+/);
      }
      const read31 = yield* reader.read(file("model: old\nnative: keep\n"), yaml);
      assertSome(read31, "old");
      const xml: Locator = {
        _tag: "xml-attribute",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        elementSelector: 'option[name="model"]',
        attribute: "value",
      };
      for (const text of [
        '<root><!-- <option name="model" value="old"/> --></root>',
        '<root><option-extra name="model" value="old"/></root>',
        '<root><q:option name="model" value="old"/></root>',
        '<root><![CDATA[<option name="model" value="old"/>]]></root>',
        '<root note="model"><option name="model" value="old"/></root>',
        '<root><option name="model" value="old"/><option name="model" value="wrong"/></root>',
        '<root><option name="model" value="old" keep="model"/></root>',
      ]) {
        const read10 = yield* reader.read(file(text), xml);
        expect(O.getOrThrow(read10)).toMatch(/^Unsupported XML form: line [0-9]+/);
      }
      const read32 = yield* reader.read(file("<root><option name='model' value='old'/></root>"), xml);
      assertSome(read32, "old");
    })
  );

  it.effect("scopes a shell assignment to its own function", () =>
    Effect.gen(function* () {
      const readFixture33 = yield* readFixture("locators.sh", {
        _tag: "shell-assign",
        binding: binding("model-effort-suffix"),
        render: verbatim,
        variable: "--model",
        within: O.some("claudex"),
      } as Locator);
      assertSome(readFixture33, "gpt-6-astra(xhigh)");
      const readFixture34 = yield* readFixture("locators.sh", {
        _tag: "shell-assign",
        binding: binding("model"),
        render: verbatim,
        variable: "--model",
        within: O.some("claudeg"),
      } as Locator);
      assertSome(readFixture34, "grok-4.6");
      const readFixture35 = yield* readFixture("locators.sh", {
        _tag: "shell-assign",
        binding: binding("model"),
        render: verbatim,
        variable: "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        within: O.none(),
      } as Locator);
      assertSome(readFixture35, "gpt-5.6-luna");
    })
  );

  it.effect("reads xml attributes and an escaped-json attribute", () =>
    Effect.gen(function* () {
      const readFixture36 = yield* readFixture("locators.xml", {
        _tag: "xml-attribute",
        binding: binding("model"),
        render: verbatim,
        elementSelector: 'option[name="model"]',
        attribute: "value",
      } as Locator);
      assertSome(readFixture36, "gpt-5.6-sol");
      const readFixture37 = yield* readFixture("locators.xml", {
        _tag: "xml-attribute",
        binding: LocatorBinding.make(binding("effort")),
        render: labels,
        elementSelector: 'option[name="modelReasoningEffort"]',
        attribute: "value",
      } as Locator);
      assertSome(readFixture37, "Extra High");
      const readFixture38 = yield* readFixture("locators-rollout.xml", {
        _tag: "xml-escaped-json-attribute",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        elementSelector: 'option[name="options"]',
        attribute: "value",
        jsonPointer: ["0", "model"],
      } as Locator);
      assertSome(readFixture38, "gpt-5.6-luna");
    })
  );

  it.effect("reads an exported TypeScript literal", () =>
    Effect.gen(function* () {
      const readFixture39 = yield* readFixture("locators-literal.ts.txt", {
        _tag: "ts-literal",
        binding: binding("model"),
        render: verbatim,
        symbol: "defaultJSDocMigrateTitlesModel",
      } as Locator);
      assertSome(readFixture39, "grok-4.5");
      const readFixture40 = yield* readFixture("locators-literal.ts.txt", {
        _tag: "ts-literal",
        binding: binding("model"),
        render: verbatim,
        symbol: "noSuchSymbol",
      } as Locator);
      assertNone(readFixture40);
    })
  );

  it("renders and re-extracts a generated block body", () => {
    const body = renderGeneratedBlockBody([codexHeavy, seat], [], false);
    const content = `${generatedBlockBegin("x")}\n${body}\n<!-- beep-models:end x -->\n`;
    assertSome(extractGeneratedBlock(content, "x"), body);
    expect(body).toContain("| codex.heavy | codex-cli | `gpt-6-astra` | `medium` |");
    strictEqual(Str.includes("superseded:")(body), false);
  });

  it.effect("duplicate JSON diagnostics carry one format prefix", () =>
    Effect.gen(function* () {
      const reader = yield* ModelsLocatorReader;
      const read41 = yield* reader.read(file('{"model":"one","model":"two"}'), {
        _tag: "json-key",
        binding: LocatorBinding.make(binding("model")),
        render: verbatim,
        pointer: ["model"],
        fallbacks: [],
      });
      assertRead(read41, "Unsupported JSON form: duplicate keys.");
    })
  );

  it.effect("a bound-model pointer follows the binding, not a stale literal entry", () =>
    Effect.gen(function* () {
      const reader = yield* ModelsLocatorReader;
      // The reviewer's probe: the binding moved to claude-opus-5-6 while a
      // stale claude-opus-5-5 entry still says medium.
      const encodedJsonText = yield* encodeJsonText({
        model: "claude-opus-5-6",
        effortLevel: "low",
        modelSettings: { "claude-opus-5-5": { effortLevel: "medium" }, "claude-opus-5-6": { effortLevel: "high" } },
      });
      const settings = file(encodedJsonText);
      const locator = {
        _tag: "json-key",
        binding: LocatorBinding.make(binding("effort")),
        render: verbatim,
        pointer: ["modelSettings", BOUND_MODEL_SEGMENT, "effortLevel"],
        fallbacks: [["effortLevel"]],
      } as Locator;

      const read42 = yield* reader.read(settings, bindLocatorModel(locator, "claude-opus-5-6"));
      assertRead(read42, "high");
      // No per-model entry for the bound id: the top-level effort applies.
      const read43 = yield* reader.read(settings, bindLocatorModel(locator, "claude-opus-5-7"));
      assertRead(read43, "low");
    })
  );
});
