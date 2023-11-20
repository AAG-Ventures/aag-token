/* eslint-disable no-undef */
const AAGVestingContract = artifacts.require("AAGVestingContract");

module.exports = async function (deployer, network, accounts) {
  let vestingWalletOwner = accounts[0]; // vesting wallet
  let aagTokenContract = "0xae0609a062a4eaed49de28c5f6a193261e0150ea";
  const owner = "0x40C288725051113ACa6c800b43b95F37928466B8";

  await deployer.deploy(AAGVestingContract, aagTokenContract, owner, { from: vestingWalletOwner });
};
