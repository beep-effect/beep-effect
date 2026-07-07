import * as S from "effect/Schema";
import * as ST from "effect/SchemaTransformation";

export class SourceMetadataInput extends S.Class<SourceMetadataInput>(
  "SourceMetadataInput",
)({
  sourcePath: S.String,
  owner: S.String,
}) {}

export class SourceMetadata extends S.Class<SourceMetadata>("SourceMetadata")({
  sourcePath: S.String,
  owner: S.String,
  generatedBy: S.Literal("sync-data-to-ts"),
}) {}

export const MakeSourceMetadata = SourceMetadataInput.pipe(
  S.decodeTo(
    SourceMetadata,
    ST.transform({
      decode: (input) => ({
        sourcePath: input.sourcePath,
        owner: input.owner,
        generatedBy: "sync-data-to-ts" as const,
      }),
      encode: (metadata) => ({
        sourcePath: metadata.sourcePath,
        owner: metadata.owner,
      }),
    }),
  ),
);

export const makeSourceMetadata = S.decodeUnknownSync(MakeSourceMetadata);
