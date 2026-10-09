import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubAnnotation } from "../../effected/cli/GithubAnnotation.ts";
import { AnnotationOptions } from "../../effected/cli/Doc.ts";

const runs = { arbitrary: fcRuns(100) };
const unescape = (text: string) => text.replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%0D/g, "\r").replace(/%0A/g, "\n").replace(/%25/g, "%");
const unescapeMessage = (text: string) => text.replace(/%0D/g, "\r").replace(/%0A/g, "\n").replace(/%25/g, "%");

it.effect.prop("annotation formatting preserves message and metadata through the workflow grammar", [Arbitrary.schema(AnnotationOptions), Arbitrary.schema(S.String)], ([annotation, message]) => Effect.sync(() => {
  const formatted = GithubAnnotation.format(annotation, message);
  const end = formatted.indexOf("::", 2);
  assert.isAtLeast(end, 2);
  const header = formatted.slice(2, end);
  const firstSpace = header.indexOf(" ");
  const level = firstSpace < 0 ? header : header.slice(0, firstSpace);
  assert.strictEqual(level, annotation.level);
  const pairs = firstSpace < 0 ? [] : header.slice(firstSpace + 1).split(",");
  const fields: Record<string, string> = {};
  for (const pair of pairs) {
    const equals = pair.indexOf("=");
    fields[pair.slice(0, equals)] = unescape(pair.slice(equals + 1));
  }
  const decodedMessage = unescapeMessage(formatted.slice(end + 2));
  assert.strictEqual(decodedMessage, message);
  const reconstructed = {
    level: annotation.level,
    ...(annotation.title === undefined ? {} : { title: fields["title"] }),
    ...(annotation.file === undefined ? {} : { file: fields["file"] }),
    ...(annotation.line === undefined ? {} : { line: Number(fields["line"]) }),
    ...(annotation.endLine === undefined ? {} : { endLine: Number(fields["endLine"]) }),
    ...(annotation.col === undefined ? {} : { col: Number(fields["col"]) }),
    ...(annotation.endColumn === undefined ? {} : { endColumn: Number(fields["endColumn"]) }),
  };
  assertTrue(AnnotationOptions.pipe(S.toEquivalence)(reconstructed, annotation));
  assert.strictEqual(GithubAnnotation.format(reconstructed, decodedMessage), formatted);
  assert.strictEqual(A.join(Str.split(formatted, "\n"), ""), formatted);
}), runs);
