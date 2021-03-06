/* eslint-disable no-undef */
const AAGToken = artifacts.require("AAGToken");
// const { time } = require('@openzeppelin/test-helpers');

module.exports = async function (deployer, network, accounts) {
  console.log(deployer, network, accounts);
  let tokenContractOwner = accounts[0];
  let recoveryAdmin = accounts[2];
  let admin = accounts[3];

  const timelockPeriod = 3600;

  let lossless = "0x27fce20D62f1DE73B0Ae1Dc7572F881061692de9";
  let losslessOn = false;
  if (network === "ropsten") {
    lossless = "0x27fce20D62f1DE73B0Ae1Dc7572F881061692de9";
    losslessOn = true;
  }
  if (network === "live") {
    lossless = "0xe91D7cEBcE484070fc70777cB04F7e2EfAe31DB4";
    losslessOn = true;
  }

  if (network === "harmonyTestnet") {
    tokenContractOwner = accounts[0];
    recoveryAdmin = accounts[0];
    admin = accounts[0];
  }

  await deployer.deploy(AAGToken, admin, recoveryAdmin, timelockPeriod, lossless, losslessOn, { from: tokenContractOwner });
};
