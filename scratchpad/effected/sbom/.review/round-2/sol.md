### sol-2-1

- file: scratchpad/effected/sbom/InTotoStatement.ts:520
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D5/D11.   evidence: At commit `60fcfb5ebcdc26765a66cc1f13afc88adcb05d11`, `toJson` still declares its configuration as the handwritten shape `{ readonly space?: number | undefined }`. The existing `SbomJsonOptions` schema and its derived type represent exactly this shape. Round 1’s r5 addressed eight named input/configuration interfaces; this anonymous configuration shape was outside that finding. The green gates therefore leave this schema-source-of-truth requirement unenforced here.
- failure: The public statement serializer maintains an independent configuration model instead of deriving it from a schema. Its indentation contract can drift from the existing schema-backed JSON options contract without creating a shared type obligation.
- fix: Add a type-only import of `SbomJsonOptions` from `./Sbom.ts` and use `toJson(options?: SbomJsonOptions)`. Retain the statement’s default indentation of `0` and its current validation boundary. The type-only import adds no runtime dependency.

REQUIRED: 1
BACKLOG: 0