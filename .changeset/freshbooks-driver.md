---
"@beep/freshbooks": minor
---

Add the `@beep/freshbooks` driver: a schema-first Effect wrapper for the
FreshBooks REST API on the `@beep/hubspot` pattern. Ships an auth-code token
helper whose single-use refresh-token rotation runs behind one refresh owner
with atomic persistence, schema-decoded read verbs for identity, clients,
invoices, and payments (distinct `account_id` / `business_id` namespaces), and
typed `LiteralKit` driver errors. Invoice-PDF retrieval is gated on the P0
endpoint-validation spike and intentionally absent until its live half
validates the endpoint.
