const AAGToken = artifacts.require("AAGToken");
import { expectEvent, time, constants } from "@openzeppelin/test-helpers";

const { ZERO_ADDRESS } = constants;

contract("AAG Token standard", (accounts) => {
  const TOTAL_SUPPLY = 1000000000e18;
  const recoveryAdmin = accounts[2];
  const admin = accounts[3];
  let tokenContract;

  it("Set up and claim tokens", async () => {
    tokenContract = await AAGToken.deployed();
    await tokenContract.balanceOf(tokenContract.address);

    // Set birthday
    let blockTime = await time.latest();
    const birthdayDate = blockTime.add(time.duration.hours(1));
    await tokenContract.setTokenBirthday(birthdayDate, { from: recoveryAdmin });

    // Move two hours to the future and claim initial pool tokens
    await time.increaseTo(blockTime.add(time.duration.hours(2)));
    await tokenContract.claimInitialPoolTokens({ from: recoveryAdmin });

    // Move 41 days to the future and claim all other tokens
    await time.increaseTo(blockTime.add(time.duration.days(41)));
    await tokenContract.claimTreasuryTokens({ from: recoveryAdmin });
    await tokenContract.claimVestingTokens({ from: recoveryAdmin });

    // Test if initial supply is minted and transfered to admin's wallet
    const balance = await tokenContract.balanceOf(admin);
    assert.equal(balance, TOTAL_SUPPLY, "Wrong amount");
  });

  describe("ERC20 standard scenarios", () => {
    describe("values", () => {
      it("has a name", async () => {
        const name = await tokenContract.name();
        assert.equal(name, "AAG");
      });

      it("has a symbol", async () => {
        const symbol = await tokenContract.symbol();
        assert.equal(symbol, "AAG");
      });

      it("has 18 decimals", async () => {
        const decimals = await tokenContract.decimals();
        assert.equal(decimals.toString(), "18");
      });

      it("returns the total amount of tokens", async () => {
        const totalSupply = await tokenContract.totalSupply();
        assert.equal(totalSupply.toString(), TOTAL_SUPPLY);
      });
    });

    describe("balanceOf", () => {
      describe("when the requested account has no tokens", () => {
        it("returns zero", async () => {
          const balance = await tokenContract.balanceOf(accounts[4]);
          assert.equal(balance.toString(), "0", "Balance should be zero");
        });
      });
    });

    describe("transfer", () => {
      describe("Non zero address scenarios", () => {
        it("when the sender does not have enough balance", async () => {
          let error;
          try {
            await tokenContract.transfer(accounts[6], "100000000", { from: recoveryAdmin });
          } catch (e) {
            error = e.reason;
          }
          assert.equal(error, "ERC20: transfer amount exceeds balance", "Allows transactions with insuficient balance");
        });

        it("emits a transfer event", async () => {
          let adminBalance = await tokenContract.balanceOf(admin);
          const receipt = await tokenContract.transfer(accounts[5], "300000000000", { from: admin });

          await expectEvent(receipt, "Transfer", {
            from: admin,
            to: accounts[5],
            value: "300000000000",
          });

          let balanceOf2 = await tokenContract.balanceOf(accounts[5]);
          assert.equal(balanceOf2.toString(), "300000000000", "Address received tokens");

          adminBalance = await tokenContract.balanceOf(admin);
          assert.equal(adminBalance.toString(), "999999999999999700000000000", "Tokens were excluded from the balance");

          const receipt2 = await tokenContract.transfer(accounts[6], "300", { from: accounts[5] });

          await expectEvent(receipt2, "Transfer", {
            from: accounts[5],
            to: accounts[6],
            value: "300",
          });

          balanceOf2 = await tokenContract.balanceOf(accounts[5]);
          assert.equal(balanceOf2.toString(), "299999999700", "Address received tokens");

          let balanceOf3 = await tokenContract.balanceOf(accounts[6]);
          assert.equal(balanceOf3.toString(), "300", "Tokens were excluded from the balance");
        });
      });

      describe("Zero address validations", () => {
        it("Transfer to zero address", async () => {
          let error;
          try {
            await tokenContract.transfer(ZERO_ADDRESS, "99999999999999700000000000", { from: admin });
          } catch (e) {
            error = e.reason;
          }
          assert.equal(error, "ERC20: transfer to the zero address", "Allows transfers to zero address");
        });
      });
    });

    describe("transfer from", () => {
      describe("Non zero address scenarios", () => {
        it("increase allowance", async () => {
          await tokenContract.increaseAllowance(admin, "200000000", { from: accounts[4] });
          const allowance = await tokenContract.allowance(accounts[4], admin);
          assert.equal(allowance, "200000000", "Incorrect allowance amount");
        });

        it("decrease allowance", async () => {
          await tokenContract.decreaseAllowance(admin, "100000000", { from: accounts[4] });
          const allowance = await tokenContract.allowance(accounts[4], admin);
          assert.equal(allowance, "100000000", "Incorrect allowance amount");
        });

        it("executing transfer from without allowance", async () => {
          let error;
          try {
            await tokenContract.transferFrom(accounts[5], admin, "100000000");
          } catch (e) {
            error = e.reason;
          }
          assert.equal(error, "ERC20: transfer amount exceeds allowance");
        });

        it("executing transfer from with insuficient balance", async () => {
          let error;
          try {
            await tokenContract.transferFrom(accounts[4], accounts[5], "100000000", { from: admin });
          } catch (e) {
            error = e.reason;
          }
          assert.equal(error, "ERC20: transfer amount exceeds balance", "Allow transfer from without allowance");
        });

        it("executing transfer from correctly", async () => {
          await tokenContract.transfer(accounts[4], "100000000", { from: admin });
          await tokenContract.transferFrom(accounts[4], accounts[7], "100000000", { from: admin });
          const balance = await tokenContract.balanceOf(accounts[7]);
          assert.equal(balance.toString(), "100000000", "Transfer from executed incorrectly");
        });

        it("approve and execute transaction (admin -> account[7] -> account[8]", async () => {
          const amount = "200000000";
          await tokenContract.approve(accounts[7], admin, { from: admin });

          // execute one transaction
          const reciept = await tokenContract.transferFrom(admin, accounts[8], amount, { from: accounts[7] });
          await expectEvent(reciept, "Transfer", {
            from: admin,
            to: accounts[8],
            value: amount,
          });
        });
      });

      describe("Zero address validations", () => {
        describe("approve", () => {
          let amount = "200000000";
          it("approve", async () => {
            let error;
            try {
              console.log("pavyko su zero address");
              await tokenContract.approve(ZERO_ADDRESS, amount, { from: admin });
            } catch (e) {
              error = e.reason;
            }
            assert.equal(error, "ERC20: approve to the zero address");
          });

          it("increase allowance", async () => {
            let error;
            try {
              await tokenContract.increaseAllowance(ZERO_ADDRESS, amount, { from: admin });
            } catch (e) {
              error = e.reason;
            }
            assert.equal(error, "ERC20: approve to the zero address");
          });

          it("decrease allowance", async () => {
            let error;
            try {
              await tokenContract.decreaseAllowance(ZERO_ADDRESS, amount, { from: admin });
            } catch (e) {
              error = e.reason;
            }
            assert.equal(error, "ERC20: decreased allowance below zero");
          });
        });
      });
    });
  });
});
