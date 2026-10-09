import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { GuardExceeded, isGuardExceeded, isRawMarkdownError, MARKDOWN_PARSE_ERROR_CODES, RawMarkdownError } from "../../../effected/markdown/internal/carriers.ts";

it.effect("preserves diagnostic identity and guard details across raw error carriers", () => Effect.sync(() => {
  const diagnostic = { code: "NestingDepthExceeded", message: "too deep", offset: 7, length: 2 } as const;
  const raw = new RawMarkdownError(diagnostic);
  assert.strictEqual(raw.diagnostic, diagnostic);
  assert.strictEqual(raw.message, diagnostic.message);
  assert.strictEqual(raw.name, "Error");
  const guard = new GuardExceeded("NestingDepthExceeded", 128, 129, 7);
  assert.deepStrictEqual(MARKDOWN_PARSE_ERROR_CODES, [diagnostic.code]);
  assert.strictEqual(guard.message, "NestingDepthExceeded: limit 128, actual 129");
  assert.strictEqual(guard.name, "Error");
  assert.strictEqual(guard.reason, diagnostic.code);
  assert.strictEqual(guard.offset, diagnostic.offset);
  assert.strictEqual(guard.limit, 128);
  assert.strictEqual(guard.actual, 129);
  assert.strictEqual(isRawMarkdownError(raw), true);
  assert.strictEqual(isRawMarkdownError(guard), false);
  assert.strictEqual(isGuardExceeded(guard), true);
  assert.strictEqual(isGuardExceeded(raw), false);
  assert.strictEqual(isGuardExceeded({ _tag: "GuardExceeded" }), false);
}));
