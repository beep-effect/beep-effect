/**
 * Composable config file loading for Effect: pluggable codecs, resolvers that
 * find the file, and merge strategies that combine several into one value.
 *
 * **Details**
 *
 * Name the codec you use (`JsonCodec`, `JsoncCodec`, `YamlCodec`, `TomlCodec`)
 * and a bundler drops the rest. Build a service with `ConfigFile.Service` and
 * `ConfigFile.layer`, or read one known path with `ConfigFile.read`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export type { ConfigCodec } from "./ConfigCodec.ts";
export { ConfigCodecError } from "./ConfigCodec.ts";
export type { ConfigEventsShape } from "./ConfigEvent.ts";
export { ConfigEvent, ConfigEventPayload, ConfigEvents, ConfigSourceRef } from "./ConfigEvent.ts";
export type {
	ConfigEncodeError,
	ConfigEncodeOptions,
	ConfigFileOptions,
	ConfigFileShape,
	ConfigFileTestOptions,
	ConfigLoadError,
	ConfigReadError,
	ConfigReadOptions,
	ConfigSaveError,
	ConfigUpdateError,
	ConfigWriteError,
} from "./ConfigFile.ts";
export {
	ConfigDefaultPathMissingError,
	ConfigFile,
	ConfigFileNotFoundError,
	ConfigFileReadError,
	ConfigFileWriteError,
	ConfigValidationError,
} from "./ConfigFile.ts";
export type { ConfigFileMigration, ConfigMigrationOptions } from "./ConfigMigration.ts";
export { ConfigMigration, ConfigMigrationError, VersionAccess } from "./ConfigMigration.ts";
export type { LayerConfigProviderOptions } from "./ConfigProvider.ts";
export { asConfigProvider, layerConfigProvider } from "./ConfigProvider.ts";
export type { ConfigMatch, ConfigProbe, UpwardWalkOptions } from "./ConfigResolver.ts";
export { ConfigResolver } from "./ConfigResolver.ts";
export { ConfigEncryptionError, EncryptedCodec, EncryptedCodecKey } from "./EncryptedCodec.ts";
export { JsonCodec } from "./JsonCodec.ts";
export { JsoncCodec } from "./JsoncCodec.ts";
export type { ConfigSource, NonEmptySources } from "./MergeStrategy.ts";
export { MergeStrategy } from "./MergeStrategy.ts";
export { TomlCodec } from "./TomlCodec.ts";
export { YamlCodec } from "./YamlCodec.ts";
