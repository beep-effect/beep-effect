/**
 * The filesystem half of the tsconfig.json port: extends-chain loading,
 * config discovery and the strict closed validator. The pure document model
 * lives in `@beep/tsconfig`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export { FindNearestOptions, TsconfigDiscovery } from "./TsconfigDiscovery.ts";
export { ExtendsFailureReason, TsconfigExtendsError, TsconfigLoader } from "./TsconfigLoader.ts";
export { TsconfigLoaderSync } from "./TsconfigLoaderSync.ts";
export {
  StrictCompilerOptions,
  StrictTsconfig,
  TsconfigValidationError,
  TsconfigValidator,
} from "./TsconfigValidator.ts";
export type { SyncFileSystem, SyncPath, TsconfigLoaderSyncOptions } from "./TsconfigLoaderSync.ts";
