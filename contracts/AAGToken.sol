// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import './IERC20.sol';

contract ERC20 is Context, IERC20 {
  mapping(address => uint256) private _balances;

  mapping(address => mapping(address => uint256)) private _allowances;

  uint256 private _totalSupply;

  string private _name;
  string private _symbol;

  constructor(string memory name_, string memory symbol_) {
    _name = name_;
    _symbol = symbol_;
  }

  function name() public view virtual override returns (string memory) {
    return _name;
  }

  function symbol() public view virtual override returns (string memory) {
    return _symbol;
  }

  function decimals() public view virtual override returns (uint8) {
    return 18;
  }

  function totalSupply() public view virtual override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    return _balances[account];
  }

  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    _transfer(_msgSender(), recipient, amount);
    return true;
  }

  function allowance(address owner, address spender) public view virtual override returns (uint256) {
    return _allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) public virtual override returns (bool) {
    _approve(_msgSender(), spender, amount);
    return true;
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public virtual override returns (bool) {
    _transfer(sender, recipient, amount);

    uint256 currentAllowance = _allowances[sender][_msgSender()];
    require(currentAllowance >= amount, 'ERC20: transfer amount exceeds allowance');
    unchecked {
      _approve(sender, _msgSender(), currentAllowance - amount);
    }

    return true;
  }

  function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
    _approve(_msgSender(), spender, _allowances[_msgSender()][spender] + addedValue);
    return true;
  }

  function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
    uint256 currentAllowance = _allowances[_msgSender()][spender];
    require(currentAllowance >= subtractedValue, 'ERC20: decreased allowance below zero');
    unchecked {
      _approve(_msgSender(), spender, currentAllowance - subtractedValue);
    }

    return true;
  }

  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal virtual {
    require(sender != address(0), 'ERC20: transfer from the zero address');
    require(recipient != address(0), 'ERC20: transfer to the zero address');

    uint256 senderBalance = _balances[sender];
    require(senderBalance >= amount, 'ERC20: transfer amount exceeds balance');
    unchecked {
      _balances[sender] = senderBalance - amount;
    }
    _balances[recipient] += amount;

    emit Transfer(sender, recipient, amount);
  }

  function _mint(address account, uint256 amount) internal virtual {
    require(account != address(0), 'ERC20: mint to the zero address');

    _totalSupply += amount;
    _balances[account] += amount;
    emit Transfer(address(0), account, amount);
  }

  function _burn(address account, uint256 amount) internal virtual {
    require(account != address(0), 'ERC20: burn from the zero address');

    uint256 accountBalance = _balances[account];
    require(accountBalance >= amount, 'ERC20: burn amount exceeds balance');
    unchecked {
      _balances[account] = accountBalance - amount;
    }
    _totalSupply -= amount;

    emit Transfer(account, address(0), amount);
  }

  function _approve(
    address owner,
    address spender,
    uint256 amount
  ) internal virtual {
    require(owner != address(0), 'ERC20: approve from the zero address');
    require(spender != address(0), 'ERC20: approve to the zero address');

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }
}

contract AAGToken is ERC20, Ownable {
  string private _name = 'AAG';
  string private _symbol = 'AAG';

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

  constructor() ERC20(_name, _symbol) {
    _mint(address(this), _TOTAL_SUPPLY);
  }

  // Token unlock initialization

  function setTokenBirthday(uint256 _tokenBirthDate) public onlyOwner {
    require(tokenBirthDate == 0, 'Already set');
    require(_tokenBirthDate > block.timestamp, "Can't be a date in the past");
    tokenBirthDate = _tokenBirthDate;
  }

  function getBirthdayDate() public view virtual returns (uint256) {
    return tokenBirthDate;
  }

  // Claiming

  function changeVestingContractAddress(address _vestingContractAddress) public onlyOwner {
    vestingContractAddress = _vestingContractAddress;
  }

  function claimInitialPoolTokens() public onlyOwner tokenBirthdayDefined {
    require(initialPoolClaimed == false, 'Already claimed');
    require(tokenBirthDate < block.timestamp, "Can't claim tokens before the IDO");
    initialPoolClaimed = true;
    _transfer(address(this), owner(), LIQUIDITY_POOL_TOKENS + STRATEGIC_BACKERS_POOL + PUBLIC_TOKENS);
  }

  function claimTreasuryTokens() public onlyOwner lockUpFinished tokenBirthdayDefined {
    require(treasuryTokensClaimed == false, 'Already claimed');
    treasuryTokensClaimed = true;
    _transfer(address(this), owner(), TREASURY_TOKENS);
  }

  function claimVestingTokens() public onlyOwner lockUpFinished tokenBirthdayDefined {
    require(vestingContractAddress != address(0));
    require(vestingTokensClaimed == false, 'Already claimed');
    vestingTokensClaimed = true;
    _transfer(address(this), vestingContractAddress, TEAM_TOKENS + ADVISORS_TOKENS + PRIVATE_INVESTORS_TOKENS + COMMUNITY_ECOSYSTEM_TOKEN);
  }

  // Modifiers

  modifier tokenBirthdayDefined() {
    require(tokenBirthDate != 0, 'Initialization have not started');
    _;
  }

  modifier lockUpFinished() {
    require(tokenBirthDate != 0, 'Initialization have not started');
    require(tokenBirthDate + 40 days < block.timestamp, 'Still locked');
    _;
  }
}
