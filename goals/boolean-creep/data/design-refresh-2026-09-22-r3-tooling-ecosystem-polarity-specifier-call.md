# Ecosystem call-kind P2 audit

Source/main0be1f13d62fa00cb65e34ff69ec99043380f8d81.

## Findings

Full4/3 private AST relation independent of in-repo producer reachability: ImportKeyword cannot be Identifier. Public source inputs remain arbitrary. Classifier preserves exact syntactic require, including shadowing, without semantic binding checks. Visitor return is not skip/stop, so nested calls continue. First argument only; template head only; exact prefix. Static imports then exports then calls order and duplicates remain.

## Scope

Read source owner and public wrapper, options/output/error schema and existing source-edge fixture. No parser/lint/runtime tests or product/canonical edits. No P3 credit.

## Inputs

- `packages/tooling/tool/cli/src/commands/Lint/EcosystemPolarity.ts`: `1622d3aed9308b58062c0c22aad704441935570733d056e4afe15d591f52c2e4`
- `packages/tooling/tool/cli/src/commands/Lint/index.ts`: `7c5f571be1ae0404b6425725a4fa2dba61847d629405b32184f23574ef66a798`
- `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts`: `811fb1a59b624398bbf188e6a06931d7b361bec4f4c470c95a126d7ab2ed602f`
- `packages/tooling/tool/cli/test/ecosystem-polarity.test.ts`: `bd3ab1dc70d36c456623c87134c7b29434a46911bb8ad835ff6d487e10d989d2`
- `packages/tooling/tool/cli/package.json`: `917dc5e460d2a61b7a9acdc969bb851e475fd4f74015b43a81ad40a111ee60f1`
- `inventory.before.jsonl`: `23e70595917673b3d8f708303e50b7f6adbb9b751b8a51a3270edc0e312f8e01`
- `design.before.md`: `a92c2ac0d5b7ed337ec3edcb3de33656fb157fad5a82dfa2e298827f5e5dba6e`
- `decisions.before.md`: `e85016058ca6000aa1309eaa7a737566ba1ddef4141509df0b39c693ff4306d9`

## Outputs

- `proposed-design.md`: `eea72d606cd941824f958f62d34aae0f00e2a1748f4ca98921822b1531db1544`
- `proposed-row.json`: `4d3e6d27eeb37b468721a16cf13ecc31db1803ac9a823172fa41b59676450f87`

Graft savings25430tokens,1call.
