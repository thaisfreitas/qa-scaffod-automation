# ADR-001: Test isolation and gating

- Status: Accepted
- Date: 2026-11-19

## Context

The primary application under test is Automation Exercise, a public site with a UI and a small REST API. The flake lab is UI Testing Playground. Product engineers need parallel pull-request feedback without sharing accounts or blocking merges on a test we already know is unstable.

## Decision 1: Test-scoped users, seeded and deleted through the API

A test that needs a person requests the `testUser` fixture. The fixture calls `POST /api/createAccount` with a unique email and deletes that account after the test. Parallelism comes from Playwright workers. Isolation comes from never reusing the account.

Rejected: a worker-scoped user, which would share one account across every test on that worker. Rejected: signing the user up through the UI, which is slower and flakes before the behavior under test.

## Decision 2: UI session is a real login, then storageState

`POST /api/verifyLogin` confirms credentials. It does not mint the browser cookie the site uses. The `pages` fixture logs in once through the login form, saves `storageState`, and opens the context the page objects use. API tests never pay for a browser because `apiClient` and `testUser` depend only on Playwright's `request` fixture.

## Decision 3: A fast gate, then three regression shards

`static-and-smoke` is the required fast job. It typechecks, lints, and runs `@api` and `@smoke`. `@regression` runs in a required matrix of three shards (`--shard=1/3`, `2/3`, `3/3`). Blob reports are merged into one HTML report. `@ui @critical` stays in the regression job, so it still blocks merge without stretching the fast job toward a full browser suite.

Rejected: one giant shard. Rejected: putting the full UI suite in the two-minute job.

## Decision 4: Quarantine does not block the pull request

`@quarantine` runs in its own job with `continue-on-error: true`. That job must not be a required status check. A test that fails and then passes on retry is recorded as `flaky` in `reports/flaky-registry.json`. The synthetic UI Testing Playground test exists only to make that signal deterministic.

Rejected: failing the pull request on a known flake.

## Consequences

If account deletion returns anything other than `responseCode` 200, the fixture throws after a passing test so the leak is visible. When the test itself failed, the delete error is attached instead, so the original failure stays visible.

Shard jobs do not each publish the HTML report engineers read. The merge job does.

The quarantine job can stay red without blocking merge. The owning team is the `owner` annotation on the test.
