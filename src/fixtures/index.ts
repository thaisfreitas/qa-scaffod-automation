import { randomBytes } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ApiClient } from "../api/client.js";
import { AuthPage } from "../pages/auth.page.js";
import { CartPage } from "../pages/cart.page.js";
import { HomePage } from "../pages/home.page.js";
import { ProductsPage } from "../pages/products.page.js";

export type TestUser = {
  email: string;
  password: string;
  name: string;
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
};

export type Pages = {
  readonly home: HomePage;
  readonly products: ProductsPage;
  readonly cart: CartPage;
  readonly auth: AuthPage;
};

type PlatformFixtures = {
  apiClient: ApiClient;
  testUser: TestUser;
  pages: Pages;
};

function lazyPages(page: Page): Pages {
  let home: HomePage | undefined;
  let products: ProductsPage | undefined;
  let cart: CartPage | undefined;
  let auth: AuthPage | undefined;

  return {
    get home(): HomePage {
      return (home ??= new HomePage(page));
    },
    get products(): ProductsPage {
      return (products ??= new ProductsPage(page));
    },
    get cart(): CartPage {
      return (cart ??= new CartPage(page));
    },
    get auth(): AuthPage {
      return (auth ??= new AuthPage(page));
    },
  };
}

export const test = base.extend<PlatformFixtures>({
  apiClient: async ({ request }, use, testInfo) => {
    await use(new ApiClient(request, testInfo));
  },

  testUser: async ({ apiClient }, use, testInfo) => {
    const firstName = "Qa";
    const lastName = "User";
    const user: TestUser = {
      email: `qa.${testInfo.parallelIndex}.${testInfo.testId.slice(0, 8)}@platform.test`,
      password: `Pw1!${randomBytes(16).toString("hex").slice(0, 16)}`,
      name: firstName,
      firstName,
      lastName,
      address1: "100 Test Street",
      city: "Toronto",
      state: "Ontario",
      zipcode: "M5V2T6",
      country: "Canada",
    };

    let created = false;
    let testError: unknown;
    let teardownError: Error | undefined;
    try {
      const createdAccount = await apiClient.createAccount({
        name: user.name,
        email: user.email,
        password: user.password,
        title: "Mrs",
        birth_date: "1",
        birth_month: "1",
        birth_year: "1990",
        firstname: user.firstName,
        lastname: user.lastName,
        company: "Platform",
        address1: user.address1,
        address2: "Suite 1",
        country: user.country,
        zipcode: user.zipcode,
        state: user.state,
        city: user.city,
        mobile_number: "4165550100",
      });
      if (createdAccount.responseCode !== 201) {
        throw new Error(
          `Account create failed (${createdAccount.responseCode}): ${createdAccount.message}`,
        );
      }
      created = true;
      await testInfo.attach("test-user-email", {
        body: user.email,
        contentType: "text/plain",
      });
      try {
        await use(user);
      } catch (error) {
        testError = error;
      }
    } finally {
      if (created) {
        try {
          const deleted = await apiClient.deleteAccount(user.email, user.password);
          if (deleted.responseCode !== 200) {
            teardownError = new Error(
              `Account delete failed (${deleted.responseCode}): ${deleted.message}`,
            );
          }
        } catch (error) {
          teardownError = error instanceof Error ? error : new Error("Account delete failed");
        }
      }
    }
    if (testError !== undefined && teardownError !== undefined) {
      await testInfo.attach("account-delete-failed", {
        body: teardownError.message,
        contentType: "text/plain",
      });
    }
    if (testError !== undefined) {
      throw testError instanceof Error ? testError : new Error("Test failed");
    }
    if (teardownError !== undefined) {
      throw teardownError;
    }
  },

  pages: async ({ browser, testUser }, use, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) {
      throw new Error("pages fixture requires a project baseURL");
    }

    const bootstrap = await browser.newContext({ baseURL });
    let bootstrapClosed = false;
    try {
      const bootstrapPage = await bootstrap.newPage();
      await bootstrapPage.goto("/login");
      const auth = new AuthPage(bootstrapPage);
      await auth.login(testUser.email, testUser.password);
      await auth.expectLoggedIn(testUser.name);
      const storageState = await bootstrap.storageState();
      await bootstrap.close();
      bootstrapClosed = true;

      const context = await browser.newContext({ baseURL, storageState });
      try {
        const page = await context.newPage();
        await use(lazyPages(page));
      } finally {
        await context.close();
      }
    } finally {
      if (!bootstrapClosed) {
        await bootstrap.close();
      }
    }
  },
});

export { expect };
