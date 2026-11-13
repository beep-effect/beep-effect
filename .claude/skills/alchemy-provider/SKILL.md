---
name: alchemy-provider
description: Bring up a new Alchemy cloud provider (its own `@alchemy.run/<provider>` package under packages/<provider>) end to end — credentials, a distilled SDK, resources, bindings, live tests, and the patch loop that feeds live-test failures back into distilled — or extend an existing provider with a new service, or bring an existing provider up to the bar (gap audit, then waves). Use for "add a <X> provider", "create an alchemy provider for <X>", "port <X> to alchemy", "add <service> to the <X> provider", "bring the <X> provider up to par", or any work that needs a distilled SDK plus Alchemy resources tested against a live API.
---

This repo-local adaptation is based on the [Alchemy upstream skill](https://github.com/alchemy-run/alchemy/tree/main/.agents/skills/alchemy-provider).
Maintain its repository policy adaptations locally; it is not a floating upstream mirror.

# Building an Alchemy provider

Follow the [provider guide](references/provider-guide.md) for SDK generation,
resources, bindings, testing, deployment and review.

Companion references:

- [Documentation](docs.md)
- [Review](review.md)
