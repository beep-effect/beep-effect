# toml-test corpus (TOML 1.1.0 subset)

Vendored fixtures from the official language-agnostic TOML compliance test
suite.

- **Upstream:** [toml-lang/toml-test](https://github.com/toml-lang/toml-test)
- **Tag:** `v2.2.0`
- **Commit:** `ce08da1ddb075d1c7596d663c7fcba9a2ae02c5c`
- **Fetched:** 2026-07-19

## Subset

Upstream's `tests/files-toml-1.1.0` manifest lists exactly which `valid/**`
and `invalid/**` files belong to the TOML 1.1.0 spec (released 2025-12-24).
Only the files named in that manifest were copied into `valid/` and
`invalid/` below. The 1.1.0 tree is not a superset of the 1.0.0 tree it
replaced: twelve files are invalid under 1.0 but valid under 1.1 (optional
seconds, inline-table newlines and trailing commas, `\xHH` byte escapes), so
the two subsets cannot coexist in one corpus.

## Counts

- **214** valid `.toml`/`.json` pairs under `valid/`
- **467** invalid `.toml` files under `invalid/`

Every `valid/**/*.toml` has a sibling `.json` holding the tagged expected
value (for example `{"type": "integer", "value": "1"}`); `invalid/**/*.toml`
files stand alone and are expected to fail parsing.

## License

The toml-test corpus is distributed under the MIT License, copyright (c)
2018 TOML authors:

```text
The MIT License (MIT)

Copyright (c) 2018 TOML authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
