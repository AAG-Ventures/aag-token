/* eslint-disable no-undef */
const AAGVestingContract = artifacts.require("AAGVestingContract");

module.exports = async function (deployer, network, accounts) {
  let vestingWalletOwner = accounts[0]; // vesting wallet
  let aagTokenContract = "0x5ba19d656b65f1684cfea4af428c23b9f3628f97";

  await deployer.deploy(AAGVestingContract, aagTokenContract, { from: vestingWalletOwner });
};
