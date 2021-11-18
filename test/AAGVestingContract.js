const AAGToken = artifacts.require("AAGToken");
const AAGVestingContract = artifacts.require("AAGVestingContract");

import { time } from "@openzeppelin/test-helpers";

contract("AAGVestingContract", (accounts) => {
  const TOTAL_SUPPLY = 1000000000e18;

  const vestingWalletOwner = accounts[1]; // vesting wallet
  const recoveryAdmin = accounts[2];
  const admin = accounts[3];

  let tokenContract;
  let vestingContract;
  let blockTime;

  it("Should mint a 1 000 000 000 AAG tokens to the admins account", async () => {
    tokenContract = await AAGToken.deployed();
    vestingContract = await AAGVestingContract.deployed();
    blockTime = await time.latest();
    const balanceLocked = await tokenContract.balanceOf(tokenContract.address);
    assert.equal(TOTAL_SUPPLY / balanceLocked, 1, "1 000 000 000 is not in the first account");
  });

  it("Set IDO date and claim tokens", async () => {
    // Set token birthday
    blockTime = await time.latest();
    const birthdayDate = blockTime.add(time.duration.minutes(1));
    await tokenContract.setTokenBirthday(birthdayDate, { from: recoveryAdmin });
    const birthday = await tokenContract.getBirthdayDate();
    assert.equal(birthday.toString(), birthdayDate, "Birthday date set correctly");

    // Claim tokens
    await time.increaseTo(blockTime.add(time.duration.days(41)));
    await tokenContract.claimInitialPoolTokens({ from: recoveryAdmin });

    blockTime = await time.latest();
    await time.increaseTo(blockTime.add(time.duration.days(41)));

    await tokenContract.claimTreasuryTokens({ from: recoveryAdmin });
    await tokenContract.claimVestingTokens({ from: recoveryAdmin });

    // Test balance
    await tokenContract.transfer(vestingWalletOwner, "1000000000000000000000000000", { from: admin });
    let balance1 = await tokenContract.balanceOf(vestingWalletOwner);
    assert.equal(balance1.toString(), "1000000000000000000000000000", "Wrong amount");
  });

  it("Set vesting and test data", async () => {
    // Create vesting schedule for 4 years that starts after 1 minute
    blockTime = await time.latest();
    const vestingStart = blockTime.add(time.duration.minutes(1));
    await tokenContract.increaseAllowance(vestingContract.address, "1000000000000000000000000", { from: vestingWalletOwner });
    await vestingContract.createVestingSchedule(accounts[5], "1000000000000000000000000", vestingStart, 4 * 365, { from: vestingWalletOwner });

    // Test balance in the vesting contract
    let vestingContractBalance = await tokenContract.balanceOf(vestingContract.address);
    assert.equal(vestingContractBalance.toString(), "1000000000000000000000000", "Incorrect balance in the vesting wallet");
  });

  it("Vest for 1 year & withdraw", async () => {
    // Increase time one year
    blockTime = await time.latest();
    await time.increaseTo(blockTime.add(time.duration.days(365)));

    // Test available balance
    let available2 = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[5]);
    assert.equal(available2.toString().substr(0, 6) === "249999" && available2.toString().length === 24, true, "Incorrect unlocked amount");

    // Withdraw and test account balance after
    await vestingContract.withdraw({ from: accounts[5] });
    let vestedAndDrawnBalance = await tokenContract.balanceOf(accounts[5]);
    assert.equal(vestedAndDrawnBalance.toString().substr(0, 6) === "249999" && vestedAndDrawnBalance.toString().length === 24, true, "Incorrect amount after 100 days");
  });

  it("Vest for 3 more years & withdraw", async () => {
    // Increase time 3 years and one day
    blockTime = await time.latest();
    await time.increaseTo(blockTime.add(time.duration.days(365 * 3 + 1)));

    // Test schedule data after 4 years
    let account2Balance = await tokenContract.balanceOf(accounts[5]);
    let available2 = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[5]);
    let vestingContractBalance = await tokenContract.balanceOf(vestingContract.address);
    let fullVestingInfo2 = await vestingContract.vestingScheduleForBeneficiary(accounts[5]);

    assert.equal(vestingContractBalance.toString().substr(0, 6), "750000");
    assert.equal(available2.toString().substr(0, 6), "750000");
    assert.equal(account2Balance.toString().substr(0, 6), "249999", "");
    assert.equal(fullVestingInfo2._canceledTimestamp.toString(), "0", "");
    assert.equal(fullVestingInfo2._amount.toString(), "1000000000000000000000000", "");
    assert.equal(fullVestingInfo2._totalDrawn.toString().substr(0, 6), "249999", "");
    assert.equal(fullVestingInfo2._lastDrawnAt.toString() !== 0, true, "");
    assert.equal(fullVestingInfo2._withdrawRate.toString(), "7927447995941146", "");
    assert.equal(fullVestingInfo2._remainingBalance.toString().substr(0, 6), "750000", "");

    await vestingContract.withdraw({ from: accounts[5] });

    account2Balance = await tokenContract.balanceOf(accounts[5], { from: accounts[5] });
    assert.equal(account2Balance.toString(), "1000000000000000000000000", "Incorrect balance after withdraw");

    // Trying to withdraw one more time
    let error = "";
    try {
      await vestingContract.withdraw({ from: accounts[5] });
    } catch (e) {
      error = e.reason;
    }
    assert.equal(error, "Nothing to withdraw", "Vesting should be over");

    // Vesting contract balance should be zero
    vestingContractBalance = await tokenContract.balanceOf(vestingContract.address, { from: accounts[5] });
    assert.equal(vestingContractBalance.toString(), "0", "Vesting contract should be zero");
  });

  it("Handle insuficient balance and duplicated vesting", async () => {
    // fetch balance before actions
    let adminBalancePre = await tokenContract.balanceOf(vestingWalletOwner, { from: vestingWalletOwner });

    // Try to create second schedule
    blockTime = await time.latest();
    const vestingStart = blockTime.add(time.duration.minutes(1));
    let errorMessage = "";
    try {
      await vestingContract.createVestingSchedule(accounts[5], "1000000000000000000000000", vestingStart, 4 * 365, { from: vestingWalletOwner });
    } catch (e) {
      errorMessage = e.reason;
    }
    assert.equal(errorMessage, "Schedule already exists", "Allows to create duplicated schedules");

    // Try to create vesting schedule with insufficient allowance
    errorMessage = "";
    try {
      await vestingContract.createVestingSchedule(accounts[6], "22000000000000000000000000", vestingStart, 4 * 365, { from: vestingWalletOwner });
    } catch (e) {
      errorMessage = e.reason;
    }
    assert.equal(errorMessage, "ERC20: transfer amount exceeds allowance", "Allows create schedule with unavailable balance");

    // Test if balance admin balance has changed (Should be unchanged)
    let adminBalance = await tokenContract.balanceOf(vestingWalletOwner);
    assert.equal(adminBalance.toString(), adminBalancePre, "Admin balance should stay unchanged");
  });

  it("Set vesting for two years and cancel after 6 months", async () => {
    // Increase allowance for vesting contract
    await tokenContract.increaseAllowance(vestingContract.address, "1000000000000000000000000", { from: vestingWalletOwner });

    // Create vesting schedule for accounts[6]
    blockTime = await time.latest();
    const vestingStart = blockTime.add(time.duration.minutes(1));
    await vestingContract.createVestingSchedule(accounts[6], "500000000000000000000000", vestingStart, 2 * 365, { from: vestingWalletOwner });

    // Test available balance then schedule is not started (should be zero)
    let available3 = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[6]);
    assert.equal(available3.toString(), "0");

    // Check available amount after 180 days
    await time.increaseTo(blockTime.add(time.duration.days(180)));
    available3 = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[6]);
    assert.equal(available3.toString().substr(0, 6) === "123287" && available3.toString().length === 24, true, "Incorrect unlocked amount 1");

    // Cancel and check information
    await vestingContract.cancelVestingForBeneficiary(accounts[6], { from: vestingWalletOwner });

    let fullVestingInfo = await vestingContract.vestingScheduleForBeneficiary(accounts[6]);

    blockTime = await time.latest();

    // Check if cancelation time updated to the latest block time
    assert.equal(fullVestingInfo._canceledTimestamp.toString(), blockTime.toString(), "");

    // Amount should be deducted to 6 months vesting total
    assert.equal(fullVestingInfo._amount.toString().substr(0, 6), "123287", "");
    assert.equal(fullVestingInfo._amount.toString().length, 24, "");
    assert.equal(fullVestingInfo._remainingBalance.toString().substr(0, 6), "123287", "");

    // // Expect unuesed tokens to be transfered to admin
    let vestingWalletOwnerBalance = await tokenContract.balanceOf(vestingWalletOwner);
    assert.equal(vestingWalletOwnerBalance.toString().substr(0, 7), "9988767", "Incorrected unlocked amount 2");

    // Get available balance and evaluate it
    let availableAfterCancel3 = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[6]);
    assert.equal(availableAfterCancel3.toString().substr(0, 6) === "123287" && availableAfterCancel3.toString().length === 24, true, "Incorrected unlocked amount 2");
  });

  it("Check if vesting is canceled properly", async () => {
    // Fetch available tokens now
    let availableAfterCancel3 = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[6]);
    await time.increaseTo(blockTime.add(time.duration.days(180)));

    // Fetch available tokens after 180 days
    let availableAfterCancel3later = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[6]);
    assert.equal(availableAfterCancel3.toString().substr(0, 12), availableAfterCancel3later.toString().substr(0, 12), "Vesting not canceled properly");

    // Try to create second schedule for wallet
    let errorMessage = "";
    try {
      blockTime = await time.latest();
      const vestingStart = blockTime.add(time.duration.minutes(1));
      await vestingContract.createVestingSchedule(accounts[6], "500000000000000000000000", vestingStart, 2 * 365, { from: vestingWalletOwner });
    } catch (e) {
      errorMessage = e.reason;
    }
    assert.equal(errorMessage, "Schedule already exists", "Allows to create duplicated schedules");

    // Withdraw available balance
    await vestingContract.withdraw({ from: accounts[6] });
    blockTime = await time.latest();
    let vestedAndDrawnBalance = await tokenContract.balanceOf(accounts[6]);
    assert.equal(vestedAndDrawnBalance.toString().substr(0, 6) === "123287" && vestedAndDrawnBalance.toString().length === 24, true, "Incorrect balance after withdraw");

    // Check vesting data after withdrawal
    let fullVestingInfo = await vestingContract.vestingScheduleForBeneficiary(accounts[6]);
    assert.equal(fullVestingInfo._remainingBalance.toString(), "0", "");
    assert.equal(fullVestingInfo._totalDrawn.toString().substr(0, 6), "123287", "");
    assert.equal(fullVestingInfo._lastDrawnAt.toString(), blockTime, "");
  });

  it("Create schedules, but execute emergency withdrawal", async () => {
    // Create few vesting schedules for testing
    let blockTime = await time.latest();
    const vestingStart = blockTime.add(time.duration.minutes(1));
    await vestingContract.createVestingSchedule(accounts[7], "300000000000000000000000", vestingStart, 1 * 365, { from: vestingWalletOwner });
    await vestingContract.createVestingSchedule(accounts[8], "200000000000000000000000", vestingStart, 1 * 365, { from: vestingWalletOwner });

    // Check balance inside vesting contract
    let balanceInVesting = await tokenContract.balanceOf(vestingContract.address);
    assert.equal(balanceInVesting.toString(), "500000000000000000000000", "Incorrect amount in vesting contract");

    // Execute emergency withdrawal after 3 days
    blockTime = await time.latest();
    await time.increaseTo(blockTime.add(time.duration.days(3)));
    await vestingContract.emergencyWithdrawAllTokens({ from: vestingWalletOwner });

    // Check balances of recovery admin and vesting contract addresses
    balanceInVesting = await tokenContract.balanceOf(vestingContract.address);
    let balanceInRecoveryAdmin = await tokenContract.balanceOf(vestingWalletOwner);
    assert.equal(balanceInVesting.toString(), "0", "Incorrect amount in vesting contract");

    // Tokens should be returned to vesting wallet owner
    assert.equal(balanceInRecoveryAdmin.toString().substr(0, 8), "99887671", "Incorrect amount in recovery admin's wallet");
  });

  describe("token balance function", () => {
    it("No vesting schedules", async () => {
      const balance = await vestingContract.tokenBalance();
      assert.equal(balance.toString(), "0", "Empty wallet");
    });

    it("Active vesting schedule", async () => {
      const amount = "2500000000000000000000";
      let blockTime = await time.latest();
      const vestingStart = blockTime.add(time.duration.minutes(1));
      await tokenContract.increaseAllowance(vestingContract.address, amount, { from: vestingWalletOwner });
      await vestingContract.createVestingSchedule(accounts[9], amount, vestingStart, 1 * 365, { from: vestingWalletOwner });
      const balance = await vestingContract.tokenBalance();
      assert.equal(balance.toString(), amount, "Empty wallet");
    });
  });
});
