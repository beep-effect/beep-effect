import { dual } from "effect/Function";
export interface CacheIdentity {
  readonly resourceNamePrefix: string;
}

export interface TurboCacheOptions extends CacheIdentity {
  readonly teams: readonly string[];
  readonly retentionDays: number;
  readonly main: string;
  readonly retainStages?: ReadonlyArray<string>
}

export const tokenId: {
  (options: CacheIdentity, team: string): string,
  (team: string): (options: CacheIdentity) => string
} = dual(2, (options: CacheIdentity, team: string): string =>
  `${options.resourceNamePrefix}Token-${team}`);

export const foundationId = (options: CacheIdentity): string => `${options.resourceNamePrefix}Foundation`;

export const workerId = (options: CacheIdentity): string => options.resourceNamePrefix;
