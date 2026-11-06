# Review of CLI test cache input expansion

Merged PR #2777 (`e68e1d1e06319a9e7781eeb9dd8da5f8e5ab05de`) added the native dependency diagnostic Python source and test to the CLI test, property-test and coverage task input declarations. It also preserved the existing external architecture-lab and db-admin inputs for each consumer. Those additions expand invalidation inputs; they do not enable cache reuse, change commands, remove dependencies, or reduce test populations.

On main `0b1d20050fce435b6029881fb4bb0beeaa2e4251`, `beep quality cache-policy` refuses the two existing legacy cached tasks `@beep/repo-cli#test` and `@beep/repo-cli#test:property` because the reviewed projection predates those input declarations. Coverage remains uncached. The CLI turbo source digest also changed.

This review authorizes the canonical baseline recorder to update only the CLI package projection and the root source-digest review. It preserves the four lint qualification scope entries, profile, epoch, unrelated reviews, and qualification ledger. It grants no new qualification, cache activation, producer approval, expiry extension, or acceptance exception. Existing commands, cache settings, dependencies and environment declarations must remain unchanged. The affected task input arrays must equal the merged declarations exactly.

Reversal is reverting this reviewed projection update; the audit will again refuse the expanded declarations until they receive a matching review.
