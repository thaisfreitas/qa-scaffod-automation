import { test } from "../../src/fixtures/index.js";
import { Tags, meta } from "../../src/config/tags.js";

test(
  "checks out with a user seeded from the API",
  {
    tag: [Tags.ui, Tags.critical],
    ...meta("checkout"),
  },
  async ({ apiClient, testUser, pages }) => {
    // Arrange
    const catalog = await apiClient.getProducts();
    const blueTop = catalog.products.find((product) => product.name === "Blue Top");
    const fallback = catalog.products[0];
    const productName = blueTop?.name ?? fallback?.name;
    if (productName === undefined) {
      throw new Error("Catalog returned no products to add");
    }

    // Act
    await pages.products.open();
    await pages.products.addProduct(productName);

    // Assert
    await pages.cart.expectProduct(productName);
    await pages.cart.proceedToCheckout();
    await pages.cart.expectDeliveryAddressContains([testUser.firstName, testUser.address1]);
  },
);
