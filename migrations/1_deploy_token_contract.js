const AAGToken = artifacts.require('AAGToken');
const AAGVestingContract = artifacts.require('AAGVestingContract');
// const { time } = require('@openzeppelin/test-helpers');

module.exports = async function (deployer, network, accounts) {
  const recoveryAdmin = accounts[0];
  const admin = accounts[1];
  const timelockPeriod = 3600;

  const lossless = accounts[2];

  await deployer.deploy(AAGToken, admin, recoveryAdmin, timelockPeriod, lossless, { from: recoveryAdmin });
  await deployer.deploy(AAGVestingContract, AAGToken.address, recoveryAdmin, { from: recoveryAdmin });

  tokenContract = await AAGToken.deployed()

  // set IDO date
  if(network !== "test"){
      if(network == "live"){
        await tokenContract.setTokenBirthday(math.round(new Date("2021-11-01") / 1000))
      }
      if(network == "test") {
        let blockTime = await time.latest();
        const birthdayDate = blockTime.add(time.duration.minutes(1))
        await tokenContract.setTokenBirthday(birthdayDate)
      }
  }
};
