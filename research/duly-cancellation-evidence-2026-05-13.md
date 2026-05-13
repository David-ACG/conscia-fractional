# Duly Cancellation Evidence

Filed: 13 May 2026, 22:32 BST

Purpose: record evidence in case Duly does not cancel/unsubscribe the account or charges after the Gmail connection failed.

## Account and billing state

- Service: Duly / getduly.ai
- Billing page observed: `https://app.getduly.ai/billing`
- Plan status shown: Active
- Plan price shown: $7/month
- Next billing date shown: 20 May 2026
- Billing page text shown: "Manage your subscription and account."

## Cancellation/deletion state observed

The Duly billing page showed a "Delete account" section with the following warning:

> Permanently delete your Duly account and all associated data. Your Stripe subscription will be canceled immediately. This action cannot be undone.

The delete confirmation input contained:

```text
DELETE
```

The red button beside the confirmation input read:

```text
Delete account
```

## Reason for cancellation

The core Gmail connection failed after signup/payment details were provided.

Google OAuth displayed:

```text
Access blocked: getduly.ai has not completed the Google verification process
```

The Google error message said the app is currently being tested and can only be accessed by developer-approved testers.

Error shown:

```text
Error 403: access_denied
```

Account shown on the Google error page:

```text
duccelli@gmail.com
```

## Notes

- This suggests the Duly Gmail integration was not available for this account at the time of attempted onboarding.
- If Duly charges after this cancellation/deletion attempt, this file records that the paid account was unusable for the intended Gmail workflow.
- Relevant date for billing dispute: next billing date shown as 20 May 2026.
