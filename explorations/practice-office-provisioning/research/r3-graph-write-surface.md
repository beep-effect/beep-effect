# Microsoft Graph write surface for practice office provisioning

Research lane: R3  
Verified against live Microsoft Learn documentation: 2026-08-30  
Scope: Microsoft Graph v1.0 writes for document backfill, personal contacts, and
limited mailbox-item placement. This report contains no client-identifying data.

## Executive summary

The document job has a well-supported Graph path. Use resumable
`driveItem` upload sessions for files larger than 10 MiB and 5–10 MiB fragments
that are exact multiples of 320 KiB. Graph permits each fragment to be less than
60 MiB, while simple `PUT .../content` accepts files up to 250 MB. The upload
session has no documented fixed lifetime; the service returns an inactivity
deadline in `expirationDateTime`, extends it after each accepted fragment, and
discards uncommitted fragments after expiry. For a SharePoint destination, the
least-privilege runtime design is the `Sites.Selected` application permission
plus a `write` grant on only the destination site. Microsoft’s upload method
page still lists the tenant-wide `Sites.ReadWrite.All` application permission,
so `Sites.Selected` must be treated as the selected-permissions authorization
model layered over that method and proven against the exact destination site
before production. [Create upload session](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0),
[upload small files](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0),
[Selected permissions](https://learn.microsoft.com/en-us/graph/permissions-selected-overview)

Ordinary Outlook message creation is not a full-fidelity historical-mail import
surface. Graph accepts base64-encoded MIME on `POST /users/{id}/messages` and on
the folder variants documented on the same page, but calls the result a *draft*.
The general Graph write limit is 4 MB after base64 encoding. The separate
mail-folder page documents JSON creation with `receivedDateTime` and
`sentDateTime`, but only documents `application/json`; the broader create-message
page documents MIME and describes all listed endpoints as draft creation. That
documentation does not establish a reliable contract for turning arbitrary
RFC822 into a non-draft, historically received item with exact transport and
received-time fidelity. Use this surface only for clearly labelled reference
drafts after a mailbox pilot. Keep Purview import as the authoritative PST path.
[Create message](https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0),
[create message in a mail folder](https://learn.microsoft.com/en-us/graph/api/mailfolder-post-messages?view=graph-rest-1.0),
[Graph request size limit](https://learn.microsoft.com/en-us/graph/use-the-api)

Microsoft added a Graph mailbox import/export API to v1.0 in 2026, but it does
not close the RFC822 or PST gap. Its `Data` field is a base64-encoded opaque FTS
stream previously produced by Graph `exportItems`; it is not arbitrary MIME and
not a PST ingress format. It is useful for Exchange Online to Exchange Online
item transfer, not for the raw PST lane in this packet.
[Mailbox import/export overview](https://learn.microsoft.com/en-us/graph/api/resources/mailbox-import-export-api-overview?view=graph-rest-1.0),
[import an Exchange mailbox item](https://learn.microsoft.com/en-us/graph/import-exchange-mailbox-item)

Personal contacts are straightforward: app-only callers use
`POST /users/{id}/contacts` or
`POST /users/{id}/contactFolders/{folderId}/contacts` with
`Contacts.ReadWrite`. Organization contacts in the global address list are
read-only in Microsoft Graph; creation belongs to Exchange Online recipient
administration, normally `New-MailContact` through Exchange Online PowerShell.
For new mailbox-scoped app-only configurations, use Exchange Online Application
RBAC with the `Application Contacts.ReadWrite` and, only if approved,
`Application Mail.ReadWrite` roles. Microsoft marks Application Access Policies
as legacy and says Application RBAC replaces them.
[Create personal contact](https://learn.microsoft.com/en-us/graph/api/contactfolder-post-contacts?view=graph-rest-1.0),
[organization contact](https://learn.microsoft.com/en-us/graph/api/resources/orgcontact?view=graph-rest-1.0),
[Exchange Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac),
[Application Access Policies](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-access-policies)

The recommended authentication topology is three single-tenant app
registrations: retain the existing delegated PKCE public client for interactive
verbs; add a confidential client for selected-site file backfill; and add a
separate confidential client for mailbox/contact backfill. Give the two daemon
clients separate certificates, permissions, and token caches. Do not put the
site-granting or Exchange-role-granting authority into either runtime. For an
unattended workstation, Microsoft recommends a certificate rather than a client
secret; MSAL Node should use a long-lived `ConfidentialClientApplication` and
`acquireTokenByClientCredential` with
`https://graph.microsoft.com/.default`.
[Register an Entra application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app),
[application credentials](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials),
[MSAL Node client credentials](https://learn.microsoft.com/en-us/entra/msal/javascript/node/acquire-token-requests)

## 1. DriveItem content uploads

### 1.1 Endpoint shapes and the simple-upload boundary

For a new file, the canonical resumable endpoint is:

```http
POST /drives/{driveId}/items/{parentItemId}:/{fileName}:/createUploadSession
```

Graph also documents equivalent forms under `/sites/{siteId}/drive`,
`/users/{userId}/drive`, `/groups/{groupId}/drive`, and `/me/drive`. Updating an
existing item uses its item ID instead of a path:

```http
POST /drives/{driveId}/items/{itemId}/createUploadSession
```

An app-only process must use an explicit drive, site, group, or user form rather
than `/me`. [Create upload session](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0)

The single-request endpoint is:

```http
PUT /drives/{driveId}/items/{parentItemId}:/{fileName}:/content
PUT /drives/{driveId}/items/{itemId}/content
```

It accepts files up to **250 MB**. That is a protocol ceiling, not the preferred
bulk-job threshold. Microsoft recommends resumable transfers for files larger
than **10 MiB**, with a **5–10 MiB** fragment size and 10 MiB described as
optimal on a stable high-speed connection. The runner should therefore use
simple upload only through 10 MiB and use an upload session above 10 MiB. This
policy buys resumability well below the 250 MB simple-upload ceiling.
[Upload small files](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0),
[upload-session best practices](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0#best-practices)

SharePoint Online and OneDrive support files up to **250 GB** and a decoded path,
including the file name, of at most **400 characters**. Those service limits are
separate from the 250 MB simple-upload limit.
[SharePoint limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)

### 1.2 Session creation, fragments, and completion

Session creation returns an `uploadSession` containing at least an `uploadUrl`
and `expirationDateTime`. The upload URL is preauthenticated. Send the Graph
bearer token only on the initial `POST`; Microsoft warns that adding an
`Authorization` header to fragment `PUT` requests can produce `401 Unauthorized`.
Treat the URL as a credential: never emit it to logs or ordinary receipts, and
encrypt it if crash recovery requires persistence.
[Create upload session](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0),
[uploadSession resource](https://learn.microsoft.com/en-us/graph/api/resources/uploadsession?view=graph-rest-1.0)

Upload each fragment to the returned URL:

```http
PUT {uploadUrl}
Content-Length: {fragmentLength}
Content-Range: bytes {first}-{last}/{totalLength}

{fragment bytes}
```

The runner must know the total file length before the first fragment. It must
keep that total unchanged, upload ranges sequentially, and keep every non-final
fragment size on a **320 KiB (327,680-byte) boundary**. Each request must be
**less than 60 MiB**. A practical default is 10 MiB, exactly 32 units of
320 KiB. The final range can contain the remaining bytes. A nonfinal success is
`202 Accepted` with an updated `expirationDateTime` and
`nextExpectedRanges`; the final successful request returns `200 OK` or
`201 Created` with the completed `driveItem`.
[Upload byte ranges](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0#example-2-upload-bytes-to-the-upload-session)

With `deferCommit` absent or `false`, Graph commits when it receives the last
range. With `deferCommit: true`, OneDrive for Business and SharePoint accept a
zero-length `POST` to the upload URL after the final range. Deferring commit is
useful only if the job needs an explicit final checkpoint; it adds a state and
failure mode, so automatic commit is the better default.
[Complete an upload](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0#example-4-completing-a-file-defercommit-is-false)

### 1.3 Session lifetime, retry, and resume semantics

Microsoft does not document a fixed number of minutes or hours for a drive
upload session. The only safe deadline is the server-returned
`expirationDateTime`. It is an inactivity deadline: each accepted fragment
extends it and returns the revised value. If no further fragment or commit
arrives before expiry, the service discards the uploaded fragments. Persist the
latest deadline and accepted offset after each `202` response, not just the
values from session creation.
[Upload-session expiration](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0#response)

For a dropped connection, the bytes in the incomplete request are ignored. The
runner can query current state with `GET {uploadUrl}` and resume at a missing
range from `nextExpectedRanges`. That property can contain multiple gaps and is
not guaranteed to list every missing range; it is state, not a recommendation
for fragment sizing. A resend of a range already held by the service can return
`416 Requested Range Not Satisfiable`; query status and continue from the
service’s missing range rather than restarting immediately. A `404` while
resuming means the session no longer exists and the whole upload must restart.
[Resume an upload](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0#example-6-resuming-an-in-progress-upload),
[upload error guidance](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0#best-practices)

Retry connection failures and `500`, `502`, `503`, and `504` with exponential
backoff. Honor `Retry-After` on `429` or `503` exactly. Apply bounded retries to
other failures after classifying them; do not turn authentication, path,
permission, quota, or validation failures into infinite retry loops. Cancel an
abandoned session with `DELETE {uploadUrl}`, which returns `204 No Content`.
[Create-upload-session best practices](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0#best-practices),
[Graph throttling](https://learn.microsoft.com/en-us/graph/throttling)

### 1.4 Names, paths, conflicts, and idempotency

Session creation accepts this uploadable item property:

```json
{
  "item": {
    "@microsoft.graph.conflictBehavior": "fail"
  }
}
```

The legal values are `fail`, `replace`, and `rename`; `fail` is the default.
For a backfill, use `fail` unless the import plan has positively matched an
existing destination item. Silent `rename` creates duplicates and weakens
idempotency. `replace` can destroy a user-edited destination version. When
updating a matched item, use its `driveItem.id` plus `If-Match` with the stored
ETag so a concurrent edit produces `412 Precondition Failed` instead of being
overwritten. A name conflict can also appear only at final commit; Graph keeps
the upload session alive until expiry and permits a corrected explicit commit
using `@microsoft.graph.sourceUrl`.
[Conflict behavior and preconditions](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0),
[final-commit conflict recovery](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0#example-7-handle-upload-errors)

Encode each user-controlled path segment according to RFC 3986 rather than
encoding the entire URL. Spaces become `%20` and `#` becomes `%23`; reserved
file-name characters remain invalid even when encoded. Prefer ID-based parent
addressing after the destination folder has been resolved, because item IDs
survive renames and moves while paths do not.
[Address drive items and encode paths](https://learn.microsoft.com/en-us/graph/onedrive-addressing-driveitems)

Each completed-file receipt should contain the source record key, source byte
length and digest, target tenant/site/drive/folder identifiers, requested name,
conflict policy, resulting `driveItem.id`, resulting name, size, ETag, and
completion time. In-progress state may also contain the next accepted offset
and session expiry, but not the raw preauthenticated upload URL in ordinary
logs.

### 1.5 Application permissions for files

The current upload-session method page lists `Sites.ReadWrite.All` as its least
privileged **application** permission. The small-file method lists
`Files.ReadWrite.All` as least privileged and `Sites.ReadWrite.All` as higher.
Both are tenant-wide. The upload-session page also states that app-only
authentication cannot replace content protected with a sensitivity label; that
operation requires delegated authentication.
[Upload-session permissions](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0#permissions),
[small-upload permissions](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0#permissions)

For a known SharePoint destination, prefer `Sites.Selected`. It has three gates:

1. Admin-consent the `Sites.Selected` application permission in Entra ID.
2. Grant the runner’s application `write` on the specific site with
   `POST /sites/{siteId}/permissions`.
3. Acquire an app-only token containing the selected permission and call only
   the granted site.

Admin consent alone grants no content access. The `write` role allows reading
and modifying resource metadata and content. Creating the per-site permission
requires `Sites.FullControl.All` and an appropriately privileged SharePoint
administrator. Use a separate, temporary administration identity for that
grant; the runtime runner should not hold `Sites.FullControl.All`.
[Selected-permission gates and roles](https://learn.microsoft.com/en-us/graph/permissions-selected-overview),
[create site permission](https://learn.microsoft.com/en-us/graph/api/site-post-permissions?view=graph-rest-1.0)

The grant shape is:

```http
POST /sites/{siteId}/permissions
Content-Type: application/json

{
  "roles": ["write"],
  "grantedToIdentities": [
    {
      "application": {
        "id": "{bulk-runner-client-id}",
        "displayName": "{bulk-runner-display-name}"
      }
    }
  ]
}
```

Microsoft’s response now exposes `grantedToIdentitiesV2`; the current request
example still uses `grantedToIdentities`.
[Create a site permission](https://learn.microsoft.com/en-us/graph/api/site-post-permissions?view=graph-rest-1.0)

`Sites.Selected` is explicitly a site-collection permission and Microsoft’s
overview covers both SharePoint and OneDrive. Nevertheless, because the
create-upload-session method table does not itself list `Sites.Selected`, run a
preproduction authorization test against the exact target drive. If the job
must write arbitrary user OneDrives rather than one known site collection,
least privilege changes materially; the documented method-level alternatives
are tenant-wide `Sites.ReadWrite.All` and, for the simple-upload endpoint,
`Files.ReadWrite.All`.

## 2. Existing messages and mailbox folders

### 2.1 What ordinary Graph message creation supports

The current v1.0 create-message page documents these endpoints:

```http
POST /me/messages
POST /users/{id|userPrincipalName}/messages
POST /me/mailFolders/{folderId}/messages
POST /users/{id|userPrincipalName}/mailFolders/{folderId}/messages
```

An app-only caller uses one of the `/users/{id|userPrincipalName}/...` forms.
All require `Mail.ReadWrite`, either delegated or application authorization.
The operation accepts JSON with `Content-Type: application/json`, or a complete
MIME message with applicable Internet headers, base64-encoded as the
`text/plain` request body. Malformed base64 returns `400 Bad Request`.
[Create message](https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0)

The MIME path is not a large-message upload protocol. Graph’s general write
request limit is **4 MB**, and base64 expansion plus headers count toward it.
There is therefore no safe fixed 4 MB source-file cutoff; the runner must encode
the message and reject the operation before the encoded request exceeds the
limit. S/MIME message payloads have an explicitly documented 4 MB limit and
return `413 Request Entity Too Large` when exceeded.
[Graph request size limit](https://learn.microsoft.com/en-us/graph/use-the-api),
[create-message MIME limit](https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0)

Graph supports upload sessions for a **file attachment** between 3 MB and
150 MB on an existing draft. That does not raise the size limit for posting a
whole RFC822/MIME message. It can support a newly constructed JSON draft with a
large attachment, but it does not preserve the original message as a single raw
MIME artifact.
[Large Outlook attachments](https://learn.microsoft.com/en-us/graph/outlook-large-attachments)

### 2.2 Draft state and date fidelity

The broad create-message page calls the operation “Create a draft” and says the
no-folder form saves to Drafts by default. Its method list includes the
mail-folder variants. Graph’s message resource defines `isDraft` as true when a
message has not been sent. The documented post-create transition is to *send*
the draft, which creates sent-mail semantics, not historical received-mail
semantics. Moving or creating the draft in another folder does not document a
transition into a received message.
[Create message](https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0),
[message resource](https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0)

There is a documentation inconsistency that must stay visible in the design:

- The general create-message page documents JSON and MIME for all four listed
  endpoints and describes the operation as draft creation.
- The separate mail-folder page documents
  `POST /users/{id}/mailFolders/{folderId}/messages` with
  `Content-Type: application/json` and shows `receivedDateTime` and
  `sentDateTime` in its request example. It does not document MIME on that page.
- The update-message page’s writable-property list omits
  `receivedDateTime`, `sentDateTime`, and `isDraft`, so the runner cannot depend
  on repairing those fields after creation.

[Create message](https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0),
[create message in a mail folder](https://learn.microsoft.com/en-us/graph/api/mailfolder-post-messages?view=graph-rest-1.0),
[update message](https://learn.microsoft.com/en-us/graph/api/message-update?view=graph-rest-1.0)

The most defensible conclusion is narrow: Graph documents that it can create a
message or draft from MIME, but it does **not** document a full-fidelity import
contract for arbitrary RFC822 in which `isDraft`, `receivedDateTime`,
`sentDateTime`, transport headers, conversation identity, and item class are
all restored exactly. A `Date` or `Received` header inside MIME is not the same
as a documented guarantee that Exchange will expose the intended Graph
`receivedDateTime` or treat the object as delivered mail.

If the product accepts “reference copy stored as a draft,” a disposable-mailbox
pilot should compare the source and created item for:

- `isDraft`, `parentFolderId`, `receivedDateTime`, and `sentDateTime`;
- `internetMessageId` and selected `internetMessageHeaders`;
- sender/from/recipient fields, body alternatives, inline content IDs, and
  attachment count and hashes;
- Outlook presentation, search, conversation grouping, retention behavior, and
  eDiscovery visibility.

Do not describe a passing pilot as a Microsoft-supported archival import
contract. It is evidence only for the tested tenant and payload classes.

### 2.3 The 2026 mailbox import/export API is FTS-only

Microsoft Graph v1.0 now exposes:

```http
POST /admin/exchange/mailboxes/{mailboxId}/createImportSession
```

The delegated permission is `MailboxItem.ImportExport`; the application
permission is `MailboxItem.ImportExport.All`. The endpoint is currently listed
for the global service only. It returns a preauthenticated `importUrl` with its
own expiry.
[Create mailbox import session](https://learn.microsoft.com/en-us/graph/api/mailbox-createimportsession?view=graph-rest-1.0)

The subsequent `POST` to `importUrl` carries:

```json
{
  "FolderId": "{mailboxFolder-id}",
  "Mode": "create",
  "Data": "{base64-encoded-FTS-stream}"
}
```

`FolderId` must come from
`GET /admin/exchange/mailboxes/{mailboxId}/folders`, not the Outlook
`mailFolder` collection. Most importantly, `Data` must be the opaque FTS format
produced by the Graph `exportItems` API. Microsoft says the import session is
for an item that was exported with `exportItems`; this is not an arbitrary MIME
decoder, PST upload endpoint, or general backup/restore API.
[Import an Exchange mailbox item](https://learn.microsoft.com/en-us/graph/import-exchange-mailbox-item),
[mailbox import/export overview](https://learn.microsoft.com/en-us/graph/api/resources/mailbox-import-export-api-overview?view=graph-rest-1.0)

Decision for this packet:

- Keep raw PSTs in the Purview import lane.
- Do not implement ordinary `POST /messages` as a historical mailbox-import
  engine.
- Consider MIME message creation only for explicitly labelled, size-bounded
  reference drafts if the business accepts the fidelity limits.
- Consider the FTS import API only if a future source is another Exchange Online
  mailbox exported through Graph.

## 3. Contacts

### 3.1 Personal mailbox contacts

Graph creates personal contacts with:

```http
POST /me/contacts
POST /users/{id|userPrincipalName}/contacts
POST /me/contactFolders/{folderId}/contacts
POST /users/{id|userPrincipalName}/contactFolders/{folderId}/contacts
```

The permission is `Contacts.ReadWrite` in delegated or application mode. An
app-only runner must use an explicit `/users/{id|userPrincipalName}` endpoint.
Success returns `201 Created` and the new contact. Personal contacts live in a
mailbox; they are not tenant directory objects and do not populate the global
address list.
[Create contact](https://learn.microsoft.com/en-us/graph/api/contactfolder-post-contacts?view=graph-rest-1.0),
[organization-contact distinction](https://learn.microsoft.com/en-us/graph/api/resources/orgcontact?view=graph-rest-1.0)

Unscoped `Contacts.ReadWrite` application consent permits create, read, update,
and delete across contacts in all mailboxes. For a new deployment, prefer an
Exchange Application RBAC assignment of
`Application Contacts.ReadWrite` restricted to the intended mailbox resource
scope. Keep a source entity key and resulting Graph contact ID in each receipt;
do not rely on names as unique keys.
[Exchange Application RBAC roles](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac#supported-application-roles)

### 3.2 Organization contacts and the GAL

Microsoft Graph’s `orgContact` resource is read-only. Graph can list and read
organization contacts but has no supported create endpoint for them.
[orgContact resource](https://learn.microsoft.com/en-us/graph/api/resources/orgcontact?view=graph-rest-1.0)

Mail-enabled external contacts in the Exchange Online global address list are
an Exchange recipient-management surface. Microsoft documents creation in the
Exchange admin center or Exchange Online PowerShell, for example:

```powershell
New-MailContact -Name "{display-name}" `
  -ExternalEmailAddress "{external-address}" `
  -Alias "{alias}"
```

The administrator needs the Exchange recipient permissions documented for the
procedure. Use `Set-Contact` for organization/contact properties and
`Set-MailContact` for mail properties. The Exchange admin center does not offer
bulk editing of mail contacts, so any repeatable bulk GAL process would be a
separate, tightly governed Exchange Online PowerShell provisioning lane, not a
method added to the Graph driver.
[Manage Exchange Online mail contacts](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-mail-contacts)

Do not automatically promote every extracted client entity to the GAL. Personal
contact creation affects a scoped mailbox; an organization contact is a
tenant-visible recipient object with broader address-book and governance
effects. The packet needs a policy decision that classifies which extracted
entities, if any, deserve organization-contact status.

## 4. Throttling and job control

### 4.1 Retry discipline

On `429 Too Many Requests`, wait the number of seconds in `Retry-After`, then
retry the failed operation. If another `429` occurs, repeat using the new value.
Immediate retries continue to accrue usage and extend recovery. If the response
does not contain `Retry-After`, use exponential backoff with jitter and a finite
attempt/time budget. Apply the same service-directed pause to SharePoint
`503 Service Unavailable` responses that carry `Retry-After`.
[Graph throttling guidance](https://learn.microsoft.com/en-us/graph/throttling),
[SharePoint Retry-After guidance](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online#retry-after-header)

Throttle state must be shared by workers operating in the same service bucket.
When one upload receives `Retry-After`, pause new work for that target
site/drive/app rather than allowing sibling workers to continue consuming the
same budget. Record the status, service request ID, attempt count, and wait
duration, but never the upload URL or access token.

JSON batching does not bypass throttling. Each subrequest is evaluated
individually; the batch itself can return `200 OK` while individual entries
return `429`. SDK automatic retry handlers do not automatically retry throttled
subrequests inside a batch. Upload chunks cannot use ordinary JSON batching in
any case because they go to preauthenticated upload URLs.
[Graph throttling and batching](https://learn.microsoft.com/en-us/graph/throttling#throttling-and-batching)

### 4.2 Outlook mailbox limits

Current Outlook service limits apply per **app ID plus mailbox** combination:

| Limit | Window |
| --- | --- |
| 10,000 API requests | 10 minutes |
| 4 concurrent requests | instantaneous |
| 150 MB uploaded by `PATCH`, `POST`, or `PUT` | 5 minutes |

These limits cover the Mail API, personal Contacts API, and mailbox
import/export API. Exceeding a limit for one mailbox does not consume another
mailbox’s app/mailbox bucket.
[Outlook service limits](https://learn.microsoft.com/en-us/graph/throttling-limits#outlook-service-limits)

For contact creation or any approved message-reference job, start with **one
worker per mailbox**, permit at most **two**, and never exceed Microsoft’s hard
limit of four concurrent requests for the same app/mailbox pair. This one-to-two
worker recommendation is an engineering safety margin, not a Microsoft limit.
It leaves headroom for read-before-write checks, receipts, and interactive work
using the same app ID.

### 4.3 SharePoint resource units and large libraries

SharePoint assigns Graph operations a resource-unit (RU) cost: a single-item
query or file download costs 1 RU; a multi-item query and a create, update,
delete, or upload costs 2 RU; permission-resource operations cost 5 RU. Tenant
five-minute RU limits scale with licensed-user count:

| Licensed users | Tenant RU per 5 minutes | App RU per tenant per minute | App RU per tenant per 24 hours |
| ---: | ---: | ---: | ---: |
| 0–1,000 | 18,750 | 1,250 | 1,200,000 |
| 1,001–5,000 | 37,500 | 2,500 | 2,400,000 |
| 5,001–15,000 | 56,250 | 3,750 | 3,600,000 |
| 15,001–50,000 | 75,000 | 5,000 | 4,800,000 |
| 50,000+ | 93,750 | 6,250 | 6,000,000 |

The per-app, per-tenant ingress limit is 400 GB per hour. Microsoft labels these
as default limits that may change. A delegated-user path also has defaults of
3,000 requests per five minutes and 50 GB ingress per hour, but the proposed
backfill runner is app-only.
[SharePoint throttling limits](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online)

There is no Microsoft-published universal “safe upload concurrency” for a
SharePoint library. Use this adaptive policy:

- Start with **two files in flight per target drive/site**.
- Upload chunks sequentially within each file, as the protocol requires.
- Use the Microsoft-recommended 10 MiB fragment on a stable connection.
- Permit an operational ceiling of **four files in flight per target** only
  after a sustained no-throttle pilot; four is a local ceiling, not a
  SharePoint service limit.
- On `429` or `503`, stop admission for the affected target, honor
  `Retry-After`, and reduce concurrency. Increase again only slowly after a
  stable period.
- Schedule large runs during the tenant region’s off-peak nights or weekends,
  when Microsoft says throttling and slowdown are less likely.

[Upload-session best practices](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0#best-practices),
[SharePoint off-peak guidance](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online#peak-vs-off-peak-usage)

For a large library, cache the destination site, drive, and parent-folder IDs;
do not list a folder before every upload. Use deterministic destination names,
`fail` conflict behavior, and receipts to avoid duplicate probing. If a scan is
needed, Microsoft prices delta with a token at 1 RU versus 2 RU for a multi-item
query. A SharePoint library can contain up to 30 million items, but scale does
not relax throttling, path, or permission-inheritance limits.
[SharePoint RU costs](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online#resource-units),
[SharePoint library limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)

## 5. App-only registration, consent, and scope

### 5.1 Registration and credentials

For each app-only runner:

1. In the Microsoft Entra admin center, go to **Entra ID → App registrations →
   New registration**.
2. Use a purpose-specific name and choose **single tenant**, which Microsoft
   recommends for most internal applications. Record the application (client)
   ID and tenant ID. A daemon does not need a browser redirect URI.
3. Under **Certificates & secrets**, upload the certificate’s public portion and
   record its SHA-256 thumbprint. Keep the private key outside the repository.
4. Add only the required Microsoft Graph **Application permissions** under
   **API permissions**.
5. Have an authorized administrator review and grant tenant-wide admin consent.

[Register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app),
[configure Graph application permissions](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis),
[add application credentials](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials)

Microsoft recommends certificates over client secrets and says client secrets
should not be used for production. Secrets have a maximum lifetime of 24 months
and Microsoft recommends less than 12 months. A managed identity is preferable
when a workload runs on supporting Azure infrastructure, but an unattended
workstation does not have that hosting trust. Use a certificate with a
restricted private key, a documented rotation procedure, and overlapping
certificate validity during rotation. If private-key material should not enter
the runner process, MSAL Node supports `clientAssertion` with an external signer
such as Key Vault; otherwise `clientCertificate` requires the PEM private key
and SHA-256 thumbprint.
[Credential recommendation](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials),
[MSAL Node certificate credentials](https://learn.microsoft.com/en-us/entra/msal/javascript/node/certificate-credentials)

Client-credentials token requests use the tenant-specific authority and the
Graph resource’s static `.default` scope:

```text
authority: https://login.microsoftonline.com/{tenantId}
scopes:    https://graph.microsoft.com/.default
grant:     client_credentials
```

The flow never returns a refresh token. The client credential can obtain a new
access token, and MSAL checks its application token cache before contacting the
security token service.
[Client-credentials protocol](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow),
[MSAL token acquisition and caching](https://learn.microsoft.com/en-us/entra/identity-platform/msal-acquire-cache-tokens)

### 5.2 Admin consent

Microsoft Graph application permissions require tenant admin approval. The
portal route is **App registrations → application → API permissions → Grant
admin consent**. Microsoft also documents this URL shape:

```text
https://login.microsoftonline.com/{organization}/adminconsent?client_id={client-id}
```

For Microsoft Graph application roles, a Privileged Role Administrator can
grant any permission. Cloud Application Administrator and Application
Administrator cannot grant Microsoft Graph application permissions. Review the
exact configured permission list before consent; tenant-wide admin consent can
authorize access to broad portions of organizational data.
[Grant tenant-wide admin consent](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent)

For `Sites.Selected`, admin consent is only the first gate. A separate
SharePoint administrator must grant the application’s `write` role on the exact
site. Keep that provisioning action outside the unattended runner.

### 5.3 Mailbox scope: Application RBAC, not a new AAP

Microsoft’s current guidance says Exchange Online Application RBAC replaces
Application Access Policies. Application RBAC grants a Graph-aligned Exchange
application role to a service principal and attaches a resource scope covering
the permitted mailboxes. New configurations should use this model.
[Exchange Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)

The administration sequence is:

```powershell
New-ServicePrincipal `
  -AppId "{client-application-id}" `
  -ObjectId "{entra-service-principal-object-id}" `
  -DisplayName "{runner-display-name}"

New-ManagementRoleAssignment `
  -Role "Application Contacts.ReadWrite" `
  -App "{exchange-service-principal}" `
  -CustomResourceScope "{mailbox-management-scope}"

# Add only if the reference-message lane is explicitly approved.
New-ManagementRoleAssignment `
  -Role "Application Mail.ReadWrite" `
  -App "{exchange-service-principal}" `
  -CustomResourceScope "{mailbox-management-scope}"

Test-ServicePrincipalAuthorization `
  -Identity "{exchange-service-principal}" `
  -Resource "{target-mailbox}"
```

The Exchange administrator creating these assignments needs the appropriate
delegating rights; Microsoft documents Organization Management and Exchange
Administrator requirements. Changes can take 30 minutes to two hours to become
effective because of authorization caching, while
`Test-ServicePrincipalAuthorization` bypasses that cache for configuration
testing.
[Application RBAC configuration](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac#configuration-instructions)

Do **not** also admin-consent the same unscoped `Mail.ReadWrite` or
`Contacts.ReadWrite` Graph application role in Entra ID when relying on
Application RBAC. Microsoft says Entra and Application RBAC permissions are
additive; an unscoped Entra grant would restore organization-wide access and
defeat the mailbox scope.
[Application RBAC authorization interoperability](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac#how-does-rbac-for-applications-work-alongside-application-access-policies)

Application Access Policies remain relevant only for an existing legacy
configuration. The legacy pattern is tenant-wide Entra admin consent for
`Mail.ReadWrite` and/or `Contacts.ReadWrite`, followed by a restrictive policy
over a mail-enabled security group:

```powershell
New-ApplicationAccessPolicy `
  -AppId "{client-id}" `
  -PolicyScopeGroupId "{mail-enabled-security-group}" `
  -AccessRight RestrictAccess `
  -Description "Restrict backfill runner to approved mailboxes"
```

Test it with `Test-ApplicationAccessPolicy`. Do not choose this for a new
deployment merely because older guidance or the original mission text mentions
it; Microsoft labels the feature “legacy” and states that Application RBAC has
replaced it.
[Application Access Policies (legacy)](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-access-policies)

## 6. MSAL Node beside the delegated PKCE lane

Keep the existing authorization-code-plus-PKCE implementation as its own public
client and app registration. Add a distinct MSAL Node
`ConfidentialClientApplication` for each daemon registration. Do not add client
credentials to the public client or put application permissions into its token
request. Separate registrations make consent, credential rotation, audit logs,
revocation, and blast radius legible.

The app-only acquisition shape is:

```ts
const app = new ConfidentialClientApplication({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    clientCertificate: {
      thumbprintSha256,
      privateKey,
    },
  },
  cache: {
    cachePlugin,
  },
})

const result = await app.acquireTokenByClientCredential({
  scopes: ["https://graph.microsoft.com/.default"],
})
```

This is an API-shape illustration, not a request to store the private key in
configuration. Resolve certificate material at runtime from the approved
protected store, or supply `clientAssertion` from an external signer.
[MSAL Node client-credentials request](https://learn.microsoft.com/en-us/entra/msal/javascript/node/acquire-token-requests#client-credentials-flow),
[MSAL Node certificate options](https://learn.microsoft.com/en-us/entra/msal/javascript/node/certificate-credentials)

Construct each `ConfidentialClientApplication` once and keep it alive for the
run. MSAL’s in-memory cache lives as long as the application object. Client
credentials use the application token cache, and
`acquireTokenByClientCredential` checks that cache; do not substitute the
user-account-oriented `acquireTokenSilent` flow. For a single-tenant daemon,
Microsoft documents the cache partition key as `<clientId>.<tenantId>`.
[MSAL cache behavior](https://learn.microsoft.com/en-us/entra/msal/javascript/node/caching),
[application token cache](https://learn.microsoft.com/en-us/entra/identity-platform/msal-acquire-cache-tokens)

For a production runner, persist the cache only with encryption and keep it in
a namespace separate from the delegated PKCE cache and from the other daemon
registration. Cache persistence reduces token-service calls after restart; it
does not preserve a refresh token, because client credentials never receive
one. A short, single-process run can safely rely on one long-lived in-memory
cache, accepting one new token request after process restart.
[MSAL Node cache persistence](https://learn.microsoft.com/en-us/entra/msal/javascript/node/caching),
[client-credentials flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)

## Least-privilege permission table

| Verb or job | Exact endpoint | Identity mode | Permission or Exchange role | Consent or assignment | Scope and caveat |
| --- | --- | --- | --- | --- | --- |
| Upload to one approved SharePoint site | `PUT /drives/{driveId}/items/{parentId}:/{name}:/content` or `POST /drives/{driveId}/items/{parentId}:/{name}:/createUploadSession` | Application | `Sites.Selected` plus site role `write` | Entra admin consent **and** `POST /sites/{siteId}/permissions` by a SharePoint admin | Recommended. No access until the resource grant exists. Pilot the upload session against the exact drive because its method page lists `Sites.ReadWrite.All`, not `Sites.Selected`. |
| Upload across all SharePoint sites | Same drive endpoints | Application | `Sites.ReadWrite.All` | Entra admin consent | Tenant-wide fallback; current upload-session page lists this as its least-privileged application permission. Avoid if one-site access is sufficient. |
| Simple upload across files the app can reach | `PUT /drives/{driveId}/items/{parentId}:/{name}:/content` | Application | `Files.ReadWrite.All` | Entra admin consent | Tenant-wide file access. Current simple-upload page lists it; current resumable-upload page does not. |
| Interactive file upload | `/me/drive/...`, `/sites/...`, or `/drives/...` variants | Delegated | `Files.ReadWrite` | Delegated user consent or tenant admin consent, subject to tenant policy | User context. Required for replacing content protected by a sensitivity label. |
| Create personal contacts in approved mailboxes | `POST /users/{id}/contacts` or `POST /users/{id}/contactFolders/{folderId}/contacts` | Application | Preferred: Exchange role `Application Contacts.ReadWrite` | Exchange Application RBAC role assignment with mailbox resource scope | Do not also grant unscoped Entra `Contacts.ReadWrite`; grants are additive. |
| Create personal contacts using legacy mailbox scoping | Same contact endpoints | Application | Graph `Contacts.ReadWrite` | Entra admin consent plus legacy Application Access Policy | Supported legacy fallback, not the recommended new configuration. |
| Create an interactive user’s personal contact | `POST /me/contacts` or `POST /me/contactFolders/{folderId}/contacts` | Delegated | `Contacts.ReadWrite` | Delegated user consent or tenant admin consent, subject to tenant policy | Interactive lane only; caller is limited by signed-in user context. |
| Create a MIME or JSON reference draft in an approved mailbox | `POST /users/{id}/messages` or `POST /users/{id}/mailFolders/{folderId}/messages` | Application | Preferred: Exchange role `Application Mail.ReadWrite` | Exchange Application RBAC role assignment with mailbox resource scope | Does not include send. This is not a full-fidelity historical import contract. |
| Create a reference draft using legacy mailbox scoping | Same message endpoints | Application | Graph `Mail.ReadWrite` | Entra admin consent plus legacy Application Access Policy | Supported legacy fallback. General write request limit is 4 MB. |
| Create or edit an interactive user’s draft | `/me/messages` or `/me/mailFolders/{folderId}/messages` | Delegated | `Mail.ReadWrite` | Delegated user consent or tenant admin consent, subject to tenant policy | Interactive lane. Does not solve historical received-mail fidelity. |
| Import an item previously exported as Graph FTS | `POST /admin/exchange/mailboxes/{mailboxId}/createImportSession`, then `POST {importUrl}` | Application | Preferred scoped role: `Application MailboxItem.ImportExport`; tenant-wide Graph alternative: `MailboxItem.ImportExport.All` | Exchange Application RBAC assignment, or Entra admin consent for the tenant-wide app role | Global cloud only. Accepts Graph-exported FTS, not RFC822/MIME or PST. |
| Import an item previously exported as Graph FTS interactively | Same import-session flow | Delegated | `MailboxItem.ImportExport` | Delegated/admin consent as required | Work or school accounts only; not a PST/RFC822 path. |
| Create an organization/GAL mail contact | No Microsoft Graph create endpoint | Exchange administrator | Exchange recipient permissions; `New-MailContact` | Exchange Online administrative authorization | Separate Exchange Online PowerShell or EAC lane. `orgContact` is read-only in Graph. |

Permission references:
[drive upload session](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0#permissions),
[simple drive upload](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0#permissions),
[Selected permissions](https://learn.microsoft.com/en-us/graph/permissions-selected-overview),
[create contact](https://learn.microsoft.com/en-us/graph/api/contactfolder-post-contacts?view=graph-rest-1.0#permissions),
[create message](https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0#permissions),
[create mailbox import session](https://learn.microsoft.com/en-us/graph/api/mailbox-createimportsession?view=graph-rest-1.0#permissions),
[Exchange Application RBAC roles](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac#supported-application-roles).

## Recommended auth topology

### A. Delegated interactive app

Retain the existing public-client app registration and MSAL Node PKCE flow.
Keep current read scopes. Add delegated write scopes only when the associated
interactive verbs are implemented and approved:

- `Files.ReadWrite` for an interactive file verb;
- `Contacts.ReadWrite` for an interactive personal-contact verb;
- `Mail.ReadWrite` for an interactive draft/message-management verb.

This registration has no certificate, client secret, or application permission.
Its cache remains user-account-oriented and separate from daemon caches.

### B. Selected-site file backfill app

Create a single-tenant confidential-client registration dedicated to document
uploads. Grant only `Sites.Selected`, then grant `write` on the exact destination
site. Authenticate with a dedicated certificate. The runtime has no mail,
contacts, directory, or `Sites.FullControl.All` permission. A separate admin
session performs and records the site grant.

This is the preferred file topology if the packet approves a SharePoint
destination. It also makes the repo-level Box-as-document-system-of-record
decision visible: the Graph upload capability should not be used to create an
unapproved duplicate document repository.

### C. Mailbox/contact backfill app

Create a second single-tenant confidential-client registration with a separate
certificate. Register its Entra service principal in Exchange Online and assign
`Application Contacts.ReadWrite` through Application RBAC over only the intended
mailbox scope. Do not grant `Application Mail.ReadWrite` until the product owner
accepts the reference-draft fidelity limits. If later approved, add that scoped
Exchange role rather than creating an unscoped Graph app-role consent.

Keep the Purview PST lane separate. Add
`Application MailboxItem.ImportExport` only if a later requirement has
Graph-exported FTS as its source. Do not add `Mail.Send`; none of the stated
backfill jobs needs to send mail.

### D. Administration and credential boundaries

Use human-controlled administration sessions for:

- Entra app registration, certificate upload, and admin consent;
- `Sites.Selected` resource grants;
- Exchange service-principal registration, resource scopes, and Application
  RBAC assignments;
- Purview import work.

The unattended runners receive only their own client ID, tenant ID, certificate
signing capability, and runtime configuration. They cannot grant themselves a
new site, mailbox, or permission. Rotate each certificate independently and
keep completion receipts free of tokens, certificate material, and
preauthenticated URLs.

## Open questions

1. **What is the approved document destination?** The packet says Box remains
   the document system of record and rejects automatic SharePoint duplication.
   The upload runner needs an explicit exception, destination site/drive, and
   purpose before `Sites.Selected` is provisioned.
2. **Is the target a SharePoint library or one or more user OneDrives?** A known
   site supports a clean `Sites.Selected` design. Arbitrary user drives may force
   a broader permission and require a separate risk decision.
3. **What does “place historical messages” mean operationally?** If a visible
   received item with exact historical fidelity is required, ordinary Graph MIME
   creation is not an acceptable contract. If a clearly labelled reference
   draft is acceptable, define the destination folder, supported payload classes,
   encoded size ceiling, and pilot acceptance tests.
4. **Is every mail source PST, or can any source be Graph-exported FTS?** Only the
   latter can use the 2026 mailbox import/export API. Raw PST stays with Purview.
5. **Which extracted entities become personal contacts, and in whose mailbox?**
   Define deduplication keys, ownership, overwrite policy, and deletion/rollback
   behavior before enabling `Contacts.ReadWrite`.
6. **Are any entities intended for the GAL?** If yes, define an approval policy
   and a separate Exchange recipient-management packet. Graph cannot create
   `orgContact` objects.
7. **What Exchange mailbox scope should Application RBAC use?** Choose a stable
   management-scope filter or administrative unit, identify its administrator,
   and record both in provisioning receipts.
8. **Where will the workstation certificate private key or signing service
   live?** Decide the protected store, process access boundary, rotation owner,
   expiry alerting, and emergency revocation procedure before the daemon is
   unattended.
9. **What is the required crash-resume boundary?** Decide whether upload URLs may
   be encrypted and persisted across process restarts or whether a restart may
   abandon and recreate the session. Ordinary logs must never contain those
   URLs.
10. **What tenant cloud and region apply?** The new mailbox import/export API is
    documented only for the global service, and SharePoint off-peak scheduling
    follows the tenant region’s time zone.

## Sources

All sources below are Microsoft Learn pages opened and checked on 2026-08-30.

### Drive and SharePoint

- [driveItem: createUploadSession](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0)
- [Upload or replace the contents of a driveItem](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0)
- [uploadSession resource](https://learn.microsoft.com/en-us/graph/api/resources/uploadsession?view=graph-rest-1.0)
- [Address resources in a drive](https://learn.microsoft.com/en-us/graph/onedrive-addressing-driveitems)
- [Overview of Selected permissions in OneDrive and SharePoint](https://learn.microsoft.com/en-us/graph/permissions-selected-overview)
- [Create a site permission](https://learn.microsoft.com/en-us/graph/api/site-post-permissions?view=graph-rest-1.0)
- [SharePoint Online limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- [Avoid getting throttled or blocked in SharePoint Online](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online)

### Mail and contacts

- [Create message](https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0)
- [Create message in a mail folder](https://learn.microsoft.com/en-us/graph/api/mailfolder-post-messages?view=graph-rest-1.0)
- [Update message](https://learn.microsoft.com/en-us/graph/api/message-update?view=graph-rest-1.0)
- [message resource](https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0)
- [Send messages with MIME content](https://learn.microsoft.com/en-us/graph/outlook-send-mime-message)
- [Attach large files to Outlook messages or events](https://learn.microsoft.com/en-us/graph/outlook-large-attachments)
- [Mailbox import/export API overview](https://learn.microsoft.com/en-us/graph/api/resources/mailbox-import-export-api-overview?view=graph-rest-1.0)
- [mailbox: createImportSession](https://learn.microsoft.com/en-us/graph/api/mailbox-createimportsession?view=graph-rest-1.0)
- [Import an Exchange mailbox item](https://learn.microsoft.com/en-us/graph/import-exchange-mailbox-item)
- [Create personal contact](https://learn.microsoft.com/en-us/graph/api/contactfolder-post-contacts?view=graph-rest-1.0)
- [orgContact resource](https://learn.microsoft.com/en-us/graph/api/resources/orgcontact?view=graph-rest-1.0)
- [Manage mail contacts in Exchange Online](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-mail-contacts)

### Permissions, throttling, and authentication

- [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [Microsoft Graph throttling guidance](https://learn.microsoft.com/en-us/graph/throttling)
- [Microsoft Graph service-specific throttling limits](https://learn.microsoft.com/en-us/graph/throttling-limits)
- [Exchange Online Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)
- [Application Access Policies (legacy)](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-access-policies)
- [Register an application in Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [Configure application access to Microsoft Graph](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis)
- [Grant tenant-wide admin consent](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent)
- [Add and manage application credentials](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials)
- [OAuth 2.0 client credentials flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)
- [Acquire tokens in MSAL Node](https://learn.microsoft.com/en-us/entra/msal/javascript/node/acquire-token-requests)
- [Use certificate credentials with MSAL Node](https://learn.microsoft.com/en-us/entra/msal/javascript/node/certificate-credentials)
- [Token caching in MSAL Node](https://learn.microsoft.com/en-us/entra/msal/javascript/node/caching)
- [Acquire and cache tokens with MSAL](https://learn.microsoft.com/en-us/entra/identity-platform/msal-acquire-cache-tokens)
- [Use the Microsoft Graph API and request-size limits](https://learn.microsoft.com/en-us/graph/use-the-api)
