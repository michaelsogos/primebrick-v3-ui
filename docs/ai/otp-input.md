# Devin Rule: OTP / PIN Code Input

> Canonical body — this doc moved WITH the component into `primebrick-v3-ui`
> (`src/lib/components/otp-input/` + `src/lib/composables/useOtpInput.svelte.ts`).
> The FE-side rule `.devin/rules/otp-input.md` in primebrick-fe-v3 remains the
> trigger and points here.

## Trigger
- Applies whenever a UI needs a short numeric verification code (MFA TOTP,
  welcome/invitation OTP, step-up auth, enrollment verify).

## Golden Rule

**Always use `OtpInput` + `useOtpInput` — never a raw `<Input>` for codes.**

```svelte
<script lang="ts">
  import { OtpInput, useOtpInput } from '@primebrick/ui';

  const otp = useOtpInput({
    onSubmit: () => verify(),          // same function the Verify button calls
    disabled: () => submitting,        // suppress re-entry while in flight
  });
</script>

<OtpInput
  id="mfa-code"
  data-testid="mfa-code-input"
  bind:value={otp.code}
  onsubmit={otp.requestSubmit}
  disabled={submitting}
/>
```

## Behavior contract (already built-in — do not reimplement)

- **Digits only** — `pattern={REGEXP_ONLY_DIGITS}` (bits-ui `PinInput`).
- **Paste** — `pasteTransformer` strips non-digits and fills all cells instantly.
- **Auto-submit** — `onsubmit` fires when all cells are filled (`onComplete`).
- **Enter** — `onsubmit` fires on Enter regardless of fill; the caller's
  verify function decides validity (same path as the Verify button).
- **No double submit** — `useOtpInput`'s `disabled` predicate suppresses
  `requestSubmit` while a request is in flight; the caller must pass the
  in-flight flag.
- **Reset on failure** — call `otp.reset()` in the error path so the user
  can retype immediately (all existing call sites do this).
- **Duplicate completion is deduped in `OtpInput`** — bits-ui `onComplete`
  lives in an `$effect` and can re-emit for the same value when the parent
  re-renders with the code still bound (observed: `finish → GET /factors →
  finish` → `MFA_ENROLLMENT_TOKEN_INVALID`). The wrapper emits each completed
  value once and re-arms only when the code becomes incomplete. Do NOT add
  per-site workarounds; if you see a duplicate submit, fix `OtpInput`.
- **Reset on success is still good hygiene** — `otp.reset()` before
  success callbacks keeps state clean, but is not required for correctness
  (the wrapper dedupes).

## Styling

Separated cells with `border-primary-gradient` (same border treatment as the
`Input` component), middle separator dash, horizontally centered. Do not
restyle per call site — adjust `src/lib/components/otp-input/otp-input.svelte`
/ `src/lib/components/input-otp/input-otp-slot.svelte` in this repo.

## Testing

Component test lives in the FE repo (`primebrick-fe-v3`,
`src/lib/__tests__/otp-input.test.ts`) — it imports `OtpInput`/`useOtpInput`
from `@primebrick/ui` and exercises the public export end-to-end. jsdom lacks
`CSS.supports`, `ResizeObserver`, and `document.elementFromPoint` (required by
bits-ui `PinInput`) — the polyfills live in the FE `vitest-setup.ts`.

## Existing call sites (keep in sync)

All in primebrick-fe-v3:

- `src/lib/components/auth/MfaChallenge.svelte` — login MFA (also refreshes the challenge on mount)
- `src/lib/components/auth/MfaStepUpDialog.svelte` — step-up authorization
- `src/lib/components/auth/MfaEnrollmentSection.svelte` — enforcer enrollment verify
- `src/lib/components/auth/MfaManagement.svelte` — settings enrollment verify
- `src/routes/welcome/+page.svelte` — invitation OTP
