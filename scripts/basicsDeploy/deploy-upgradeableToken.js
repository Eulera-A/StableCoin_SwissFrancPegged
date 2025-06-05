const { ethers, upgrades } = require("hardhat");

async function main() {
  const CHF = await ethers.getContractFactory(
    "CHFStablecoinAdminControlUpgradeable"
  );
  const chf = await upgrades.deployProxy(CHF, [process.env.DEPLOYER_ADDRESS], {
    initializer: "initialize",
  });

  await chf.waitForDeployment();
  console.log("Proxy deployed to:", await chf.getAddress());

  const impl = await upgrades.erc1967.getImplementationAddress(
    await chf.getAddress()
  );
  const admin = await upgrades.erc1967.getAdminAddress(await chf.getAddress());

  console.log("Implementation address:", impl);
  console.log("Proxy admin:", admin);
}

main();
