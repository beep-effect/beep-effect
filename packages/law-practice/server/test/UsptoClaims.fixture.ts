/**
 * Recorded USPTO responses for the `UsptoClaims` adapter test.
 *
 * Synthetic: the documents listing follows the Open Data Portal documents
 * shape and the claims follow the USPTO `<claim>` / `<claim-text>` XML, but
 * the application, documents and claim text were written for this test.
 */

/** Application whose documents are recorded. */
export const recordedApplication = "18900001";

/** Download host the driver accepts: the configured USPTO API origin. */
const downloadBase = `https://api.uspto.gov/api/v1/download/applications/${recordedApplication}`;

/** Documents listing: an older PDF-only claim set, the latest XML claim set, and a later non-claims document. */
const recordedDocumentsJson = `{
  "count": 3,
  "documentBag": [
    {
      "applicationNumberText": "${recordedApplication}",
      "officialDate": "2025-06-10T00:00:00.000-0400",
      "documentIdentifier": "SYNTHCLM1",
      "documentCode": "CLM",
      "documentCodeDescriptionText": "Claims",
      "directionCategory": "INCOMING",
      "downloadOptionBag": [
        { "mimeTypeIdentifier": "PDF", "downloadUrl": "${downloadBase}/SYNTHCLM1.pdf", "pageTotalQuantity": 2 }
      ]
    },
    {
      "applicationNumberText": "${recordedApplication}",
      "officialDate": "2026-03-02T00:00:00.000-0500",
      "documentIdentifier": "SYNTHCLM2",
      "documentCode": "CLM",
      "documentCodeDescriptionText": "Claims",
      "directionCategory": "INCOMING",
      "downloadOptionBag": [
        { "mimeTypeIdentifier": "PDF", "downloadUrl": "${downloadBase}/SYNTHCLM2.pdf" },
        { "mimeTypeIdentifier": "XML", "downloadUrl": "${downloadBase}/SYNTHCLM2.xml" }
      ]
    },
    {
      "applicationNumberText": "${recordedApplication}",
      "officialDate": "2026-04-01T00:00:00.000-0400",
      "documentIdentifier": "SYNTHCTNF1",
      "documentCode": "CTNF",
      "documentCodeDescriptionText": "Non-Final Rejection",
      "directionCategory": "OUTGOING",
      "downloadOptionBag": [
        { "mimeTypeIdentifier": "PDF", "downloadUrl": "${downloadBase}/SYNTHCTNF1.pdf", "pageTotalQuantity": 9 }
      ]
    }
  ]
}`;

/** Full-text claims of `SYNTHCLM2`, with nested claim text, a claim reference and an entity. */
const recordedClaimsXml = `<?xml version="1.0" encoding="UTF-8"?>
<claims id="claims">
<claim id="CLM-00001" num="00001">
<claim-text>1: A lamp comprising:
<claim-text>a base &amp; a stem;</claim-text>
<claim-text>a bulb held by the stem; and</claim-text>
<claim-text>a switch wired to the bulb.</claim-text>
</claim-text>
</claim>
<claim id="CLM-00002" num="00002">
<claim-text>2. The lamp of <claim-ref idref="CLM-00001">claim 1</claim-ref>, wherein the switch is a toggle switch.</claim-text>
</claim>
</claims>
`;

/** `SYNTHCLM1` is only a scanned PDF: a PDF header followed by bytes that are not UTF-8. */
const recordedScannedPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0xff, 0xfe, 0x00]);

/** A native grant whose claims carry OCR confidence data, which the native source excludes. */
const recordedOcrGrantXml = `<?xml version="1.0" encoding="UTF-8"?>
<claims id="claims"><OCRConfidenceData/>
<claim id="CLM-00001" num="00001"><claim-text>1. A lamp comprising a base.</claim-text></claim>
</claims>
`;

/** Recorded responses by URL suffix. */
export const recordedResponses: ReadonlyArray<readonly [suffix: string, body: string | Uint8Array]> = [
  [
    `/applications/search?q=${encodeURIComponent("applicationMetaData.earliestPublicationNumber:US20260100001A*")}`,
    `{
      "patentFileWrapperDataBag": [{
        "applicationNumberText": "${recordedApplication}",
        "applicationMetaData": { "earliestPublicationNumber": "US20260100001A1" },
        "pgpubDocumentMetaData": {
          "productIdentifier": "APPXML", "xmlFileName": "native-publication.xml",
          "fileLocationURI": "https://api.uspto.gov/native-publication.xml"
        }
      }]
    }`,
  ],
  ["/native-publication.xml", recordedClaimsXml],
  [
    `/applications/search?q=${encodeURIComponent("applicationMetaData.patentNumber:10200001")}`,
    `{
      "patentFileWrapperDataBag": [{
        "applicationNumberText": "${recordedApplication}",
        "applicationMetaData": { "patentNumber": "10200001" },
        "grantDocumentMetaData": {
          "productIdentifier": "PTGRXML", "xmlFileName": "native-grant.xml",
          "fileLocationURI": "https://api.uspto.gov/native-grant.xml"
        }
      }]
    }`,
  ],
  ["/native-grant.xml", recordedOcrGrantXml],
  [
    `/applications/search?q=${encodeURIComponent("applicationMetaData.earliestPublicationNumber:US20260100002A*")}`,
    `{
      "patentFileWrapperDataBag": [{
        "applicationNumberText": "${recordedApplication}",
        "applicationMetaData": { "earliestPublicationNumber": "US20260100002A1" }
      }]
    }`,
  ],
  [`/api/v1/patent/applications/${recordedApplication}/documents`, recordedDocumentsJson],
  ["/SYNTHCLM2.xml", recordedClaimsXml],
  ["/SYNTHCLM1.pdf", recordedScannedPdf],
];
