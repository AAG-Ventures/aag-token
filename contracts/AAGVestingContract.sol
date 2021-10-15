// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IERC20.sol";

contract AAGVestingContract is ReentrancyGuard, Context {
  event ScheduleCreated(address indexed _beneficiary, uint256 indexed _amount, uint256 indexed _startTimestamp, uint256 _duration);

  event ScheduleCancelled(address indexed _beneficiary, address indexed _cancelledBy, uint256 _remainingBalance, uint256 _canceledTimestamp);

  event Withdraw(address indexed _beneficiary, uint256 indexed _amount, uint256 indexed _time);

  struct Schedule {
    uint256 startTimestamp;
    uint256 endTimestamp;
    uint256 canceledTimestamp;
    uint256 amount;
    uint256 totalDrawn;
    uint256 lastDrawnAt;
    uint256 withdrawRate;
  }

  // Vested address to its schedule
  mapping(address => Schedule) public vestingSchedule;

  // AAG token contract (Or any other ERC20)
  IERC20 public token;
  address private admin;  
  uint256 public constant ONE_DAY_IN_SECONDS = 1 days;

  constructor(IERC20 _token, address _admin) {
    require(address(_token) != address(0));
    token = _token;
    admin = _admin;
  }

  function createVestingSchedule(
    address _beneficiary,
    uint256 _amount,
    uint256 _startTimestamp,
    uint256 _durationInDays,
    uint256 _cliffDurationInDays
  ) public {
    require(_beneficiary != address(0), "Beneficiary cannot be empty");
    require(_amount > 0, "Amount cannot be empty");
    require(_durationInDays > 0, "Duration cannot be empty");
    require(_cliffDurationInDays <= _durationInDays, "Cliff can not be bigger than duration");
    require(_startTimestamp > block.timestamp, "Can not set the date in the past");
    // Ensure one per address
    require(vestingSchedule[_beneficiary].amount == 0, "Schedule already exists");

    // Create schedule
    uint256 _durationInSecs = _durationInDays * ONE_DAY_IN_SECONDS;
    uint256 _cliffDurationInSecs = _cliffDurationInDays * ONE_DAY_IN_SECONDS;
    vestingSchedule[_beneficiary] = Schedule({
      startTimestamp: _startTimestamp + _cliffDurationInSecs,
      endTimestamp: _startTimestamp + _durationInSecs,
      canceledTimestamp: 0,
      amount: _amount,
      totalDrawn: 0,
      lastDrawnAt: 0,
      withdrawRate: _amount / _durationInSecs
    });

    emit ScheduleCreated(_beneficiary, _amount, vestingSchedule[_beneficiary].startTimestamp, _durationInDays);

    // Transfer tokens in the vesting contract on behalf of the beneficiary
    require(token.transferFrom(msg.sender, address(this), _amount), "Unable to transfer tokens to vesting contract");
  }

  // Cancel vesting schedule for beneficiary
  function cancelVestingForBeneficiary(address _beneficiary) public onlyAdmin {
    Schedule storage item = vestingSchedule[_beneficiary];

    require(item.endTimestamp > block.timestamp, "No active vesting");

    uint256 availableAmount = this.getAvailableWithdrawAmountForSchedule(item);

    item.canceledTimestamp = block.timestamp;

    uint256 finalAmountForBeneficiary = availableAmount + item.totalDrawn;
    uint256 amountToRetrieveToOwner = item.amount - finalAmountForBeneficiary;

    // Set final amount for beneficiary
    item.amount = finalAmountForBeneficiary;

    // Return unvested tokens to owner
    require(token.transfer(admin, amountToRetrieveToOwner), "Unable to transfer tokens");

    // TODO left over transfer tokens to owner
    emit ScheduleCancelled(_beneficiary, msg.sender, availableAmount, vestingSchedule[_beneficiary].canceledTimestamp);
  }

  // Emergency withdrawal (Whole balance)
  function emergencyWithdrawAllTokens() public onlyAdmin {
    uint256 balance = token.balanceOf(address(this));
    // Return all tokens to the owner
    require(token.transfer(msg.sender, balance), "Unable to transfer tokens");
  }

  function withdraw() external nonReentrant {
    Schedule memory schedule = vestingSchedule[msg.sender];
    require(schedule.amount > 0, "There is no schedule currently in flight");

    // available right now
    uint256 amount = this.getAvailableWithdrawAmountForSchedule(schedule);
    require(amount > 0, "Nothing to withdraw");

    // Update last drawn to now
    vestingSchedule[msg.sender].lastDrawnAt = block.timestamp;

    // Increase total drawn amount
    vestingSchedule[msg.sender].totalDrawn = schedule.totalDrawn + amount;

    // Issue tokens to beneficiary
    require(token.transfer(msg.sender, amount), "Unable to transfer tokens");

    emit Withdraw(msg.sender, amount, block.timestamp);
  }

  // Accessors
  function tokenBalance() external view returns (uint256) {
    return token.balanceOf(address(this));
  }

  function vestingScheduleForBeneficiary(address _beneficiary)
    external
    view
    returns (
      uint256 _startTimestamp,
      uint256 _endTimestamp,
      uint256 _canceledTimestamp,
      uint256 _amount,
      uint256 _totalDrawn,
      uint256 _lastDrawnAt,
      uint256 _withdrawRate,
      uint256 _remainingBalance
    )
  {
    Schedule memory schedule = vestingSchedule[_beneficiary];
    return (
      schedule.startTimestamp,
      schedule.endTimestamp,
      schedule.canceledTimestamp,
      schedule.amount,
      schedule.totalDrawn,
      schedule.lastDrawnAt,
      schedule.withdrawRate,
      schedule.amount - schedule.totalDrawn
    );
  }

  function getAvailableWithdrawAmountForAddress(address _beneficiary) external view returns (uint256 _amount) {
    Schedule memory schedule = vestingSchedule[_beneficiary];
    return this.getAvailableWithdrawAmountForSchedule(schedule);
  }

  function getAvailableWithdrawAmountForSchedule(Schedule memory _schedule) external view returns (uint256 _amount) {
    // Vesting haven't started
    if (block.timestamp <= _schedule.startTimestamp) {
      return 0;
    }

    // Ended
    if (block.timestamp > _schedule.endTimestamp && _schedule.canceledTimestamp == 0) {
      return _schedule.amount - _schedule.totalDrawn;
    }

    // Canceled
    if (block.timestamp > _schedule.canceledTimestamp && _schedule.canceledTimestamp != 0) {
      uint256 timeVestedSinceCanceled = _schedule.canceledTimestamp - _schedule.startTimestamp;
      return timeVestedSinceCanceled * _schedule.withdrawRate - _schedule.totalDrawn;
    }

    // Active
    uint256 timePassedFromVestingStart = block.timestamp - _schedule.startTimestamp;
    return timePassedFromVestingStart * _schedule.withdrawRate - _schedule.totalDrawn;
  }


  // AAG Access modifier

  modifier onlyAdmin() {
      require(_msgSender() == admin, "Permission denied");
      _;
  }
}
