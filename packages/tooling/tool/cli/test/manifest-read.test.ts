/**
 * The shared package.json projection readers (`manifestParser` for text,
 * `manifestDecoder` for an already-parsed value).
 *
 * The retired per-command projections failed when a field they read had the
 * wrong JSON shape and ignored every other field. These cases pin that verdict
 * on top of `LenientManifest`, and the one deliberate change: the text must be
 * JSON, where three of the projections accepted JSONC.
 */
import { DegradedManifestFieldError, manifestDecoder, manifestParser } from "@beep/repo-cli/test/SharedInternals";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertInstanceOf, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";

describe("manifestParser", () => {
  it.effect("reads the fields it names through LenientManifest", () =>
    Effect.gen(function* () {
      const manifest = yield* manifestParser(["name", "scripts"])(
        '{"name":"@beep/demo","scripts":{"check":"tsc"},"private":true}'
      );

      strictEqual(manifest.name, "@beep/demo");
      deepStrictEqual(manifest.scripts, { check: "tsc" });
      assertTrue(manifest.isPrivate);
    })
  );

  it.effect("fails when a field it reads is present in the wrong JSON shape", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(manifestParser(["name", "private"])('{"name":"@beep/demo","private":"yes"}'));

      assertInstanceOf(error, DegradedManifestFieldError);
      deepStrictEqual(error.fields, ["private"]);
    })
  );

  it.effect("leaves a malformed field it does not read as a degraded issue", () =>
    Effect.gen(function* () {
      const manifest = yield* manifestParser(["name"])('{"name":"@beep/demo","bin":7}');

      strictEqual(manifest.name, "@beep/demo");
      strictEqual(manifest.bin, undefined);
      deepStrictEqual(
        A.map(manifest.issues, (issue) => issue.field),
        ["bin"]
      );
    })
  );

  it.effect("rejects JSONC text: comments and trailing commas are not JSON", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(manifestParser(["name"])('{\n  // comment\n  "name": "@beep/demo",\n}\n'));

      strictEqual(error._tag, "PackageJsonSyntaxError");
    })
  );

  it.effect("rejects a document that is not a JSON object", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(manifestParser(["name"])("[]"));

      strictEqual(error._tag, "PackageJsonSyntaxError");
    })
  );
});

describe("manifestDecoder", () => {
  it.effect("decodes a parsed value with the parser's verdict", () =>
    Effect.gen(function* () {
      const manifest = yield* manifestDecoder(["name", "scripts"])({ name: "@beep/demo", scripts: { check: "tsc" } });

      strictEqual(manifest.name, "@beep/demo");
      deepStrictEqual(manifest.scripts, { check: "tsc" });
    })
  );

  it.effect("fails when a field it reads is present in the wrong JSON shape", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(manifestDecoder(["name", "dependencies"])({ name: "a", dependencies: [] }));

      assertInstanceOf(error, DegradedManifestFieldError);
      deepStrictEqual(error.fields, ["dependencies"]);
    })
  );

  it.effect("rejects a value that is not a JSON object", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(manifestDecoder(["name"])([]));

      strictEqual(error._tag, "PackageDecodeError");
    })
  );
});
