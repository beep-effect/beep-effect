# M365 retryability P2 refresh audit

Source SHA: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`. Private proposal only; no canonical/product changes, package proof or P3 review.

## Immutable inputs

- Private `input-inventory.jsonl`: `41bd12478546af93581a4ef6d1dc3493aae50930d49c3fcb254d43845f903171`
- Private `input-design.md`: `47816a65ea4b956c0217864cbb60fc265e7c7511423db3d7af70aeafcc1ec4c1`
- Private `input-row.json`: `8db2c5a3c5fa8f62ad1b081c6f0077433d0120eb9dd4a05773165bc132ee2f2b`

## Source bindings

- `goals/boolean-creep/SPEC.md`: `9df7ebe63b9c7c1e253892ff1b36600baa8b22f7c6598617e7e8995575ad5087`
- `goals/boolean-creep/DECISIONS.md`: `e6851a394568acf774d51b2d840635b8f4fbee200dd346d26bc82dbef624ea8d`
- `packages/drivers/m365-mcp/src/M365Tools.ts`: `ec432d8c22ace8a8aee94d594632a4f299a1320aea26a88c374af6c81853e860`
- `packages/drivers/m365-mcp/src/M365Handlers.ts`: `60857801be3d977c63f971b31dc3340d0f81528fa0e5df04e7f775c53b2b3957`
- `packages/drivers/m365-mcp/src/index.ts`: `b2c5a684ad809c9e8ea90e48b2d7aa205ed934e560f215be229b672910efa870`
- `packages/drivers/m365-mcp/test/Server.test.ts`: `02397a0970cb0cfb7dacafdfb112ede91383d3544e91cbeccd8fe39d7dd88428`
- `packages/drivers/m365-mcp/package.json`: `f6232b851e388c7dacb5c51f11d42e1115f695faff490bb9bf2f868dcad04adc`
- `packages/drivers/m365/src/M365.errors.ts`: `c981ba50095ba8cc6ec463973356f43999ae4ef09bd3881859a81019816f7003`
- `packages/foundation/modeling/schema/src/SchemaUtils/withConstructorDefaults.ts`: `e7ce42e18be6fa70eed37b50d2d9f16218e176fda6329195be4bc2ac88c4f9cb`
- `.repos/effect/packages/effect/SCHEMA.md`: `4ad8e16a92cbefc9c7cc9759f982645a6a4802fdb18eb2b5f7755f2d30f652a9`
- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`
- `.repos/effect/packages/effect/src/SchemaTransformation.ts`: `3c2d0b6100eae360ce29b27e42f197bfcea2b6b0a9d13a7c65a3de74a8405d12`
- `.repos/effect/packages/effect/src/SchemaIssue.ts`: `ed0969e0bf569a29a045c40e76db1e112ec470b1d5dfd69506eb3bfd02da288a`
- `bun.lock`: `acba0f05d1f3c47cb1a67598f992b80a8b4b96dada74c267d810c2fb1e1e4794`

## Audit findings

- Cardinality remains 18/9. Current codec permissiveness is not business legitimacy: sole production policy gives eight reason projections and the explicit None/false fixture gives the ninth.
- All eleven Tool.make declarations use this failure codec with return failure mode; all eleven handlers use the same finalizer.
- Correct concrete design uses private semantic S.Class with runtime Option and constructor-only None default, plus exported legacy decodeTo schema and same-name Type alias. An arbitrary transformed schema cannot be passed as Class Struct input.
- Current local Effect decodeTo preserves target make/input type; prototype .make produced a class instance and omitted reason became None.
- Baseline and prototype encoded all nine legitimate values with identical JSON bytes; prototype rejected all nine inverse policy tuples that baseline admitted. Five malformed boundary cases retained rejection parity.
- Public decoded class-to-codec surface is a deliberate migration, not blanket TypeScript compatibility. Known consumers use .make; no alias or retryable getter should retain redundancy.
- JSON Schema/tool conversion and actual stdio failure protocol remain implementation verification obligations; private prototype does not satisfy package or MCP integration proof.

## Probe execution and limitations

Executed codec-probe.ts using Bun eval from repository root (so workspace aliases resolve), capturing codec-probe.json; exit 0. It uses installed Effect plus current M365 source and old schema fields, creates private prototype only, and asserts finite projection equivalence. No network/service credential or MCP server was used. Initial exploratory default-constructor probe incorrectly supplied a function to withConstructorDefault and failed; corrected to existing SchemaUtils.withNoneDefault after checking its Effect-valued API. Final saved probe uses that canonical helper and passes.

## Outputs

- Private `proposed-design.md`: `46713b6b1747d1c71fb33e3ae7e0a1e5e00963371dda4d358ab79580f692abf3`
- Private `proposed-row.json`: `05dfcce4f7a1eeb316b3c4bf50310ad00f69b69fdd2af39868e5f225e21145bc`
- Private `codec-probe.ts`: `03c8498af33e0c09eea1135ae2627e5b4b3d7c7465b13b4032b14a13066eb9f2`
- Private `codec-probe.json`: `c65bdbd36f4bbd668170bb9f5ffdcbdb3371fde1294588a38b40078beb811eb9`

Graft estimate: 47279 tokens saved across two calls.
