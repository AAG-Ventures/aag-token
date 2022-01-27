/* eslint-disable no-undef */
const AAGVestingContract = artifacts.require("AAGVestingContract");

module.exports = async function (deployer, network, accounts) {
  let vestingWalletOwner = accounts[0]; // vesting wallet
  let aagTokenContract = "";

  await deployer.deploy(AAGVestingContract, aagTokenContract, { from: vestingWalletOwner });
};
