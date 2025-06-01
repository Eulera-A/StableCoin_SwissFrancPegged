Notes:
ethers V6 deploy:
contract.waitForDeployment()!

lower versions:
contract.deploy()!

things to do:

1.  Emit events on role changes and admin transfers

event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
event MinterRoleGranted(address indexed account);
event MinterRoleRevoked(address indexed account);

2. Use a proxy pattern (like OpenZeppelin’s UUPS or Transparent Proxy) for upgradeability

Transfer admin role to a Gnosis Safe or multisig on testnet/mainnet

Add supportsInterface override

Add unit tests for edge cases: pausing, role changes, failed burns/mints

security static analysis
do install python first:
check via python3 --version
and pip3 install
check via pip3 --version

pip3 install slither-analyzer
solc-select install 0.8.20 (to match version)
solc-select use 0.8.20

yarn (to install all dependencies in the package.json)

in package.json, script: defined slither : "slither": "slither ./contracts --solc-remaps '@openzeppelin=node_modules/@openzeppelin @chainlink=node_modules/@chainlink' --exclude naming-convention,external-function,low-level-calls",

and call yarn slither!!!

the upgrade and dao flow:
🧪 Deployment & Upgrade Flow (Scripted)
Here’s a full Hardhat script that will:

Deploy V1 as proxy

Deploy the DAO

Mint tokens to a user

Propose an upgrade to V2

Vote + advance time

Execute upgrade
