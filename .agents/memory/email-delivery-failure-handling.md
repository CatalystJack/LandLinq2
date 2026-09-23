---
name: Email delivery failure handling
description: The shared email dispatcher reports provider failures as a false return instead of always throwing.
---

Every caller that requires delivery must inspect the boolean returned by `sendNotificationEmail`. A false result must be converted into an error or an explicit failure response before logging success.

**Why:** Provider and transport failures can be represented by a false return, so awaiting the promise alone can make password resets, invitations, and approval notifications appear successful when no message was accepted.

**How to apply:** For account-critical email, capture the result, handle false explicitly, and keep public responses identity-safe where the recipient could be a user-discovery vector.