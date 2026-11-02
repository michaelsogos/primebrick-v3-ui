# Pre-Implementation Anatomy Protocol (UI surfaces)

**Applies to:** every component, composable, control, or surface an agent
implements or modifies in this library — including changes driven by a
consumer's needs (host pages, remote module pages).

This protocol exists because every recurring anatomy regression (dropped
default affordances, overlapped trailing icons, wrong slot positions,
icon-lexical collisions) has the same root cause: **implementation from
memory instead of from the canonical reference consumer and the
component's own contract.** Good intentions are not enforcement — these
gates are mandatory and sequential.

## Gate 1 — REFERENCE LOCK

Before writing code, declare the **canonical reference** in the plan: the
existing component/consumer the new work must be a diff of (e.g. a
canonical input for a new input control). Produce an **anatomy
inventory**: slots/snippets, props, variants, spacing classes, icon
allocation, dynamic-position rules. Review the new code as **diff vs
inventory** — never vs memory.

## Gate 2 — CONTRACT READ

For every sibling component or utility consumed: read its docstring header
and props **in the file itself** and cite the usage constraints that apply
(e.g. `TextInput.trailing` two-CTA slot contract — second slot at
`right-10`, clear CTA owns `right-1.5` — `JsonEditor.minRows`/`maxHeight`,
shared `inputTrailingIconButtonClasses`). If a contract is documented in a
file's docstring, not reading it is a violation, not an oversight.

## Gate 3 — ALLOCATION CHECK

- Every new Lucide icon → grep the codebase for existing usage of that
  icon AND of the slot it will occupy. Icon imports go through
  `@primebrick/ui/vendor/lucide` — never raw `@lucide/*`.
- Icon-lexical collisions: an icon already bound to a domain concept
  (e.g. `calendar-clock` = datetime) is reserved — pick a distinct icon.
- Every new export → check the barrel (`src/lib/index.ts`,
  `utils/index.ts`) and rebuild dist before consumers see it.
Attach results to the plan.

## Gate 4 — TESTS = PRODUCT CONTRACT

Tests in this library assert **consumer-facing contract behavior** (slot
positions, default affordances, emitted events), never implementation
internals. A test that asserts the shortcut taken proves nothing.

## Gate 5 — VISUAL GATE

Where a consumer preview exists (host pages exercising the control):
before "done", verify the rendered anatomy — screenshot or live check —
against the reference. A green unit test is not evidence of rendered
anatomy.

## Gate 6 — DONE = SIGNED CHECKLIST

A UI task closes only when the plan/checklist records: reference named,
anatomy inventory produced, component contracts read, icon/export
allocations checked, contract-level tests written, rendered anatomy
verified where a consumer exists.
