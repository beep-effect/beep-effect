import { ConfigFile } from "@beep/config-file/ConfigFile";
import { ConfigProbe, ConfigResolver } from "@beep/config-file/ConfigResolver";
import { JsonCodec } from "@beep/config-file/JsonCodec";
import { MergeStrategy } from "@beep/config-file/MergeStrategy";
import { assert, describe, expectTypeOf, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { ConfigFileShape } from "@beep/config-file/ConfigFile";
import type * as FileSystem from "effect/FileSystem";
import type * as Layer from "effect/Layer";
import type * as Path from "effect/Path";

class Settings extends S.Class<Settings, { readonly brand: unique symbol }>("Settings")({ port: S.Finite }) {}
type SettingsEncoded = typeof Settings.Encoded;
class SettingsFile extends ConfigFile.Service<SettingsFile, Settings>()("key-typing/SettingsFile") {}
class WiderFile extends Context.Service<WiderFile, ConfigFileShape<Settings> & { readonly extra: string }>()(
  "@beep/config-file/test/ConfigFileKeyTyping.test/WiderFile"
) {}

class Optional extends S.Class<Optional, { readonly brand: unique symbol }>("Optional")({
  cacheDir: S.optionalKey(S.String),
  projectKey: S.optionalKey(S.String),
}) {}
class OptionalFile extends ConfigFile.Service<OptionalFile, Optional>()("key-typing/OptionalFile") {}

const options = { schema: Settings, codec: JsonCodec, strategy: MergeStrategy.firstMatch<Settings>() };

describe("ConfigFile key typing", () => {
  it("layer accepts a ConfigFile.Service key, with or without explicit type arguments", () => {
    const inferred = ConfigFile.layer(SettingsFile, { ...options, resolvers: [] });
    const explicit = ConfigFile.layer<SettingsFile, Settings, SettingsEncoded, never>(SettingsFile, {
      ...options,
      resolvers: [],
    });
    assert.isDefined(inferred);
    assert.isDefined(explicit);
  });

  it("layer and testLayer reject a key over a wider shape", () => {
    // @ts-expect-error -- a wider shape would be handed a value missing `extra`. Owner: @beep/config-file. Exit: remove if the API is meant to accept this.
    const layer = () => ConfigFile.layer(WiderFile, { ...options, resolvers: [] });
    // @ts-expect-error -- the same pin applies to testLayer. Owner: @beep/config-file. Exit: remove if the API is meant to accept this.
    const testLayer = () => ConfigFile.testLayer(WiderFile, { ...options, files: {} });
    const accepted = () => ConfigFile.testLayer(SettingsFile, { ...options, files: {} });
    for (const build of [layer, testLayer, accepted]) assert.isFunction(build);
  });

  it("layer and testLayer infer A from the key when the strategy is a bare firstMatch()", () => {
    const layer = ConfigFile.layer(OptionalFile, {
      schema: Optional,
      codec: JsonCodec,
      strategy: MergeStrategy.firstMatch(),
      resolvers: [ConfigResolver.upwardWalk({ filename: "optional.json" })],
    });
    const typed: Layer.Layer<OptionalFile, never, FileSystem.FileSystem | Path.Path> = layer;
    const testLayer = ConfigFile.testLayer(OptionalFile, {
      schema: Optional,
      codec: JsonCodec,
      strategy: MergeStrategy.firstMatch(),
      files: {},
    });
    assert.isDefined(typed, "RR comes from the resolvers, so the requirements carry no stray unknown");
    assert.isDefined(
      testLayer,
      "the tag keeps A inferable under a bare firstMatch(), else A is unknown and this key fails"
    );
  });

  it("still rejects a wider key when the strategy is a bare firstMatch()", () => {
    const build = () =>
      // @ts-expect-error -- a wider shape would be handed a value missing `extra`. Owner: @beep/config-file. Exit: remove if the API is meant to accept this.
      ConfigFile.layer(WiderFile, {
        schema: Settings,
        codec: JsonCodec,
        strategy: MergeStrategy.firstMatch(),
        resolvers: [],
      });
    assert.isFunction(build);
  });
});

describe("ConfigFile resolver requirements", () => {
  const first: ConfigResolver<SettingsFile> = {
    name: "first",
    resolve: SettingsFile.pipe(Effect.as(O.none<string>())),
  };
  const second: ConfigResolver<OptionalFile> = {
    name: "second",
    resolve: OptionalFile.pipe(Effect.as(O.none<string>())),
  };

  it("infers every resolver requirement in both call forms", () => {
    const direct = ConfigFile.layer(SettingsFile, { ...options, resolvers: [first, second] });
    const curried = ConfigFile.layer({ ...options, resolvers: [first, second] })(SettingsFile);
    type Required = FileSystem.FileSystem | Path.Path | SettingsFile | OptionalFile;
    expectTypeOf<Layer.Services<typeof direct>>().toEqualTypeOf<Required>();
    expectTypeOf<Layer.Services<typeof curried>>().toEqualTypeOf<Required>();
  });

  it("infers a prebuilt array and independent defaultPath requirements", () => {
    const resolvers = [first, second];
    const layer = ConfigFile.layer(SettingsFile, {
      ...options,
      resolvers,
      defaultPath: WiderFile.pipe(Effect.as("/settings.json")),
    });
    expectTypeOf<Layer.Services<typeof layer>>().toEqualTypeOf<
      FileSystem.FileSystem | Path.Path | SettingsFile | OptionalFile | WiderFile
    >();
  });

  it("infers independent match and probe requirements in both call forms", () => {
    const resolver = {
      name: "independent-probe",
      resolve: first.resolve,
      resolveMatch: OptionalFile.pipe(Effect.as(O.none())),
      resolveProbe: WiderFile.pipe(Effect.as(ConfigProbe.make({ match: O.none(), probed: [] }))),
    };
    const direct = ConfigFile.layer(SettingsFile, { ...options, resolvers: [resolver] });
    const curried = ConfigFile.layer({ ...options, resolvers: [resolver] })(SettingsFile);
    type Required = FileSystem.FileSystem | Path.Path | SettingsFile | OptionalFile | WiderFile;
    expectTypeOf<Layer.Services<typeof direct>>().toEqualTypeOf<Required>();
    expectTypeOf<Layer.Services<typeof curried>>().toEqualTypeOf<Required>();
  });
});
