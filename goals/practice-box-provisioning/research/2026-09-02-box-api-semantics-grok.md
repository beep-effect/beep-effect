# Box REST semantics for first-time desired-state apply

**Scope:** Box **Business** plan; Client Credentials Grant as the enterprise **Service Account**; SDK `box-node-sdk` v10.14 (`box-typescript-sdk-gen` managers). Reconciler: `packages/drivers/box-provisioning/src/`.

**Method:** Official `developer.box.com` API reference + guides (OpenAPI **2024.0**, `https://developer.box.com/box-openapi.json`) and `support.box.com` articles that actually match their titles. Community posts are not used as evidence.

**Date accessed:** 2026-09-02 (all URLs below).

**Constraint:** Read-only research. No repository mutations.

**UNUSABLE support URLs (do not cite):** several historical `support.box.com` titles now serve unrelated recycled articles (Trash, Box Edit, Pulse, sandboxes). In this fetch, `360043695814-External-Collaborators` served “Clear Your Box Edit Cache”. `www.box.com/pricing` and the governance marketing page returned HTTP 403 to unauthenticated curl.

**Quote rule:** each cited sentence is ≤15 words, in quotes, attributed.

---

## Reconciler surface (live checkout, read-only)

- **Folders:** `folders.createFolder({ name, parent: { id } })`. Precheck `listFolderItems` for an exact name. Planner match: parent id + **case-sensitive** `Equal.equals` on name. Duplicate exact-name siblings → `BlockedByAmbiguity`. No folder PUT. Sequential apply. Rejects Delete/Replace/destructive.
- **Collaborations:** `userCollaborations.createCollaboration` with `accessibleBy.login` (user) or `id` (group), `item` folder, `role`. **`notify` is omitted.** Updates: `updateCollaborationById` role only. Listing: `listFolderCollaborations` per folder (marker pages, limit 1000; **no** `usemarker`, **no** `fields`). Pending principal: `accessibleBy.login`/`id`, else `inviteEmail`. Collab etag always `O.none()`.
- **Webhooks:** `createWebhook({ address, target: { id, type: folder }, triggers })`. Match: target+address; triggers compared **sorted**.
- **Identity:** `users.getUserMe({ fields: ["id", "enterprise"] })`; fails if `enterprise.id` missing.
- **Metadata/retention:** inventory lists enterprise+global templates, folder metadata on root, cascade policies, retention policies+assignments. 403 `access_denied_insufficient_permissions` / `insufficient_scope` → PermissionBlocked; **other 403 + asserted unavailable → BlockedByEntitlement**. Planner always Blocks metadata/retention (entitlement or out-of-scope-v1).
- **Folder items:** marker pages, `usemarker: true`, limit 1000. FolderMini requires `name`; Folder--Base includes `etag`.

---

## Q1 — POST `/2.0/folders` (name collision)

### Duplicate name → HTTP 409 `item_name_in_use`

**Verdict:** Confirmed. Creating a folder whose name already exists in that parent returns **409** with Box code **`item_name_in_use`**. Common-errors message: same-name *item* (file **or** folder) already exists — a sibling **file** named `Contracts` also blocks a folder `Contracts`.

> "Returned if a folder with the name already exists"

