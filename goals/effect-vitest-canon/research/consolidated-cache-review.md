# Consolidated cache dependency review

Preserve the separately reviewed dependency changes from the constituent PRs.
Only disjoint or identical node changes are combined; all other projection
metadata and qualification fields must remain identical to the merge base.

## Incoming 166721d72c510a04092462f15fbdb5bd8c06e736

- `@beep/mcp-kit#audit`
- `@beep/mcp-kit#build`
- `@beep/mcp-kit#check`
- `@beep/mcp-kit#coverage`
- `@beep/mcp-kit#doctest`
- `@beep/mcp-kit#lint:deprecated-apis`
- `@beep/mcp-kit#package-test-typecheck`
- `@beep/mcp-kit#test`
- `@beep/mcp-kit#test:integration`
- `@beep/mcp-kit#test:property`

## Incoming a97ca9c183b2cf7cdacb4a5c78bfcb5b949bbaae

- `@beep/shared-domain#audit`
- `@beep/shared-domain#build`
- `@beep/shared-domain#check`
- `@beep/shared-domain#coverage`
- `@beep/shared-domain#lint:deprecated-apis`
- `@beep/shared-domain#package-test-typecheck`
- `@beep/shared-domain#test`
- `@beep/shared-domain#test:property`

## Incoming 769c458492713cf271732e5e10ecb37a7f1a046e

- `@beep/provenance#audit`
- `@beep/provenance#build`
- `@beep/provenance#check`
- `@beep/provenance#coverage`
- `@beep/provenance#doctest`
- `@beep/provenance#lint:deprecated-apis`
- `@beep/provenance#package-test-typecheck`
- `@beep/provenance#test`
- `@beep/provenance#test:property`

## Incoming 29c8d7355d6f3c8315d7cdef5780a7a787a2781d

- `@beep/anthropic#audit`
- `@beep/anthropic#build`
- `@beep/anthropic#check`
- `@beep/anthropic#coverage`
- `@beep/anthropic#lint:deprecated-apis`
- `@beep/anthropic#package-test-typecheck`
- `@beep/anthropic#test`
- `@beep/anthropic#test:property`
- `@beep/openai#audit`
- `@beep/openai#build`
- `@beep/openai#check`
- `@beep/openai#coverage`
- `@beep/openai#lint:deprecated-apis`
- `@beep/openai#package-test-typecheck`
- `@beep/openai#test`
- `@beep/openai#test:integration`
- `@beep/openai-compat#audit`
- `@beep/openai-compat#build`
- `@beep/openai-compat#check`
- `@beep/openai-compat#coverage`
- `@beep/openai-compat#lint:deprecated-apis`
- `@beep/openai-compat#package-test-typecheck`
- `@beep/openai-compat#test`
- `@beep/openai-compat#test:integration`
- `@beep/openai-compat#test:property`
- `@beep/venice-ai#audit`
- `@beep/venice-ai#build`
- `@beep/venice-ai#check`
- `@beep/venice-ai#coverage`
- `@beep/venice-ai#lint:deprecated-apis`
- `@beep/venice-ai#package-test-typecheck`
- `@beep/venice-ai#test`
- `@beep/venice-ai#test:integration`
- `@beep/venice-ai#test:integration:parallel`
- `@beep/venice-ai#test:property`
- `@beep/xai#audit`
- `@beep/xai#build`
- `@beep/xai#check`
- `@beep/xai#coverage`
- `@beep/xai#lint:deprecated-apis`
- `@beep/xai#package-test-typecheck`
- `@beep/xai#test`
- `@beep/xai#test:integration`
- `@beep/xai#test:property`

## Incoming 3d79b3530aa77ccf6d3af7005a8cf9e02db5d489

- `@beep/freshbooks#audit`
- `@beep/freshbooks#build`
- `@beep/freshbooks#check`
- `@beep/freshbooks#coverage`
- `@beep/freshbooks#lint:deprecated-apis`
- `@beep/freshbooks#package-test-typecheck`
- `@beep/freshbooks#test`
- `@beep/freshbooks#test:integration`
- `@beep/hubspot#audit`
- `@beep/hubspot#build`
- `@beep/hubspot#check`
- `@beep/hubspot#coverage`
- `@beep/hubspot#lint:deprecated-apis`
- `@beep/hubspot#package-test-typecheck`
- `@beep/hubspot#test`
- `@beep/hubspot#test:integration`
- `@beep/hubspot#test:property`
- `@beep/m365#audit`
- `@beep/m365#build`
- `@beep/m365#check`
- `@beep/m365#coverage`
- `@beep/m365#lint:deprecated-apis`
- `@beep/m365#package-test-typecheck`
- `@beep/m365#test`
- `@beep/m365#test:integration`
- `@beep/m365#test:integration:parallel`
- `@beep/m365#test:property`
- `@beep/uspto#audit`
- `@beep/uspto#build`
- `@beep/uspto#check`
- `@beep/uspto#coverage`
- `@beep/uspto#lint:deprecated-apis`
- `@beep/uspto#package-test-typecheck`
- `@beep/uspto#test`
- `@beep/uspto#test:integration`
- `@beep/uspto#test:property`

