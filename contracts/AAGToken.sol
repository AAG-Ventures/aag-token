// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IERC20.sol";

interface ILosslessController {
  function beforeTransfer(
    address sender,
    address recipient,
    uint256 amount
  ) external;

  function beforeTransferFrom(
    address msgSender,
    address sender,
    address recipient,
    uint256 amount
  ) external;

  function beforeApprove(
    address sender,
    address spender,
    uint256 amount
  ) external;

  function beforeIncreaseAllowance(
    address msgSender,
    address spender,
    uint256 addedValue
  ) external;

  function beforeDecreaseAllowance(
    address msgSender,
    address spender,
    uint256 subtractedValue
  ) external;

  function afterApprove(
    address sender,
    address spender,
    uint256 amount
  ) external;

  function afterTransfer(
    address sender,
    address recipient,
    uint256 amount
  ) external;

  function afterTransferFrom(
    address msgSender,
    address sender,
    address recipient,
    uint256 amount
  ) external;

  function afterIncreaseAllowance(
    address sender,
    address spender,
    uint256 addedValue
  ) external;

  function afterDecreaseAllowance(
    address sender,
    address spender,
    uint256 subtractedValue
  ) external;
}

contract AAGToken is Context, IERC20 {
  mapping(address => uint256) private _balances;
  mapping(address => mapping(address => uint256)) private _allowances;

  uint256 private _totalSupply;
  string private _name = "AAG";
  string private _symbol = "AAG";

  address public recoveryAdmin;
  address private recoveryAdminCanditate;
  bytes32 private recoveryAdminKeyHash;
  address public admin;
  uint256 public timelockPeriod;
  uint256 public losslessTurnOffTimestamp;
  bool public isLosslessTurnOffProposed;
  bool public isLosslessOn = false;
  ILosslessController private lossless;

  event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
  event RecoveryAdminChangeProposed(address indexed candidate);
  event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
  event LosslessTurnOffProposed(uint256 turnOffDate);
  event LosslessTurnedOff();
  event LosslessTurnedOn();

  // AAG Token vesting schedule
  uint256 private constant _TOTAL_SUPPLY = 1000000000e18; // Initial supply 1 000 000 000
  uint256 public tokenBirthDate = 0;

  uint256 private constant STRATEGIC_BACKERS_POOL = 5000000e18; // Strategic Backers 0.5%,
  uint256 private constant LIQUIDITY_POOL_TOKENS = 10000000e18; // Liquidity 1%
  uint256 private constant PUBLIC_TOKENS = 27500000e18; // 2.75% / Public IDO
  bool private initialPoolClaimed = false;

  uint256 private constant TREASURY_TOKENS = 150000000e18; // 15% / Treasury / 40-day lockup
  bool private treasuryTokensClaimed = false;

  address private vestingContractAddress;
  uint256 private constant TEAM_TOKENS = 247500000e18; // 24.75% 40-day lockup. Daily vesting over 4 years
  uint256 private constant ADVISORS_TOKENS = 30000000e18; // 3% 40-day lockup. Daily vesting over 4 years
  uint256 private constant PRIVATE_INVESTORS_TOKENS = 100000000e18; // 10% 40-day lockup. Daily vesting over 2 years
  uint256 private constant COMMUNITY_ECOSYSTEM_TOKEN = 430000000e18; // 43% / Community & Ecosystem / Daily vesting over 4 years

  bool private vestingTokensClaimed = false;

  constructor(
    address admin_,
    address recoveryAdmin_,
    uint256 timelockPeriod_,
    address lossless_
  ) {
    _mint(address(this), _TOTAL_SUPPLY);
    admin = admin_;
    recoveryAdmin = recoveryAdmin_;
    timelockPeriod = timelockPeriod_;
    lossless = ILosslessController(lossless_);
  }

  // --- AAG Token functions ---

  // AAG token unlock initialization

  function setTokenBirthday(uint256 _tokenBirthDate) public onlyRecoveryAdmin {
    require(tokenBirthDate == 0, "Already set");
    require(_tokenBirthDate > block.timestamp, "Can't be a date in the past");
    tokenBirthDate = _tokenBirthDate;
  }

  function getBirthdayDate() public view virtual returns (uint256) {
    return tokenBirthDate;
  }

  // AAG unlocked tokens claiming

  function claimInitialPoolTokens() public onlyRecoveryAdmin tokenBirthdayDefined {
    require(initialPoolClaimed == false, "Already claimed");
    require(tokenBirthDate < block.timestamp, "Can't claim tokens before the IDO");
    initialPoolClaimed = true;
    _transfer(address(this), admin, LIQUIDITY_POOL_TOKENS + STRATEGIC_BACKERS_POOL + PUBLIC_TOKENS);
  }

  function claimTreasuryTokens() public onlyRecoveryAdmin lockUpFinished tokenBirthdayDefined {
    require(treasuryTokensClaimed == false, "Already claimed");
    treasuryTokensClaimed = true;
    _transfer(address(this), admin, TREASURY_TOKENS);
  }

  function claimVestingTokens() public onlyRecoveryAdmin lockUpFinished tokenBirthdayDefined {
    require(vestingTokensClaimed == false, "Already claimed");
    vestingTokensClaimed = true;
    _transfer(address(this), admin, TEAM_TOKENS + ADVISORS_TOKENS + PRIVATE_INVESTORS_TOKENS + COMMUNITY_ECOSYSTEM_TOKEN);
  }

  // AAG vesting modifiers modifiers

  modifier tokenBirthdayDefined() {
    require(tokenBirthDate != 0, "Initialization have not started");
    _;
  }

  modifier lockUpFinished() {
    require(tokenBirthDate != 0, "Initialization have not started");
    require(tokenBirthDate + 40 days < block.timestamp, "Still locked");
    _;
  }

  // --- LOSSLESS modifiers ---

  modifier lssAprove(address spender, uint256 amount) {
    if (isLosslessOn) {
      lossless.beforeApprove(_msgSender(), spender, amount);
      _;
      lossless.afterApprove(_msgSender(), spender, amount);
    } else {
      _;
    }
  }

  modifier lssTransfer(address recipient, uint256 amount) {
    if (isLosslessOn) {
      lossless.beforeTransfer(_msgSender(), recipient, amount);
      _;
      lossless.afterTransfer(_msgSender(), recipient, amount);
    } else {
      _;
    }
  }

  modifier lssTransferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) {
    if (isLosslessOn) {
      lossless.beforeTransferFrom(_msgSender(), sender, recipient, amount);
      _;
      lossless.afterTransferFrom(_msgSender(), sender, recipient, amount);
    } else {
      _;
    }
  }

  modifier lssIncreaseAllowance(address spender, uint256 addedValue) {
    if (isLosslessOn) {
      lossless.beforeIncreaseAllowance(_msgSender(), spender, addedValue);
      _;
      lossless.afterIncreaseAllowance(_msgSender(), spender, addedValue);
    } else {
      _;
    }
  }

  modifier lssDecreaseAllowance(address spender, uint256 subtractedValue) {
    if (isLosslessOn) {
      lossless.beforeDecreaseAllowance(_msgSender(), spender, subtractedValue);
      _;
      lossless.afterDecreaseAllowance(_msgSender(), spender, subtractedValue);
    } else {
      _;
    }
  }

  modifier onlyRecoveryAdmin() {
    require(_msgSender() == recoveryAdmin, "ERC20: Must be recovery admin");
    _;
  }

  // --- LOSSLESS management ---

  function getAdmin() external view returns (address) {
    return admin;
  }

  function transferOutBlacklistedFunds(address[] calldata from) external {
    require(_msgSender() == address(lossless), "ERC20: Only lossless contract");
    for (uint256 i = 0; i < from.length; i++) {
      _transfer(from[i], address(lossless), balanceOf(from[i]));
    }
  }

  function setLosslessAdmin(address newAdmin) public onlyRecoveryAdmin {
    emit AdminChanged(admin, newAdmin);
    admin = newAdmin;
  }

  function transferRecoveryAdminOwnership(address candidate, bytes32 keyHash) public onlyRecoveryAdmin {
    recoveryAdminCanditate = candidate;
    recoveryAdminKeyHash = keyHash;
    emit RecoveryAdminChangeProposed(candidate);
  }

  function acceptRecoveryAdminOwnership(bytes memory key) external {
    require(_msgSender() == recoveryAdminCanditate, "ERC20: Must be canditate");
    require(keccak256(key) == recoveryAdminKeyHash, "ERC20: Invalid key");
    emit RecoveryAdminChanged(recoveryAdmin, recoveryAdminCanditate);
    recoveryAdmin = recoveryAdminCanditate;
  }

  function proposeLosslessTurnOff() public onlyRecoveryAdmin {
    losslessTurnOffTimestamp = block.timestamp + timelockPeriod;
    isLosslessTurnOffProposed = true;
    emit LosslessTurnOffProposed(losslessTurnOffTimestamp);
  }

  function executeLosslessTurnOff() public onlyRecoveryAdmin {
    require(isLosslessTurnOffProposed, "ERC20: TurnOff not proposed");
    require(losslessTurnOffTimestamp <= block.timestamp, "ERC20: Time lock in progress");
    isLosslessOn = false;
    isLosslessTurnOffProposed = false;
    emit LosslessTurnedOff();
  }

  function executeLosslessTurnOn() public onlyRecoveryAdmin {
    isLosslessTurnOffProposed = false;
    isLosslessOn = true;
    emit LosslessTurnedOn();
  }

  // --- ERC20 methods ---

  function name() public view virtual returns (string memory) {
    return _name;
  }

  function symbol() public view virtual returns (string memory) {
    return _symbol;
  }

  function decimals() public view virtual returns (uint8) {
    return 18;
  }

  function totalSupply() public view virtual override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    return _balances[account];
  }

  function transfer(address recipient, uint256 amount) public virtual override lssTransfer(recipient, amount) returns (bool) {
    _transfer(_msgSender(), recipient, amount);
    return true;
  }

  function allowance(address owner, address spender) public view virtual override returns (uint256) {
    return _allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) public virtual override lssAprove(spender, amount) returns (bool) {
    require((amount == 0) || (_allowances[_msgSender()][spender] == 0), "ERC20: Cannot change non zero allowance");
    _approve(_msgSender(), spender, amount);
    return true;
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public virtual override lssTransferFrom(sender, recipient, amount) returns (bool) {
    _transfer(sender, recipient, amount);

    uint256 currentAllowance = _allowances[sender][_msgSender()];
    require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
    _approve(sender, _msgSender(), currentAllowance - amount);

    return true;
  }

  function increaseAllowance(address spender, uint256 addedValue) public virtual lssIncreaseAllowance(spender, addedValue) returns (bool) {
    _approve(_msgSender(), spender, _allowances[_msgSender()][spender] + addedValue);
    return true;
  }

  function decreaseAllowance(address spender, uint256 subtractedValue) public virtual lssDecreaseAllowance(spender, subtractedValue) returns (bool) {
    uint256 currentAllowance = _allowances[_msgSender()][spender];
    require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
    _approve(_msgSender(), spender, currentAllowance - subtractedValue);

    return true;
  }

  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal virtual {
    require(sender != address(0), "ERC20: transfer from the zero address");
    require(recipient != address(0), "ERC20: transfer to the zero address");

    uint256 senderBalance = _balances[sender];
    require(senderBalance >= amount, "ERC20: transfer amount exceeds balance");
    _balances[sender] = senderBalance - amount;
    _balances[recipient] += amount;

    emit Transfer(sender, recipient, amount);
  }

  function _mint(address account, uint256 amount) internal virtual {
    require(account != address(0), "ERC20: mint to the zero address");

    _totalSupply += amount;
    _balances[account] += amount;
    emit Transfer(address(0), account, amount);
  }

  function _approve(
    address owner,
    address spender,
    uint256 amount
  ) internal virtual {
    require(owner != address(0), "ERC20: approve from the zero address");
    require(spender != address(0), "ERC20: approve to the zero address");

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }
}
