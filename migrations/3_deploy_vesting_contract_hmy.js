/* eslint-disable no-undef */
const AAGVestingContract = artifacts.require("AAGVestingContract");

module.exports = async function (deployer, network, accounts) {
  let vestingWalletOwner = accounts[0]; // vesting wallet
  let aagTokenContract = "0xbd9d810bb361A18B7e703d6dDC01b721e1c4BdAA";
  const owner = "0x9A3C0BB204A4cDbD788ee95bede7f1F905b413B7";

  await deployer.deploy(AAGVestingContract, aagTokenContract, owner, { from: vestingWalletOwner });
};
