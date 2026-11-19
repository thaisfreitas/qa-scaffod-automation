import { test, expect } from "../../src/fixtures/index.js";
import { Tags, meta } from "../../src/config/tags.js";

test(
  "creates an account and verifies login",
  {
    tag: [Tags.api, Tags.smoke],
    ...meta("identity"),
  },
  async ({ apiClient, testUser }) => {
    // Arrange
    // testUser creates the account and deletes it after this test.

    // Act
    const login = await apiClient.verifyLogin(testUser.email, testUser.password);

    // Assert
    expect(login.responseCode).toBe(200);
    expect(login.message).toBe("User exists!");
  },
);