## Incoming abb9ab2cea6b289dfb1e89de2b1495d1bda87216

- `@beep/ai-provider-cli#audit`
- `@beep/ai-provider-cli#build`
- `@beep/ai-provider-cli#check`
- `@beep/ai-provider-cli#coverage`
- `@beep/ai-provider-cli#lint:deprecated-apis`
- `@beep/ai-provider-cli#package-test-typecheck`
- `@beep/ai-provider-cli#test`
- `@beep/ai-provider-cli#test:integration`
- `@beep/ai-provider-cli#test:property`
- `@beep/architecture-lab-config#audit`
- `@beep/architecture-lab-config#build`
- `@beep/architecture-lab-config#check`
- `@beep/architecture-lab-config#coverage`
- `@beep/architecture-lab-config#lint:deprecated-apis`
- `@beep/architecture-lab-config#package-test-typecheck`
- `@beep/architecture-lab-config#test`
- `@beep/architecture-lab-config#test:integration`
- `@beep/architecture-lab-config#test:property`

## Incoming 80e01f276dbd9420cc6d19573ebd67fa4e3cf56b

- `@beep/exiftool#audit`
- `@beep/exiftool#build`
- `@beep/exiftool#check`
- `@beep/exiftool#coverage`
- `@beep/exiftool#lint:deprecated-apis`
- `@beep/exiftool#package-test-typecheck`
- `@beep/exiftool#test`
- `@beep/exiftool#test:integration`
- `@beep/exiftool#test:integration:parallel`
- `@beep/face-detection#audit`
- `@beep/face-detection#build`
- `@beep/face-detection#check`
- `@beep/face-detection#coverage`
- `@beep/face-detection#lint:deprecated-apis`
- `@beep/face-detection#package-test-typecheck`
- `@beep/face-detection#test`
- `@beep/face-detection#test:integration`
- `@beep/face-detection#test:property`

## Incoming 9ab680a91284e255bc389cc70980ef502f0af6d3

- `@beep/drizzle#audit`
- `@beep/drizzle#build`
- `@beep/drizzle#check`
- `@beep/drizzle#coverage`
- `@beep/drizzle#lint:deprecated-apis`
- `@beep/drizzle#package-test-typecheck`
- `@beep/drizzle#test`
- `@beep/drizzle#test:integration`
- `@beep/drizzle#test:integration:serial`
- `@beep/drizzle#test:property`
- `@beep/duckdb#audit`
- `@beep/duckdb#build`
- `@beep/duckdb#check`
- `@beep/duckdb#coverage`
- `@beep/duckdb#lint:deprecated-apis`
- `@beep/duckdb#package-test-typecheck`
- `@beep/duckdb#test`
- `@beep/duckdb#test:property`
- `@beep/postgres#audit`
- `@beep/postgres#build`
- `@beep/postgres#check`
- `@beep/postgres#coverage`
- `@beep/postgres#lint:deprecated-apis`
- `@beep/postgres#package-test-typecheck`
- `@beep/postgres#test`
- `@beep/postgres#test:integration`
- `@beep/postgres#test:integration:serial`
- `@beep/postgres#test:property`

## Incoming c03a3983e8839e13597791e8ca2569b4b9c0e356

- `@beep/md#audit`
- `@beep/md#build`
- `@beep/md#check`
- `@beep/md#coverage`
- `@beep/md#doctest`
- `@beep/md#lint:deprecated-apis`
- `@beep/md#package-test-typecheck`
- `@beep/md#test`
- `@beep/md#test:property`

## Incoming 09a8f7339788aadabce6933897d8c03ce65b2419

- `@beep/acp#audit`
- `@beep/acp#build`
- `@beep/acp#check`
- `@beep/acp#codegen`
- `@beep/acp#coverage`
- `@beep/acp#lint:deprecated-apis`
- `@beep/acp#package-test-typecheck`
- `@beep/acp#test`
- `@beep/acp#test:integration`
- `@beep/acp#test:integration:parallel`
- `@beep/acp#test:property`

