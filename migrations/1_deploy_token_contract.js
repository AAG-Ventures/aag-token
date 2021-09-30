const AAGToken = artifacts.require('AAGToken');
const AAGVestingContract = artifacts.require('AAGVestingContract');
// const { time } = require('@openzeppelin/test-helpers');

module.exports = async function (deployer, network, accounts) {
  const owner = accounts[0];

  await deployer.deploy(AAGToken, { from: owner });
  await deployer.deploy(AAGVestingContract, AAGToken.address, { from: owner });

  tokenContract = await AAGToken.deployed()

  await tokenContract.changeVestingContractAddress(
      owner,
      { from: owner  },
  );

  // set IDO date
  if(network !== "test"){
      if(network !== "live"){
        let blockTime = await time.latest();
        const birthdayDate = blockTime.add(time.duration.minutes(1))
        await tokenContract.setTokenBirthday(birthdayDate)
      } else {
        await tokenContract.setTokenBirthday(math.round(new Date("2021-11-01") / 1000))
      }
  }

};
