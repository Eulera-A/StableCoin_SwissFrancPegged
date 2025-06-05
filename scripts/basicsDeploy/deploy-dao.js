const { ethers } = require("hardhat");

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const proxyAdminAddress = process.env.PROXY_ADMIN;

  const DAO = await ethers.getContractFactory("CHFStablecoinDAO");
  const dao = await DAO.deploy(proxyAddress, proxyAdminAddress, proxyAddress);
  await dao.waitForDeployment();

  console.log("DAO deployed to:", await dao.getAddress());
}

main();
