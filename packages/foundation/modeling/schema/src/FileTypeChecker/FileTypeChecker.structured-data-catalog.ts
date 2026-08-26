/**
 * Internal structured-data entries for the file-type catalog.
 *
 * @internal
 * @since 0.0.0
 */

import { makeCatalogFileTypeInfo } from "./FileTypeChecker.catalog-constructor.ts";
import type { FileTypeInfo } from "./FileTypeChecker.schema.ts";

type StructuredDataFileType = "orc" | "parquet" | "pcap" | "sqlite";
type StructuredDataCatalog = {
  readonly [K in StructuredDataFileType]: FileTypeInfo & { readonly extension: K };
};

/**
 * Internal structured-data metadata keyed by canonical extension.
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const structuredDataCatalog: StructuredDataCatalog = {
  orc: makeCatalogFileTypeInfo({
    extension: "orc",
    mimeType: "application/x-orc",
    description: "Apache ORC (Optimized Row Columnar) file format for columnar storage",
    signatures: [
      {
        sequence: [0x4f, 0x52, 0x43],
      },
    ],
  }),
  parquet: makeCatalogFileTypeInfo({
    extension: "parquet",
    mimeType: "application/vnd.apache.parquet",
    description: "Apache Parquet file format for columnar storage",
    signatures: [
      {
        sequence: [0x50, 0x41, 0x52, 0x31],
      },
    ],
  }),
  pcap: makeCatalogFileTypeInfo({
    extension: "pcap",
    mimeType: "application/vnd.tcpdump.pcap",
    description: "Libpcap File Format",
    signatures: [
      {
        sequence: [0xd4, 0xc3, 0xb2, 0xa1],
      },
      {
        sequence: [0x4d, 0x3c, 0xb2, 0xa1],
        description: "Nanosecond resolution",
      },
    ],
  }),
  sqlite: makeCatalogFileTypeInfo({
    extension: "sqlite",
    mimeType: "application/x-sqlite3",
    description: "SQLite database file",
    signatures: [
      {
        sequence: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00],
      },
    ],
  }),
};
