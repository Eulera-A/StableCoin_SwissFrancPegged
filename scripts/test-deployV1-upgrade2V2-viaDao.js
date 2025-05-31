const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer, voter] = await ethers.getSigners();

  // Step 1: Deploy V1 as proxy
  const V1 = await ethers.getContractFactory(
    "CHFStablecoinAdminControlUpgradeable"
  );
  const proxy = await upgrades.deployProxy(V1, [deployer.address], {
    initializer: "initialize",
  });
  await proxy.deployed();

  const proxyAdmin = await upgrades.admin.getInstance();
  const proxyAddress = proxy.address;
  const proxyAdminAddress = proxyAdmin.address;

  // Step 2: Deploy DAO
  const DAO = await ethers.getContractFactory("CHFStablecoinDAO");
  const dao = await DAO.deploy(proxyAddress, proxyAdminAddress, proxyAddress);
  await dao.deployed();

  // Step 3: Mint tokens to voter
  const MINTER_ROLE = await proxy.MINTER_ROLE();
  await proxy.grantRole(MINTER_ROLE, deployer.address); // Ensure deployer can mint
  await proxy.mint(voter.address, ethers.utils.parseEther("1000"));

  // Step 4: Deploy V2 implementation
  const V2 = await ethers.getContractFactory(
    "CHFStablecoinAdminControlUpgradeableV2"
  );
  const v2Impl = await V2.deploy();
  await v2Impl.deployed();

  // Step 5: Create proposal
  const tx = await dao
    .connect(voter)
    .createProposalUpgrade(v2Impl.address, "Upgrade to V2");
  const receipt = await tx.wait();
  const proposalId = receipt.events.find((e) => e.event === "ProposalCreated")
    .args.id;

  // Step 6: Vote
  await dao.connect(voter).vote(proposalId, true);

  // Simulate time passing to end voting period
  await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]); // 3 days
  await ethers.provider.send("evm_mine", []);

  // Step 7: Approve proposal
  await dao.connect(deployer).approveProposal(proposalId);

  // Simulate delay
  await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]); // 1 day
  await ethers.provider.send("evm_mine", []);

  // Step 8: Execute proposal
  await dao.connect(deployer).executeProposal(proposalId);

  // Verify new implementation
  const newImpl = await upgrades.erc1967.getImplementationAddress(
    proxy.address
  );
  console.log("Implementation upgraded to:", newImpl);

  // Confirm logic via version
  const upgraded = await ethers.getContractAt(
    "CHFStablecoinAdminControlUpgradeableV2",
    proxy.address
  );
  const version = await upgraded.CONTRACT_VERSION();
  console.log("Contract version after upgrade:", version); // should be "2.0.0"
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
