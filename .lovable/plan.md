## What's happening

The signup request IS reaching the server and returning an error — it's just not surfacing visibly. From the network log:

```
POST /_serverFn/...  (sendSignupEmail)
Response: { error: "Password is known to be weak and easy to guess, please choose a different one." }
```

The password `Dawie@1976` is being rejected by Supabase's HIBP (Have I Been Pwned) leaked-password check, which is enabled on this project. The Supabase auth log confirms it: `POST /admin/generate_link → 422`.

Why the user perceives "nothing happens":
1. The signup handler throws, `signUp()`'s catch runs `toast.error(...)` — but the toast is easy to miss, and there's no inline error on the form.
2. No console log because it's a handled rejection (toast only).
3. No email because the user was never created (generate_link failed at 422).

## Fix

Frontend-only change in `src/routes/auth.tsx`:

1. Add a `signUpProblem` state (similar to existing `signInProblem`) and render an inline `<Alert variant="destructive">` above the signup form when set.
2. In `signUp()`'s catch, detect weak/pwned password messages (`"weak"`, `"easy to guess"`, `"pwned"`, `"compromised"`) and set a specific `{ kind: "weak-password" }` problem with helpful copy ("This password has appeared in known data breaches. Please choose a different one — try a longer passphrase or add unique words."). For other errors, set `{ kind: "generic", message }`.
3. Clear `signUpProblem` on input change / tab switch.
4. Add a small helper hint under the password field on the signup tab: "Avoid common passwords; passphrases work best."

No backend changes — HIBP protection stays on (it's a good security default).

## Files

- `src/routes/auth.tsx` — add inline signup error alert + weak-password detection.