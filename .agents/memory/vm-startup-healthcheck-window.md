---
name: VM startup healthcheck window
description: How to distinguish transient deployment startup probes from steady-state application failures.
---

Deployment logs can show an initial connection refusal followed by repeated healthcheck 500s before the application begins listening and marks heavy initialization complete. Later successful API and asset responses indicate a startup readiness window, not necessarily an application crash or route-level 502.

**Why:** Reserved VM promotion probes the forwarded port while the Node process is still loading routes and initialization jobs, so early failures can look like an application outage without matching request failures after startup.

**How to apply:** Compare probe timestamps with the app's listening/ready markers, then test the affected API and static asset after readiness. Attribute a persistent 502 to the application only when it has a matching post-start request or process error.