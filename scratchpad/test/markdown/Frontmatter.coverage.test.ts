import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { FrontmatterDecodeError, FrontmatterEncodeError, FrontmatterFormatMismatchError, FrontmatterMissingError, FrontmatterValidationError } from "../../effected/markdown/Frontmatter.ts";

it.effect("frontmatter failures expose precise messages and retain structured causes", () => Effect.sync(() => {
  const cause = { detail: "bad value" };
  const decode = FrontmatterDecodeError.make({ format: "json", cause });
  const encode = FrontmatterEncodeError.make({ format: "toml", cause });
  const validation = FrontmatterValidationError.make({ issue: cause });
  assert.strictEqual(decode.message, "frontmatter json content failed to parse");
  assert.strictEqual(encode.message, "frontmatter toml content failed to serialize");
  assert.strictEqual(decode.cause, cause);
  assert.strictEqual(encode.cause, cause);
  assert.strictEqual(validation.issue, cause);
  assert.strictEqual(validation.message, "frontmatter data failed schema validation");
  assert.strictEqual(FrontmatterFormatMismatchError.make({ expected: "json", actual: "yaml" }).message,
    "frontmatter format mismatch: the json codec cannot decode a yaml capture");
  assert.strictEqual(FrontmatterMissingError.make({ reason: "absent" }).message, "the document has no frontmatter block");
  assert.strictEqual(FrontmatterMissingError.make({ reason: "captureDisabled" }).message,
    "the source opens with a frontmatter block, but it was not captured; parse with `frontmatter: true`");
}));
