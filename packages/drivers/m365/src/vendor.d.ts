/**
 * Ambient surface of `@azure/msal-node-extensions` for the encrypted token
 * cache path in `M365.auth.ts`.
 *
 * The extension is an optional peer dependency that this workspace does not
 * install: it hard-depends on the native `keytar` addon, whose prebuild
 * download fails hosted installs. A host that sets `tokenCachePath` declares
 * the package itself; this file keeps the driver's dynamic import typed
 * without the package on disk. It mirrors the upstream
 * `types/persistence/*.d.ts` at 5.5.0 for exactly the members the driver uses.
 */
declare module "@azure/msal-node-extensions" {
  import type { ICachePlugin, TokenCacheContext } from "@azure/msal-node";

  export const DataProtectionScope: {
    readonly CurrentUser: "CurrentUser";
    readonly LocalMachine: "LocalMachine";
  };
  export type DataProtectionScope = (typeof DataProtectionScope)[keyof typeof DataProtectionScope];

  export interface IPersistence {
    createForPersistenceValidation(): Promise<IPersistence>;
    delete(): Promise<boolean>;
    getFilePath(): string;
    load(): Promise<string | null>;
    reloadNecessary(lastSync: number): Promise<boolean>;
    save(contents: string): Promise<void>;
    verifyPersistence(): Promise<boolean>;
  }

  export interface IPersistenceConfiguration {
    readonly accountName?: string;
    readonly cachePath?: string;
    readonly dataProtectionScope?: DataProtectionScope;
    readonly serviceName?: string;
    readonly usePlaintextFileOnLinux?: boolean;
  }

  export class PersistenceCreator {
    static createPersistence(config: IPersistenceConfiguration): Promise<IPersistence>;
  }

  export class PersistenceCachePlugin implements ICachePlugin {
    constructor(persistence: IPersistence);
    beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void>;
    afterCacheAccess(cacheContext: TokenCacheContext): Promise<void>;
  }
}
