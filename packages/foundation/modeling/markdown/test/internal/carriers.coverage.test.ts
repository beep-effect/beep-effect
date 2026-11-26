import {
  GuardExceeded,
  isGuardExceeded,
  isRawMarkdownError,
  MARKDOWN_PARSE_ERROR_CODES,
  RawDiagnostic,
  RawMarkdownError,
} from "@beep/markdown/internal/carriers";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

it.effect("preserves diagnostic fields and guard details across raw error carriers", () =>
  Effect.sync(() => {
    const diagnostic = RawDiagnostic.make({ code: "NestingDepthExceeded", message: "too deep", offset: 7, length: 2 });
    const raw = RawMarkdownError.make(diagnostic);
    assert.notStrictEqual(
      raw.diagnostic,
      diagnostic,
      "the schema carrier rebuilds its diagnostic from its own fields: equal to its source record, not identical"
    );
    assert.deepStrictEqual(raw.diagnostic, diagnostic);
    assert.strictEqual(raw.message, diagnostic.message);
    assert.strictEqual(raw.name, "Error");
    assert.strictEqual(raw._tag, "RawMarkdownError");
    const guard = GuardExceeded.new("NestingDepthExceeded", 128, 129, 7);
    assert.deepStrictEqual(MARKDOWN_PARSE_ERROR_CODES, [diagnostic.code]);
    assert.strictEqual(guard.message, "NestingDepthExceeded: limit 128, actual 129");
    assert.strictEqual(guard.name, "Error");
    assert.strictEqual(guard._tag, "GuardExceeded");
    assert.strictEqual(guard.reason, diagnostic.code);
    assert.strictEqual(guard.offset, diagnostic.offset);
    assert.strictEqual(guard.limit, 128);
    assert.strictEqual(guard.actual, 129);
    assert.strictEqual(isRawMarkdownError(raw), true);
    assert.strictEqual(isRawMarkdownError(guard), false);
    assert.strictEqual(isGuardExceeded(guard), true);
    assert.strictEqual(isGuardExceeded(raw), false);
    assert.strictEqual(isGuardExceeded({ _tag: "GuardExceeded" }), false);
  })
);
