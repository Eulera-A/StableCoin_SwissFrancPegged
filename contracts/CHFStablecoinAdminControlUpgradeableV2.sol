// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract CHFStablecoinAdminControlUpgradeableV2 is
    Initializable,
    ERC20Upgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable
{
    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Constants
    uint256 public constant MAX_SUPPLY = 500_000 * 1e18;
    string public constant CONTRACT_VERSION = "2.0.0";

    // storage upgrade example
    address public deployingAdmin;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) public initializer {
        require(admin != address(0), "Invalid admin");

        __ERC20_init("CHFx", "CHFx");
        __ERC20_init_unchained("CHFx", "CHFx");
        __Pausable_init(); // This is the missing piece!

        __ERC20Pausable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    /// @notice Reinitializer for V2 logic if you need to add in a new role or variable
    //     function initializeV2(address admin) public reinitializer(2) {
    //     }

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

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        super._update(from, to, value);
    }
}
