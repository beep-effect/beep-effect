# Original Document input modes and clean-step protocols

The next composition must preserve the actual pinned Document constructor,
including its failures. A source probe now calls the actual dataclass initializer
on an allocated Document, retaining field state even when initialization throws.
It invokes the original cleaner, placeholder, diff constructors and emphasis
method through trace wrappers. No constructor logic is substituted.

The 112 cases cross eight plain/markup pairs with fourteen step containers:
default, mutable lists, tuples, None, generators, identity/None-returning
callbacks and list subclasses with permissive insertion, false truth or throwing
truth. Native values distinguish literal surrogate pairs and supplementary
attribute points. Results record source/plain identity relationships, retained
step-container identity and mutation, generator state, phase events, exact diff
inputs, emphasis and partial map presence.

## Source bug is part of the compatibility contract

The original source calls `self.clean_steps.insert("html", 0)`. Python list.insert
expects the index first. Therefore default or ordinary list steps lacking html
raise TypeError before warning, cleaning or geometry. An empty tuple instead
raises AttributeError because it has no insert. None fails during membership.
Implementing a conventional prepend would change observable behavior; no such
divergence is approved here.

The tracing list records the actual call as steps:insert:html:0 before delegating
to list.insert. An initial trace wrapper tried concatenating the integer argument
directly into its log string, which raised its own TypeError. This was corrected
before sealing, so the original method now supplies the failure. A permissive
list subclass accepts those exact arguments without changing its contents; it
then receives the warning and proceeds with unchanged markup. This distinguishes
the call protocol from both ordinary prepend and unconditional refusal.

## Other constraints on the target composition

- Plain-only input evaluates step truth before deciding whether to clean. It
  retains the original source value; a custom callback can successfully return
  None as the plain field when no geometry is constructed.
- Markup-only input performs membership directly, without a preliminary truth
  check. A truth-throwing list containing html can therefore succeed in this
  branch. A false list without html still reaches the reversed insert and fails.
- Membership on a generator consumes elements. A generator containing html can
  be exhausted before clean_text iterates it; its uncleaned markup becomes plain
  text, and the constructor still builds both maps and discovers emphasis.
- Both nonempty inputs reject truthy steps without iteration. An empty generator
  is truthy and remains GEN_CREATED on this failure. A nonempty list subclass
  whose truth is false is accepted without cleaning or geometry.
- Both empty inputs fail without consulting steps. Both nonempty inputs with
  falsy steps retain supplied plain text, use markup as source, and do not
  construct maps or discover tags.

These observations rule out eagerly normalizing all steps to arrays, equating
truth with length, or repairing the insert order. Captured server protocols and
the existing owned cleaner entry are required for the next implementation.

## Reproduction and proof limits

The producer authenticates clean oracle commit/tree, CPython 3.11.15, lxml 5.1.0
and fast-diff-match-patch 2.0.1. It seals source models/clean/utils modules and its
own bytes. The repository's installed Biome formats output through stdin, with
its version recorded; no-install invocation prevents fetching another formatter.
A second export with PYTHONHASHSEED=389 is byte-identical and the repository
formatter check passes.

| Artifact | SHA-256 |
| --- | --- |
| Producer | 06635d7b92282af08f713e101e4463b8c37b730f1f80f1045dc4fc68085d2c4b |
| document-input-modes.json | 3f12e818620d16fa7ab9b3ded25c2ab8d95136bb33e70ae6eb7df746784abe37 |

There are 55 successful constructions and 57 failures: 35 ValueError, fourteen
TypeError, four AttributeError and four RuntimeError. Ten cases construct both
maps. Focused assertions in the producer enforce the reversed-insert,
permissive-insert, generator-consumption, generator-truth and None-output controls.

This is source evidence, not target constructor qualification. The owned cleaner
and connected post-cleaning geometry remain separate tested prerequisites.
Implementing/replaying the constructor protocols, whole-engine budgets, HTML
names, all other parity/accounting gates and lifecycle closeout remain open.
