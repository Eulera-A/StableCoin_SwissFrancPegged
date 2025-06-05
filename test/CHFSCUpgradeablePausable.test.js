// test/CHFStablecoinDaoUpgradeablePausable.test.js

const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("CHFStablecoinDaoUpgradeablePausable", function () {
  let CHFx, chfx, admin, minter, user1, user2;
  const MAX_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [admin, minter, user1, user2] = await ethers.getSigners();

    CHFx = await ethers.getContractFactory(
      "CHFStablecoinDaoUpgradeablePausable"
    );
    chfx = await upgrades.deployProxy(CHFx, [admin.address], {
      initializer: "initialize",
    });
    await chfx.waitForDeployment();
  });

  it("should initialize with correct roles and metadata", async function () {
    expect(await chfx.name()).to.equal("CHFx");
    expect(await chfx.symbol()).to.equal("CHFx");
    expect(await chfx.hasRole(await chfx.DEFAULT_ADMIN_ROLE(), admin.address))
      .to.be.true;
    expect(await chfx.hasRole(await chfx.MINTER_ROLE(), admin.address)).to.be
      .true;
  });

  it("should allow minting by admin", async function () {
    const amount = ethers.parseEther("100");
    await chfx.connect(admin).mint(user1.address, amount);
    expect(await chfx.balanceOf(user1.address)).to.equal(amount);
  });

  it("should reject minting over max supply", async function () {
    await expect(
      chfx.connect(admin).mint(user1.address, MAX_SUPPLY + 1n)
    ).to.be.revertedWith("Cap exceeded");
  });

  it("should allow burning by admin (as minter)", async function () {
    const amount = ethers.parseEther("50");
    await chfx.connect(admin).mint(user1.address, amount);
    await chfx.connect(admin).burn(user1.address, amount);
    expect(await chfx.balanceOf(user1.address)).to.equal(0);
  });

  it("should allow users to burn their own tokens", async function () {
    const amount = ethers.parseEther("30");
    await chfx.connect(admin).mint(user1.address, amount);
    await chfx.connect(user1).burnMyTokens(amount);
    expect(await chfx.balanceOf(user1.address)).to.equal(0);
  });

  it("should allow pausing, and block transfers when paused", async function () {
    const amount = ethers.parseEther("20");
    await chfx.connect(admin).mint(user1.address, amount);
    await chfx.connect(admin).pause();

    await expect(chfx.connect(user1).transfer(user2.address, amount)).to.be
      .reverted;
  });

  it("should allow unpausing and resume transfers", async function () {
    const amount = ethers.parseEther("20");
    await chfx.connect(admin).mint(user1.address, amount);
    await chfx.connect(admin).pause();
    await chfx.connect(admin).unpause();

    await chfx.connect(user1).transfer(user2.address, amount);
    expect(await chfx.balanceOf(user2.address)).to.equal(amount);
  });

  it("should not allow non-admin to pause or unpause", async function () {
    await expect(chfx.connect(user1).pause()).to.be.reverted;
    await expect(chfx.connect(user1).unpause()).to.be.reverted;
  });

  it("should not allow non-minter to mint or burn others' tokens", async function () {
    const amount = ethers.parseEther("10");
    await expect(chfx.connect(user1).mint(user2.address, amount)).to.be
      .reverted;
    await expect(chfx.connect(user1).burn(user2.address, amount)).to.be
      .reverted;
  });
});
