const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CHFStablecoinAdminControl", function () {
  let admin, user1, user2;
  let token;

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

    it("should assign admin both admin and minter roles", async function () {
      expect(
        await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), admin.address)
      ).to.be.true;
      expect(await token.hasRole(await token.MINTER_ROLE(), admin.address)).to
        .be.true;
    });

    it("should not assign roles to user1 or user2", async function () {
      expect(await token.hasRole(await token.MINTER_ROLE(), user1.address)).to
        .be.false;
      expect(await token.hasRole(await token.MINTER_ROLE(), user2.address)).to
        .be.false;
    });
  });

  describe("Minting", function () {
    it("should allow admin to mint tokens to user2", async function () {
      const amount = ethers.parseUnits("1000", 18);
      await token.connect(admin).mint(user2.address, amount);
      expect(await token.balanceOf(user2.address)).to.equal(amount);
    });

    it("should not allow user1 (non-minter) to mint tokens", async function () {
      const amount = ethers.parseUnits("1000", 18);
      await expect(
        token.connect(user1).mint(user2.address, amount)
      ).to.be.revertedWithCustomError(
        token,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      const amount = ethers.parseUnits("1000", 18);
      await token.connect(admin).mint(user2.address, amount);
    });

    it("should allow admin to burn tokens from user2", async function () {
      const burnAmount = ethers.parseUnits("500", 18);
      await token.connect(admin).burn(user2.address, burnAmount);
      expect(await token.balanceOf(user2.address)).to.equal(
        ethers.parseUnits("500", 18)
      );
    });

    it("should not allow user1 (non-minter) to burn tokens from user2", async function () {
      const burnAmount = ethers.parseUnits("500", 18);
      await expect(
        token.connect(user1).burn(user2.address, burnAmount)
      ).to.be.revertedWithCustomError(
        token,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should allow user2 to burn their own tokens using burnMyTokens", async function () {
      const burnAmount = ethers.parseUnits("500", 18);
      await token.connect(user2).burnMyTokens(burnAmount);
      expect(await token.balanceOf(user2.address)).to.equal(
        ethers.parseUnits("500", 18)
      );
    });

    it("should not allow user2 to burn more tokens than they have", async function () {
      const burnAmount = ethers.parseUnits("1500", 18);
      await expect(
        token.connect(user2).burnMyTokens(burnAmount)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });
});
