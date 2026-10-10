import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { PackageManagerPin, InvalidPackageManagerPinError } from "../../effected/npm/PackageManagerPin.ts";
import { SemVer } from "../../effected/semver/index.ts";

it.effect("reports each invalid component and rejects constructed build metadata", () => Effect.gen(function* () {
  for (const [input, reason, detail] of [
    ["pnpm", "format", "expected <name>@<version>[+<integrity>]"],
    ["other@1.0.0", "name", "name must be one of npm, pnpm, yarn, bun"],
    ["pnpm@ 1.0.0", "version", "version must be an exact SemVer version (ranges, partial versions and dist-tags are not pinnable)"],
    ["pnpm@1.0.0+broken", "integrity", "integrity must be a corepack <algo>.<hex> hash"],
  ] as const) {
    const error = yield* Effect.flip(PackageManagerPin.parse(input));
    assert.strictEqual(error.reason, reason);
    assert.strictEqual(error.message, `Invalid package-manager pin "${input}": ${detail}`);
    assert.strictEqual(InvalidPackageManagerPinError.make({ input, reason }).message, error.message);
  }
  const version = yield* SemVer.parse("1.0.0+build");
  const result = S.decodeResult(PackageManagerPin)({ name: "pnpm", version });
  result.pipe(Result.isFailure, assertTrue);
}));
