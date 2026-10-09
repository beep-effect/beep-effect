# Byte-parity fixtures

Real manifests from this repository (copied verbatim, tab-indented), paired
with the output of `sort-package-json@4.0.0` for the same input.

- `*.input.json` — the manifest as it sat in the repo when the fixture was
  frozen (`root` = the repo root `package.json`, the rest =
  `packages/<name>/package.json`).
- `*.expected.json` — the result of running `sort-package-json@4.0.0`
  (`sortPackageJson(inputText)`, default options) on the input **once**, with
  the process cwd inside a pnpm workspace so its package-manager detection
  resolves to non-npm (plain code-unit dependency sorting). Committed as
  frozen oracle output; `sort-package-json` is deliberately **not** a
  dependency of this package.

`Format.test.ts` asserts that `Package.decode(input).toJsonString()` with
`indent: "preserve"` (and `"tab"`) byte-equals the expected output.

To regenerate (only when intentionally re-baselining against a new
sort-package-json version — update the version above and the `KEY_ORDER`
provenance comment in `src/internal/format.ts` together):

```js
import sortPackageJson from "sort-package-json";
writeFileSync(`${name}.expected.json`, sortPackageJson(readFileSync(`${name}.input.json`, "utf8")));
```
