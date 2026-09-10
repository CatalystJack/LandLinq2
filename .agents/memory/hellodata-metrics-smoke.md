---
name: HelloData metrics smoke tests
description: Direct tsx imports of the HelloData service can keep the database pool open after assertions finish.
---

When running a one-off TypeScript smoke test that imports the HelloData service, explicitly close the process or database pool after assertions so shell cleanup and result reporting run.

**Why:** The service import initializes a PostgreSQL connection pool; a successful test can otherwise hang until the command timeout, bypassing shell cleanup.

**How to apply:** Use an explicit process exit or pool shutdown in temporary smoke-test harnesses, and verify cleanup separately if the harness is interrupted.