const AAGToken = artifacts.require("AAGToken");

import { expectEvent, time } from "@openzeppelin/test-helpers";

contract("AAG Token custom", (accounts) => {
  const TOTAL_SUPPLY = 1000000000e18;
  const recoveryAdmin = accounts[0];
  const admin = accounts[1];
  let blockTime;
  let tokenContract;
  describe("Token unlock and claim functions", () => {
    it("Should mint a 1 000 000 000 AAG tokens to the admins account", async () => {
      tokenContract = await AAGToken.deployed();
      const balanceLocked = await tokenContract.balanceOf(tokenContract.address);
      assert.equal(TOTAL_SUPPLY / balanceLocked, 1, "1 000 000 000 is not in the first account");
    });

    it("Set IDO date (AAG token birthday)", async () => {
      const blockTime = await time.latest();
      const birthdayDate = blockTime.add(time.duration.hours(1));

      await tokenContract.setTokenBirthday(birthdayDate);
      const birthday = await tokenContract.getBirthdayDate();
      assert.equal(birthday.toString(), birthdayDate, "Birthday date set correctly");
      let errorMessage;
      try {
        await tokenContract.setTokenBirthday(birthdayDate);
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
        value: "42500000000000000000000000",
      });

      await time.increaseTo(blockTime.add(time.duration.days(37)));
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

      // claim all tokens
      await tokenContract.claimTreasuryTokens({ from: recoveryAdmin });
      await tokenContract.claimVestingTokens({ from: recoveryAdmin });

      const balance = await tokenContract.balanceOf(admin);
      assert.equal(balance.toString(), "1000000000000000000000000000", "Wrong amount");
    });
  });
});
