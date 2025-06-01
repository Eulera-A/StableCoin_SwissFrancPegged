const { ethers, upgrades } = require("hardhat");
const {
  getAdminAddress,
  getImplementationAddress,
  isTransparentOrUUPSProxy,
  inferProxyKind,
} = require("@openzeppelin/upgrades-core");

async function main() {
  const [deployer, voter] = await ethers.getSigners();

  // Step 1: Deploy V1 as proxy
  const Test_V1 = await ethers.getContractFactory("CHFStablecoinTestV1");
  const proxy = await upgrades.deployProxy(Test_V1, [deployer.address], {
    initializer: "initialize",
  });
  console.log(`V1 proxy deploying at: ${proxy.target}`);

  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log(`V1 proxy deployed at: ${proxy.target}`);
  console.log(`Get V1 proxy address: ${proxyAddress}`);

  const adminAddress = await getAdminAddress(ethers.provider, proxy.target);
  const implAddress = await getImplementationAddress(
    ethers.provider,
    proxy.target
  );

  console.log("Proxy Admin Address:", adminAddress);
  console.log("Implementation Address:", implAddress);

  // /////////////////////////Manually upgrade to V2///////////////////////////

  // // Step 1-2: Deploy new impl V2:
  // // STEP 2: Deploy V2
  // const V2 = await ethers.getContractFactory("CHFStablecoinTestV2");

  // // STEP 1-3: Upgrade proxy to V2
  // const safeGuardVersionCompatible = await upgrades.validateUpgrade(
  //   proxyAddress,
  //   V2
  // );
  // console.log(`V2 and V1 compatibility: ${safeGuardVersionCompatible}`);
  // const upgraded = await upgrades.upgradeProxy(proxy, V2);
  // await upgraded.waitForDeployment();
  // console.log("Upgraded proxy now running V2 logic");

  // // STEP 1-4: Call reinitializer manually (not using a DAO yet)
  // const upgradedAsV2 = await ethers.getContractAt(
  //   "CHFStablecoinTestV2",
  //   proxy.target
  // );
  // await upgradedAsV2.initializeV2(deployer.address);

  // // STEP 1-5: Confirm upgrade
  // const version = await upgradedAsV2.CONTRACT_VERSION();
  // console.log("Contract version after upgrade:", version);

  // // Check what proxy is:
  // const kind = await inferProxyKind(ethers.provider, Test_V1);
  // console.log("Proxy kind:", kind); // Will print: "transparent" or "uups"

  // ////////////////////////////////DAO Process//////////////////////////////

  // Step 2: Deploy DAO
  const DAO = await ethers.getContractFactory("CHFStablecoinTestDao");
  const dao = await DAO.deploy(proxy.target, adminAddress, proxy.target);
  await dao.waitForDeployment();
  console.log(`Dao deployed at ${dao.target}`);

  // Step 2-1: check ownership if needing transfer to Dao:
  const ProxyAdmin = await ethers.getContractAt(
    "contracts/CHFStablecoinTestDao.sol:IProxyAdmin",
    adminAddress
  );

  const currentOwner = await ProxyAdmin.owner();
  console.log("ProxyAdmin current owner:", currentOwner);
  console.log("Deployer address:", deployer.address);

  if (currentOwner !== deployer.address) {
    throw new Error("Deployer is not the ProxyAdmin owner");
  }

  const txTransferOwnership2Dao = await ProxyAdmin.connect(
    deployer
  ).transferOwnership(dao.target);
  await txTransferOwnership2Dao.wait();
  console.log("Transferred ProxyAdmin ownership to DAO");

  const newDaoOwner = await ProxyAdmin.owner();
  console.log("Proxy Admin Owner Address (after):", newDaoOwner);

  if (newDaoOwner.toLowerCase() !== dao.target.toLowerCase()) {
    throw new Error("Ownership transfer to DAO failed");
  }

  // Step 3: Mint tokens to voter
  const MINTER_ROLE = await proxy.MINTER_ROLE();
  await proxy.grantRole(MINTER_ROLE, deployer.address); // Ensure deployer can mint
  await proxy.mint(voter.address, ethers.parseEther("1000"));

  // Step 4: Deploy V2 implementation
  const V2 = await ethers.getContractFactory("CHFStablecoinTestV2");
  const v2Impl = await V2.deploy();
  await v2Impl.waitForDeployment();
  const v2ImplAddress = await v2Impl.getAddress();
  console.log(`V2 implementation deployed at ${v2Impl.target}`);

  // Step 5: Create proposal
  const tx = await dao
    .connect(voter)
    .createProposalUpgrade(v2ImplAddress, "Upgrade to V2");
  const receipt = await tx.wait();
  const iface = dao.interface;
  let proposalId;

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed.name === "ProposalCreated") {
        proposalId = parsed.args.id;
        break;
      }
    } catch (err) {
      // Ignore logs that don't belong to the DAO
    }
  }

  if (!proposalId) {
    throw new Error("ProposalCreated event not found in transaction logs");
  }

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

  // Step 8: check and Execute proposal
  const proposal = await dao.proposals(proposalId);
  console.log("Proposal to be executed:", proposal);
  console.log(
    "Now time:",
    (await ethers.provider.getBlock("latest")).timestamp
  );
  console.log("Approved time:", proposal.approvedTime);
  console.log("Executed:", proposal.executed);
  console.log(
    "ProxyAdmin owner before executeProposal:",
    await ProxyAdmin.owner()
  );

  await dao.connect(deployer).executeProposal(proposalId);

  // Verify new implementation
  const newImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Implementation upgraded to:", newImpl);

  // Confirm logic via version
  const upgraded = await ethers.getContractAt(
    "CHFStablecoinTestV2",
    proxyAddress
  );
  const version = await upgraded.CONTRACT_VERSION();
  console.log("Contract version after upgrade:", version); // should be "2.0.0"
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
