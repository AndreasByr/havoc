# Setup Wizard UAT Runbook (S02 / T04)

This runbook is the manual verification source of truth for the setup wizard end-to-end flow.

## Preconditions

- Hub is running and reachable.
- Bot service is reachable for positive bot-connection verification.
- Test Discord app credentials are available for wizard setup.
- You can access `/dev` in the hub environment.

## 1) Reset setup state

1. Open `/dev`.
2. Trigger the setup reset action.
3. Confirm the action succeeds.
4. Visit `/setup` and verify the wizard appears at the first step.

## 2) Community step

1. Fill community information (name and slug).
2. Continue to the next step.
3. Verify step progression is successful.

## 3) Platform config step (Discord required, Matrix optional)

### 3.1 Negative path: invalid Discord token

1. Enter Discord credentials with an intentionally invalid bot token.
2. Submit/save platform configuration.
3. Verify a validation error is shown in the step error block.
4. Expected behavior: setup does **not** progress to admin login.

### 3.2 Positive path: valid Discord token

1. Replace invalid token with valid Discord credentials.
2. Submit/save platform configuration.
3. Verify save succeeds and flow continues.

### 3.3 Optional Matrix

1. (Optional) Provide Matrix homeserver/user/token values.
2. Save and verify Discord + Matrix can coexist in platform setup.

## 4) Admin login / OAuth step

1. Continue to admin login and complete Discord OAuth.
2. Verify setup completion succeeds.

## 5) Completion and redirect behavior

1. After completion, revisit `/setup`.
2. Verify `/setup` redirects to `/dashboard` once setup is complete.

## 6) Bot connection status on Complete screen

1. Complete setup with bot reachable.
2. Verify complete screen shows the "Bot connected" state.

## Failure-mode checks (operator-facing)

Validate these messages through API and UI surfaces:

- Missing `NUXT_BOT_INTERNAL_URL` on reload call:
  - Expected status: `503`
  - Expected statusMessage: `Bot internal URL is not configured. Set NUXT_BOT_INTERNAL_URL in .env.`

- Missing `NUXT_BOT_INTERNAL_TOKEN` on reload call:
  - Expected status: `503`
  - Expected statusMessage: `Bot internal token is not configured. Set NUXT_BOT_INTERNAL_TOKEN in .env.`

- Bot unreachable / bot returns 5xx during reload call:
  - Expected status: `502`
  - Expected statusMessage contains: `docker compose restart bot`

## Notes

- Automated browser verification is intentionally not the primary check here because it requires a running multi-service dev stack and real Discord credentials.
- Keep this runbook updated when setup wizard UX or API error contracts change.
