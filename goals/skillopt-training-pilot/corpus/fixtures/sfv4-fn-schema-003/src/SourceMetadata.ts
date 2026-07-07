export interface SourceMetadataInput {
  readonly owner: string;
  readonly sourcePath: string;
}

export interface SourceMetadata {
  readonly generatedBy: "sync-data-to-ts";
  readonly owner: string;
  readonly sourcePath: string;
}

export const makeSourceMetadata = (input: SourceMetadataInput): SourceMetadata => ({
  sourcePath: input.sourcePath,
  owner: input.owner,
  generatedBy: "sync-data-to-ts",
});
