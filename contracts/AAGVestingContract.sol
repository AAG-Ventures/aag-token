// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import './IERC20.sol';

contract AAGVestingContract is ReentrancyGuard, Context, Ownable {
    using SafeMath for uint256;

    event ScheduleCreated(
        address indexed _beneficiary,
        uint256 indexed _amount,
        uint256 indexed _start,
        uint256 _duration
    );

    event ScheduleCancelled(
        address indexed _beneficiary,
        address indexed _cancelledBy,
        uint256 _remainingBalance,
        uint256 _end
    );

    event Withdraw(
        address indexed _beneficiary,
        uint256 indexed _amount,
        uint256 indexed _time
    );

    struct Schedule {
        uint256 start;
        uint256 end;
        uint256 cliff;
        uint256 amount;
        uint256 totalDrawn;
        uint256 lastDrawnAt;
        uint256 withdrawRate;
    }

    // Vested address to its schedule
    mapping(address => Schedule) public vestingSchedule;

    // AAG token contract (Or any other ERC20)
    IERC20 public token;

    uint256 public constant ONE_DAY_IN_SECONDS = 1 days;

    constructor(IERC20 _token) {
        require(address(_token) != address(0));
        token = _token;
    }

    function createVestingSchedule(address _beneficiary, uint256 _amount, uint256 _start, uint256 _durationInDays, uint256 _cliffDurationInDays) public onlyOwner {
        require(_beneficiary != address(0), "Beneficiary cannot be empty");
        require(_amount > 0, "Amount cannot be empty");
        require(_durationInDays > 0, "Duration cannot be empty");
        require(_cliffDurationInDays <= _durationInDays, "Cliff can not be bigger than duration");

        // Ensure one per address
        require(vestingSchedule[_beneficiary].amount == 0, "Schedule already exists");

        // Create schedule
        uint256 _durationInSecs = _durationInDays.mul(ONE_DAY_IN_SECONDS);
        uint256 _cliffDurationInSecs = _cliffDurationInDays.mul(ONE_DAY_IN_SECONDS);
        vestingSchedule[_beneficiary] = Schedule({
            start : _start,
            end : _start.add(_durationInSecs),
            cliff : _start.add(_cliffDurationInSecs),
            amount : _amount,
            totalDrawn : 0, // no tokens drawn yet
            lastDrawnAt : 0, // never invoked
            withdrawRate : _amount.div(_durationInSecs)
        });

        emit ScheduleCreated(_beneficiary, _amount, _start, _durationInDays);

        // Escrow tokens in the vesting contract on behalf of the beneficiary
        require(token.transferFrom(msg.sender, address(this), _amount), "Unable to transfer tokens to vesting contract");
    }

    function cancelVestingForBeneficiary(address _beneficiary) public onlyOwner {
        Schedule storage schedule = vestingSchedule[_beneficiary];
        require(vestingSchedule[_beneficiary].end > block.timestamp, "No active vesting");

        uint256 availableAmount = _availableWithdrawAmount(_beneficiary);

        uint256 _start = schedule.start;
        uint256 _end = block.timestamp;
        uint256 _cliff = schedule.cliff;
        uint256 _totalDrawn = schedule.totalDrawn;
        uint256 _lastDrawnAt = schedule.lastDrawnAt;
        uint256 _withdrawRate = schedule.withdrawRate;

        vestingSchedule[_beneficiary] = Schedule({
            start : _start,
            end : _end,
            cliff : _cliff,
            amount : _totalDrawn.add(availableAmount),
            totalDrawn : _totalDrawn,
            lastDrawnAt : _lastDrawnAt,
            withdrawRate : _withdrawRate
        });

        emit ScheduleCancelled(
            _beneficiary,
            msg.sender,
            availableAmount,
            _end
        );   
    }

    function withdraw() nonReentrant external {
        Schedule storage schedule = vestingSchedule[msg.sender];
        require(schedule.amount > 0, "There is no schedule currently in flight");

        // available right now
        uint256 amount = _availableWithdrawAmount(msg.sender);
        require(amount > 0, "Nothing to withdraw");

        // Update last drawn to now
        schedule.lastDrawnAt = _currentBlockTimestamp();

        // Increase total drawn amount
        schedule.totalDrawn = schedule.totalDrawn.add(amount);

        // Issue tokens to beneficiary
        require(token.transfer(msg.sender, amount), "Unable to transfer tokens");

        emit Withdraw(msg.sender, amount, _currentBlockTimestamp());
    }

    // Accessors

    function tokenBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function vestingScheduleForBeneficiary(address _beneficiary) external view returns (uint256 _start, uint256 _end, uint256 _cliff, uint256 _amount, uint256 _totalDrawn, uint256 _lastDrawnAt, uint256 _withdrawRate, uint256 _remainingBalance) {
        Schedule memory schedule = vestingSchedule[_beneficiary];
        return (
            schedule.start,
            schedule.end,
            schedule.cliff,
            schedule.amount,
            schedule.totalDrawn,
            schedule.lastDrawnAt,
            schedule.withdrawRate,
            schedule.amount.sub(schedule.totalDrawn)
        );
    }

    function availableWithdrawAmount(address _beneficiary) external view returns (uint256 _amount) {
        return _availableWithdrawAmount(_beneficiary);
    }

    // Internal
    
    function _currentBlockTimestamp() internal view virtual returns (uint256) {
        return block.timestamp;
    }

    function _availableWithdrawAmount(address _beneficiary) internal view returns (uint256 _amount) {
        Schedule memory schedule = vestingSchedule[_beneficiary];

        // Cliff

        // the cliff period has not ended, therefore, no tokens to draw down
        if (_currentBlockTimestamp() <= schedule.cliff) {
            return 0;
        }

        // Ended
        if (_currentBlockTimestamp() > schedule.end) {
            return schedule.amount.sub(schedule.totalDrawn);
        }

        // Active

        // Work out when the last invocation was
        uint256 timeLastDrawnOrStart = schedule.lastDrawnAt == 0 ? schedule.start : schedule.lastDrawnAt;

        // Find out how much time has past since last invocation
        uint256 timePassedSinceLastInvocation = _currentBlockTimestamp().sub(timeLastDrawnOrStart);

        // Work out how many due tokens - time passed * rate per second
        return timePassedSinceLastInvocation.mul(schedule.withdrawRate);
    }
}