# Migrating files into the practice Box tree

How an operator or agent moves a set of local files into the provisioned
client/matter tree with the content-migration engine in
`@beep/box-provisioning`. The engine reads sources and never writes to them;
in Box it only creates folders and uploads new files.

Everything that names a client, a matter, or a file stays in a private
directory outside any repository. Tracked evidence is counts, sizes, digests,
and typed outcomes.

## What you need

- The Box platform app's client-credentials references in a private env file,
  resolved with `op run --env-file=<file> -- <command>`. Test first with
  `op run --env-file=<file> -- true >/dev/null`.
- The private provisioning intent, for the expected enterprise id, service
  subject id, and root folder id.
- A private working directory, mode `0700`, for the map, plan, receipt, and
  journal.

## 1. Inventory and map

Produce a migration map (`box-content-migration-map/v1`). One entry per
distinct file content:

```json
{
  "version": "box-content-migration-map/v1",
  "sourceRevision": "onboarding-1",
  "expectedEnterpriseId": "<enterprise id>",
  "expectedSubjectId": "<service account id>",
  "rootFolderId": "0",
  "sourceRoot": "/absolute/source/directory",
  "folders": [{ "path": ["01 Clients", "<client>", "<matter>", "03 Drafting"] }],
  "files": [
    {
      "sourceRelativePath": "relative/path/under/source-root.docx",
      "sha256": "<64 lowercase hex>",
      "sizeBytes": 12345,
      "folderPath": ["01 Clients", "<client>", "<matter>", "03 Drafting"],
      "fileName": "name-in-box.docx",
      "ruleId": "which-rule-placed-it"
    }
  ]
}
```

Rules the map must follow:

- `folders` lists every folder that must exist even when empty (the full
  matter template). Folders implied by a file's `folderPath` are created
  too.
- Two files may not share a destination. Box compares sibling names without
  regard to case, so resolve collisions in the map, for example by appending
  eight characters of the SHA-256 before the extension.
- Make names safe for Box Drive on Windows: no `< > : " | ? *`, no control
  characters, no trailing dot or space.
- Attribute a file to a matter only on evidence (its folder, or exactly one
  known docket in its text). Everything else goes to the holding folder.
  Resolve matter identity through the practice KG's matter lookup; ambiguous
  or unverified identities go on the attorney's spot-check list.

Client folders and who can see them belong to the provisioning reconciler.
Add them to the private intent and apply that plan before uploading.

## 2. Dry-run

`BoxContentMigration.plan(map, options)` hashes every source, lists only the
destination folders that already exist, and classifies each file:

| Action | Meaning |
| --- | --- |
| `Upload` | Not in Box yet. `single` or `chunked` by size. |
| `SkipIdentical` | The same name already holds the same content. |
| `BlockedNameConflict` | The same name holds different content. Never overwritten. |
| `BlockedSourceMissing` | The source file is gone. |
| `BlockedSourceChanged` | Size or SHA-256 no longer matches the map. |

Run it twice and require identical plan digests. Review the summary: counts
per action, upload bytes, uploads per rule, and `estimatedProviderCalls`.
Write the encoded plan to the private directory.

## 3. Apply

`applyReviewedPlan(map, reviewedPlanJson, options)` plans again and refuses
to write if the digest differs from the reviewed plan. Then it creates
missing folders in depth order, uploads with bounded concurrency, and checks
the SHA-1 Box reports against the local file after each upload.

- Pass the same options as the dry-run. A different chunk threshold changes
  the plan and is reported as drift.
- Always set `maxProviderCalls`. The tenant has a monthly API allowance; a
  run that would exceed its budget stops cleanly and reports the rest as
  `NotAttempted`.
- Provide a journal sink that appends each entry to a private
  newline-delimited file and syncs it.
- One failed file does not stop the run.

The result carries a receipt, a post-apply plan, and a verdict. `complete`
means the post-apply plan holds only existing folders and identical files.

## 4. Resume after an interruption

Run the dry-run again. Files that reached Box are now `SkipIdentical` and
folders are `FolderExists`, so the new plan contains only what remains.
Review its digest and apply it. Nothing is uploaded twice.

A file whose upload was cut off mid-transfer can leave a partial item in Box.
It shows up as `BlockedNameConflict` in the next plan. Check it in Box,
remove the partial item by hand, and plan again; the engine never deletes.

## 5. Verify and record

- The verdict is `complete`, or every remaining action is an understood
  blocker.
- Re-hash a sample of sources, or all of them, and compare with the map to
  show the sources are unchanged.
- Record in the packet's `history/`: file and byte counts, action counts,
  provider calls used, the verdict, and the plan digest prefix. No names.

## 6. Give the attorney access

Only after the upload is verified, add the attorney's collaborations for the
new client folders to the private intent and apply that plan. Then run the
Box Drive checklist in
[`practice-box-drive-windows.md`](./practice-box-drive-windows.md).

## Later corrections

- **A matter belongs to a different client**: move the matter folder in Box.
  Folder ids, shared links, and Box Drive paths under it follow.
- **A file is in the wrong subfolder**: the attorney drags it. The map is a
  starting point, not a constraint.
- **New source files** (another drive, a PC inventory): build a new map with
  a new `sourceRevision` and repeat from step 2. Content already in the same
  destination is skipped.
