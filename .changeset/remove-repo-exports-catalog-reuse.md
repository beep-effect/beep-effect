---
{}
---

Remove the repo-exports catalog subsystem and the Reuse-discovery feature to streamline tooling and eliminate generated-artifact churn:

- Deleted the `@beep/repo-codegraph` package (catalog models + lookup), the `quality repo-exports-catalog` generator/subcommand, the `reuse` CLI command, the `@beep/repo-utils` Reuse services (ReuseDiscoveryService/ReuseInventory/ReusePartitionPlanner/etc.), all ~84 tracked `**/.beep/repo-exports/catalog.shard.jsonc` shards, and `standards/repo-exports.catalog.{jsonc,md}`.
- Removed the `repo-exports:*` package scripts, the `repo-exports:shard` turbo task, the pre-push catalog lefthook hook, the `.gitignore` shard-tracking exceptions, and the `$RepoCodegraphId` identity composer.
- Removed the now-deleted `effect-capability-kg` module (`@beep/repo-utils`), which depended on the catalog, plus its goal/exploration packets.
- Reuse discovery is now done with ripgrep + package barrels (see the `repo-symbol-discovery` skill). No package releases required.
