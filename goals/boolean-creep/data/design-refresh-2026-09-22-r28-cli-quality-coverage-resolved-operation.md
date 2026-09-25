# Coverage resolved-operation P2 audit

Source HEAD: `0be1f13d62fa00cb65e34ff69ec99043380f8d81`. Private artifacts only.

## Exact input bindings
- Private `inventory-before.jsonl`: `b276f0b0ffccccc39779394df44c219945a091dd5fdea8513daa66049ffc6ed5`
- Private `design-before.md`: `1cb10d65bbf46f88cb4a59271dde3e0395b171c275fe6670206a48575c22ea61`
- Private `row-before.json`: `eede033e796dee4c5e53bf77d5cc887adf94e8b97fa603bbf9dd91bb2a71e8fa`
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`: `c64ec0e4b0113fe376cdc8a55cff5b0db6f45da6026c8eab6271197a77d92124`
- `packages/tooling/tool/cli/test/quality-tasks.test.ts`: `9ab84576de8a94dec07f35d0b483f4e92dcafafec3f17437e8db96eb10fdc515`
- `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts`: `83ecc7398db34c8db8f47fdd602b63059cb7c053dbdbf47a665bb02b77194c38`
- `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts`: `68eeb73990fcc024618c520287c29dd7d64b85c63b19907f597b2b2a5ca5de8f`

- `packages/tooling/tool/cli/src/test/Quality.test-kit.ts`: `5f1b6dad7ae20d94f7002db5834bee869019d933fe8bb48cc747299e2cf2dc81`

- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`

## Findings

All nine supported tuples retained, including scoped-replace and noop-replace. Raw parser remains broader than resolved domain. Required arrays and absent/empty topology distinctions retained. Existing Tasks changes only affect downstream cache-runtime execution and line offsets; design now explicitly preserves the launch wrapper rather than treating planned bunx command as the actual process command. Test changes reviewed, not executed. Scope and regression sources byte-identical to prior design binding.

Proposed migration removes four resolved Boolean fields; raw parser fields and real boundary guards retained. Report-only eligibility stays ahead of noop, with no cleanup/write on noop. Full args and payloads retained. No package source changes, runtime tests, P3 or implementation credit.

## Outputs
- Private `proposed-design.md`: `08ec72ad8140ba79a67ce1f67ccded81296e5e7d217f8053f701e5f7ee39df9d`
- Private `proposed-row.json`: `222cf12b42ebfbd9da4b1ed379c5dc5e0719ce1770dab2cf3b349a2c49b3308c`
- Private `projections.json`: `533138c0a6ef2ae5d3c8ca38352e3c25ee746d20e98ee93a2ad312a40be2c1ac`
- Private `source-delta.json`: `c53faa4af09e3877fdb3eb16d4a3f7f9178a81465d79ddf9df7c15567803c074`

Graft: three calls, estimated153,206 tokens saved.
