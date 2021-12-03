const AAGToken = artifacts.require("AAGToken");

import { expectEvent } from "@openzeppelin/test-helpers";

contract("AAG Token custom", (accounts) => {
  const TOTAL_SUPPLY = 1000000000e18;
  const recoveryAdmin = accounts[2];
  const admin = accounts[3];
  let tokenContract;

  describe("Token unlock and claim functions", () => {
    it("Should mint a 1 000 000 000 AAG tokens in the contract address", async () => {
      tokenContract = await AAGToken.deployed();
      const balanceLocked = await tokenContract.balanceOf(tokenContract.address);
      assert.equal(TOTAL_SUPPLY / balanceLocked, 1, "1 000 000 000 is not in the first account");
    });

    it("Tokens are not claimable before lockout period", async () => {
      let claimRecept;

      // Initial pool
      claimRecept = await tokenContract.claimTokens({ from: recoveryAdmin });

      await expectEvent(claimRecept, "Transfer", {
        from: tokenContract.address,
        to: admin,
        value: "1000000000000000000000000000",
      });

      const balance = await tokenContract.balanceOf(admin);
      assert.equal(balance.toString(), "1000000000000000000000000000", "Wrong amount");
    });
  });
});
