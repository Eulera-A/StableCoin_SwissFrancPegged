// scripts/deploy.js

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with:", deployer.address);

  const CHFStablecoin = await ethers.getContractFactory("CHFStablecoin");

  // Deploy with deployer's address as the initial owner
  const chf = await CHFStablecoin.deploy(deployer.address);

  // Wait for deployment to complete (Ethers v6+)
  await chf.waitForDeployment();

  console.log("CHFStablecoin deployed to:", await chf.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
