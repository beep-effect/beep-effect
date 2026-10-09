# Contact census (offline)

The job parsed four byte-identical CSV copies once. Hash prefix matches ruling R5.
VCF counts are census-only; no VCF contact will be seeded.

```json
{
  "csvInputs": [
    {
      "sha256": "72015a759732",
      "inputsSharingHash": 4,
      "columnCount": 61,
      "headerNames": [
        "First Name",
        "Middle Name",
        "Last Name",
        "Title",
        "Suffix",
        "Nickname",
        "Given Yomi",
        "Surname Yomi",
        "E-mail Address",
        "E-mail 2 Address",
        "E-mail 3 Address",
        "Home Phone",
        "Home Phone 2",
        "Business Phone",
        "Business Phone 2",
        "Mobile Phone",
        "Car Phone",
        "Other Phone",
        "Primary Phone",
        "Pager",
        "Business Fax",
        "Home Fax",
        "Other Fax",
        "Company Main Phone",
        "Callback",
        "Radio Phone",
        "Telex",
        "TTY/TDD Phone",
        "IMAddress",
        "Job Title",
        "Department",
        "Company",
        "Office Location",
        "Manager's Name",
        "Assistant's Name",
        "Assistant's Phone",
        "Company Yomi",
        "Business Street",
        "Business City",
        "Business State",
        "Business Postal Code",
        "Business Country/Region",
        "Home Street",
        "Home City",
        "Home State",
        "Home Postal Code",
        "Home Country/Region",
        "Other Street",
        "Other City",
        "Other State",
        "Other Postal Code",
        "Other Country/Region",
        "Personal Web Page",
        "Spouse",
        "Schools",
        "Hobby",
        "Location",
        "Web Page",
        "Birthday",
        "Anniversary",
        "Notes"
      ],
      "recordCount": 533,
      "withEmail": 465,
      "withNonRoleEmail": 464,
      "roleOnly": 1
    }
  ],
  "csvNormalized": 487,
  "unidentifiable": 0,
  "vcfCards": 697,
  "vcfNormalized": 588,
  "vcfOverlap": 412,
  "vcfOnly": 176
}
```

KG cross-check: 595 JSONL records. No contact content or source path is recorded.
