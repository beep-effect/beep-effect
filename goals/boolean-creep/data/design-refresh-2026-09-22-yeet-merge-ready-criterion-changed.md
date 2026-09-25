# Criterion changed P2 audit

Source/main0be1f13d62fa00cb65e34ff69ec99043380f8d81.

## Findings

Full4/2 event relation; snapshot observation pairs remain4/4. Public truthful-flip documentation gives semantic evidence independently of writer. Structural schema accepts equal pairs; strict proposed codec narrowing needs explicit P3 compatibility adjudication, not automatic approval. Public schema and union both require legacy wire projection; no separate new-shape public codec loophole.

Current union has9members, not8; settle events last, and head changes preserve applicable settle event. schemaVersion constructor default is not decoding default. at is arbitrary string. Exact metadata and criterion order preserved.

## Scope

Source/fixtures inspected only; no Yeet jobs/proofs/runtime executions or source edits. Existing equal snapshot suppression and8rising event fixture are not full codec matrix proof.

## Inputs

- `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts`: `48b34e69f1d1271f0413cde95f5c18e01fcd271a47d26142205b39a2a53a6eb5`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchMode.ts`: `2901cc8089141165e08b3e970c311e82ca8314ecd107fa408f61a032d7ca2091`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts`: `15a433e966df6aa8a1be309d3437173c1cc39d9eb48257a9af2b6a8304db6987`
- `packages/tooling/tool/cli/src/test/Yeet.test-kit.ts`: `6d3edb17e97282bd7d3fe27b3e9bac59885244b04305a6e5e0e6fb8a6a637afe`
- `packages/tooling/tool/cli/test/yeet-watch-stream.test.ts`: `ee5b8411f739e414f2345a9063eadb9f6a8a112a752e2a20951b62b4fcaf0501`
- `packages/tooling/tool/cli/test/yeet-watch-mode.test.ts`: `c4b488bbcb79396cedc6670722528e6f3408be8844fbc4c60f4ce8f57ea499f3`
- `packages/tooling/tool/cli/package.json`: `917dc5e460d2a61b7a9acdc969bb851e475fd4f74015b43a81ad40a111ee60f1`
- `inventory.before.jsonl`: `23e70595917673b3d8f708303e50b7f6adbb9b751b8a51a3270edc0e312f8e01`
- `design.before.md`: `88966e73c1f862f70c98730d6ce5f05cd2d80827629a89ee6e702b62a102bb47`

## Outputs

- `proposed-design.md`: `229a9f5f96532c43badf1dd3bf75198305c8f7226f30b0e3f5f1bd4de89ba7e0`
- `proposed-row.json`: `57ec7a207632f79193ac76b4d916d38c6915a03cb92d4769f118806ebd84a399`

Graft savings89174tokens,2calls.
