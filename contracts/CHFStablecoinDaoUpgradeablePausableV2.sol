// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract CHFStablecoinDaoUpgradeablePausableV2 is
    Initializable,
    ERC20Upgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_SUPPLY = 500000 * 1e18; // changed max supply by halve
    string public constant CONTRACT_VERSION = "2.0.0"; // versioning
    // Added new storage variable here:
    address public deployingAdmin;

    /// Original initializer — still required!
    function initialize(address admin) public initializer {
        __ERC20_init("CHF Stablecoin", "CHFS");
        __ERC20Pausable_init();
        __AccessControl_init();

        require(admin != address(0), "Invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    /// @notice Reinitializer for V2 upgrade
    function initializeV2(address admin) public reinitializer(2) {
        require(admin != address(0), "Invalid admin");

        deployingAdmin = admin;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        //require(!paused(), "Pausable: paused");
        require(totalSupply() + amount <= MAX_SUPPLY, "Cap exceeded");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        //require(!paused(), "Pausable: paused");
        _burn(from, amount);
    }

    function burnMyTokens(uint256 amount) external {
        //require(!paused(), "Pausable: paused");
        _burn(msg.sender, amount);
    }

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // 🧩 same function signatures from multiple inheritance: override _update hook
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        super._update(from, to, value);
    }

    // Remove grant/revoke admin and minter functions from here
    // These should be handled by the DAO contract for governance.
}
