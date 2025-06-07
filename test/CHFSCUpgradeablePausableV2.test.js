const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("CHFStablecoinDaoUpgradeablePausableV2", function () {
  let chf, deployer, admin, user1, user2;

  const MAX_SUPPLY = ethers.parseEther("500000");

  beforeEach(async () => {
    [deployer, admin, user1, user2] = await ethers.getSigners();

    // Deploy V1 contract
    const CHFV1 = await ethers.getContractFactory(
      "CHFStablecoinDaoUpgradeablePausable"
    );
    chf = await upgrades.deployProxy(CHFV1, [admin.address], {
      initializer: "initialize",
    });
    await chf.waitForDeployment();

    // Upgrade to V2
    const CHFV2 = await ethers.getContractFactory(
      "CHFStablecoinDaoUpgradeablePausableV2"
    );
    chf = await upgrades.upgradeProxy(chf.target, CHFV2);
    await chf.initializeV2(admin.address);
  });

  it("should have correct name, symbol, and version", async () => {
    expect(await chf.name()).to.equal("CHFxStableCoin");
    expect(await chf.symbol()).to.equal("CHFxSC");
    expect(await chf.CONTRACT_VERSION()).to.equal("2.0.0");
  });

  it("should set deployingAdmin correctly in V2", async () => {
    expect(await chf.deployingAdmin()).to.equal(admin.address);
  });

  describe("Roles", () => {
    it("should grant MINTER and ADMIN roles to the initializer admin", async () => {
      const DEFAULT_ADMIN_ROLE = await chf.DEFAULT_ADMIN_ROLE();
      const MINTER_ROLE = await chf.MINTER_ROLE();

      expect(await chf.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await chf.hasRole(MINTER_ROLE, admin.address)).to.be.true;
    });

    it("should not allow non-minters to mint", async () => {
      await expect(chf.connect(user1).mint(user1.address, 100)).to.be.reverted;
    });
  });

  describe("Minting", () => {
    it("should allow minting up to MAX_SUPPLY", async () => {
      await chf.connect(admin).mint(user1.address, MAX_SUPPLY);
      expect(await chf.totalSupply()).to.equal(MAX_SUPPLY);
      expect(await chf.balanceOf(user1.address)).to.equal(MAX_SUPPLY);
    });

    it("should revert if mint exceeds MAX_SUPPLY", async () => {
      await chf.connect(admin).mint(user1.address, MAX_SUPPLY);
      await expect(
        chf.connect(admin).mint(user1.address, 1)
      ).to.be.revertedWith("Cap exceeded");
    });
  });

  describe("Burning", () => {
    beforeEach(async () => {
      await chf.connect(admin).mint(user1.address, ethers.parseEther("1000"));
    });

    it("should allow burn by MINTER", async () => {
      await chf.connect(admin).burn(user1.address, ethers.parseEther("500"));
      expect(await chf.balanceOf(user1.address)).to.equal(
        ethers.parseEther("500")
      );
    });

    it("should allow self-burn", async () => {
      await chf.connect(user1).burnMyTokens(ethers.parseEther("300"));
      expect(await chf.balanceOf(user1.address)).to.equal(
        ethers.parseEther("700")
      );
    });

    it("should revert burn by non-minter", async () => {
      await expect(chf.connect(user1).burn(user1.address, 100)).to.be.reverted;
    });
  });

  describe("Pause / Unpause", () => {
    beforeEach(async () => {
      await chf.connect(admin).pause();
    });

    it("should block transfer when paused", async () => {
      // first, we got to unpaused it for this...
      await chf.connect(admin).unpause();
      // do some minting, 100
      await chf.connect(admin).mint(user1.address, 100);
      await chf.connect(admin).pause();
      await expect(
        chf.connect(user1).transfer(user2.address, 50)
      ).to.be.revertedWithCustomError(chf, "EnforcedPause");
    });

    it("should allow transfer when unpaused", async () => {
      await chf.connect(admin).unpause();
      await chf.connect(admin).mint(user1.address, 100);
      await chf.connect(user1).transfer(user2.address, 50);
      expect(await chf.balanceOf(user2.address)).to.equal(50);
    });

    it("should not allow non-admin to pause/unpause", async () => {
      await expect(chf.connect(user1).pause()).to.be.reverted;
      await expect(chf.connect(user1).unpause()).to.be.reverted;
    });
  });

  describe("Upgrade Safety", () => {
    it("should preserve existing state and allow using new variables", async () => {
      // Deployment done in V1 and upgraded; now verify if old roles still exist
      const MINTER_ROLE = await chf.MINTER_ROLE();
      expect(await chf.hasRole(MINTER_ROLE, admin.address)).to.be.true;
      expect(await chf.deployingAdmin()).to.equal(admin.address);
    });
  });
});
