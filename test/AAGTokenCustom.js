const AAGToken = artifacts.require("AAGToken");

import { expectEvent, time } from "@openzeppelin/test-helpers";

contract("AAG Token custom", (accounts) => {
  const TOTAL_SUPPLY = 1000000000e18;
  const recoveryAdmin = accounts[2];
  const admin = accounts[3];
  let blockTime;
  let tokenContract;

  describe("Token unlock and claim functions", () => {
    it("Should mint a 1 000 000 000 AAG tokens in the contract address", async () => {
      tokenContract = await AAGToken.deployed();
      const balanceLocked = await tokenContract.balanceOf(tokenContract.address);
      assert.equal(TOTAL_SUPPLY / balanceLocked, 1, "1 000 000 000 is not in the first account");
    });

    it("Set birthday date", async () => {
      blockTime = await time.latest();
      const birthdayDate = blockTime.add(time.duration.minutes(1));
      await tokenContract.setTokenBirthday(birthdayDate, { from: recoveryAdmin });
      const birthday = await tokenContract.getBirthdayDate();
      assert.equal(birthday.toString(), birthdayDate, "Birthday date set correctly");
    });

    it("Try to overwrite birthday date", async () => {
      blockTime = await time.latest();
      const birthdayDate = blockTime.add(time.duration.minutes(1));
      let errorMessage;
      try {
        await tokenContract.setTokenBirthday(birthdayDate, { from: recoveryAdmin });
      } catch (e) {
        errorMessage = e.reason;
      }
      assert.equal(errorMessage, "Already set", "Can not set birthday date more than once");
    });

    it("Tokens are not claimable before lockout period", async () => {
      blockTime = await time.latest();
      let errorMessage;
      let claimRecept;

      // Initial pool
      claimRecept = await tokenContract.claimInitialPoolTokens({ from: recoveryAdmin });

      await expectEvent(claimRecept, "Transfer", {
        from: tokenContract.address,
        to: admin,
        value: "62500000000000000000000000",
      });

      // Increase time by 39 days
      await time.increaseTo(blockTime.add(time.duration.days(39)));

      // Treasury pool
      errorMessage = "";
      try {
        await tokenContract.claimTreasuryTokens({ from: recoveryAdmin });
      } catch (e) {
        errorMessage = e.reason;
      }
      assert.equal(errorMessage, "Still locked", "Not locked");

      // Vesting pool
      errorMessage = "";
      try {
        await tokenContract.claimVestingTokens({ from: recoveryAdmin });
      } catch (e) {
        errorMessage = e.reason;
      }
      assert.equal(errorMessage, "Still locked", "Not locked");
    });

    it("Claim public pool & treasury tokens", async () => {
      blockTime = await time.latest();

      await time.increaseTo(blockTime.add(time.duration.days(4)));

      // Claim all tokens
      await tokenContract.claimTreasuryTokens({ from: recoveryAdmin });
      await tokenContract.claimVestingTokens({ from: recoveryAdmin });

      const balance = await tokenContract.balanceOf(admin);
      assert.equal(balance.toString(), "1000000000000000000000000000", "Wrong amount");
    });
  });
});
