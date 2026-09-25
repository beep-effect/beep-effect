# Knowledge classifier audit bindings

Source SHA: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`.
Result: unresolved public-input contract hold; no qualification/design row.

## Source SHA-256

- `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts`: `d5e890c27397f55dd21d003a13426430b65360ec76d572565e71787a03292aa8`
- `packages/tooling/tool/cli/test/knowledge-refs.test.ts`: `94cf4a86180258f8c938d9a50eb55640ec039c799d2ab6e640d6f6f893298ecb`
- `packages/tooling/tool/cli/package.json`: `917dc5e460d2a61b7a9acdc969bb851e475fd4f74015b43a81ad40a111ee60f1`
- `packages/tooling/tool/cli/src/index.ts`: `19c10f83b6e17ae87269aa30da8f95fb06108e01ef1330f693281b237cd7c6b8`

## Private artifact SHA-256

- `input-inventory.jsonl`: `de0477d42e7c44de5d1f41e869565bce230d2378542f9ed4d1785bf28f69cf38`
- `input-row.json`: `fb5b190578f87331ed9af71d5b27ccf59bf5c05ce8c6472f3fe4b8c6f8ce705f`
- `adjudication-hold.md`: `d8e8dc1027e79f7262327aab03d454a37059b40f04b6b7c4b647ee4161fddc77`
- `classifier-contract-probe.ts`: `bc6a5b74add9354af9b34f5035001c15f1d9fb33b510f2711ddf2ec5fc4c3153`
- `classifier-contract-probe.stdout.json`: `ead2a23bab2c88e87a3e924b27cd53d4e75babc5fe84254c78fffc6a5dc4baa3`
- `classifier-contract-probe.stderr.txt`: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

Searches: Graft symbol query, narrowed status/kind query, callers depth all, exhaustive symbol query; corroborating packages/apps ripgrep and package export inspection.
Graft estimated savings:190792 tokens across4 calls.
No tracked edits, implementation, independent review or dry-round credit.
