# Contributing tests

Write the cheapest test that proves the behavior. The platform already handles users, tags, traces, and the merge gate.

## Choose the layer

Use the API when the behavior is a contract: status codes, payloads, and account lifecycle. An API test does not open a browser.

Use the UI when only the browser can prove the behavior, such as a control that has no API equivalent.

Use a hybrid test when the UI must show data the API just seeded. Tag hybrid tests `@ui` only. Do not also add `@api`, or the API project will run the browser flow.

## Generate

```bash
npm run generate:test
npm run generate:test -- --domain checkout --layer hybrid --risk critical --name adds-a-product
```

The flags are `--domain`, `--layer` (`api`, `ui`, or `hybrid`), `--risk` (`smoke`, `critical`, or `regression`), and `--name`. The scaffold is `test.skip` with Arrange, Act, and Assert comments. Replace the assertion and remove `skip` before review. The generator refuses to overwrite an existing file.

## Isolation

Never share an email and never log in as a fixed user. Request `testUser` only when the test needs an account. The fixture creates that account with `POST /api/createAccount` and deletes it afterwards. API tests that only check a public contract should depend on `apiClient` alone.

## Locators

Use `getByRole`, `getByLabel`, and `getByTestId`. The Playwright `testIdAttribute` is `data-qa`, which is what Automation Exercise exposes. The login form uses `login-email`, `login-password`, and `login-button`. Do not add CSS or XPath selectors.

## Reading a failure

After a run, open `reports/ci-summary.md`. Each failure includes a `failureClass`:

- `assertion` — an `expect`, a Zod contract mismatch, or an `ApiError`
- `timeout_or_network` — a timeout that is not a missing locator, or a connection failure
- `locator_not_found` — the runner was waiting on a role, label, or test id

The owning team is the `owner` annotation on the test.

## Trace Viewer

Traces are `retain-on-failure`. The zip lands under `test-results/`. Open it with:

```bash
npx playwright show-trace path/to/trace.zip
```

Screenshots are `only-on-failure`. Video uses the same retain-on-failure policy as traces.

## Quarantine

Add `@quarantine` and remove `@api` or `@ui`. The test moves to the quarantine project, which targets `http://uitestingplayground.com`, and to the non-blocking CI job. The `owner` annotation is how the owning team is alerted. See [ADR-001](ADR-001-test-isolation-and-gating.md).

The synthetic flake in `tests/quarantine/playground.quarantine.spec.ts` exists so the registry has a deterministic signal. Do not copy that pattern into a product test.