— POST `/folders` 409 description, [Create folder](https://developer.box.com/reference/post-folders), 2026-09-02.

Also: “Item with the same name already exists” — [common-errors](https://developer.box.com/guides/api-calls/permissions-and-errors/common-errors) `item_name_in_use` (under **409**).

OpenAPI `ClientError.code` enum lists `conflict` and `item_name_invalid`, **not** `item_name_in_use`. Treat the endpoint/common-errors code as authoritative; the enum is incomplete.

### Uniqueness is case-insensitive

**Verdict:** Confirmed. Box uniqueness is **case-insensitive**. Reconciler match is **case-sensitive**. `New Folder` vs existing `new folder` → planner **Create**, API **409**.

> "The name check is case-insensitive"

— OpenAPI `POST /folders` `name` description, [Create folder](https://developer.box.com/reference/post-folders), 2026-09-02.

### Trailing spaces, `/` `\`, `.` `..`, non-printable ASCII

**Verdict:** Confirmed forbidden. **Leading** whitespace: **UNVERIFIED** (docs only call out trailing spaces).

> "names with trailing spaces are prohibited."

— [Create Folder guide](https://developer.box.com/guides/folders/single/create), 2026-09-02.

OpenAPI also forbids non-printable ASCII, `/`, `\`, and names `.` and `..`. Common-errors **400** `item_name_invalid`: “Item name invalid”.

### Length 1–255

**Verdict:** Confirmed. OpenAPI `minLength: 1`, `maxLength: 255`. Too long → **400** `item_name_too_long`.

> "Box only supports file or folder names that are 255 characters or less."

— [common-errors](https://developer.box.com/guides/api-calls/permissions-and-errors/common-errors) `item_name_invalid` / `item_name_too_long`, 2026-09-02.

### `context_info.conflicts` on folder 409

**Verdict:** **UNVERIFIED for POST `/folders`.** That 409 content schema is **`ClientError`**, not `ConflictError`. `ConflictError.context_info.conflicts` is **file** conflicts (`x-box-tag: uploads`). A .NET **uploads** sample recovers an existing folder id from `BoxConflictException.ConflictingItems` — SDK/upload-guide, not the folder-create REST schema.

> "A list of the file conflicts that caused this error."

— OpenAPI `ConflictError`, [box-openapi.json](https://developer.box.com/box-openapi.json) 2024.0, 2026-09-02.

Do not parse folder-create 409 as a documented `conflicts[]` of folders.

---

## Q2 — POST `/2.0/collaborations`

### `notify` query param

**Verdict:** Optional boolean. Effect: whether users get email for the action. Example `true`. **Default UNVERIFIED** (no `default` in OpenAPI). Reconciler **omits** it — invite email may still send.

> "Determines if users should receive email notification for the action performed."

— [Create collaboration](https://developer.box.com/reference/post-collaborations) `notify`, 2026-09-02.

### `accessible_by.login` vs `id`

**Verdict:** Confirmed. `type` is required (`user`|`group`). Users: `id` **or** `login` (email). Groups: `id` only.

> "Alternatively, use `login` to specify a user by email address."

— POST `/collaborations` `accessible_by.id` description, [Create collaboration](https://developer.box.com/reference/post-collaborations), 2026-09-02.

Share-content guide: invite with user ID **or** email, item id, and role. Node v10 sample uses `accessibleBy.id`; curl sample uses `"login": "user@example.com"`.

### Unregistered invitee: `invite_email`, `status=pending`, redacted `name`

**Verdict:** Confirmed. Unregistered collaborator email is `invite_email`. Status enum: `accepted` | `pending` | `rejected`. Pending: `name` is empty; **`login` is still returned** on `User--Collaborations`. Collaboration `item` is **`null` when pending**.

> "The email address used to invite an unregistered collaborator"

— Collaboration `invite_email`, OpenAPI 2024.0 / [Create collaboration](https://developer.box.com/reference/post-collaborations), 2026-09-02.

> "If the collaboration status is `pending`, a login value is returned."

— `User--Collaborations.login`, OpenAPI 2024.0, 2026-09-02.

POST prose: if pending, field `name` is redacted whether created via `user_id` or `login`.

Inventory listing passes the **folder id from the list call**, so pending `item: null` is not a listing blocker. Principal falls back to `inviteEmail` if `accessible_by` login/id is missing.

`GET /collaborations?status=pending` is the **current user’s** pending invites, not the folder listing. Do not confuse with `GET /folders/:id/collaborations`.

### Roles on create vs PUT

**Verdict:** Create enum: `editor`, `viewer`, `previewer`, `uploader`, `previewer uploader`, `viewer uploader`, `co-owner`. PUT adds **`owner`** (owner change returns **204**, deletes the collab, previous owner becomes co-owner). Role strings include **spaces**.

> "The level of access granted."

— `role` field, [Create collaboration](https://developer.box.com/reference/post-collaborations) / [Update collaboration](https://developer.box.com/reference/put-collaborations-id), 2026-09-02.

### Already a collaborator

**Verdict:** Confirmed **HTTP 400** (common-errors section **400 Bad Request**, before 401), code **`user_already_collaborator`**. Not 409. Re-applying the same editor collab is a client error, not a conflict payload.

> "User is already a collaborator"

— [common-errors](https://developer.box.com/guides/api-calls/permissions-and-errors/common-errors) `user_already_collaborator`, 2026-09-02.

### CCG Service Account can share owned content

**Verdict:** Confirmed that a Service Account owns its own folder tree and is documented for “content distribution” / share regardless of invitee auth status. API applies the **same permission model as the web app**; the SA can invite on items it **owns**. Domain-restriction / information-barrier failures: POST collab **403** documents `forbidden_by_policy` (information barriers). **Enterprise collaboration-domain deny codes on Business: UNVERIFIED** beyond that.

> "Upload and share files with users regardless of their authentication status"

— [User types](https://developer.box.com/guides/getting-started/users) Service Account use cases, 2026-09-02.

> "Box applies the same permission model through the API as in the Box web app."

— [Collaborations](https://developer.box.com/guides/collaborations), 2026-09-02.

Groups: Add Users says groups are **Business Plus and Enterprise**. First-apply uses a **user** editor, not a group.

---

## Q3 — Business plan and external collaborators

### Externals permitted without Admin-Console pre-provision

**Verdict:** Confirmed. External partners are added as folder collaborators; Box puts them on the external-user list.

> "You can simply add them as collaborators to a folder."

— [Add Users](https://support.box.com/hc/en-us/articles/360043694594-Add-Users), 2026-09-02.

### Business seats include externals; Plus+ have unlimited externals

**Verdict:** Confirmed. **Starter/Business:** seats = internal **and** external. **Business Plus / Enterprise / Enterprise Plus / Enterprise Advanced:** seats = internal only; unlimited external collaborators. About External Users: on plans without unlimited collaborators, excess externals **contribute to purchased seat count**.

> "seats refer to both internal and external users."

— [I Have More Users Than Seats Error](https://support.box.com/hc/en-us/articles/360043695374-I-Have-More-Users-Than-Seats-Error), 2026-09-02.

> "you have unlimited external collaborators."

— same article, Business Plus+ paragraph, 2026-09-02.

### API refuse vs succeed when over seats

**Verdict:** **UNVERIFIED.** Those articles are billing/admin, not REST error codes. No official `developer.box.com` code for “no seats left” was found.

### Managed vs external vs invited-not-joined

**Verdict:**
- **Managed Users:** enterprise members, consume a standard license, share enterprise ID / typically the managed domain.
- **External Users:** collaborators **outside** the org — other enterprise or free personal; not created in Admin Console; email not on managed domain. Appear under Users & Groups → External Users.
- **Pending collaboration:** invite sent, not accepted (`status=pending`). Unregistered invitee is not yet a Box user; `invite_email` holds the address.
- In-domain invite **auto-provisioning a managed user:** **UNVERIFIED** as an API guarantee (support “invite to become managed” is an Admin action, not POST collab).

> "External Users are collaborators from outside your organization"

— [User types](https://developer.box.com/guides/getting-started/users), 2026-09-02.

---

## Q4 — Folder collaborations and items listings

### Folder collaborations pagination

**Verdict:** **Marker-based only.** 200 schema is `Collaborations` (`limit`, `next_marker`, `prev_marker`). Query: `fields`, `limit` (example 1000), `marker`. **No `offset`. No `usemarker` parameter** on this operation. The `marker` description still says it “requires `usemarker` to be set to `true`” — leftover text from dual-pagination endpoints; **do not send `usemarker` here**. Reconciler omission is correct.

> "This list includes pending collaborations"

— [List folder collaborations](https://developer.box.com/reference/get-folders-id-collaborations) 200, 2026-09-02.

### Pending included

**Verdict:** Confirmed. Empty folder → empty collection. Pending rows have `status=pending`.

### Folder items pagination

**Verdict:** Dual: offset (default `offset=0`) **or** `usemarker=true` + `marker`. Only one method at a time. Reconciler uses marker + `usemarker=true`. Collection `Items` is **mini** representations.

> "Only one pagination method can be used at a time."

— [List items in folder](https://developer.box.com/reference/get-folders-id-items) `usemarker`, 2026-09-02.

> "APIs that support both offset-based pagination and marker-based pagination require the `usemarker` query parameter"

— [Marker-based pagination](https://developer.box.com/guides/api-calls/pagination/marker-based) (that sentence continues “to be set to `true`”), 2026-09-02.

### Default Collaboration fields (`accessible_by`, `role`, `login`)

**Verdict:** Standard Collaboration properties include `accessible_by`, `role`, `status`, `invite_email`. Required only `id`,`type`. `accessible_by` is `User--Collaborations | Group--Mini`. User--Collaborations includes **`login`**. Reconciler does **not** pass `fields` → standard response, sufficient for principal+role match.

If `fields` **is** passed: OpenAPI says **mini + requested only** (standard fields dropped unless listed). Extra-fields guide says **base + requested**. Do not pass a narrow `fields` list unless `accessible_by` and `role` are included.

> "The default set of fields returned in an API response."

— [Request extra fields](https://developer.box.com/guides/api-calls/request-extra-fields) “Standard”, 2026-09-02.

### Nested folder items include `name` + `etag`

**Verdict:** Confirmed. `Items` = mini files/folders/weblinks. `Folder--Mini` adds required `name` on `Folder--Base` (`id`, `type`, `etag`). Enough for name match and etag observe.

> "A list of files, folders, and web links in their mini representation."

— OpenAPI `Items`, [List items in folder](https://developer.box.com/reference/get-folders-id-items), 2026-09-02.

---

## Q5 — PUT collaborations and folders (etag / no-op)

### Folders PUT `If-Match`

**Verdict:** Documented optional header. Mismatch → **412**. Folder `etag` exists on Folder--Base for If-Match / If-None-Match. Reconciler **never PUTs folders**.

> "Ensures this item hasn't recently changed before making changes."

— [Update folder](https://developer.box.com/reference/put-folders-id) `If-Match`, 2026-09-02.

> "Returns an error when the `If-Match` header does not match"

— same, 412 response, 2026-09-02.

### Collaborations PUT `If-Match`

**Verdict:** **Not in OpenAPI** for `PUT /collaborations/{id}` (params: `collaboration_id` only). Reconciler never sends it; planner stores collab etag as `none`. Collaboration schema has **no `etag` property**.

No quote: absence of a header in the spec is the evidence. [Update collaboration](https://developer.box.com/reference/put-collaborations-id), 2026-09-02.

### No-op PUT (same name / same role)

**Verdict:** **UNVERIFIED.** Spec does not say whether a PUT that sets the current name or role is 200 vs error. **Non-risk for first-apply-then-replan:** folder Noop is GET-only (no PUT); collab Noop skips PUT when role already matches.

---

## Q6 — Webhooks v2

### HTTPS, port 443, public IP, no self-signed, not `*.box.com`

**Verdict:** Confirmed. TLS 1.2/1.3 with FIPS ciphers.

> "The notification URL or `address` for a webhook must be a valid HTTPS URL"

— [Webhook limitations](https://developer.box.com/guides/webhooks/v2/limitations-v2), 2026-09-02.

> "The port used in the URL must be the standard HTTPS port (`443`)."

— same page, 2026-09-02.

### One webhook per item + application + user; 1000 per app+user

**Verdict:** Confirmed. A second webhook on the same item/app/user is refused even for a different trigger — update the existing webhook instead. POST **409** if that combination already exists.

> "There's a limit of one webhook for each item"

— [Webhook limitations](https://developer.box.com/guides/webhooks/v2/limitations-v2), 2026-09-02.

> "There is a limit of 1000 webhooks for each application and each user."

— same page, 2026-09-02.

> "a webhook for this combination of target, application, and user already exists"

— [Create webhook](https://developer.box.com/reference/post-webhooks) 409, 2026-09-02.

### Trigger list order stability

**Verdict:** **UNVERIFIED.** Spec lists enum values; no stability/order contract. Reconciler sorts before compare → **non-risk for Noop**.

### Cannot create on folder `0`

**Verdict:** Confirmed. Use v1 webhooks for root (out of scope here).

> "V2 webhooks cannot be created on the root folder"

— [Webhook limitations](https://developer.box.com/guides/webhooks/v2/limitations-v2), 2026-09-02.

---

## Q7 — CCG Service Account identity

### CCG `box_subject_type=enterprise` → Service Account

**Verdict:** Confirmed. `grant_type=client_credentials`; enterprise subject = application Service Account; user subject = Admin/Managed/App User (needs extra console flags).

> "If you would like to authenticate as the application's Service Account"

— [Client Credentials Grant](https://developer.box.com/guides/authentication/client-credentials) (next lines: set `box_subject_type` to `enterprise`), 2026-09-02.

### Login pattern

**Verdict:** Confirmed. Auto-generated when Admin authorizes JWT **or CCG** app.

> "Box assigns the Service Account an email address in the format:"

— [User types](https://developer.box.com/guides/getting-started/users) (format: `AutomationUser_AppServiceID_RandomString@boxdevedition.com`), 2026-09-02.

### GET `/users/me`

**Verdict:** Returns **`User--Full`**. Prose names JWT server-auth as the Service Account; CCG is also server authentication with enterprise subject = SA (CCG guide). Direct CCG sentence on this reference page: **UNVERIFIED**; identity follows the token subject.

> "this will be the service account that belongs to the application"

— [Get current user](https://developer.box.com/reference/get-users-me) (JWT server-side sentence), 2026-09-02.

`enterprise` lives on **User--Full**, not User / User--Mini. Inventory requests `fields=id,enterprise`. OpenAPI `fields`: specifying fields drops standard fields and returns **mini + requested** — `enterprise` is requested, so it should appear. Extra-fields guide instead says **base + requested**. Either interpretation still includes `enterprise` **if listed**. Omitting `fields` would also return Full (includes `enterprise`). Requesting `fields` **without** `enterprise` would drop it — that would fail the inventory tenant check.

### Admin visibility of SA-owned folders

**Verdict:** Confirmed. Primary Admin: Content Manager → search app name → **Log in to user's account**. **Not** in Users & Groups. **Co-Admins cannot** log in as the SA.

> "Only **Primary Admins** can view a Service Account's content"

— [User types](https://developer.box.com/guides/getting-started/users), 2026-09-02.

> "Service Accounts are **not** visible in the **Users & Groups** tab."

— same page, 2026-09-02.

---

## Q8 — Metadata templates and retention on Business

### Retention / Box Governance vs Business (non-Plus)

**Verdict:** Retention is **Box Governance**, add-on for **Business Plus or Enterprise**. **Business (non-Plus) is not listed.** That is a plan-entitlement fact, not an API status code.

> "Retention Policies are a feature of the Box Governance package"

— [Retention policies](https://developer.box.com/guides/retention-policies), 2026-09-02.

> "which can be added on to any Business Plus or Enterprise account."

— same Info callout, 2026-09-02.

### GET `/retention_policies` status codes

**Verdict:** Documented **200 / 400 / 404** — **no 403**. Cannot assert `BlockedByEntitlement` from a **documented** list-endpoint 403. Live behavior if Governance is absent: **UNVERIFIED** (200 empty, undocumented 403, or scope error).

> "Returns a list retention policies in the enterprise."

— [List retention policies](https://developer.box.com/reference/get-retention-policies) 200, 2026-09-02.

### GET metadata templates (enterprise / global)

**Verdict:** Documented **200 / 400** — **no 403**. Global templates exist for all enterprises; listing should succeed. Marker pagination; `marker` description again mentions `usemarker` though that param is **not** on these GETs (same leftover as folder collabs).

> "Returns all of the metadata templates within an enterprise"

— [List enterprise metadata templates](https://developer.box.com/reference/get-metadata-templates-enterprise) 200, 2026-09-02.

### POST metadata template 403 (admin-gated, not plan)

**Verdict:** Create is admin/co-admin (with “Create and edit metadata templates”) and `enterprise` scope only — **not** a Business-vs-Plus entitlement. 403 if not (co-)admin or if `global` scope.

> "Creating metadata templates is restricted to users with admin permission."

— [Create metadata template](https://developer.box.com/guides/metadata/templates/create), 2026-09-02.

### GET folder metadata 403 on root `0`

**Verdict:** Documented **`forbidden`** — **root restriction**, not Governance. If inventory roots at `0` and treats non-permission 403 + “asserted unavailable” as entitlement, this is a **false `BlockedByEntitlement`**.

> "this operation is not allowed on the Root folder."

— [List metadata on folder](https://developer.box.com/reference/get-folders-id-metadata) 403 `forbidden`, 2026-09-02.

---

## Implications for a first apply

Context: create a **32-folder tree**, add **one external editor** collaboration, re-plan expecting **all-Noop**. At most ten bullets.

1. **Exact-case names, empty parent:** first apply **Create**; replan **Noop**. Marker `limit=1000` covers 32 children. **Non-risk** if desired names are identical including case.
2. **Case-only mismatch vs an existing sibling:** planner **Create** (case-sensitive match), API **409 `item_name_in_use`** (case-insensitive uniqueness). **Risk.** Same 409 if a **file** already uses that item name.
3. **Illegal names** (trailing space, `/` `\`, `.` `..`, non-printable, length>255): **400** `item_name_invalid` / `item_name_too_long`. Leading-space: **UNVERIFIED**. Duplicate exact-name desired siblings: planner **BlockedByAmbiguity** (never hits the API).
4. **External editor via `accessible_by.login`:** POST succeeds as **`pending`**; folder listing **includes pending**; `login` and/or `invite_email` let the matcher **Noop** on replan. Second apply of the same collab: **400 `user_already_collaborator`**, not 409. Pending `item` is null — listing must keep using the folder id (reconciler does).
5. **`notify` omitted:** default **UNVERIFIED** — invitee may still get email. **Not** a plan-shape risk.
6. **Business seats:** that external collaborator **counts as a paid seat**. API failure when over capacity: **UNVERIFIED**. Plus+ would not consume a seat for the external.
7. **Replan Noop is GET-only:** no folder PUT, no collab `If-Match`, collab etag always none. No-op PUT success **UNVERIFIED** and unused. Folder etags are observed on items listing; they do not gate Create. **Non-risk** for all-Noop if GET listings match.
8. **Webhooks (if in desired state):** HTTPS:`443` only; **one** per folder+app+SA; **409** on duplicate; **cannot** attach to folder `0`. Trigger order **UNVERIFIED**; planner sort makes replan Noop **non-risk**.
9. **`GET /users/me`:** keep requesting `enterprise` (or omit `fields` entirely). SA-created folders are **invisible in Users & Groups**; only **Primary Admin** Content Manager “Log in to user's account” sees them. Co-Admin cannot. First-apply success is not disproven by the folders missing from Users & Groups.
10. **Do not treat list-endpoint emptiness or root-`0` 403 `forbidden` as Governance entitlement.** GET retention/templates **do not document 403**; GET folder metadata `forbidden` on `0` is a **root restriction**. Retention is Governance on **Business Plus/Enterprise**, not Business — assert that from **plan**, not from a missing 403.

---

## Sources (official only)

- OpenAPI 2024.0: https://developer.box.com/box-openapi.json
- https://developer.box.com/reference/post-folders
- https://developer.box.com/guides/folders/single/create
- https://developer.box.com/reference/post-collaborations
- https://developer.box.com/guides/collaborations
- https://developer.box.com/guides/collaborations/share-content
- https://developer.box.com/guides/api-calls/permissions-and-errors/common-errors
- https://developer.box.com/reference/get-folders-id-collaborations
- https://developer.box.com/reference/get-folders-id-items
- https://developer.box.com/guides/api-calls/pagination/marker-based
- https://developer.box.com/guides/api-calls/request-extra-fields
- https://developer.box.com/reference/put-folders-id
- https://developer.box.com/reference/put-collaborations-id
- https://developer.box.com/reference/post-webhooks
- https://developer.box.com/guides/webhooks/v2/limitations-v2
- https://developer.box.com/guides/authentication/client-credentials
- https://developer.box.com/reference/get-users-me
- https://developer.box.com/guides/getting-started/users
- https://developer.box.com/guides/retention-policies
- https://developer.box.com/reference/get-retention-policies
- https://developer.box.com/reference/get-metadata-templates-enterprise
- https://developer.box.com/guides/metadata/templates/create
- https://developer.box.com/reference/get-folders-id-metadata
- https://support.box.com/hc/en-us/articles/360043694594-Add-Users
- https://support.box.com/hc/en-us/articles/360043695374-I-Have-More-Users-Than-Seats-Error
- https://support.box.com/hc/en-us/articles/32132489860115-About-External-Users
