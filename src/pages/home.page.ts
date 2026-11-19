import type { Page } from "@playwright/test";

export class HomePage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto("/");
  }

  async goToSignupLogin(): Promise<void> {
    await this.page.getByRole("link", { name: "Signup / Login" }).click();
  }

  async goToProducts(): Promise<void> {
    await this.page.getByRole("link", { name: "Products" }).click();
  }

  async goToCart(): Promise<void> {
    await this.page.getByRole("link", { name: "Cart" }).click();
  }
}
