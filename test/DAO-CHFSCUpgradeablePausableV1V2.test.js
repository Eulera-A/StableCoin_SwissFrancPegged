// test/CHFStablecoinDao.integration.test.js
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const ADMIN_ROLE = ethers.ZeroHash; // 0x00

describe("CHFStablecoinDao (integration)", function () {
  let owner, daoAdmin, voter1, voter2;
  let TokenV1, TokenV2;
  let token, dao, proxyAdmin;

  beforeEach(async function () {
    [owner, daoAdmin, voter1, voter2] = await ethers.getSigners();

    const TokenV1Factory = await ethers.getContractFactory(
      "CHFStablecoinDaoUpgradeablePausable"
    );
    token = await upgrades.deployProxy(TokenV1Factory, [daoAdmin.address], {
      initializer: "initialize",
    });
    await token.waitForDeployment();

    const adminAddress = await upgrades.admin.getInstance();
    proxyAdmin = await ethers.getContractAt("IProxyAdmin", adminAddress);

    const DaoFactory = await ethers.getContractFactory("CHFStablecoinDao");
    dao = await DaoFactory.deploy(
      token.address,
      proxyAdmin.address,
      token.address
    );
    await dao.waitForDeployment();

    await proxyAdmin.transferOwnership(await dao.getAddress());

    await token
      .connect(daoAdmin)
      .grantRole(MINTER_ROLE, await voter1.getAddress());
    await token
      .connect(voter1)
      .mint(await voter1.getAddress(), ethers.parseEther("100"));
  });

  it("should execute an upgrade proposal end-to-end", async function () {
    const TokenV2Factory = await ethers.getContractFactory(
      "CHFStablecoinDaoUpgradeablePausableV2"
    );
    const tokenV2Impl = await TokenV2Factory.deploy();
    await tokenV2Impl.waitForDeployment();

    const tx = await dao
      .connect(voter1)
      .createProposalUpgrade(await tokenV2Impl.getAddress(), "Upgrade to V2");
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await dao.connect(voter1).vote(proposalId, true);

    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await dao.connect(voter1).approveProposal(proposalId);
    await dao.connect(voter1).executeProposal(proposalId);

    const upgradedToken = await ethers.getContractAt(
      "CHFStablecoinDaoUpgradeablePausableV2",
      await token.getAddress()
    );
    expect(await upgradedToken.CONTRACT_VERSION()).to.equal("2.0.0");
    expect(await upgradedToken.deployingAdmin()).to.equal(
      await dao.getAddress()
    );
  });

  it("should grant and revoke minter role via proposal", async function () {
    const tx = await dao
      .connect(voter1)
      .createProposalUpgrade(ethers.ZeroAddress, "Grant minter");
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await dao.proposals(proposalId).then((p) => (p.action = 0));
    await dao
      .proposals(proposalId)
      .then((p) => (p.targetAccount = voter2.address));

    await dao.connect(voter1).vote(proposalId, true);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).approveProposal(proposalId);
    await dao.connect(voter1).executeProposal(proposalId);

    expect(await token.hasRole(MINTER_ROLE, voter2.address)).to.be.true;

    // Revoke minter role
    const revokeTx = await dao
      .connect(voter1)
      .createProposalUpgrade(ethers.ZeroAddress, "Revoke minter");
    const revokeReceipt = await revokeTx.wait();
    const revokeId = revokeReceipt.logs[0].args[0];

    await dao.proposals(revokeId).then((p) => (p.action = 1));
    await dao
      .proposals(revokeId)
      .then((p) => (p.targetAccount = voter2.address));

    await dao.connect(voter1).vote(revokeId, true);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).approveProposal(revokeId);
    await dao.connect(voter1).executeProposal(revokeId);

    expect(await token.hasRole(MINTER_ROLE, voter2.address)).to.be.false;
  });

  it("should pause and unpause via proposal", async function () {
    const pauseTx = await dao
      .connect(voter1)
      .createProposalUpgrade(ethers.ZeroAddress, "Pause token");
    const pauseReceipt = await pauseTx.wait();
    const pauseId = pauseReceipt.logs[0].args[0];

    await dao.proposals(pauseId).then((p) => (p.action = 4));

    await dao.connect(voter1).vote(pauseId, true);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).approveProposal(pauseId);
    await dao.connect(voter1).executeProposal(pauseId);

    expect(await token.paused()).to.be.true;

    const unpauseTx = await dao
      .connect(voter1)
      .createProposalUpgrade(ethers.ZeroAddress, "Unpause token");
    const unpauseReceipt = await unpauseTx.wait();
    const unpauseId = unpauseReceipt.logs[0].args[0];

    await dao.proposals(unpauseId).then((p) => (p.action = 5));

    await dao.connect(voter1).vote(unpauseId, true);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).approveProposal(unpauseId);
    await dao.connect(voter1).executeProposal(unpauseId);

    expect(await token.paused()).to.be.false;
  });

  it("should reject proposal if quorum not met", async function () {
    const TokenV2Factory = await ethers.getContractFactory(
      "CHFStablecoinDaoUpgradeablePausableV2"
    );
    const tokenV2Impl = await TokenV2Factory.deploy();
    await tokenV2Impl.waitForDeployment();

    const tx = await dao
      .connect(voter2)
      .createProposalUpgrade(await tokenV2Impl.getAddress(), "Low quorum");
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await dao.connect(voter2).vote(proposalId, true);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      dao.connect(voter2).approveProposal(proposalId)
    ).to.be.revertedWith("Quorum not met");
  });

  it("should revert if already voted", async function () {
    const tx = await dao
      .connect(voter1)
      .createProposalUpgrade(ethers.ZeroAddress, "Test double vote");
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await dao.connect(voter1).vote(proposalId, true);
    await expect(dao.connect(voter1).vote(proposalId, true)).to.be.revertedWith(
      "Already voted"
    );
  });

  it("should reject invalid proposal execution (not approved)", async function () {
    const tx = await dao
      .connect(voter1)
      .createProposalUpgrade(ethers.ZeroAddress, "Invalid execution");
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await expect(
      dao.connect(voter1).executeProposal(proposalId)
    ).to.be.revertedWith("Not approved yet");
  });

  it("should reject execution if delay not passed", async function () {
    const tx = await dao
      .connect(voter1)
      .createProposalUpgrade(ethers.ZeroAddress, "Too soon");
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await dao.proposals(proposalId).then((p) => (p.action = 4));
    await dao.connect(voter1).vote(proposalId, true);

    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).approveProposal(proposalId);

    await ethers.provider.send("evm_increaseTime", [60 * 60 * 12]); // Only 12 hours
    await ethers.provider.send("evm_mine", []);

    await expect(
      dao.connect(voter1).executeProposal(proposalId)
    ).to.be.revertedWith("Execution delay not passed");
  });
});
