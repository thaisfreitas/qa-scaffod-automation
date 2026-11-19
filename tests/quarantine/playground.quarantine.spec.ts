import { test, expect } from "../../src/fixtures/index.js";
import { Tags, meta } from "../../src/config/tags.js";

test(
  "survives dynamic ids and delayed content",
  {
    tag: [Tags.quarantine],
    ...meta("platform"),
  },
  async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);

    await page.goto("/dynamicid");
    await page.getByRole("button", { name: "Button with Dynamic ID" }).click();

    await page.goto("/loaddelay");
    await expect(page.getByRole("button", { name: "Button Appearing After Delay" })).toBeVisible();

    await page.goto("/clientdelay");
    await page.getByRole("button", { name: "Button Triggering Client Side Logic" }).click();
    await expect(page.getByText("Data calculated on the client side.")).toBeVisible({
      timeout: 20_000,
    });
  },
);

test.describe("flake lab", () => {
  test.describe.configure({ retries: 1 });

  // This is a lab signal for flaky-manager, not a pattern for product tests.
  test(
    "synthetic flake recovered on retry",
    {
      tag: [Tags.quarantine],
      ...meta("platform"),
    },
    async ({ page }, testInfo) => {
      if (testInfo.retry === 0) {
        throw new Error("Synthetic flake for quarantine lab");
      }
      await page.goto("/dynamicid");
      await expect(page.getByRole("button", { name: "Button with Dynamic ID" })).toBeVisible();
    },
  );
});
