import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { isFatalCode, YAML_COMPOSE_ERROR_CODES, YAML_LEX_ERROR_CODES, YAML_MODIFY_ERROR_CODES, YAML_PARSE_ERROR_CODES, YAML_STRINGIFY_ERROR_CODES } from "../../../effected/yaml/internal/diagnostics.ts";

it.effect("fatal classification matches the pipeline abort contract for every exported code", () => Effect.sync(() => {
  const fatal = ["UndefinedAlias", "DuplicateAnchor", "AliasCountExceeded", "UnexpectedToken", "InvalidDirective", "MalformedFlowCollection", "InvalidIndentation", "TabIndentation", "UnresolvedTag", "UnexpectedCharacter", "NestingDepthExceeded"];
  for (const code of [...YAML_COMPOSE_ERROR_CODES, ...YAML_LEX_ERROR_CODES, ...YAML_MODIFY_ERROR_CODES, ...YAML_PARSE_ERROR_CODES, ...YAML_STRINGIFY_ERROR_CODES]) {
    assert.strictEqual(isFatalCode(code), fatal.includes(code));
  }
}));
