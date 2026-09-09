---
name: Developer forced password reset
description: Security contract for temporary-password Investment Company accounts.
---

A DEVELOPER account marked for password reset must be blocked from the complete developer shell until it completes a one-time, tokenized password reset. Enforce this on both the server page gate and client router; do not rely only on a post-login client redirect. Entering the forced-reset flow and completing it should replace history so a one-time token URL is not resurrected by Back.

**Why:** Client-only redirects are bypassable through direct navigation, and the existing reset form requires a valid reset token. Leaving tokenized reset URLs in history makes Back reopen an expired or sensitive one-time link.

**How to apply:** Generate a reset token only after successful credential authentication (or when an authenticated reset-required user requests a protected page), and clear the reset requirement when the password update succeeds.