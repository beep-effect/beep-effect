import {
  PackageJsonFormat,
  PackageJsonModifyError,
  PackageJsonSyntaxError,
} from "@beep/package-json/PackageJsonFormat";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const UNSORTED =
  "{\n" +
  '  "dependencies": {\n' +
  '    "zebra": "^1.0.0",\n' +
  '    "apple": "^2.0.0"\n' +
  "  },\n" +
  '  "name": "not-sorted",\n' +
  '  "devEngines": {\n' +
  '    "runtime": {\n' +
  '      "name": "node",\n' +
  '      "version": "24.9.1"\n' +
  "    }\n" +
  "  },\n" +
  '  "version": "0.1.0",\n' +
  '  "scripts": {\n' +
  '    "b": "two",\n' +
  '    "a": "one"\n' +
  "  },\n" +
  '  "packageManager": "pnpm@11.2.0"\n' +
  "}\n";

describe("PackageJsonFormat.modifyToString (byte preservation: only the edited span may differ)", () => {
  it.effect("replaces one top-level value and preserves every other byte", () =>
    Effect.gen(function* () {
      const output = yield* PackageJsonFormat.modifyToString(UNSORTED, ["packageManager"], "pnpm@11.3.0");
      assert.strictEqual(
        output,
        Str.replace('"pnpm@11.2.0"', '"pnpm@11.3.0"')(UNSORTED),
        "the fixture is out of canonical order, so any formatter reorder shows up as a diff"
      );
    })
  );

  it.effect("replaces a nested value and preserves every other byte", () =>
    Effect.gen(function* () {
      const output = yield* PackageJsonFormat.modifyToString(UNSORTED, ["devEngines", "runtime", "version"], "24.10.0");
      assert.strictEqual(output, Str.replace('"version": "24.9.1"', '"version": "24.10.0"')(UNSORTED));
    })
  );

  it.effect("inserts a missing key after the container's last key, matching the source indent", () =>
    Effect.gen(function* () {
      const source = '{\n    "private": true\n}\n';
      const output = yield* PackageJsonFormat.modifyToString(source, ["packageManager"], "pnpm@11.2.0");
      assert.strictEqual(output, '{\n    "private": true,\n    "packageManager": "pnpm@11.2.0"\n}\n');
    })
  );

  it.effect("inserts with tab indentation when the source is tab-indented", () =>
    Effect.gen(function* () {
      const source = '{\n\t"private": true\n}\n';
      const output = yield* PackageJsonFormat.modifyToString(source, ["packageManager"], "pnpm@11.2.0");
      assert.strictEqual(output, '{\n\t"private": true,\n\t"packageManager": "pnpm@11.2.0"\n}\n');
    })
  );

  it.effect("deletes a key (and its comma) when value is undefined", () =>
    Effect.gen(function* () {
      const source = '{\n  "name": "x",\n  "packageManager": "pnpm@11.2.0"\n}\n';
      const output = yield* PackageJsonFormat.modifyToString(source, ["packageManager"], undefined);
      assert.strictEqual(output, '{\n  "name": "x"\n}\n');
    })
  );

  it.effect("preserves CRLF line endings in inserted content", () =>
    Effect.gen(function* () {
      const source = '{\r\n  "private": true\r\n}\r\n';
      const output = yield* PackageJsonFormat.modifyToString(source, ["packageManager"], "pnpm@11.2.0");
      assert.strictEqual(output, '{\r\n  "private": true,\r\n  "packageManager": "pnpm@11.2.0"\r\n}\r\n');
    })
  );

  it.effect("preserves the absence of a trailing newline", () =>
    Effect.gen(function* () {
      const source = '{\n  "packageManager": "pnpm@11.2.0"\n}';
      const output = yield* PackageJsonFormat.modifyToString(source, ["packageManager"], "pnpm@11.3.0");
      assert.strictEqual(output, '{\n  "packageManager": "pnpm@11.3.0"\n}');
    })
  );

  it.effect("passes a nonsemver version through untouched — the modify path never decodes", () =>
    Effect.gen(function* () {
      const source = '{\n  "version": "1.0",\n  "packageManager": "pnpm@11.2.0"\n}\n';
      const output = yield* PackageJsonFormat.modifyToString(source, ["packageManager"], "pnpm@11.3.0");
      assert.strictEqual(
        output,
        '{\n  "version": "1.0",\n  "packageManager": "pnpm@11.3.0"\n}\n',
        "1.0 is legal for an unpublished root though every decode here rejects it; the mutator must carry it"
      );
    })
  );

  it.effect("fails with PackageJsonSyntaxError on invalid JSON", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(PackageJsonFormat.modifyToString("{ nope", ["a"], 1));
      if (!S.is(PackageJsonSyntaxError)(error)) {
        return assert.fail(`expected PackageJsonSyntaxError, got ${error._tag}`);
      }
      assert.strictEqual(error.reason, "invalid-json");
    })
  );

  it.effect("fails with PackageJsonSyntaxError on a non-object document", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(PackageJsonFormat.modifyToString("[1, 2]", ["a"], 1));
      if (!S.is(PackageJsonSyntaxError)(error)) {
        return assert.fail(`expected PackageJsonSyntaxError, got ${error._tag}`);
      }
      assert.strictEqual(error.reason, "not-an-object");
    })
  );

  it.effect("fails with PackageJsonModifyError when the path cannot be navigated", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(PackageJsonFormat.modifyToString(UNSORTED, ["name", "sub"], 1));
      if (!S.is(PackageJsonModifyError)(error)) {
        return assert.fail(`expected PackageJsonModifyError, got ${error._tag}`);
      }
      assert.deepStrictEqual(
        error.path,
        ["name", "sub"],
        "name is a string, so descending into it as an object is a mismatch"
      );
      assertTrue(P.hasProperty(error.cause, "_tag"));
      assert.strictEqual(error.cause._tag, "JsoncModificationError");
    })
  );
});

describe("PackageJsonFormat.modify", () => {
  it.effect("returns no edits for a structural no-op", () =>
    Effect.gen(function* () {
      const edits = yield* PackageJsonFormat.modify(UNSORTED, ["doesNotExist"], undefined);
      assert.strictEqual(edits.length, 0, "deleting a key that does not exist is a no-op, not an error");
    })
  );

  it.effect("computes a single-span edit for a value replacement", () =>
    Effect.gen(function* () {
      const edits = yield* PackageJsonFormat.modify(UNSORTED, ["packageManager"], "pnpm@11.3.0");
      assert.strictEqual(edits.length, 1);
      const edit = edits[0];
      if (edit === undefined) {
        return assert.fail("expected exactly one edit");
      }
      assert.strictEqual(edit.content, '"pnpm@11.3.0"');
      assert.strictEqual(Str.slice(edit.offset, edit.offset + edit.length)(UNSORTED), '"pnpm@11.2.0"');
    })
  );
});
