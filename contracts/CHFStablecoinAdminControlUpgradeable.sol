// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract CHFStablecoinAdminControlUpgradeable is
    Initializable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_SUPPLY = 1000000 * 1e18;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(address admin) public initializer {
        __ERC20_init("CHFx", "CHFx");
        __ERC20Pausable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(!paused(), "Pausable: paused");
        require(totalSupply() + amount <= MAX_SUPPLY, "Cap exceeded");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(!paused(), "Pausable: paused");
        _burn(from, amount);
    }

    function burnMyTokens(uint256 amount) external {
        require(!paused(), "Pausable: paused");
        _burn(msg.sender, amount);
    }

    // Remove grant/revoke admin and minter functions from here
    // These should be handled by the DAO contract for governance.
}
