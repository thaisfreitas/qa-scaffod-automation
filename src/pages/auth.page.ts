import { expect, type Page } from "@playwright/test";

export class AuthPage {
  constructor(private readonly page: Page) {}

  async login(email: string, password: string): Promise<void> {
    await this.page.getByTestId("login-email").fill(email);
    await this.page.getByTestId("login-password").fill(password);
    await this.page.getByTestId("login-button").click();
  }

  async expectLoggedIn(name: string): Promise<void> {
    await expect(this.page.getByRole("link", { name: "Logout" })).toBeVisible();
    // The icon glyph is part of the list item, so the accessible name is not the visible sentence.
    await expect(
      this.page.getByRole("listitem").filter({ hasText: `Logged in as ${name}` }),
    ).toBeVisible();
  }
}
