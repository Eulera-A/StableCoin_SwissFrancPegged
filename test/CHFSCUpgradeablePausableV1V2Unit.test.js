// unit.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const ADMIN_ROLE = ethers.ZeroHash; // 0x00

describe("CHFStablecoinDao (unit tests)", function () {
  let owner, daoAdmin, voter1;
  let TokenV1Factory, token, dao;

  beforeEach(async function () {
    [owner, daoAdmin, voter1] = await ethers.getSigners();

    TokenV1Factory = await ethers.getContractFactory(
      "CHFStablecoinDaoUpgradeablePausable"
    );
    const tokenImpl = await TokenV1Factory.deploy();
    await tokenImpl.waitForDeployment();

    const DaoFactory = await ethers.getContractFactory("CHFStablecoinDao");
    dao = await DaoFactory.deploy(
      ethers.ZeroAddress, // dummy token
      ethers.ZeroAddress, // dummy proxyAdmin
      ethers.ZeroAddress // dummy upgradeable token
    );
    await dao.waitForDeployment();
  });

  it("should allow creating a proposal", async function () {
    await expect(
      dao
        .connect(voter1)
        .createProposalUpgrade(ethers.ZeroAddress, "Test Proposal")
    ).to.emit(dao, "ProposalCreated");
  });

  it("should record votes and prevent double voting", async function () {
    const tx = await dao
      .connect(voter1)
      .createProposalUpgrade(ethers.ZeroAddress, "Vote Test");
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await dao.connect(voter1).vote(proposalId, true);
    await expect(dao.connect(voter1).vote(proposalId, true)).to.be.revertedWith(
      "Already voted"
    );
  });

  it("should not approve proposal if quorum not met", async function () {
    const tx = await dao
      .connect(voter1)
      .createProposalUpgrade(ethers.ZeroAddress, "Quorum Fail");
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await dao.connect(voter1).vote(proposalId, true);

    // Simulate time passing
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      dao.connect(voter1).approveProposal(proposalId)
    ).to.be.revertedWith("Quorum not met");
  });

  it("should revert execution if proposal not approved", async function () {
    const tx = await dao
      .connect(voter1)
      .createProposalUpgrade(ethers.ZeroAddress, "Invalid Execution");
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await expect(
      dao.connect(voter1).executeProposal(proposalId)
    ).to.be.revertedWith("Not approved yet");
  });
});
