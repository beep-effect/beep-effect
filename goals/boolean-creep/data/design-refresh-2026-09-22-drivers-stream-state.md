# StreamState P2 audit

Source/main `0be1f13d62fa00cb65e34ff69ec99043380f8d81`.

## Findings

Full8/6 relation confirmed through abstract closure respecting same incoming text state per chunk and independent finish/usage/reason presence. Public callbacks do not restrict chunk order to normal providers. Finished does not stop choice processing; open+finished is possible and later choices may close it. Preserve current duplicate start/end semantics for multi-choice/late-choice streams. Only schema text pair changes; full payloads and independent finished latch stay.

## Scope

Read private class, complete transition and onHalt path, public makeFromProvider callback boundary and wildcard barrel; package-wide Graft occurrences resolve private state uses to one module. Existing text/trailing-usage fixtures inspected. Abstract projection is not runtime test. No source edits or package tests; independent review pending.

## Inputs

- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts`: `6a16aa7aae8d67d3a00160b4375859454ea6d4b3b2b79cc579adee95015cb479`
- `packages/drivers/openai-compat/src/OpenAiCompat.models.ts`: `ce2d9ad62885ee4ee748557c02d6e37bddbf0530010accd55444b099bbbfae36`
- `packages/drivers/openai-compat/src/index.ts`: `82b3ddb6139e39c4d6b0618c4c57c035e9d4e84d33de98794a67f6e33c0b36a3`
- `packages/drivers/openai-compat/test/OpenAiCompat.language-model.test.ts`: `ed1d3d076f7f92b21b19eee7b2c11f848715541ff5326ce09950f3f037d8d25a`
- `packages/drivers/openai-compat/package.json`: `512e749dd6e7aa8787516e3ce78de48c018abeacc0c5f85ae451c3ff1473654c`
- `inventory.before.jsonl`: `22f6452596f96f7e5a0545ddcddb751ae5518fe3553e260c4338b52af59e7343`
- `design.before.md`: `fa1ab266f5bc33a1fe7d9c628de001c388057d4c730283752445144a2f78fff6`

## Outputs

- `proposed-design.md`: `7fb0cf6a0becf1dde711db6241568946d360dd8f328ed7a4f174884839abd5ca`
- `proposed-row.json`: `40dc41416f6f9b3d07f76476d008ccf86fdd5739b9044e60e6ae536cf38612a8`
- `finite-projection.json`: `2c4046ed7e9369b72b0f53b26e2a1fb5ecc64a4cc146869744b142d68c89909c`

Graft savings39539 tokens,3 calls.
