const { ethers, upgrades, run } = require("hardhat");

async function main() {
  ///////////////////////// deploy to testnet and verify:////////////////

  //   const [deployer] = await ethers.getSigners();
  //   console.log(`Deployer address: ${deployer.address}`);

  //   // 1. Deploy Stablecoin V1 (as upgradeable proxy)
  //   const TokenV1Factory = await ethers.getContractFactory(
  //     "CHFStablecoinDaoUpgradeablePausable"
  //   );
  //   const token = await upgrades.deployProxy(TokenV1Factory, [deployer.address], {
  //     initializer: "initialize",
  //   });
  //   await token.waitForDeployment();
  //   console.log(`Token V1 Proxy deployed to: ${token.target}`);

  //   // Get the logic contract address
  //   const tokenImplAddress = await upgrades.erc1967.getImplementationAddress(
  //     token.target
  //   );
  //   console.log(`Token V1 Implementation address: ${tokenImplAddress}`);

  //   // 2. Deploy DAO contract
  //   const proxyAdmin = await upgrades.erc1967.getAdminAddress(token.target);
  //   const DaoFactory = await ethers.getContractFactory("CHFStablecoinDao");
  //   const dao = await DaoFactory.deploy(token.target, proxyAdmin, token.target);
  //   await dao.waitForDeployment();
  //   console.log(`DAO deployed to: ${dao.target}`);

  //   // 3. Transfer proxy admin ownership to DAO
  //   const proxyAdminContract = await ethers.getContractAt(
  //     "contracts/CHFStablecoinDao.sol:IProxyAdmin",
  //     proxyAdmin
  //   );
  //   await proxyAdminContract.transferOwnership(await dao.getAddress());
  //   console.log(`ProxyAdmin ownership transferred to DAO`);

  //   // 4. Grant DAO the ADMIN_ROLE
  //   const ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
  //   await token.grantRole(ADMIN_ROLE, await dao.getAddress());
  //   console.log(`Granted ADMIN_ROLE to DAO`);

  //   // === 5. VERIFY CONTRACTS ===
  //   console.log(`Starting Etherscan verifications...`);

  //   // Verify the V1 Implementation contract
  //   if (network.name === "sepolia") {
  //     console.log(`Waiting for 6 confirmations before verifying...`);
  //     await token.deployTransaction.wait(6);

  //     console.log(`Verifying contract on Etherscan...`);
  //     try {
  //       await run("verify:verify", {
  //         address: tokenImplAddress, // use token.getAddress() if `token.target` is not defined
  //         constructorArguments: [], // Add constructor args if needed
  //       });
  //       console.log(
  //         `✅ V1 Implementation Contract successfully verified on Sepolia!`
  //       );
  //     } catch (error) {
  //       if (error.message.toLowerCase().includes("already verified")) {
  //         console.log("Already verified.");
  //       } else {
  //         console.error("❌ Verification failed:", error);
  //       }
  //     }

  //     console.log("Waiting for 6 confirmations before verifying Dao contract...");
  //     await dao.deployTransaction.wait(6);
  //     console.log("Verifying contract on Etherscan...");

  //     try {
  //       // Verify the DAO contract
  //       await run("verify:verify", {
  //         address: dao.target,
  //         constructorArguments: [token.target, proxyAdmin, token.target],
  //       });
  //       console.log("✅ DAO Contract successfully verified on Sepolia!");
  //     } catch (error) {
  //       if (error.message.toLowerCase().includes("already verified")) {
  //         console.log("Already verified.");
  //       } else {
  //         console.error("❌ Verification failed:", error);
  //       }
  //     }
  //   }
  ////////////////////////// verification only script////////////
  // Already deployed addresses
  const tokenImplAddress = "0xD3c44681DfE394B315eb97f3eC3Aee98AF2F5d43"; // V1 implementation
  const daoAddress = "0x2dd5FF300CaA75D0845fAd34639f98c70E238A65"; // DAO
  const proxyAddress = "0x910b8b4fCd3F364F6b174EC52c34be948F7d7c72"; // Token Proxy
  //const proxyAdmin = "0xYOUR_PROXY_ADMIN_ADDRESS_HERE"; // Replace with actual ProxyAdmin address
  const proxyAdmin = await upgrades.erc1967.getAdminAddress(proxyAddress);
  console.log("ProxyAdmin is:", proxyAdmin);
  // Verify V1 Implementation
  try {
    console.log("Verifying V1 Implementation contract...");
    await run("verify:verify", {
      address: tokenImplAddress,
      constructorArguments: [],
    });
    console.log("✅ V1 Implementation verified!");
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("V1 Implementation already verified.");
    } else {
      console.error("❌ Verification failed for V1:", error);
    }
  }

  // Wait to avoid rate limits
  await new Promise((res) => setTimeout(res, 10000));

  // Verify DAO contract
  try {
    console.log("Verifying DAO contract...");
    await run("verify:verify", {
      address: daoAddress,
      constructorArguments: [proxyAddress, proxyAdmin, proxyAddress],
    });
    console.log("✅ DAO contract verified!");
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("DAO contract already verified.");
    } else {
      console.error("❌ Verification failed for DAO:", error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
