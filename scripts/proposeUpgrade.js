const { ethers } = require("hardhat");

async function main() {
  const daoAddress = process.env.DAO_ADDRESS;
  const newImplAddress = process.env.NEW_IMPLEMENTATION;

  const dao = await ethers.getContractAt("CHFStablecoinDAO", daoAddress);

  const tx = await dao.createProposalUpgrade(newImplAddress, "Upgrade to v2");
  const receipt = await tx.wait();
  console.log(
    "Upgrade proposal submitted. Proposal ID:",
    receipt.events[0].args.id.toString()
  );
}

main();
