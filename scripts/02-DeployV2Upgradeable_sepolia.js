const { ethers, run, network } = require("hardhat");

async function main() {
  //////////////////// deploy V2//////////////////////////
  //   const TokenV2Factory = await ethers.getContractFactory(
  //     "CHFStablecoinDaoUpgradeablePausableV2"
  //   );

  //   console.log("Deploying V2 implementation...");
  //   const txResponse = await TokenV2Factory.deploy();
  //   const tokenV2 = await txResponse.waitForDeployment();

  //   const v2Address = await tokenV2.getAddress();
  //   console.log("✅ V2 Implementation deployed to:", v2Address);

  //   // Ensure the transaction hash is available
  //   const txHash = txResponse.deploymentTransaction()?.hash;
  //   if (!txHash) {
  //     console.error("❌ Could not retrieve deployment transaction hash.");
  //     return;
  //   }

  if (network.name === "sepolia") {
    const v2Address = "0x8EAc4e92ADd925efB73cf29d32f741e4acCe71F4";

    try {
      await run("verify:verify", {
        address: v2Address,
        constructorArguments: [], // no constructor args for logic contract
      });
      console.log("✅ V2 successfully verified!");
    } catch (error) {
      if (error.message.toLowerCase().includes("already verified")) {
        console.log("Already verified.");
      } else {
        console.error("❌ Verification failed:", error);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
