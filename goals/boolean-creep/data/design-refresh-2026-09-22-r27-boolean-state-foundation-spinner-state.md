# Spinner state P2 audit

Source/main0be1f13d62fa00cb65e34ff69ec99043380f8d81.

## Findings

Full8/4 timer-presence/runOnce quotient unchanged. Public signature now actions bag at163. Four stored states remain closed under every writer, including reentrant callback interleavings; no resource exclusivity guarantee inferred. Preserve one captured command state, old closure params, immediate callback errors skipping scheduling/write, timer delay/no immediate timeout callback, zero handle, latest-state cleanup and both mounts. No callback normalization or reentrant repair authorized.

Original schema snippet risked losing specialized methods after annotation; revised named cases + annotated S.Union then toTaggedUnion. No executable implementation produced. Existing helpers tests inspect number input, not lifecycle. Browser QA and package verification remain implementation obligations.

## Inputs

- `packages/foundation/ui-system/ui/src/hooks/useSpinner.ts`: `cb92fa1aa992b3862f58d9dbfd3c25afcbf44d1be6a361ce5aa3e9981f51a24e`
- `packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts`: `26fa0bd3e95f5eda17b5b3ebd2d6855b5cef59e213151c0b74567b7232ec4fe8`
- `packages/foundation/ui-system/ui/src/hooks/index.ts`: `cd92311826b4a77155a03dcbbea13bf05bb0e2edbebea826987fce19e2843846`
- `packages/foundation/ui-system/ui/test/hooks.test.ts`: `71534e591d7adf26e92e7cc12fd2852927f9f5fc893853bffc05bb859606573e`
- `packages/foundation/ui-system/ui/test/schema-parity.test.ts`: `8b7857db13432d4bda5ed3a1f282cb5b48e7eb69dd0c2cb0f5fa84bc5406d523`
- `packages/foundation/ui-system/ui/package.json`: `9baf503edbe53af81000116bef925d5546db8c1be1fe913ba9c37d3d8f98e944`
- `packages/foundation/modeling/schema/src/SchemaUtils/withLiteralKitStatics.ts`: `8359e2c68161e01fba2e93bbac6f5fc522cf869ca3c0fa6a20703509d883c707`
- `inventory.before.jsonl`: `a855479f1664aa3ec732645113bb91f637095e2115cc65ec9260d76a82965178`
- `design.before.md`: `49967cae339aa2f0a5e010b3770df2a2b6b5b4b56aa278c1574599c253eb1ea1`

## Outputs

- `proposed-design.md`: `b4e85ca55268012858b241d7adbded00eed209c75fdc3d0ca5b2c71bb67c8bd7`
- `proposed-row.json`: `e4dd0a4fe69d651957384939e1433efce45a7f5a71c0de6b0c4f80c9ac811383`

Graft savings44887 tokens,3calls. No canonical/source/runtime changes.
