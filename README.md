things to do:

1.  Emit events on role changes and admin transfers

event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
event MinterRoleGranted(address indexed account);
event MinterRoleRevoked(address indexed account);

2. Use a proxy pattern (like OpenZeppelin’s UUPS or Transparent Proxy) for upgradeability

Transfer admin role to a Gnosis Safe or multisig on testnet/mainnet

Add supportsInterface override

Add unit tests for edge cases: pausing, role changes, failed burns/mints
