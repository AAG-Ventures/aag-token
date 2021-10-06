const AAGToken = artifacts.require('AAGToken');
const AAGVestingContract = artifacts.require('AAGVestingContract');

const { expectEvent, time } = require('@openzeppelin/test-helpers');

contract('AAGVestingContract', (accounts) => {
    const TOTAL_SUPPLY = 1000000000e18;
    const owner = accounts[0];
    let tokenContract;
    let vestingContract; 
    let blockTime;

    it('Should mint a 1 000 000 000 AAG tokens to the owners account', async () => {
        tokenContract = await AAGToken.deployed();
        vestingContract = await AAGVestingContract.deployed();
        blockTime = await time.latest();
        const balanceLocked = await tokenContract.balanceOf(tokenContract.address);
        assert.equal(TOTAL_SUPPLY / balanceLocked, 1, '1 000 000 000 is not in the first account');
    });
  
    it('Set IDO date and claim tokens', async () => {
        blockTime = await time.latest();
        const birthdayDate = blockTime.add(time.duration.minutes(1));
        await tokenContract.setTokenBirthday(birthdayDate);
        const birthday = await tokenContract.getBirthdayDate();
        assert.equal(birthday.toString(), birthdayDate, 'Birthday date set correctly');

        blockTime = await time.latest();
        await time.increaseTo(blockTime.add(time.duration.days(41)));
      
        await tokenContract.claimInitialPoolTokens({ from: owner });
        await tokenContract.claimTreasuryTokens({ from: owner });
        await tokenContract.claimVestingTokens({ from: owner });

        let balance1 = await tokenContract.balanceOf(owner);
        assert.equal(balance1.toString(), '1000000000000000000000000000', 'Wrong amount');
    });

    it('Set vesting and test data', async () => {
        blockTime = await time.latest();
        const vestingStart = blockTime.add(time.duration.minutes(1));
        await tokenContract.increaseAllowance(vestingContract.address, "2000000000000000000000000", { from: owner })
        await vestingContract.createVestingSchedule(accounts[2], "1000000000000000000000000", vestingStart, 4 * 365, 0, { from: owner });
    });

    it('Vest for 1 year & withdraw', async () => {
        blockTime = await time.latest();
        await time.increaseTo(blockTime.add(time.duration.days(365)));

        let available2 = await vestingContract.availableWithdrawAmount(accounts[2], { from: accounts[2] }); 
        assert.equal(available2.toString().substr(0, 12), '249999524353', 'Incorrect unlocked amount');

        await vestingContract.withdraw({ from: accounts[2] })
        let vestedAndDrawnBalance = await tokenContract.balanceOf(accounts[2], { from: accounts[2] });
        assert.equal(vestedAndDrawnBalance.toString().substr(0, 12), '249999524353', 'Incorrect amount after 100 days');
    });

    it('Vest for 3 more years & withdraw', async () => {
        blockTime = await time.latest();
        await time.increaseTo(blockTime.add(time.duration.days(365*3+1)));
        await vestingContract.withdraw({ from: accounts[2] })
        let vestedAndDrawnBalance = await tokenContract.balanceOf(accounts[2], { from: accounts[2] });
        assert.equal(vestedAndDrawnBalance.toString(), '1000000000000000000000000', 'Incorrect balance after withdraw');
    });

    it('Handle insuficient balance and duplicated vesting', async () => {
        blockTime = await time.latest();
        const vestingStart = blockTime.add(time.duration.minutes(1));
        let errorMessage = "";
        try {
            await vestingContract.createVestingSchedule(accounts[2], "1000000000000000000000000", vestingStart, 4 * 365, 0, { from: owner });
        } catch (e) {
            errorMessage = e.reason;
        }
        assert.equal(errorMessage, 'Schedule already exists', 'Allows to create duplicated schedules');

        errorMessage = "";
        try {
            await vestingContract.createVestingSchedule(accounts[4], "22000000000000000000000000", vestingStart, 4 * 365, 0, { from: owner });
        } catch (e) {
            errorMessage = e.reason;
        }
        assert.equal(errorMessage, 'ERC20: transfer amount exceeds allowance', 'Allows create schedule with unavailable balance');
    });


    it('Set vesting for two years and cancel after 6 months', async () => {
        blockTime = await time.latest();
        const vestingStart = blockTime.add(time.duration.minutes(1));
        await vestingContract.createVestingSchedule(accounts[3], "500000000000000000000000", vestingStart, 2 * 365, 0, { from: owner });
        await time.increaseTo(blockTime.add(time.duration.days(180)));
        let available3 = await vestingContract.availableWithdrawAmount(accounts[3], { from: accounts[3] }); 
        assert.equal(available3.toString().substr(0, 12), '123287195585', 'Incorrect unlocked amount 1');
        
        await vestingContract.cancelVestingForBeneficiary(accounts[3]); 
        let availableAfterCancel3 = await vestingContract.availableWithdrawAmount(accounts[3], { from: accounts[3] }); 
        assert.equal(availableAfterCancel3.toString().substr(0, 12), "123287195585", 'Incorrected unlocked amount 2');
    });

    it('Check if vesting is canceled properly', async () => {
        let availableAfterCancel3 = await vestingContract.availableWithdrawAmount(accounts[3], { from: accounts[3] }); 
        await time.increaseTo(blockTime.add(time.duration.days(180)));
        let availableAfterCancel3later = await vestingContract.availableWithdrawAmount(accounts[3], { from: accounts[3] }); 
        assert.equal(availableAfterCancel3.toString().substr(0, 12), availableAfterCancel3later.toString().substr(0, 12), 'Vesting not canceled properly');
        
        const schedule = await vestingContract.vestingScheduleForBeneficiary(accounts[3]);

        let errorMessage = "";
        try {
            blockTime = await time.latest();
            const vestingStart = blockTime.add(time.duration.minutes(1));
            await vestingContract.createVestingSchedule(accounts[3], "500000000000000000000000", vestingStart, 2 * 365, 0, { from: owner });
        } catch (e) {
            errorMessage = e.reason;
        }
        assert.equal(errorMessage, 'Schedule already exists', 'Allows to create duplicated schedules');
        
        await vestingContract.withdraw({ from: accounts[3] })
        let vestedAndDrawnBalance = await tokenContract.balanceOf(accounts[3], { from: accounts[3] });
        assert.equal(vestedAndDrawnBalance.toString().substr(0, 12), '123287195585', 'Incorrect balance after withdraw');
    })
})

