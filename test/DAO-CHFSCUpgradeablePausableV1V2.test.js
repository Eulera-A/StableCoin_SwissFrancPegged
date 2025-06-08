// test/CHFStablecoinDao.test.js
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { getAdminAddress } = require("@openzeppelin/upgrades-core");

const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const ADMIN_ROLE = ethers.ZeroHash; // 0x00

describe("CHFStablecoinDao (integration)", function () {
  let owner, daoAdmin, voter1, voter2;
  let TokenV1, TokenV2;
  let token, dao, proxyAdmin;

  beforeEach(async function () {
    [owner, daoAdmin, voter1, voter2] = await ethers.getSigners();
    // deploy V1:
    const TokenV1Factory = await ethers.getContractFactory(
      "CHFStablecoinDaoUpgradeablePausable"
    );
    token = await upgrades.deployProxy(TokenV1Factory, [daoAdmin.address], {
      initializer: "initialize",
    });
    await token.waitForDeployment();

    const adminAddress = await getAdminAddress(ethers.provider, token.target);
    console.log(`adminAddress is ${adminAddress}`);

    // Deploy Dao

    const DaoFactory = await ethers.getContractFactory("CHFStablecoinDao");
    dao = await DaoFactory.deploy(token.target, adminAddress, token.target);
    await dao.waitForDeployment();
    console.log(`dao is deployed`);

    // Grant admin role to DAO BEFORE transferring ProxyAdmin
    await token.connect(daoAdmin).grantRole(ADMIN_ROLE, await dao.getAddress());
    console.log(`Granted ADMIN_ROLE to DAO`);

    // Grant MINTER_ROLE to voter1 and mint 100 tokens
    await token
      .connect(daoAdmin)
      .grantRole(MINTER_ROLE, await voter1.getAddress());
    await token
      .connect(voter1)
      .mint(await voter1.getAddress(), ethers.parseEther("100"));

    // get proxyAdmin object

    proxyAdmin = await ethers.getContractAt(
      "contracts/CHFStablecoinDao.sol:IProxyAdmin",
      adminAddress
    );

    console.log(`got IProxyAdmin at ${adminAddress}`);

    // transfer ownership to Dao
    await proxyAdmin.transferOwnership(await dao.getAddress());
    console.log(`Transferred proxyAdmin ownership to Dao`);
  });

  it("should execute an upgrade proposal end-to-end", async function () {
    const TokenV2Factory = await ethers.getContractFactory(
      "CHFStablecoinDaoUpgradeablePausableV2"
    );
    const tokenV2Impl = await TokenV2Factory.deploy();
    await tokenV2Impl.waitForDeployment();
    // voter 1 create a proposal
    const tx = await dao
      .connect(voter1)
      .createProposal(
        6,
        ethers.ZeroAddress,
        tokenV2Impl.target,
        "Upgrade to V2"
      );
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await dao.connect(voter1).vote(proposalId, true);

    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await dao.connect(voter1).approveProposal(proposalId);

    // Simulate delay
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]); // 1 day
    await ethers.provider.send("evm_mine", []);

    await dao.connect(voter1).executeProposal(proposalId);

    const upgradedToken = await ethers.getContractAt(
      "CHFStablecoinDaoUpgradeablePausableV2",
      token.target
    );
    expect(await upgradedToken.CONTRACT_VERSION()).to.equal("2.0.0");
    expect(await upgradedToken.deployingAdmin()).to.equal(dao.target);
  });

  it("should grant and revoke minter role via proposal", async function () {
    const tx = await dao
      .connect(voter1)
      .createProposal(0, voter2.address, ethers.ZeroAddress, "Grant minter");
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await dao.connect(voter1).vote(proposalId, true);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).approveProposal(proposalId);
    // Simulate delay before execute
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]); // 1 day
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).executeProposal(proposalId);

    expect(await token.hasRole(MINTER_ROLE, voter2.address)).to.be.true;

    // Revoke minter role
    const revokeTx = await dao
      .connect(voter1)
      .createProposal(1, voter2.address, ethers.ZeroAddress, "Revoke minter");
    const revokeReceipt = await revokeTx.wait();
    const revokeId = revokeReceipt.logs[0].args[0];

    await dao.connect(voter1).vote(revokeId, true);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).approveProposal(revokeId);
    // Simulate delay
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]); // 1 day
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).executeProposal(revokeId);

    expect(await token.hasRole(MINTER_ROLE, voter2.address)).to.be.false;
  });

  it("should pause and unpause via proposal", async function () {
    const pauseTx = await dao
      .connect(voter1)
      .createProposal(4, ethers.ZeroAddress, ethers.ZeroAddress, "Pause token");
    const pauseReceipt = await pauseTx.wait();
    const pauseId = pauseReceipt.logs[0].args[0];

    await dao.connect(voter1).vote(pauseId, true);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).approveProposal(pauseId);
    // Simulate delay
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]); // 1 day
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).executeProposal(pauseId);

    expect(await token.paused()).to.be.true;

    const unpauseTx = await dao
      .connect(voter1)
      .createProposal(
        5,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        "Unpause token"
      );
    const unpauseReceipt = await unpauseTx.wait();
    const unpauseId = unpauseReceipt.logs[0].args[0];

    await dao.connect(voter1).vote(unpauseId, true);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).approveProposal(unpauseId);
    // Simulate delay
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]); // 1 day
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).executeProposal(unpauseId);

    expect(await token.paused()).to.be.false;
  });

  it("should reject proposal if quorum not met", async function () {
    const TokenV2Factory = await ethers.getContractFactory(
      "CHFStablecoinDaoUpgradeablePausableV2"
    );
    const tokenV2Impl = await TokenV2Factory.deploy();
    await tokenV2Impl.waitForDeployment();

    // Grant MINTER_ROLE to voter2 and mint 10 tokens
    await token
      .connect(daoAdmin)
      .grantRole(MINTER_ROLE, await voter2.getAddress());
    await token
      .connect(voter2)
      .mint(await voter2.getAddress(), ethers.parseEther("10"));

    const tx = await dao
      .connect(voter2)
      .createProposal(
        6,
        ethers.ZeroAddress,
        tokenV2Impl.getAddress(),
        "Low quorum"
      );
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
      .createProposal(
        4,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        "Test double vote"
      );
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
      .createProposal(
        4,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        "Invalid execution"
      );
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await expect(
      dao.connect(voter1).executeProposal(proposalId)
    ).to.be.revertedWith("Not approved yet");
  });

  it("should reject execution if delay not passed", async function () {
    const tx = await dao
      .connect(voter1)
      .createProposal(4, ethers.ZeroAddress, ethers.ZeroAddress, "Too soon");
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args[0];

    await dao.connect(voter1).vote(proposalId, true);

    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await dao.connect(voter1).approveProposal(proposalId);

    await expect(
      dao.connect(voter1).executeProposal(proposalId)
    ).to.be.revertedWith("Execution delay not passed");
  });
});
