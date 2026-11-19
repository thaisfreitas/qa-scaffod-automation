---
name: author-test
description: >-
  Authors a Playwright test on this platform with the generator, fixtures, and
  tags. Use when a developer asks to add, scaffold, or write a test, spec,
  API contract check, UI flow, hybrid scenario, or checkout coverage.
---

# Author a test

Write the cheapest test that proves the behavior. Read `docs/CONTRIBUTING_TESTS.md` if a rule below is unclear. Do not invent a second framework.

## Choose the layer

Decide before generating a file. Say the choice in one sentence.

- `api` when the behavior is a status code, payload, or account contract. The test uses `apiClient` and does not open a browser.
- `ui` when only the browser can prove it and no API seed is required. The test uses the built-in `page` fixture.
- `hybrid` when the UI must show data just created through the API. Tag it `@ui` plus the risk tag. Do not add `@api`.
- `quarantine` only when the developer says the test is intentionally unstable. Remove `@api` and `@ui`. Do not copy `tests/quarantine/playground.quarantine.spec.ts`.

Risk tags: `@smoke` and `@api` block the fast CI job. `@critical` and `@regression` run in the sharded regression job. `@quarantine` does not block merge.

Owner comes from the domain: `catalog` → `catalog`, `auth` → `identity`, `checkout` → `checkout`, anything else → `platform`.

## Generate, then fill

Run the generator. Do not hand-write the file path, imports, or tags.

```bash
npm run generate:test -- --domain <domain> --layer <api|ui|hybrid> --risk <smoke|critical|regression> --name <slug>
```

`--domain` and `--name` match `[a-z0-9-]`. If the generator exits because the file exists, edit that file. Do not create a second spec for the same behavior.

Then:

1. Remove `test.skip` and the scaffold comment.
2. Keep `Tags` and `...meta(owner)`.
3. Fill Arrange, Act, and Assert. Request `testUser` only when the test needs an account. Request `pages` only for a hybrid flow. The `pages` fixture already logs in.
4. Reuse `HomePage`, `AuthPage`, `ProductsPage`, and `CartPage`. Add a page object only when none of those methods cover the step.
5. Extend Zod schemas in `src/api/schemas.ts` when a new endpoint has a stable contract. Do not parse the body with `any`.

## Locators on this site

Prefer `getByRole`, `getByLabel`, and `getByTestId`. `testIdAttribute` is `data-qa`.

These Automation Exercise controls are anchors without `href`, so they are not links:

- "Logged in as {name}" is a list item. `AuthPage.expectLoggedIn` already asserts it.
- "Add to cart" is text inside the product card. `ProductsPage.addProduct` already clicks it.
- "Proceed To Checkout" is text. `CartPage.proceedToCheckout` already clicks it.

Do not replace those with `getByRole("link")`. Do not add a CSS or XPath selector.

## Prove it

Run only the new spec:

```bash
npx playwright test <path> --project=<api|ui|quarantine>
```

Read `reports/ci-summary.md`. If the spec failed and a `trace.zip` exists under `test-results/`, follow `.cursor/skills/playwright-trace/SKILL.md` before editing again. Open that zip, then close it when you are done.

- `locator_not_found`: `npx playwright trace actions --errors-only`, then `npx playwright trace snapshot <action-id> --phase before`.
- `assertion`: `npx playwright trace snapshot <action-id> --phase after`. Do not weaken the expectation to hide a wrong contract.
- `timeout_or_network`: `npx playwright trace requests --failed` and `npx playwright trace console --errors-only`. Stop and report that the site did not respond. Do not mock the API.

Report the layer you chose, the file path, and the command result.
