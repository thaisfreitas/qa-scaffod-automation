import { test, expect } from "../../src/fixtures/index.js";
import { Tags, meta } from "../../src/config/tags.js";

test(
  "rejects invalid and incomplete login",
  {
    tag: [Tags.api, Tags.regression],
    ...meta("identity"),
  },
  async ({ apiClient }) => {
    // Arrange

    // Act
    const invalid = await apiClient.verifyLogin("nobody@platform.test", "wrong-password");
    const incomplete = await apiClient.postVerifyLogin({ password: "secret" });

    // Assert
    expect(invalid.responseCode).toBe(404);
    expect(invalid.message).toBe("User not found!");
    expect(incomplete.responseCode).toBe(400);
  },
);
