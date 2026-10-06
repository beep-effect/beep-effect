# Opportunities

Friction receipts recorded while the work happened.

1. **The reconciler inventory walks the whole tree and lists collaborations
   per folder.** What I was doing: adding 29 collaborations after the
   migration had created about 2,900 folders under the anchored root.
   Evidence: `BoxProvisioningInventory.observe` calls `scanFolderTree` on
   the root and then `observeCollaborations` over every folder found, so one
   inventory is about 6,000 provider calls and one dry-run plus apply is
   about five inventories. What would have prevented it: scope the inventory
   to desired logical keys and their ancestors, and report foreign children
   by count from the parent listing.
2. **The reconciler cannot rename.** Changing the `name` of an adopted folder
   plans a `Create` and reports the old folder as foreign. Evidence: a
   dry-run with seven renamed client folders planned 28 creates and 25
   foreign resources. Seven superseded empty folders remain. What would have
   prevented it: an `Update` action for folder names keyed by the adoption's
   provider id.
3. **Box rejects names with invisible direction marks.** Evidence: HTTP 400
   on four uploads whose names carried U+200E. The folder and file name
   rules accept them. What would have prevented it: reject or strip Unicode
   format characters in `BoxFolderName` and the migration file-name rule.
4. **A plan over an existing tree costs one listing per existing folder.**
   Evidence: 828 calls to plan the matter scope once the folders existed.
   What would have prevented it: accept folder ids from a prior journal so a
   resume plan lists only folders that hold mapped files.
5. **SDK retries are invisible to the provider-call budget.** The Box SDK
   retries 429 and 5xx internally; the engine counts a retried request once.
   What would have prevented it: a retry-strategy option on `@beep/box`.
6. **The first map keyed matters on the bare family number.** The KG's
   matter-lookup contract arrived mid-run and showed family numbers are
   reused across clients. Nothing matter-attributed had been uploaded, but
   seven client folders had been created from a superseded naming choice.
   What would have prevented it: asking the KG workstream for the matter key
   before creating any client folder.
7. **`goals bootstrap` has no writer.** The packet was materialized from the
   plan JSON by hand.
