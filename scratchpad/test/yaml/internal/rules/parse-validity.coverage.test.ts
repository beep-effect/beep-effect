import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as A from "effect/Array";
import { YamlDiagnostic } from "../../../../effected/yaml/YamlDiagnostic.ts";
import { YamlDocument } from "../../../../effected/yaml/YamlDocument.ts";
import { parseValidity } from "../../../../effected/yaml/internal/rules/parse-validity.ts";

it.effect("recovered warnings preserve their severity and source span", () => Effect.sync(() => {
  const diagnostic = YamlDiagnostic.make({ code: "UnexpectedToken", message: "recovered warning", offset: 4, length: 2, line: 1, character: 2 });
  const document = YamlDocument.make({ contents: null, errors: [diagnostic], warnings: [diagnostic], directives: [] });
  const findings = parseValidity.check({ text: "a\n  xx", lines: [], tokens: [], document }, {});
  assert.deepStrictEqual(A.map(A.fromIterable(findings), (finding) => ({ rule: finding.rule, severity: finding.severity, message: finding.message, offset: finding.offset, length: finding.length, line: finding.line, character: finding.character })), [
    { rule: "parse-validity", severity: "error", message: "recovered warning", offset: 4, length: 2, line: 1, character: 2 },
    { rule: "parse-validity", severity: "warning", message: "recovered warning", offset: 4, length: 2, line: 1, character: 2 },
  ]);
}));