## Incoming 4fd64599c9b8cd4f3b456d4cc3b545b82ad108e8

- `@beep/repo-configs#audit`
- `@beep/repo-configs#build`
- `@beep/repo-configs#check`
- `@beep/repo-configs#codegen`
- `@beep/repo-configs#coverage`
- `@beep/repo-configs#lint:deprecated-apis`
- `@beep/repo-configs#package-test-typecheck`
- `@beep/repo-configs#test`
- `@beep/repo-configs#test:property`

## Incoming 6ad006114beb6e0fa00adcc71636e8b233b50806

- `@beep/repo-utils#audit`
- `@beep/repo-utils#build`
- `@beep/repo-utils#check`
- `@beep/repo-utils#coverage`
- `@beep/repo-utils#lint:deprecated-apis`
- `@beep/repo-utils#package-test-typecheck`
- `@beep/repo-utils#test`
- `@beep/repo-utils#test:property`

## Incoming 9b8d959e1d641dc40b4aa6e6138445790ead670b

- `@beep/observability#audit`
- `@beep/observability#build`
- `@beep/observability#check`
- `@beep/observability#coverage`
- `@beep/observability#doctest`
- `@beep/observability#lint:deprecated-apis`
- `@beep/observability#package-test-typecheck`
- `@beep/observability#test`
- `@beep/observability#test:property`

## Incoming 441bfec4e5acf966cf893ee5ab4b40aacef96b8f

- `@beep/phoenix#audit`
- `@beep/phoenix#build`
- `@beep/phoenix#check`
- `@beep/phoenix#coverage`
- `@beep/phoenix#lint:deprecated-apis`
- `@beep/phoenix#package-test-typecheck`
- `@beep/phoenix#test`
- `@beep/phoenix#test:integration`
- `@beep/phoenix#test:property`

## Incoming 91a23ba8a3c697c32c3c59f30bcf3d9c4c07f043

- `@beep/pretext#audit`
- `@beep/pretext#build`
- `@beep/pretext#check`
- `@beep/pretext#coverage`
- `@beep/pretext#lint:deprecated-apis`
- `@beep/pretext#package-test-typecheck`
- `@beep/pretext#test`
- `@beep/pretext#test:integration`

## Incoming 3194e465b6c74077ef53af50ec25c6cb172163d7

- `@beep/agents-domain#audit`
- `@beep/agents-domain#build`
- `@beep/agents-domain#check`
- `@beep/agents-domain#coverage`
- `@beep/agents-domain#lint:deprecated-apis`
- `@beep/agents-domain#package-test-typecheck`
- `@beep/agents-domain#test`
- `@beep/agents-domain#test:property`
- `@beep/agents-tables#audit`
- `@beep/agents-tables#build`
- `@beep/agents-tables#check`
- `@beep/agents-tables#coverage`
- `@beep/agents-tables#lint:deprecated-apis`
- `@beep/agents-tables#package-test-typecheck`
- `@beep/agents-tables#test`
- `@beep/agents-tables#test:integration`

## Incoming 95738112455580bb379b3b87f3173c63ef488da7

- `@beep/ecfr#audit`
- `@beep/ecfr#build`
- `@beep/ecfr#check`
- `@beep/ecfr#codegen`
- `@beep/ecfr#coverage`
- `@beep/ecfr#lint:deprecated-apis`
- `@beep/ecfr#package-test-typecheck`
- `@beep/ecfr#test`
- `@beep/ecfr#test:integration`
- `@beep/ecfr#test:property`
- `@beep/govinfo#audit`
- `@beep/govinfo#build`
- `@beep/govinfo#check`
- `@beep/govinfo#codegen`
- `@beep/govinfo#coverage`
- `@beep/govinfo#lint:deprecated-apis`
- `@beep/govinfo#package-test-typecheck`
- `@beep/govinfo#test`
- `@beep/govinfo#test:integration`
- `@beep/govinfo#test:property`

## Incoming 46452d68158d07cb817e3454e892273ef93aa76d

- `@beep/lint-rules#audit`
- `@beep/lint-rules#build`
- `@beep/lint-rules#check`
- `@beep/lint-rules#coverage`
- `@beep/lint-rules#lint:deprecated-apis`
- `@beep/lint-rules#package-test-typecheck`
- `@beep/lint-rules#test`
- `@beep/lint-rules#test:property`
