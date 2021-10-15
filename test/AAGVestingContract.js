const AAGToken = artifacts.require('AAGToken');
const AAGVestingContract = artifacts.require('AAGVestingContract');

const { expectEvent, time } = require('@openzeppelin/test-helpers');

contract('AAGVestingContract', (accounts) => {
    const TOTAL_SUPPLY = 1000000000e18;
    const recoveryAdmin = accounts[0];
    const admin = accounts[1];
    let tokenContract;
    let vestingContract; 
    let blockTime;

    it('Should mint a 1 000 000 000 AAG tokens to the admins account', async () => {
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
      
        await tokenContract.claimInitialPoolTokens({ from: recoveryAdmin });
        await tokenContract.claimTreasuryTokens({ from: recoveryAdmin });
        await tokenContract.claimVestingTokens({ from: recoveryAdmin });

        let balance1 = await tokenContract.balanceOf(admin);
        assert.equal(balance1.toString(), '1000000000000000000000000000', 'Wrong amount');
    });

    it('Set vesting and test data', async () => {
        blockTime = await time.latest();
        const vestingStart = blockTime.add(time.duration.minutes(1));
        await tokenContract.increaseAllowance(vestingContract.address, "1000000000000000000000000", { from: admin })
        await vestingContract.createVestingSchedule(accounts[2], "1000000000000000000000000", vestingStart, 4 * 365, 0, { from: admin });

        let vestingContractBalance = await tokenContract.balanceOf(vestingContract.address, { from: accounts[2] });
        assert.equal(vestingContractBalance.toString(), "1000000000000000000000000", 'Incorrect balance in the vesting wallet');
    });

    it('Vest for 1 year & withdraw', async () => {
        blockTime = await time.latest();
        await time.increaseTo(blockTime.add(time.duration.days(365)));

        let available2 = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[2], { from: accounts[2] });
        assert.equal(available2.toString().substr(0, 6) === '249999' && available2.toString().length === 24, true, 'Incorrect unlocked amount');

        await vestingContract.withdraw({ from: accounts[2] })
        let vestedAndDrawnBalance = await tokenContract.balanceOf(accounts[2], { from: accounts[2] });
        assert.equal(vestedAndDrawnBalance.toString().substr(0, 6) === '249999' && vestedAndDrawnBalance.toString().length === 24, true, 'Incorrect amount after 100 days');
    });

    it('Vest for 3 more years & withdraw', async () => {
        blockTime = await time.latest();
        await time.increaseTo(blockTime.add(time.duration.days(365*3+1)));

        let account2Balance = await tokenContract.balanceOf(accounts[2], { from: accounts[2] });
        let available2 = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[2], { from: accounts[2] });
        let vestingContractBalance = await tokenContract.balanceOf(vestingContract.address, { from: accounts[2] });
        let fullVestingInfo2 = await vestingContract.vestingScheduleForBeneficiary(accounts[2] , { from: accounts[2] });

        // TO DO increase accuracy here of test
        // console.log("vestingContractBalance", vestingContractBalance.toString());
        // console.log("available2", available2.toString());
        // console.log("account2Balance", account2Balance.toString());
        // console.log("fullVestingInfo2", fullVestingInfo2);

        await vestingContract.withdraw({ from: accounts[2] })

        account2Balance= await tokenContract.balanceOf(accounts[2], { from: accounts[2] });
        assert.equal(account2Balance.toString(), '1000000000000000000000000', 'Incorrect balance after withdraw');
        
        // Trying to withdraw one more time
        let error = "";
        try {
            await vestingContract.withdraw({ from: accounts[2] });
        } catch(e) {
            error = e.reason;
        }
        assert.equal(error, 'Nothing to withdraw', 'Vesting should be over');
 
        // Vesting contract balance should be zero
        vestingContractBalance = await tokenContract.balanceOf(vestingContract.address, { from: accounts[2] });
        assert.equal(vestingContractBalance.toString(), '0', 'Vesting contract should be zero');
    });

    it('Handle insuficient balance and duplicated vesting', async () => {
        // increase allowance for vesting wallet
        let adminBalancePre = await tokenContract.balanceOf(admin, { from: admin});
        
        blockTime = await time.latest();
        const vestingStart = blockTime.add(time.duration.minutes(1));
        let errorMessage = "";
        try {
            await vestingContract.createVestingSchedule(accounts[2], "1000000000000000000000000", vestingStart, 4 * 365, 0, { from: admin });
        } catch (e) {
            errorMessage = e.reason;
        }
        assert.equal(errorMessage, 'Schedule already exists', 'Allows to create duplicated schedules');

        errorMessage = "";
        try {
            await vestingContract.createVestingSchedule(accounts[4], "22000000000000000000000000", vestingStart, 4 * 365, 0, { from: admin });
        } catch (e) {
            errorMessage = e.reason;
        }
        assert.equal(errorMessage, 'ERC20: transfer amount exceeds allowance', 'Allows create schedule with unavailable balance');


        let adminBalance = await tokenContract.balanceOf(admin, { from: admin});
        assert.equal(adminBalance.toString(), adminBalancePre, 'Admin balance should stay unchanged');
        
    });


    it('Set vesting for two years and cancel after 6 months', async () => {
        await tokenContract.increaseAllowance(vestingContract.address, "1000000000000000000000000", { from: admin })
        blockTime = await time.latest();
        const vestingStart = blockTime.add(time.duration.minutes(1));
        await vestingContract.createVestingSchedule(accounts[3], "500000000000000000000000", vestingStart, 2 * 365, 0, { from: admin });
        await time.increaseTo(blockTime.add(time.duration.days(180)));
        let available3 = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[3], { from: accounts[3] }); 
        assert.equal(available3.toString().substr(0, 6) === "123287" && available3.toString().length === 24, true, 'Incorrect unlocked amount 1');
        
        // Cancel and check available balance
        let cancelReceipt = await vestingContract.cancelVestingForBeneficiary(accounts[3]); 

        // TODO figure out why does not track event
        // Expect unuesed tokens to be transfered to admin
        // await expectEvent(cancelReceipt, 'Transfer', {
        //     from: vestingContract.address,
        //     to: recoveryAdmin,
        //     value: '376712804414003053876760',
        // });
        let recoveryAdminBalance = await tokenContract.balanceOf(recoveryAdmin, { from: recoveryAdmin });
        assert.equal(recoveryAdminBalance.toString() === "376712804414003053876760", true , 'Incorrected unlocked amount 2');


        // console.log("cancelReceipt", vestingContract.address, recoveryAdmin);
        // Get available balance and evaluate it
        let availableAfterCancel3 = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[3], { from: accounts[3] }); 
        assert.equal(availableAfterCancel3.toString().substr(0, 6) === "123287" && availableAfterCancel3.toString().length === 24, true , 'Incorrected unlocked amount 2');
    });

    it('Check if vesting is canceled properly', async () => {
        let availableAfterCancel3 = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[3], { from: accounts[3] }); 
        await time.increaseTo(blockTime.add(time.duration.days(180)));
        let availableAfterCancel3later = await vestingContract.getAvailableWithdrawAmountForAddress(accounts[3], { from: accounts[3] }); 
        assert.equal(availableAfterCancel3.toString().substr(0, 12), availableAfterCancel3later.toString().substr(0, 12), 'Vesting not canceled properly');
        
        const schedule = await vestingContract.vestingScheduleForBeneficiary(accounts[3]);

        let errorMessage = "";
        try {
            blockTime = await time.latest();
            const vestingStart = blockTime.add(time.duration.minutes(1));
            await vestingContract.createVestingSchedule(accounts[3], "500000000000000000000000", vestingStart, 2 * 365, 0, { from: admin });
        } catch (e) {
            errorMessage = e.reason;
        }
        assert.equal(errorMessage, 'Schedule already exists', 'Allows to create duplicated schedules');
        
        await vestingContract.withdraw({ from: accounts[3] })
        let vestedAndDrawnBalance = await tokenContract.balanceOf(accounts[3], { from: accounts[3] });
        assert.equal(vestedAndDrawnBalance.toString().substr(0, 6) === "123287" && vestedAndDrawnBalance.toString().length === 24, true, 'Incorrect balance after withdraw');
    })

    it("Create schedules, but execute emergency withdrawal", async () => {
        // Create few vesting schedules for testing

        // TODO Migrate allowance test to separate test
        // let allowance = await tokenContract.allowance(admin, vestingContract.address, { from: admin })
        // console.log("allowance", allowance.toString())

        let blockTime = await time.latest();
        const vestingStart = blockTime.add(time.duration.minutes(1));
        await vestingContract.createVestingSchedule(accounts[4], "300000000000000000000000", vestingStart, 1 * 365, 0, { from: admin });
        await vestingContract.createVestingSchedule(accounts[5], "200000000000000000000000", vestingStart, 1 * 365, 0, { from: admin });

        let balanceInVesting = await tokenContract.balanceOf(vestingContract.address, { from: admin })
        assert.equal(balanceInVesting.toString(), "500000000000000000000000", "Incorrect amount in vesting contract");
   
        // Execute emergency withdrawal after 3 days
        blockTime = await time.latest();
        await time.increaseTo(blockTime.add(time.duration.days(3)));
        let emergency = await vestingContract.emergencyWithdrawAllTokens({ from: recoveryAdmin });
  
        // TODO implement event expectation

        // Check balances of recovery admin and vesting contract addresses
        balanceInVesting = await tokenContract.balanceOf(vestingContract.address, { from: admin })
        let balanceInRecoveryAdmin = await tokenContract.balanceOf(recoveryAdmin, { from: admin })
        assert.equal(balanceInVesting.toString(), "0", "Incorrect amount in vesting contract");

        // Total amount should be equal 376712804414003053876760 + 500000000000000000000000
        assert.equal(balanceInRecoveryAdmin.toString(), "876712804414003053876760", "Incorrect amount in recovery admin's wallet")
    });
})

