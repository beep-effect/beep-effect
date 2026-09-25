# TemplateContext P2 refresh audit

Source/main: `0be1f13d62fa00cb65e34ff69ec99043380f8d81`.
Private proposal only; no canonical/product changes, no P3.

## Findings

The full connected product remains 3×5×9×6×2048 = 1658880; legal states are 22 nonapp and 9 app. Arbitrary string payloads excluded from finite projection, preserved whole. No-family nonapp remains possible with explicit valid parent override. Family tooling kind need not equal type. Lab requires real app; no runtime-proof lab. Stories admission is independent and does not narrow ordinary foundation/tool pairings.

Exactly five shipped template conditions consume four flags: nextjs, tauri, lab, ecosystem (twice). No shipped template consumes the other seven flags or the raw classification fields. Sole construction remains1479. Generic TemplateRenderRequest remains S.Record(S.String,S.Unknown), noEscape true. Public class exports remain a real decoded API migration; external users are not claimed absent.

Current helpers changed: package(kind,stories) no longer takes path parameters; app(dev,build,lab) keeps full strings. Canonical audit now lint:laws. Updated design removes stale API/output claims. Shared file coordination with ScaffoldShape owner: no duplicate deletion credit.

## Verification scope

Read current declaration, full validation/constructor path, helper/manifest routing and template service; searched all shipped templates. Private cardinality enumeration verifies source-derived grammar arithmetic, not CLI or render execution. Required31-case generated-byte comparison remains an implementation obligation. No product/package tests run because no package files edited.

## Inputs

- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts`: `114634462e491e27c25477578d32008bdac6a2c7094d404d7484c8d0b21b1c7a`
- `packages/tooling/tool/cli/src/commands/CreatePackage/TemplateService.ts`: `70e5e1544cf16a5ad2b16ff024c82dd4d3a60a5fcd6f8d556f858b23265e04cd`
- `packages/tooling/tool/cli/src/commands/CreatePackage/index.ts`: `4097f8871b5b25b21611d31fa04d59fa434fbb456f25ebb2c59e13f45bc43482`
- `packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts`: `9218eed2950ca30dece0f9d7d48ebd9bc878a25d84fd5e777fc888fa03acfe84`
- `packages/tooling/tool/cli/test/create-package.test.ts`: `1a1319aae82bdd1378648650dd9023f865920defc682f641e1ebcc9573c3aefe`
- `packages/tooling/tool/cli/test/create-package-lab.test.ts`: `cf28342b051cd9a80b5ddf8f214c0243c182e2b5e8102acd69ea576a155d7f13`
- `packages/tooling/tool/cli/package.json`: `917dc5e460d2a61b7a9acdc969bb851e475fd4f74015b43a81ad40a111ee60f1`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/AGENTS.md.hbs`: `c85e45afd2ea87d8de5cf4a57e3fbada3162a2a8db601b2dea3b21ce5b040182`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/LICENSE.hbs`: `4c3826f9d83ba73340bae3df41dedb5333991ed4626b04580878617b5bf65807`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/README.md.hbs`: `7434c165e5decff5d516950cd01029b78d12a1eb752701d6c93bd85e9cd42ea7`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-next-lab-next.config.ts.hbs`: `c38a4d1f7ff16a5217da936ac7eb102c35026c0ebdde653c7a56b516fbab4610`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-next-lab-postcss.config.mjs.hbs`: `2ee9434af4fb47623ea9254b1b710f9110ec3befbf449591dadba2e5500344ea`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-next-lab-src-app-globals.css.hbs`: `19b011e8d6e12c1a414fef2493426f98eea4501b09e3555be4e2d057b63f57fd`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-next-lab-tsconfig.next.json.hbs`: `669b6a6d4e2124a4663af6afd49a27abdebf6360bcfe8a71ae0616c284f6c5c1`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-next-next-env.d.ts.hbs`: `e95800745f8e1171c294cfa6b29d663d557493989a26a7c44f32361ee468813b`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-next-next.config.ts.hbs`: `ab4c61f6ee100ae43610a18512f1ebcec842bb2405431e1009266173f21cf772`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-next-src-app-globals.css.hbs`: `1a8753f8a84a07a2ba4e4da6eee66eda571c5ce190d01bd23bac18f70899b47c`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-next-src-app-layout.tsx.hbs`: `217b79987685cf6ea8c6862fa90266a5e550740795be707ba4f0e3522be4d78e`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-next-src-app-page.tsx.hbs`: `a3e75168bd8b571c2b158c34549242baa17c4c7beb22629a3150a06b8732979f`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-next-test-app.test.tsx.hbs`: `48ebad42ebbe139f929429145a01e97fb49dbe9f80f8bc10be35a2c89115cf1e`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-next-tsconfig.json.hbs`: `d84a91f5ae46266eb2964426a413fa45252f76305ad27200e946d1ffd8991ae9`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-next-vitest.config.ts.hbs`: `cc07f894b6055ae78b3f0f78928ee2f28ddfc6c351912d696526f0de0df802f7`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-real-AGENTS.md.hbs`: `7a74f78671ac103ca1ecfabbd59a433bff061076375f0c188325c935f75aa8be`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-real-README.md.hbs`: `c0e9ad58e9c4b2595329047ecf5fe4a3d5fa4ff7b3106bd33a0777e8fb066f46`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-service-src-Api.ts.hbs`: `f487d1ce880c61d286db24868109d5f38335dff0fb439df3e1b9ff56f9490ff7`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-service-src-main.ts.hbs`: `1b33ec43818924a9030e74b2861f47cc45639041ece3b50b6ff125326b6eb5ce`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-service-src-runtime-Layer.ts.hbs`: `7c46e55a773eb004448a5557bf617ba9f3b70519770e4663705644ce905b1466`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-service-test-health.test.ts.hbs`: `64fd6ccdc79fa7c5376604166d6fc60c82faa917b815ff576a4174dd4eb987e0`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-service-tsconfig.json.hbs`: `d4031af003d9cebd1487dada80ee78283c6c68a72f1daab9dc34fe8910cea95a`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-service-vitest.config.ts.hbs`: `a956444418f643c16c5cb1b8c3e70628a76af3bf9bdd7047de42b0c73c3a552b`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-index.html.hbs`: `13d58eb6adc363278cb4cfe0160cade85e1f42ffeee4851d500262337dffeff9`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-src-App.tsx.hbs`: `15b69a6714acd4bbc1b178356631b1e630c4448f7163b2f6a801de09f781f298`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-src-main.tsx.hbs`: `2f7505f0df3560bff0c325f3d77f4080f10a8213b96ba99883a615408c82029b`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-src-tauri-Cargo.toml.hbs`: `019e49ec21a8e29b05ebbda227436fb768b702f52e980b360f285d609c967032`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-src-tauri-build.rs.hbs`: `b01bb80b64916f502a3033afdb4567227ef2abcc3b938889f02283aefa780fbe`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-src-tauri-capabilities-default.json.hbs`: `09af8956ac5ac2c73b2ac061b05685dd6127699fdce7175698c69ae87d8738e4`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-src-tauri-src-lib.rs.hbs`: `804a9dee766ae6352fa8896da7780304fd77a722189235a596da945b32b9e71b`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-src-tauri-src-main.rs.hbs`: `fa2840b447c24acb2027e98f79984b267ade1d47055092285d46bee433915b67`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-src-tauri-tauri.conf.json.hbs`: `d19251c91f265f3a7df7bdc10c68ef800fdab644c3176c71d654db3930108582`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-test-App.test.tsx.hbs`: `90b3832f802ad5827b0a15e54866fd3e1804cf8f87b86a2cb9748a8335e184bd`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-tsconfig.json.hbs`: `82969c8c35cb87e6437b28421acf54ec75b811ca66f93aadd695bcb014ce01f8`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-vite.config.ts.hbs`: `f0df6a4706ef5d3c4c4ece6bd4f0bc80b2c6a4d130a18cadbfcdc943dc262cf3`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-tauri-vitest.config.ts.hbs`: `cc07f894b6055ae78b3f0f78928ee2f28ddfc6c351912d696526f0de0df802f7`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-vite-index.html.hbs`: `13d58eb6adc363278cb4cfe0160cade85e1f42ffeee4851d500262337dffeff9`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-vite-postcss.config.mjs.hbs`: `2ee9434af4fb47623ea9254b1b710f9110ec3befbf449591dadba2e5500344ea`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-vite-src-App.tsx.hbs`: `0d69ab89a272d9e876ba028c4d76d2547ee17bc6dd4439620ba6b39bc432d79e`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-vite-src-main.tsx.hbs`: `931dd98be5250dfbf7cf5415dbe85d8f7006c3cfa413123332ed69cb4da748c9`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-vite-src-styles-globals.css.hbs`: `1130591d0d571f9283a4f9a414974f3e270078c356af594fa958c8975417f5d8`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-vite-test-App.test.tsx.hbs`: `84af18feef677c65a5fc195e8b53d4032811ac95d3262cf233aaa4cf207b8b39`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-vite-tsconfig.json.hbs`: `82969c8c35cb87e6437b28421acf54ec75b811ca66f93aadd695bcb014ce01f8`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-vite-vite.config.ts.hbs`: `bdb98d63e58e594184d1f1325fd45b9e158ac113904f8ef927cbc8482e9ed6e7`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-vite-vitest.config.ts.hbs`: `cc07f894b6055ae78b3f0f78928ee2f28ddfc6c351912d696526f0de0df802f7`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/docgen.json.hbs`: `ff963d3d97781d18a629471fd19fe91922d527aea3e58871ebaf52deb3333684`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/docs-index.md.hbs`: `ba76a2f867d8dea95282295085588d301603c1897cd205dc9b3fdcafee7e9410`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/src-index.ts.hbs`: `7707301486b458b229018a044678b56e91542cee72829be62763c2982352074e`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/stories-tsconfig.json.hbs`: `c2d7ce7734d76cd3cfa73c8ee7ccfdea927bc2ebb93553becbf0335ceef2fb33`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/tsconfig.check.json.hbs`: `01ef0df6f36d222343425768f3b1a0c59ab23a1bcb85bd205f25f62ebf7d87c7`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/tsconfig.json.hbs`: `8bcd7adfb2e7514ddf27c665139ee7b0d045c7f5abff614cd14c81a377e7a7bf`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/tsconfig.stories.json.hbs`: `8998861f2bc4a7cd25ce5df0db9a5b0e9db8b34620465db801d4859c694e596a`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/tsconfig.test.json.hbs`: `c180e9d9e802af650e337114af05304f29b51065e64b50cc7eb692939d23bb25`
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/vitest.config.ts.hbs`: `b5b0d0dcc1471bb05e8669bc44bf1c24d901ed073411cd311747964d4a5c4560`
- `inventory.before.jsonl`: `dd959f534b7bb48876562fea0d8f31a5fd8a3415e7eb4260ef4414e2d9380135`
- `design.before.md`: `7d29f38242357bbce99f5ea3702490eefbbec2d87d6eb49731ab3e01b667193a`

## Outputs

- `proposed-design.md`: `832ce7578791adee0a6d0599bd15f2905fba8f2fcc65d6e8377c74bf74faa938`
- `proposed-row.json`: `24cc40e107a33dd6786d0f7cfc88fb19e4347daff971bec1290432d273af2ae3`
- `cardinality.json`: `da53cd7f97386aa6745fdfd843e27197541ee10b48fbf9e198681d72357042ad`

Graft estimated savings:40708 tokens (two successful retrievals; one unindexed template-scope probe saved zero).
