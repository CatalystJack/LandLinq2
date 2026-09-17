---
name: HUD API response envelopes
description: Response-shape compatibility required when calling HUD User FMR and Income Limits endpoints.
---

HUD User API list endpoints such as listStates and listCounties can return a raw JSON array, while other endpoints may wrap their payload in a data property. Client code must normalize both forms before reading records.

**Why:** Treating every response as a data envelope silently produced unresolved locations even though the live HUD token and endpoints were working.

**How to apply:** Use a shared unwrap step for HUD responses, and keep provider failures as explicit unavailable states so a dashboard request is not blocked.