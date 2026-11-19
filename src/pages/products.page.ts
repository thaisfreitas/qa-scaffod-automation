import type { Page } from "@playwright/test";

export class ProductsPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto("/products");
  }

  async addProduct(productName: string): Promise<void> {
    // The product card has no accessible role. Add to cart is an anchor without href, so it is not a link.
    const card = this.page
      .getByText(productName, { exact: true })
      .locator("..")
      .filter({ hasText: "Add to cart" });
    await card.getByText("Add to cart", { exact: true }).first().click();
    await this.page.getByRole("link", { name: "View Cart" }).click();
  }
}
