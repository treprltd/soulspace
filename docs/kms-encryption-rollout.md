# KMS envelope encryption — rollout runbook

*Compliance finding #4. Branch: `kms-encryption`. Built to be non-breaking and
gated behind an env var, but this touches the code that protects ALL user
content — so the dev test below is **mandatory** before prod. It cannot be
skipped.*

## What changed

- `src/lib/encryption/index.ts` now does **AES-256-GCM envelope encryption via
  AWS KMS** when `ENCRYPTION_KMS_KEY_ID` is set: each record gets a fresh KMS
  data key; the KMS-wrapped key is stored inside the ciphertext, which is
  prefixed `kms:` so `decrypt()` self-routes.
- `encrypt()` / `decrypt()` are now **async**. All 12 call sites were updated to
  `await` (typecheck enforces this — a missed await fails the build).
- **Fully backward compatible:** existing `v1` blobs (no `kms:` prefix) still
  decrypt with the static `ENCRYPTION_KEY`. If `ENCRYPTION_KMS_KEY_ID` is unset,
  new writes also use the legacy path — so **deploying this changes nothing until
  you set that env var.**
- New dep: `@aws-sdk/client-kms`. `next.config.mjs` bakes `ENCRYPTION_KMS_KEY_ID`
  into the Lambda (Amplify Gen 1 doesn't inject env at runtime).

## Prerequisites (already done on AWS)
- KMS key `soulspace-encryption` (`arn:aws:kms:us-east-1:525391386331:key/54510eb2-3631-4a62-89c9-2d28565766e6`).
- Amplify **Compute role** set to `AmplifySSRLoggingRole`, added as a **Key user**
  on the key (grants `GenerateDataKey` + `Decrypt`).

## Rollout — dev first, always

### 1. Deploy to dev
Merge `kms-encryption` → `dev` branch (deploys to dev.soulspacehealth.org). Do
**not** set the env var yet — confirm the deploy is healthy and behaves exactly
as before (legacy path, nothing changed).

### 2. Turn KMS on for dev
Set the env var on the **dev branch** in Amplify → redeploy:
```
ENCRYPTION_KMS_KEY_ID = arn:aws:kms:us-east-1:525391386331:key/54510eb2-3631-4a62-89c9-2d28565766e6
```

### 3. Test on dev (the real proof — do all of these)
- [ ] **New write:** complete a fresh session on dev. In the dev Supabase
      `session_content` table, the new row's `encrypted_context` should start
      with `kms:` and `encryption_key_ref` should be `kms-v1`.
- [ ] **Read back the new session:** open it (dashboard / session detail) and via
      `GET /api/user/data` export — content must decrypt correctly.
- [ ] **Old data still works:** open a session created *before* step 2 (its blob
      has no `kms:` prefix) — it must still decrypt (legacy `v1` path).
- [ ] **No errors** in Amplify/CloudWatch logs. If you see a credentials /
      `AccessDenied` / `AssumeRole` error, it's the role's trust policy or the
      key-user grant — fix before proceeding (see finding #4 notes).

### 4. Promote to prod (only after step 3 fully passes)
Merge `dev` → `main`, then set the **same** `ENCRYPTION_KMS_KEY_ID` on the prod
env and redeploy. Repeat the step-3 checks against prod: one new session should
write a `kms:` blob, old prod sessions must still open.

### Rollback
If anything is wrong: **remove `ENCRYPTION_KMS_KEY_ID`** and redeploy. New writes
revert to the legacy key immediately. Any `kms:` rows written while it was on
still need the env var set to decrypt — so only roll back if no real user data
was written under KMS yet, or keep the var set and investigate forward.

## Notes
- **Rotation:** enable annual rotation on the KMS key (KMS console → Key
  rotation). Because data keys are wrapped by the KMS key, rotation is
  transparent — old data keeps decrypting.
- **Performance:** one KMS call per new encryption and per first decrypt of a
  record; unwrapped data keys are cached (bounded LRU) so repeated reads don't
  re-hit KMS.
- **Separate keys per env** (optional, cleaner): create a second KMS key for dev
  and point the dev env var at it, so dev and prod never share key material.
