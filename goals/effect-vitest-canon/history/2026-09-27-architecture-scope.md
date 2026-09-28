# Architecture-lab scope and typed-error phase

Replace the two local provideScopedLayer wrappers with independent it.layer
blocks, each containing its original single facade test. ArchitectureLabServerTest
builds mutable WorkItem and Worker repositories; neither block shares stores
with the other. No repeat-build speedup is claimed. PGlite fixtures and deadlines
remain unchanged.

Keep the archived reopen Failure-tag assertion and add the expected typed
WorkItemAlreadyArchived error carrying the actual item ID via Exit.findErrorOption.
A synthetic defect and a typed archived error for the wrong ID each fail the
new oracle; exact sources are restored. No Cause is invented and no production
transition changes. Domain and Server package audits and docgen pass.
