import { test, expect } from "../../src/fixtures/index.js";
import { Tags, meta } from "../../src/config/tags.js";

test(
  "products list matches the published contract",
  {
    tag: [Tags.api, Tags.smoke],
    ...meta("catalog"),
  },
  async ({ apiClient }) => {
    // Arrange

    // Act
    const products = await apiClient.getProducts();

    // Assert
    expect(products.products.length).toBeGreaterThan(0);
    const first = products.products[0];
    expect(first?.name.length).toBeGreaterThan(0);
    expect(first?.price.length).toBeGreaterThan(0);
  },
);
