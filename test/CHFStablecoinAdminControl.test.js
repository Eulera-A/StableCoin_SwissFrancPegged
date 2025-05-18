const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CHFStablecoinAdminControl", function () {
  let token;
  let admin, user1, user2;

  beforeEach(async function () {
    [admin, user1, user2] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("CHFStablecoinAdminControl");
    token = await Token.deploy(admin.address);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should have the correct name and symbol", async function () {
      expect(await token.name()).to.equal("CHFx");
      expect(await token.symbol()).to.equal("CHFx");
    });

    it("should assign admin the admin and minter roles", async function () {
      const ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
      const MINTER_ROLE = await token.MINTER_ROLE();

      expect(await token.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
      expect(await token.hasRole(MINTER_ROLE, admin.address)).to.be.true;
    });

    it("should not assign roles to user1 or user2", async function () {
      const MINTER_ROLE = await token.MINTER_ROLE();
      expect(await token.hasRole(MINTER_ROLE, user1.address)).to.be.false;
      expect(await token.hasRole(MINTER_ROLE, user2.address)).to.be.false;
    });
  });

  describe("Minting", function () {
    it("should allow admin to mint tokens to user2", async function () {
      const mintAmount = ethers.parseUnits("1000", 18); // Mint 1000 CHFx
      await token.connect(admin).mint(user2.address, mintAmount);
      expect(await token.balanceOf(user2.address)).to.equal(mintAmount);
    });

    it("should not allow non-minter to mint", async function () {
      const mintAmount = ethers.parseUnits("1000", 18); // Mint 1000 CHFx

      await expect(
        token.connect(user1).mint(user2.address, mintAmount)
      ).to.be.revertedWithCustomError(
        token,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should not mint beyond the max supply", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      await token.connect(admin).mint(user2.address, maxSupply);
      await expect(
        token.connect(admin).mint(user2.address, 1)
      ).to.be.revertedWith("Cap exceeded");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      const mintAmount = ethers.parseUnits("1000", 18); // Mint 1000 CHFx

      await token.connect(admin).mint(user2.address, mintAmount);
    });

    it("should allow admin to burn tokens from user2", async function () {
      const burnAmount = ethers.parseUnits("500", 18); // Mint 1000 CHFx

      await token.connect(admin).burn(user2.address, burnAmount);
      expect(await token.balanceOf(user2.address)).to.equal(burnAmount);
    });

    it("should not allow non-minter to burn tokens from user2", async function () {
      await expect(
        token.connect(user1).burn(user2.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(
        token,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should allow user2 to burn their own tokens", async function () {
      await token.connect(user2).burnMyTokens(ethers.parseUnits("200", 18));
      expect(await token.balanceOf(user2.address)).to.equal(
        ethers.parseUnits("800", 18)
      );
    });

    it("should not allow user2 to burn more than they have", async function () {
      await expect(
        token.connect(user2).burnMyTokens(ethers.parseUnits("2000", 18))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });

  describe("Pausing", function () {
    beforeEach(async function () {
      await token
        .connect(admin)
        .mint(user2.address, ethers.parseUnits("1000", 18));
    });

    it("should pause and prevent transfers", async function () {
      await token.connect(admin).pause();
      await expect(
        token
          .connect(user2)
          .transfer(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("should prevent minting while paused", async function () {
      await token.connect(admin).pause();
      await expect(
        token.connect(admin).mint(user2.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should allow transfers after unpausing", async function () {
      await token.connect(admin).pause();
      await token.connect(admin).unpause();
      await token
        .connect(user2)
        .transfer(user1.address, ethers.parseUnits("100", 18));
      expect(await token.balanceOf(user1.address)).to.equal(
        ethers.parseUnits("100", 18)
      );
    });
  });
});
