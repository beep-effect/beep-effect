import { CachePolicy, Principal, Team } from "@beep/infra-turbo-cache/CachePolicy";
import { TurboCacheOptions, turboCache } from "@beep/infra-turbo-cache/TurboCache";

/** A small policy: one writer and one reader of team `rat-stack`. */
export const fixturePolicy = CachePolicy.make({
  teams: [
    Team.make({
      slug: "rat-stack",
      principals: [
        Principal.make({ name: "writer", access: "write", rotation: 1 }),
        Principal.make({ name: "reader", access: "read", rotation: 1 }),
      ],
    }),
  ],
});

export const fixturePrefix = "TurboCache";

export default turboCache(
  TurboCacheOptions.make({
    main: import.meta.url,
    policy: fixturePolicy,
    resourceNamePrefix: fixturePrefix,
    retentionDays: 7,
  })
);
