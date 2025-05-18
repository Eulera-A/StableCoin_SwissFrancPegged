// test/CHFStablecoin.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CHFStablecoin", function () {
  let CHFStablecoin;
  let chf;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    // Get the signers (accounts): first one is owner
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy the contract with the deployer's address as the initial owner
    CHFStablecoin = await ethers.getContractFactory("CHFStablecoin");
    chf = await CHFStablecoin.deploy(owner.address);

    // Wait for deployment to finish
    // Wait for the deployment to be mined
    await chf.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should have the correct name and symbol", async function () {
      expect(await chf.name()).to.equal("Swiss Franc Stablecoin");
      expect(await chf.symbol()).to.equal("CHFx");
    });

    it("should assign the initial owner correctly", async function () {
      expect(await chf.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("should mint tokens to the correct address", async function () {
      const mintAmount = ethers.parseUnits("1000", 18); // Mint 1000 CHFx

      // Mint tokens to addr1
      await chf.mint(addr1.address, mintAmount);

      const balance = await chf.balanceOf(addr1.address);
      expect(balance).to.equal(mintAmount);
    });

    it("should fail if a non-owner tries to mint tokens", async function () {
      const mintAmount = ethers.parseUnits("1000", 18); // Mint 1000 CHFx

      // Try to mint tokens from non-owner, try from addr1
      await expect(
        chf.connect(addr1).mint(addr1.address, mintAmount)
      ).to.be.revertedWithCustomError(chf, "OwnableUnauthorizedAccount");
    });
  });

  describe("Burning", function () {
    it("should burn tokens from the correct address", async function () {
      const mintAmount = ethers.parseUnits("1000", 18); // Mint 1000 CHFx
      const burnAmount = ethers.parseUnits("500", 18); // Burn 500 CHFx

      // Mint tokens to addr1
      await chf.mint(addr1.address, mintAmount);
      const initialBalance = await chf.balanceOf(addr1.address);

      // Burn tokens from addr1
      await chf.burn(addr1.address, burnAmount);

      const finalBalance = await chf.balanceOf(addr1.address);
      expect(finalBalance).to.equal(
        BigInt(initialBalance) - BigInt(burnAmount)
      );
    });

    it("should fail if a non-owner tries to burn tokens", async function () {
      const burnAmount = ethers.parseUnits("500", 18); // Try to burn 500 CHFx

      // Try to burn tokens from addr1 (non-owner)
      await expect(
        chf.connect(addr1).burn(addr1.address, burnAmount)
      ).to.be.revertedWithCustomError(chf, "OwnableUnauthorizedAccount");
    });
  });
});
