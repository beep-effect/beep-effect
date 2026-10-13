### sol-2-1
- file: scratchpad/effected/spdx/SpdxExpression.ts:25
- class: type-safety   severity: required
- standard: `standards/effect-first-development.md` EF-33 requires runtime types to derive from schemas rather than duplicate inaccurate models; Effect `SCHEMA.md`, “Recursive schema with different Encoded and Type,” requires the recursive codec’s encoded parameter to describe its actual wire representation; D11 covers type-safety defects.   evidence: The four recursive suspensions now use `S.Codec<SpdxExpression, SpdxNode>`, exposing this structural union through `AndNode.Encoded` and `OrNode.Encoded`. Its `WithException` arm permits any `SpdxNode` as `license`, whereas `WithExceptionNode` accepts only `LicenseNode | LicenseRefNode`. An in-memory TypeScript compiler probe assigned the following shape to `typeof AndNode.Encoded` and passed it to `S.decodeEffect(AndNode)` with **zero diagnostics**:
  ```ts
  const leaf = { _tag: "License", id: "MIT", plus: false } as const;
  const wire: typeof AndNode.Encoded = {
    _tag: "And",
    left: {
      _tag: "WithException",
      license: { _tag: "And", left: leaf, right: leaf },
      exception: "Classpath-exception-2.0",
    },
    right: leaf,
  };
  ```
  A read-only Node probe of `S.decodeResult(AndNode)(wire)` returned `Failure` with:
  ```text
  Expected { readonly "_tag": "License", ... } | { readonly "_tag": "LicenseRef", ... }
    at ["left"]["license"]
  ```
  The green compiler gate misses this because the widening is a legal annotation; existing round-trip properties generate schema-valid values and never exercise the impossible encoded shape.
- failure: The public recursive encoded types admit compound operands under `WITH` that the schema cannot encode or decode. The round-1 class-versus-POJO repair therefore leaves a distinct structural mismatch: callers can construct a statically accepted wire value that fails specifically because its variant structure contradicts the declared schema.
- fix: Narrow the `SpdxNode` `WithException.license` field to `typeof LicenseNode.Encoded | typeof LicenseRefNode.Encoded`. Keep the recursive suspension annotations and runtime schemas unchanged.

REQUIRED: 1
BACKLOG: 0