import { expect, type Page } from "@playwright/test";

export class CartPage {
  constructor(private readonly page: Page) {}

  async expectProduct(productName: string): Promise<void> {
    await expect(this.page.getByRole("row", { name: productName })).toBeVisible();
  }

  async proceedToCheckout(): Promise<void> {
    // The checkout control is an anchor without an href, so it has no link role.
    await this.page.getByText("Proceed To Checkout", { exact: true }).click();
  }

  async expectDeliveryAddressContains(fragments: readonly string[]): Promise<void> {
    // Automation Exercise uses the heading "Your delivery address" inside the delivery address list.
    const delivery = this.page
      .getByRole("list")
      .filter({ has: this.page.getByRole("heading", { name: "Your delivery address" }) });
    for (const fragment of fragments) {
      await expect(delivery).toContainText(fragment);
    }
  }
}
