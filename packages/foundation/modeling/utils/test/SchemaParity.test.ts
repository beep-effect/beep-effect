import { fcRuns } from "@beep/fc-runs";
import { it } from "@beep/test-runner";
import { AppendFileSyncOptions, ReaddirSyncOptions, RmSyncOptions } from "@beep/utils/FileSystem";
import { GlobOptions, Pattern } from "@beep/utils/Glob";
import { PathInput } from "@beep/utils/Struct";
import { describe, expect } from "@effect/vitest";
import { Result } from "effect";
import * as S from "effect/Schema";

const encode = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): C["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Encoded"]): C["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): void => {
  const decoded = decode(schema, encode(schema, value));

  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

describe("@beep/utils schema parity", () => {
  it("preserves representative encoded option and path shapes", () => {
    expect(encode(Pattern, "src/**/*.ts")).toBe("src/**/*.ts");
    expect(encode(Pattern, ["src/**/*.ts", "test/**/*.ts"])).toEqual(["src/**/*.ts", "test/**/*.ts"]);
    expect(encode(GlobOptions, GlobOptions.make({}))).toEqual({});
    expect(
      encode(
        GlobOptions,
        GlobOptions.make({
          absolute: true,
          cwd: ".",
          dot: false,
          ignore: ["dist/**"],
          nodir: true,
        })
      )
    ).toEqual({
      absolute: true,
      cwd: ".",
      dot: false,
      ignore: ["dist/**"],
      nodir: true,
    });
    expect(
      encode(
        AppendFileSyncOptions,
        AppendFileSyncOptions.make({
          encoding: "utf8",
          flag: "a",
          mode: 0,
        })
      )
    ).toEqual({
      encoding: "utf8",
      flag: "a",
      mode: 0,
    });
    expect(encode(RmSyncOptions, RmSyncOptions.make({ force: true, recursive: false }))).toEqual({
      force: true,
      recursive: false,
    });
    expect(encode(ReaddirSyncOptions, ReaddirSyncOptions.make({ withFileTypes: true }))).toEqual({
      withFileTypes: true,
    });
    expect(encode(PathInput, "profile.name")).toBe("profile.name");
    expect(encode(PathInput, ["profile", "name"])).toEqual(["profile", "name"]);
  });

  it.prop(
    "round-trips Pattern",
    { value: Pattern },
    ({ value }) => {
      expectRoundTrip(Pattern, value);
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round-trips GlobOptions",
    { value: GlobOptions },
    ({ value }) => {
      expectRoundTrip(GlobOptions, value);
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round-trips AppendFileSyncOptions",
    { value: AppendFileSyncOptions },
    ({ value }) => {
      expectRoundTrip(AppendFileSyncOptions, value);
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round-trips RmSyncOptions",
    { value: RmSyncOptions },
    ({ value }) => {
      expectRoundTrip(RmSyncOptions, value);
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round-trips ReaddirSyncOptions",
    { value: ReaddirSyncOptions },
    ({ value }) => {
      expectRoundTrip(ReaddirSyncOptions, value);
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round-trips PathInput",
    { value: PathInput },
    ({ value }) => {
      expectRoundTrip(PathInput, value);
    },
    { arbitrary: fcRuns(50) }
  );
});
