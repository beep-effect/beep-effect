import * as S from "effect/Schema";

export const SourceMetadataInput = S.Struct({
  sourcePath: S.String,
  owner: S.String,
});

export type SourceMetadataInput = typeof SourceMetadataInput.Type;

export const SourceMetadata = S.Struct({
  sourcePath: S.String,
  owner: S.String,
  generatedBy: S.Literal("sync-data-to-ts"),
});

export type SourceMetadata = typeof SourceMetadata.Type;

export type MakeSourceMetadata = (input: SourceMetadataInput) => SourceMetadata;

export const makeSourceMetadata: MakeSourceMetadata = (input) => ({
  sourcePath: input.sourcePath,
  owner: input.owner,
  generatedBy: "sync-data-to-ts",
});
