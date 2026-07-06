import { AppendFileSyncOptions, ReaddirSyncOptions, RmSyncOptions } from "@beep/utils/FileSystem";
import { GlobOptions, Pattern } from "@beep/utils/Glob";
import { PathInput } from "@beep/utils/Struct";
import { Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

const encode = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): C["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Encoded"]): C["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): void => {
  const decoded = decode(schema, encode(schema, value));

  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const expectSchemaRoundTrips = <C extends S.Codec<unknown, unknown>>(schema: C): void => {
  const arbitrary = S.toArbitrary(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      expectRoundTrip(schema, value);
    }),
    { numRuns: 50 }
  );
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

  it("round-trips schema-derived arbitrary values through encoded form", () => {
    expectSchemaRoundTrips(Pattern);
    expectSchemaRoundTrips(GlobOptions);
    expectSchemaRoundTrips(AppendFileSyncOptions);
    expectSchemaRoundTrips(RmSyncOptions);
    expectSchemaRoundTrips(ReaddirSyncOptions);
    expectSchemaRoundTrips(PathInput);
  });
});
