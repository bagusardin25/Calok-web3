const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const AMENITY = { POWER: 1, WIFI: 2, WATER: 4, SEATING: 8 };
const PLACE = { TRANSIT: 0, LIBRARY: 1, PARK: 2, CAMPUS: 3, MALL: 4, WORSHIP: 5, CAFE: 6, OTHER: 7 };
const REASON = { GONE: 0, BROKEN: 1, NOT_FREE: 2, WRONG_PLACE: 3 };
const STATUS = { NEW: 0, VERIFIED: 1, STALE: 2, REPORTED_GONE: 3, CLOSED: 4, HIDDEN: 5 };
const BLOCK = { OK: 0, NOT_FOUND: 1, HIDDEN: 2, CLOSED: 3, OWN_SPOT: 4, COOLING_DOWN: 5 };
const DAY = 24 * 60 * 60;
const COOLDOWN = 30 * DAY;
const STALE_AFTER = 90 * DAY;

// A real-looking spot, used only in tests: a station concourse in Jakarta.
const GAMBIR = { lat: -6_176_640, lng: 106_830_630 };
const GAMBIR_CELL = 838 * 3600 + 2868;

async function deploy() {
  const [owner, ayu, bima, citra, dewi, eko] = await ethers.getSigners();
  const Colok = await ethers.getContractFactory("Colok");
  const colok = await Colok.deploy();
  await colok.waitForDeployment();
  return { colok, owner, ayu, bima, citra, dewi, eko };
}

/** One spot, added by ayu. */
async function withSpot() {
  const ctx = await deploy();
  await ctx.colok
    .connect(ctx.ayu)
    .addSpot(GAMBIR.lat, GAMBIR.lng, AMENITY.POWER | AMENITY.WIFI, PLACE.TRANSIT, "Gambir concourse", "Pillar by the east gate, level 2");
  return ctx;
}

/** The same spot, confirmed by bima and citra: Verified. */
async function withVerifiedSpot() {
  const ctx = await withSpot();
  await ctx.colok.connect(ctx.bima).confirm(1);
  await ctx.colok.connect(ctx.citra).confirm(1);
  return ctx;
}

const add = (colok, signer, overrides = {}) => {
  const s = { lat: GAMBIR.lat, lng: GAMBIR.lng, amenities: AMENITY.POWER, place: PLACE.OTHER, name: "A spot", note: "", ...overrides };
  return colok.connect(signer).addSpot(s.lat, s.lng, s.amenities, s.place, s.name, s.note);
};

describe("Colok", function () {
  describe("deployment", function () {
    it("makes the deployer the owner and starts empty", async function () {
      const { colok, owner } = await loadFixture(deploy);
      expect(await colok.owner()).to.equal(owner.address);
      expect(await colok.spotCount()).to.equal(0);
      const s = await colok.stats();
      expect([s.spots, s.verified, s.confirmations, s.reports, s.mappers]).to.deep.equal([0n, 0n, 0n, 0n, 0n]);
    });

    it("refuses plain transfers of BOT: there is nothing payable", async function () {
      const { colok, ayu } = await loadFixture(deploy);
      await expect(ayu.sendTransaction({ to: await colok.getAddress(), value: 1n })).to.be.reverted;
    });
  });

  describe("addSpot", function () {
    it("stores the spot, files it under its cell and starts it as New", async function () {
      const { colok, ayu } = await loadFixture(deploy);
      await expect(
        colok.connect(ayu).addSpot(GAMBIR.lat, GAMBIR.lng, AMENITY.POWER | AMENITY.WIFI, PLACE.TRANSIT, "Gambir concourse", "Pillar by the east gate")
      )
        .to.emit(colok, "SpotAdded")
        .withArgs(1, ayu.address, GAMBIR_CELL, GAMBIR.lat, GAMBIR.lng, 3, PLACE.TRANSIT, "Gambir concourse");

      const spot = await colok.getSpot(1);
      expect(spot.id).to.equal(1);
      expect(spot.adder).to.equal(ayu.address);
      expect(spot.lat).to.equal(GAMBIR.lat);
      expect(spot.lng).to.equal(GAMBIR.lng);
      expect(spot.cell).to.equal(GAMBIR_CELL);
      expect(spot.amenities).to.equal(3);
      expect(spot.place).to.equal(PLACE.TRANSIT);
      expect(spot.score).to.equal(0);
      expect(spot.status).to.equal(STATUS.NEW);
      expect(spot.closed).to.equal(false);
      expect(spot.hidden).to.equal(false);
      expect(spot.createdAt).to.equal(await time.latest());
      expect(spot.lastConfirmedAt).to.equal(0);
      expect(spot.lastConfirmer).to.equal(ethers.ZeroAddress);
      expect(spot.confirmations).to.equal(0);
      expect(spot.reports).to.equal(0);
      expect(spot.name).to.equal("Gambir concourse");
      expect(spot.note).to.equal("Pillar by the east gate");

      expect(await colok.spotCount()).to.equal(1);
      expect(await colok.spotsBy(ayu.address)).to.deep.equal([1n]);
      const m = await colok.mapperOf(ayu.address);
      expect([m.added, m.confirms, m.reports]).to.deep.equal([1n, 0n, 0n]);
      expect((await colok.stats()).mappers).to.equal(1);
    });

    it("returns the new id from a dry run", async function () {
      const { colok, ayu } = await loadFixture(withSpot);
      const id = await colok.connect(ayu).addSpot.staticCall(0, 0, AMENITY.WATER, PLACE.PARK, "Fountain", "");
      expect(id).to.equal(2);
    });

    it("accepts the edges of every range", async function () {
      const { colok, ayu } = await loadFixture(deploy);
      await add(colok, ayu, { lat: 90_000_000, lng: 180_000_000 });
      await add(colok, ayu, { lat: -90_000_000, lng: -180_000_000 });
      await add(colok, ayu, { amenities: 15, place: PLACE.OTHER, name: "abc", note: "" });
      await add(colok, ayu, { name: "n".repeat(48), note: "x".repeat(160) });
      expect(await colok.spotCount()).to.equal(4);
      expect((await colok.getSpot(3)).amenities).to.equal(15);
      expect((await colok.getSpot(4)).note).to.have.lengthOf(160);
    });

    it("rejects coordinates out of range", async function () {
      const { colok, ayu } = await loadFixture(deploy);
      await expect(add(colok, ayu, { lat: 90_000_001 })).to.be.revertedWithCustomError(colok, "InvalidLatitude");
      await expect(add(colok, ayu, { lat: -90_000_001 })).to.be.revertedWithCustomError(colok, "InvalidLatitude");
      await expect(add(colok, ayu, { lng: 180_000_001 })).to.be.revertedWithCustomError(colok, "InvalidLongitude");
      await expect(add(colok, ayu, { lng: -180_000_001 })).to.be.revertedWithCustomError(colok, "InvalidLongitude");
    });

    it("rejects a spot with no amenity, or with unknown amenity bits", async function () {
      const { colok, ayu } = await loadFixture(deploy);
      await expect(add(colok, ayu, { amenities: 0 })).to.be.revertedWithCustomError(colok, "NoAmenities");
      await expect(add(colok, ayu, { amenities: 16 })).to.be.revertedWithCustomError(colok, "InvalidAmenities");
      await expect(add(colok, ayu, { amenities: 0x81 })).to.be.revertedWithCustomError(colok, "InvalidAmenities");
    });

    it("rejects an unknown place type", async function () {
      const { colok, ayu } = await loadFixture(deploy);
      await expect(add(colok, ayu, { place: 8 })).to.be.revertedWithCustomError(colok, "InvalidPlace");
    });

    it("limits the name to 3–48 bytes, counting bytes rather than characters", async function () {
      const { colok, ayu } = await loadFixture(deploy);
      await expect(add(colok, ayu, { name: "ab" })).to.be.revertedWithCustomError(colok, "InvalidName");
      await expect(add(colok, ayu, { name: "" })).to.be.revertedWithCustomError(colok, "InvalidName");
      await expect(add(colok, ayu, { name: "n".repeat(49) })).to.be.revertedWithCustomError(colok, "InvalidName");
      // 25 x "é" is 25 characters but 50 bytes.
      await expect(add(colok, ayu, { name: "é".repeat(25) })).to.be.revertedWithCustomError(colok, "InvalidName");
      await add(colok, ayu, { name: "é".repeat(24) });
    });

    it("limits the note to 160 bytes", async function () {
      const { colok, ayu } = await loadFixture(deploy);
      await expect(add(colok, ayu, { note: "x".repeat(161) })).to.be.revertedWithCustomError(colok, "InvalidNote");
    });
  });

  describe("cell index", function () {
    const cell = (row, col) => row * 3600 + col;

    it("puts 0,0 at row 900, column 1800", async function () {
      const { colok } = await loadFixture(deploy);
      expect(await colok.cellOf(0, 0)).to.equal(cell(900, 1800));
    });

    it("floors negative latitudes instead of truncating toward zero", async function () {
      const { colok } = await loadFixture(deploy);
      expect(await colok.cellOf(-1, 0)).to.equal(cell(899, 1800));
      expect(await colok.cellOf(-100_000, 0)).to.equal(cell(899, 1800));
      expect(await colok.cellOf(-100_001, 0)).to.equal(cell(898, 1800));
      expect(await colok.cellOf(99_999, 0)).to.equal(cell(900, 1800));
      expect(await colok.cellOf(100_000, 0)).to.equal(cell(901, 1800));
    });

    it("floors negative longitudes instead of truncating toward zero", async function () {
      const { colok } = await loadFixture(deploy);
      expect(await colok.cellOf(0, -1)).to.equal(cell(900, 1799));
      expect(await colok.cellOf(0, -100_000)).to.equal(cell(900, 1799));
      expect(await colok.cellOf(0, -100_001)).to.equal(cell(900, 1798));
      expect(await colok.cellOf(0, 99_999)).to.equal(cell(900, 1800));
      expect(await colok.cellOf(0, 100_000)).to.equal(cell(900, 1801));
    });

    it("indexes real places in every hemisphere", async function () {
      const { colok } = await loadFixture(deploy);
      // Jakarta (S, E), São Paulo (S, W), Reykjavík (N, W), Tokyo (N, E)
      expect(await colok.cellOf(GAMBIR.lat, GAMBIR.lng)).to.equal(GAMBIR_CELL);
      expect(await colok.cellOf(-23_550_520, -46_633_310)).to.equal(cell(664, 1333));
      expect(await colok.cellOf(64_146_582, -21_942_635)).to.equal(cell(1541, 1580));
      expect(await colok.cellOf(35_681_236, 139_767_125)).to.equal(cell(1256, 3197));
    });

    it("folds the poles into the edge rows and +180 into column 0", async function () {
      const { colok } = await loadFixture(deploy);
      expect(await colok.cellOf(90_000_000, 0)).to.equal(cell(1799, 1800));
      expect(await colok.cellOf(-90_000_000, 0)).to.equal(cell(0, 1800));
      expect(await colok.cellOf(0, 180_000_000)).to.equal(cell(900, 0));
      expect(await colok.cellOf(0, -180_000_000)).to.equal(cell(900, 0));
      expect(await colok.cellOf(0, 179_999_999)).to.equal(cell(900, 3599));
    });

    it("rejects coordinates out of range", async function () {
      const { colok } = await loadFixture(deploy);
      await expect(colok.cellOf(90_000_001, 0)).to.be.revertedWithCustomError(colok, "InvalidLatitude");
      await expect(colok.cellOf(0, -180_000_001)).to.be.revertedWithCustomError(colok, "InvalidLongitude");
    });

    it("finds an added spot in its own cell and not in the neighbours", async function () {
      const { colok } = await loadFixture(withSpot);
      const here = await colok.getSpotsInCells([GAMBIR_CELL], 10);
      expect(here.map((p) => p.id)).to.deep.equal([1n]);
      expect(here[0].name).to.equal("Gambir concourse");
      const around = [GAMBIR_CELL - 1, GAMBIR_CELL + 1, GAMBIR_CELL - 3600, GAMBIR_CELL + 3600];
      expect(await colok.getSpotsInCells(around, 10)).to.have.lengthOf(0);
    });

    it("keeps spots either side of the equator and the prime meridian in different cells", async function () {
      const { colok, ayu } = await loadFixture(deploy);
      await add(colok, ayu, { lat: 50, lng: 50, name: "NE of origin" });
      await add(colok, ayu, { lat: -50, lng: 50, name: "SE of origin" });
      await add(colok, ayu, { lat: -50, lng: -50, name: "SW of origin" });
      await add(colok, ayu, { lat: 50, lng: -50, name: "NW of origin" });
      const cells = [cell(900, 1800), cell(899, 1800), cell(899, 1799), cell(900, 1799)];
      for (let i = 0; i < 4; i++) {
        const pins = await colok.getSpotsInCells([cells[i]], 10);
        expect(pins.map((p) => p.id)).to.deep.equal([BigInt(i + 1)]);
      }
    });
  });

  describe("confirm", function () {
    it("raises the score and records who confirmed and when", async function () {
      const { colok, bima } = await loadFixture(withSpot);
      await expect(colok.connect(bima).confirm(1)).to.emit(colok, "SpotConfirmed").withArgs(1, bima.address, 1);
      const spot = await colok.getSpot(1);
      expect(spot.score).to.equal(1);
      expect(spot.confirmations).to.equal(1);
      expect(spot.lastConfirmer).to.equal(bima.address);
      expect(spot.lastConfirmedAt).to.equal(await time.latest());
      expect(spot.status).to.equal(STATUS.NEW);
      const vote = await colok.voteOf(1, bima.address);
      expect(vote.kind).to.equal(1);
      expect(vote.nextAt).to.equal(BigInt(await time.latest()) + BigInt(COOLDOWN));
      expect((await colok.mapperOf(bima.address)).confirms).to.equal(1);
    });

    it("turns a spot Verified on the second confirmation from someone else", async function () {
      const { colok } = await loadFixture(withVerifiedSpot);
      const spot = await colok.getSpot(1);
      expect(spot.score).to.equal(2);
      expect(spot.status).to.equal(STATUS.VERIFIED);
      expect(await colok.statusOf(1)).to.equal(STATUS.VERIFIED);
      const s = await colok.stats();
      expect(s.verified).to.equal(1);
      expect(s.confirmations).to.equal(2);
      expect(s.mappers).to.equal(3);
    });

    it("does not let the adder confirm their own spot", async function () {
      const { colok, ayu } = await loadFixture(withSpot);
      await expect(colok.connect(ayu).confirm(1)).to.be.revertedWithCustomError(colok, "OwnSpot");
    });

    it("lets a wallet move the score only once per 30 days", async function () {
      const { colok, bima } = await loadFixture(withSpot);
      await colok.connect(bima).confirm(1);
      const votedAt = await time.latest();
      const nextAt = votedAt + COOLDOWN;
      await expect(colok.connect(bima).confirm(1)).to.be.revertedWithCustomError(colok, "CoolingDown").withArgs(nextAt);
      await expect(colok.connect(bima).report(1, REASON.BROKEN))
        .to.be.revertedWithCustomError(colok, "CoolingDown")
        .withArgs(nextAt);

      await time.setNextBlockTimestamp(nextAt - 1);
      await expect(colok.connect(bima).confirm(1)).to.be.revertedWithCustomError(colok, "CoolingDown");

      await time.setNextBlockTimestamp(nextAt);
      await expect(colok.connect(bima).confirm(1)).to.emit(colok, "SpotConfirmed").withArgs(1, bima.address, 2);
      expect((await colok.getSpot(1)).confirmations).to.equal(2);
    });

    it("keeps the cooldown per spot, not per wallet", async function () {
      const { colok, ayu, bima } = await loadFixture(withSpot);
      await add(colok, ayu, { name: "Second spot" });
      await colok.connect(bima).confirm(1);
      await expect(colok.connect(bima).confirm(2)).to.emit(colok, "SpotConfirmed");
    });

    it("caps the score at +3 but still counts the confirmation and refreshes the date", async function () {
      const { colok, dewi, eko } = await loadFixture(withVerifiedSpot);
      await colok.connect(dewi).confirm(1);
      await time.increase(DAY);
      await expect(colok.connect(eko).confirm(1)).to.emit(colok, "SpotConfirmed").withArgs(1, eko.address, 3);
      const spot = await colok.getSpot(1);
      expect(spot.score).to.equal(3);
      expect(spot.confirmations).to.equal(4);
      expect(spot.lastConfirmer).to.equal(eko.address);
      expect(spot.lastConfirmedAt).to.equal(await time.latest());
    });

    it("counts a spot as verified once in the stats, however often it gets there", async function () {
      const { colok, dewi, eko } = await loadFixture(withVerifiedSpot);
      await colok.connect(dewi).report(1, REASON.GONE);
      await colok.connect(eko).confirm(1);
      expect((await colok.getSpot(1)).score).to.equal(2);
      expect((await colok.stats()).verified).to.equal(1);
    });

    it("rejects unknown, closed and hidden spots", async function () {
      const { colok, owner, ayu, bima } = await loadFixture(withSpot);
      await expect(colok.connect(bima).confirm(0)).to.be.revertedWithCustomError(colok, "SpotNotFound");
      await expect(colok.connect(bima).confirm(2)).to.be.revertedWithCustomError(colok, "SpotNotFound");

      await colok.connect(owner).setHidden(1, true);
      await expect(colok.connect(bima).confirm(1)).to.be.revertedWithCustomError(colok, "SpotIsHidden");
      await colok.connect(owner).setHidden(1, false);

      await colok.connect(ayu).closeSpot(1);
      await expect(colok.connect(bima).confirm(1)).to.be.revertedWithCustomError(colok, "SpotIsClosed");
    });
  });

  describe("report", function () {
    it("lowers the score and records the reason", async function () {
      const { colok, bima } = await loadFixture(withSpot);
      await expect(colok.connect(bima).report(1, REASON.NOT_FREE))
        .to.emit(colok, "SpotReported")
        .withArgs(1, bima.address, REASON.NOT_FREE, -1);
      const spot = await colok.getSpot(1);
      expect(spot.score).to.equal(-1);
      expect(spot.reports).to.equal(1);
      expect(spot.status).to.equal(STATUS.NEW);
      expect(spot.lastConfirmedAt).to.equal(0);
      const vote = await colok.voteOf(1, bima.address);
      expect(vote.kind).to.equal(-1);
      expect(vote.reason).to.equal(REASON.NOT_FREE);
      expect((await colok.mapperOf(bima.address)).reports).to.equal(1);
      expect((await colok.stats()).reports).to.equal(1);
    });

    it("marks a spot Reported gone after two reports from different wallets", async function () {
      const { colok, bima, citra } = await loadFixture(withSpot);
      await colok.connect(bima).report(1, REASON.GONE);
      await colok.connect(citra).report(1, REASON.BROKEN);
      expect((await colok.getSpot(1)).score).to.equal(-2);
      expect(await colok.statusOf(1)).to.equal(STATUS.REPORTED_GONE);
    });

    it("brings a Verified spot down: two reports after two confirmations leave it New", async function () {
      const { colok, dewi, eko } = await loadFixture(withVerifiedSpot);
      await colok.connect(dewi).report(1, REASON.GONE);
      expect(await colok.statusOf(1)).to.equal(STATUS.NEW);
      await colok.connect(eko).report(1, REASON.GONE);
      expect((await colok.getSpot(1)).score).to.equal(0);
      expect(await colok.statusOf(1)).to.equal(STATUS.NEW);
    });

    it("floors the score at -3 so old spots never become immune", async function () {
      const { colok, bima, citra, dewi, eko } = await loadFixture(withSpot);
      for (const w of [bima, citra, dewi]) await colok.connect(w).report(1, REASON.GONE);
      await expect(colok.connect(eko).report(1, REASON.GONE)).to.emit(colok, "SpotReported").withArgs(1, eko.address, 0, -3);
      const spot = await colok.getSpot(1);
      expect(spot.score).to.equal(-3);
      expect(spot.reports).to.equal(4);
    });

    it("lets a reported-gone spot recover when people confirm it again", async function () {
      const { colok, bima, citra, dewi, eko, owner } = await loadFixture(withSpot);
      await colok.connect(bima).report(1, REASON.GONE);
      await colok.connect(citra).report(1, REASON.GONE);
      expect(await colok.statusOf(1)).to.equal(STATUS.REPORTED_GONE);
      await colok.connect(dewi).confirm(1);
      expect(await colok.statusOf(1)).to.equal(STATUS.NEW);
      await colok.connect(eko).confirm(1);
      await colok.connect(owner).confirm(1);
      expect((await colok.getSpot(1)).score).to.equal(1);
      await time.increase(COOLDOWN);
      await colok.connect(bima).confirm(1);
      expect(await colok.statusOf(1)).to.equal(STATUS.VERIFIED);
    });

    it("rejects an unknown reason", async function () {
      const { colok, bima } = await loadFixture(withSpot);
      await expect(colok.connect(bima).report(1, 4)).to.be.revertedWithCustomError(colok, "InvalidReason");
    });

    it("does not let the adder report their own spot", async function () {
      const { colok, ayu } = await loadFixture(withSpot);
      await expect(colok.connect(ayu).report(1, REASON.GONE)).to.be.revertedWithCustomError(colok, "OwnSpot");
    });

    it("applies the same 30-day cooldown, shared with confirmations", async function () {
      const { colok, bima } = await loadFixture(withSpot);
      await colok.connect(bima).report(1, REASON.GONE);
      await expect(colok.connect(bima).report(1, REASON.GONE)).to.be.revertedWithCustomError(colok, "CoolingDown");
      await expect(colok.connect(bima).confirm(1)).to.be.revertedWithCustomError(colok, "CoolingDown");
      await time.increase(COOLDOWN);
      await expect(colok.connect(bima).confirm(1)).to.emit(colok, "SpotConfirmed").withArgs(1, bima.address, 0);
    });

    it("rejects unknown, closed and hidden spots", async function () {
      const { colok, owner, ayu, bima } = await loadFixture(withSpot);
      await expect(colok.connect(bima).report(9, REASON.GONE)).to.be.revertedWithCustomError(colok, "SpotNotFound");
      await colok.connect(owner).setHidden(1, true);
      await expect(colok.connect(bima).report(1, REASON.GONE)).to.be.revertedWithCustomError(colok, "SpotIsHidden");
      await colok.connect(owner).setHidden(1, false);
      await colok.connect(ayu).closeSpot(1);
      await expect(colok.connect(bima).report(1, REASON.GONE)).to.be.revertedWithCustomError(colok, "SpotIsClosed");
    });
  });

  describe("status over time", function () {
    it("turns a spot nobody confirms Stale 90 days after it was added", async function () {
      const { colok } = await loadFixture(withSpot);
      const createdAt = Number((await colok.getSpot(1)).createdAt);

      await time.increaseTo(createdAt + STALE_AFTER);
      expect(await colok.statusOf(1)).to.equal(STATUS.NEW);

      await time.increaseTo(createdAt + STALE_AFTER + 1);
      expect(await colok.statusOf(1)).to.equal(STATUS.STALE);
      expect((await colok.getSpot(1)).status).to.equal(STATUS.STALE);
    });

    it("turns a Verified spot Stale 90 days after its last confirmation", async function () {
      const { colok } = await loadFixture(withVerifiedSpot);
      const last = Number((await colok.getSpot(1)).lastConfirmedAt);

      await time.increaseTo(last + STALE_AFTER);
      expect(await colok.statusOf(1)).to.equal(STATUS.VERIFIED);

      await time.increaseTo(last + STALE_AFTER + 1);
      expect(await colok.statusOf(1)).to.equal(STATUS.STALE);
      const [pin] = await colok.getSpotsInCells([GAMBIR_CELL], 5);
      expect(pin.status).to.equal(STATUS.STALE);
      expect(pin.lastSeenAt).to.equal(last);
    });

    it("measures staleness from the last confirmation, not the first", async function () {
      const { colok, dewi } = await loadFixture(withVerifiedSpot);
      await time.increase(60 * DAY);
      await colok.connect(dewi).confirm(1);
      await time.increase(60 * DAY);
      expect(await colok.statusOf(1)).to.equal(STATUS.VERIFIED);
    });

    it("does not count a report as a sighting", async function () {
      const { colok, dewi } = await loadFixture(withVerifiedSpot);
      const last = Number((await colok.getSpot(1)).lastConfirmedAt);
      await time.increaseTo(last + 80 * DAY);
      await colok.connect(dewi).report(1, REASON.BROKEN);
      await time.increaseTo(last + STALE_AFTER + 1);
      expect(await colok.statusOf(1)).to.equal(STATUS.STALE);
    });

    it("brings a stale spot back with one fresh confirmation", async function () {
      const { colok, dewi } = await loadFixture(withVerifiedSpot);
      await time.increase(STALE_AFTER + DAY);
      expect(await colok.statusOf(1)).to.equal(STATUS.STALE);
      await colok.connect(dewi).confirm(1);
      expect(await colok.statusOf(1)).to.equal(STATUS.VERIFIED);
    });

    it("shows Reported gone ahead of Stale", async function () {
      const { colok, bima, citra } = await loadFixture(withSpot);
      await colok.connect(bima).report(1, REASON.GONE);
      await colok.connect(citra).report(1, REASON.GONE);
      await time.increase(STALE_AFTER + DAY);
      expect(await colok.statusOf(1)).to.equal(STATUS.REPORTED_GONE);
    });

    it("rejects statusOf for a spot that does not exist", async function () {
      const { colok } = await loadFixture(withSpot);
      await expect(colok.statusOf(2)).to.be.revertedWithCustomError(colok, "SpotNotFound");
    });
  });

  describe("closeSpot", function () {
    it("lets the adder close their spot", async function () {
      const { colok, ayu } = await loadFixture(withVerifiedSpot);
      await expect(colok.connect(ayu).closeSpot(1)).to.emit(colok, "SpotClosed").withArgs(1, ayu.address);
      const spot = await colok.getSpot(1);
      expect(spot.closed).to.equal(true);
      expect(spot.status).to.equal(STATUS.CLOSED);
      expect(spot.name).to.equal("Gambir concourse");
      expect(await colok.getSpotsInCells([GAMBIR_CELL], 10)).to.have.lengthOf(0);
      expect(await colok.cellCounts([GAMBIR_CELL])).to.deep.equal([1n]);
      expect(await colok.spotsBy(ayu.address)).to.deep.equal([1n]);
    });

    it("rejects anyone but the adder, the owner included", async function () {
      const { colok, owner, bima } = await loadFixture(withSpot);
      await expect(colok.connect(bima).closeSpot(1)).to.be.revertedWithCustomError(colok, "NotAdder");
      await expect(colok.connect(owner).closeSpot(1)).to.be.revertedWithCustomError(colok, "NotAdder");
    });

    it("rejects closing twice and closing a spot that does not exist", async function () {
      const { colok, ayu } = await loadFixture(withSpot);
      await colok.connect(ayu).closeSpot(1);
      await expect(colok.connect(ayu).closeSpot(1)).to.be.revertedWithCustomError(colok, "SpotIsClosed");
      await expect(colok.connect(ayu).closeSpot(5)).to.be.revertedWithCustomError(colok, "SpotNotFound");
    });
  });

  describe("setHidden", function () {
    it("lets the owner hide and unhide a spot without touching its data", async function () {
      const { colok, owner } = await loadFixture(withVerifiedSpot);
      await expect(colok.connect(owner).setHidden(1, true)).to.emit(colok, "SpotHiddenSet").withArgs(1, true);
      let spot = await colok.getSpot(1);
      expect(spot.hidden).to.equal(true);
      expect(spot.status).to.equal(STATUS.HIDDEN);
      expect(spot.score).to.equal(2);
      expect(spot.name).to.equal("Gambir concourse");
      expect(await colok.getSpotsInCells([GAMBIR_CELL], 10)).to.have.lengthOf(0);

      await expect(colok.connect(owner).setHidden(1, false)).to.emit(colok, "SpotHiddenSet").withArgs(1, false);
      spot = await colok.getSpot(1);
      expect(spot.status).to.equal(STATUS.VERIFIED);
      expect(await colok.getSpotsInCells([GAMBIR_CELL], 10)).to.have.lengthOf(1);
    });

    it("shows Hidden ahead of Closed", async function () {
      const { colok, owner, ayu } = await loadFixture(withSpot);
      await colok.connect(ayu).closeSpot(1);
      await colok.connect(owner).setHidden(1, true);
      expect(await colok.statusOf(1)).to.equal(STATUS.HIDDEN);
    });

    it("is for the owner only", async function () {
      const { colok, ayu, bima } = await loadFixture(withSpot);
      await expect(colok.connect(bima).setHidden(1, true)).to.be.revertedWithCustomError(colok, "NotOwner");
      await expect(colok.connect(ayu).setHidden(1, true)).to.be.revertedWithCustomError(colok, "NotOwner");
    });

    it("rejects a spot that does not exist", async function () {
      const { colok, owner } = await loadFixture(withSpot);
      await expect(colok.connect(owner).setHidden(2, true)).to.be.revertedWithCustomError(colok, "SpotNotFound");
    });
  });

  describe("transferOwnership", function () {
    it("hands moderation to the new owner", async function () {
      const { colok, owner, bima } = await loadFixture(withSpot);
      await expect(colok.connect(owner).transferOwnership(bima.address))
        .to.emit(colok, "OwnershipTransferred")
        .withArgs(owner.address, bima.address);
      expect(await colok.owner()).to.equal(bima.address);
      await colok.connect(bima).setHidden(1, true);
      await expect(colok.connect(owner).setHidden(1, false)).to.be.revertedWithCustomError(colok, "NotOwner");
    });

    it("rejects the zero address and callers who are not the owner", async function () {
      const { colok, owner, bima } = await loadFixture(deploy);
      await expect(colok.connect(owner).transferOwnership(ethers.ZeroAddress)).to.be.revertedWithCustomError(colok, "ZeroAddress");
      await expect(colok.connect(bima).transferOwnership(bima.address)).to.be.revertedWithCustomError(colok, "NotOwner");
    });
  });

  describe("reading", function () {
    /** Five spots by ayu and bima, in two cells. */
    async function withFiveSpots() {
      const ctx = await deploy();
      const { colok, ayu, bima } = ctx;
      await add(colok, ayu, { name: "Spot one" });
      await add(colok, bima, { name: "Spot two" });
      await add(colok, ayu, { name: "Spot three", lat: 1_000_000, lng: 1_000_000 });
      await add(colok, ayu, { name: "Spot four" });
      await add(colok, bima, { name: "Spot five" });
      return ctx;
    }

    it("getSpot rejects ids that do not exist", async function () {
      const { colok } = await loadFixture(withSpot);
      await expect(colok.getSpot(0)).to.be.revertedWithCustomError(colok, "SpotNotFound");
      await expect(colok.getSpot(2)).to.be.revertedWithCustomError(colok, "SpotNotFound");
    });

    it("getSpots pages newest first with a cursor", async function () {
      const { colok } = await loadFixture(withFiveSpots);
      let [page, next] = await colok.getSpots(0, 2);
      expect(page.map((s) => s.id)).to.deep.equal([5n, 4n]);
      expect(next).to.equal(4);
      [page, next] = await colok.getSpots(next, 2);
      expect(page.map((s) => s.id)).to.deep.equal([3n, 2n]);
      expect(next).to.equal(2);
      [page, next] = await colok.getSpots(next, 2);
      expect(page.map((s) => s.id)).to.deep.equal([1n]);
      expect(next).to.equal(0);
      [page, next] = await colok.getSpots(0, 100);
      expect(page).to.have.lengthOf(5);
      expect(next).to.equal(0);
    });

    it("getSpots returns an empty page on an empty map and rejects bad limits", async function () {
      const { colok } = await loadFixture(deploy);
      const [page, next] = await colok.getSpots(0, 10);
      expect(page).to.have.lengthOf(0);
      expect(next).to.equal(0);
      await expect(colok.getSpots(0, 0)).to.be.revertedWithCustomError(colok, "InvalidLimit");
      await expect(colok.getSpots(0, 101)).to.be.revertedWithCustomError(colok, "InvalidLimit");
    });

    it("getSpotsByIds returns empty entries for unknown ids", async function () {
      const { colok } = await loadFixture(withFiveSpots);
      const page = await colok.getSpotsByIds([2, 0, 9, 5]);
      expect(page.map((s) => s.id)).to.deep.equal([2n, 0n, 0n, 5n]);
      expect(page[0].name).to.equal("Spot two");
      await expect(colok.getSpotsByIds(Array.from({ length: 101 }, (_, i) => i + 1))).to.be.revertedWithCustomError(
        colok,
        "TooManyIds"
      );
    });

    it("getSpotsInCells returns open spots newest first, at most perCell per cell", async function () {
      const { colok, ayu, owner } = await loadFixture(withFiveSpots);
      const far = await colok.cellOf(1_000_000, 1_000_000);
      let pins = await colok.getSpotsInCells([GAMBIR_CELL, far], 10);
      expect(pins.map((p) => p.id)).to.deep.equal([5n, 4n, 2n, 1n, 3n]);

      pins = await colok.getSpotsInCells([GAMBIR_CELL, far], 2);
      expect(pins.map((p) => p.id)).to.deep.equal([5n, 4n, 3n]);

      await colok.connect(ayu).closeSpot(4);
      await colok.connect(owner).setHidden(5, true);
      pins = await colok.getSpotsInCells([GAMBIR_CELL], 2);
      expect(pins.map((p) => p.id)).to.deep.equal([2n, 1n]);
      expect(await colok.cellCounts([GAMBIR_CELL, far, 12345])).to.deep.equal([4n, 1n, 0n]);
    });

    it("getSpotsInCells includes reported-gone spots so the map can show them on request", async function () {
      const { colok, bima, citra } = await loadFixture(withSpot);
      await colok.connect(bima).report(1, REASON.GONE);
      await colok.connect(citra).report(1, REASON.GONE);
      const [pin] = await colok.getSpotsInCells([GAMBIR_CELL], 1);
      expect(pin.status).to.equal(STATUS.REPORTED_GONE);
      expect(pin.reports).to.equal(2);
      expect(pin.score).to.equal(-2);
    });

    it("getSpotsInCells limits how much one call may ask for", async function () {
      const { colok } = await loadFixture(withSpot);
      const cells49 = Array.from({ length: 49 }, (_, i) => i);
      await expect(colok.getSpotsInCells(cells49, 10)).to.be.revertedWithCustomError(colok, "TooManyCells");
      expect(await colok.getSpotsInCells(cells49.slice(0, 48), 50)).to.have.lengthOf(0);
      await expect(colok.getSpotsInCells([GAMBIR_CELL], 0)).to.be.revertedWithCustomError(colok, "InvalidLimit");
      await expect(colok.getSpotsInCells([GAMBIR_CELL], 51)).to.be.revertedWithCustomError(colok, "InvalidLimit");
      await expect(colok.cellCounts(Array.from({ length: 401 }, (_, i) => i))).to.be.revertedWithCustomError(colok, "TooManyCells");
    });

    it("voteOf is empty before a wallet votes", async function () {
      const { colok, bima } = await loadFixture(withSpot);
      const vote = await colok.voteOf(1, bima.address);
      expect([vote.votedAt, vote.kind, vote.reason, vote.nextAt]).to.deep.equal([0n, 0n, 0n, 0n]);
    });

    it("canVote explains every reason a wallet cannot vote", async function () {
      const { colok, owner, ayu, bima, citra } = await loadFixture(withSpot);
      expect(await colok.canVote(1, bima.address)).to.deep.equal([BigInt(BLOCK.OK), 0n]);
      expect(await colok.canVote(1, ayu.address)).to.deep.equal([BigInt(BLOCK.OWN_SPOT), 0n]);
      expect(await colok.canVote(7, bima.address)).to.deep.equal([BigInt(BLOCK.NOT_FOUND), 0n]);

      await colok.connect(bima).confirm(1);
      const nextAt = BigInt((await time.latest()) + COOLDOWN);
      expect(await colok.canVote(1, bima.address)).to.deep.equal([BigInt(BLOCK.COOLING_DOWN), nextAt]);
      await time.increaseTo(nextAt);
      expect(await colok.canVote(1, bima.address)).to.deep.equal([BigInt(BLOCK.OK), 0n]);

      await colok.connect(owner).setHidden(1, true);
      expect(await colok.canVote(1, citra.address)).to.deep.equal([BigInt(BLOCK.HIDDEN), 0n]);
      await colok.connect(owner).setHidden(1, false);
      await colok.connect(ayu).closeSpot(1);
      expect(await colok.canVote(1, citra.address)).to.deep.equal([BigInt(BLOCK.CLOSED), 0n]);
    });

    it("votedOn lists each spot once, even after voting on it again", async function () {
      const { colok, ayu, bima } = await loadFixture(withSpot);
      await add(colok, ayu, { name: "Second spot" });
      await colok.connect(bima).confirm(2);
      await colok.connect(bima).report(1, REASON.BROKEN);
      await time.increase(COOLDOWN);
      await colok.connect(bima).confirm(1);
      expect(await colok.votedOn(bima.address)).to.deep.equal([2n, 1n]);
      expect(await colok.votedOn(ayu.address)).to.deep.equal([]);
    });

    it("getMappers lists every contributor once, in order of first contribution", async function () {
      const { colok, ayu, bima, citra, dewi } = await loadFixture(withVerifiedSpot);
      await colok.connect(dewi).report(1, REASON.WRONG_PLACE);
      await add(colok, bima, { name: "Bima's spot" });

      const all = await colok.getMappers(0, 100);
      expect(all.map((m) => m.wallet)).to.deep.equal([ayu.address, bima.address, citra.address, dewi.address]);
      expect(all.map((m) => [m.added, m.confirms, m.reports])).to.deep.equal([
        [1n, 0n, 0n],
        [1n, 1n, 0n],
        [0n, 1n, 0n],
        [0n, 0n, 1n],
      ]);
      expect((await colok.getMappers(1, 2)).map((m) => m.wallet)).to.deep.equal([bima.address, citra.address]);
      expect(await colok.getMappers(4, 10)).to.have.lengthOf(0);
      await expect(colok.getMappers(0, 0)).to.be.revertedWithCustomError(colok, "InvalidLimit");
      const s = await colok.stats();
      expect([s.spots, s.verified, s.confirmations, s.reports, s.mappers]).to.deep.equal([2n, 1n, 2n, 1n, 4n]);
    });

    it("mapperOf is all zeros for a wallet that never took part", async function () {
      const { colok, eko } = await loadFixture(withSpot);
      const m = await colok.mapperOf(eko.address);
      expect(m.wallet).to.equal(eko.address);
      expect([m.added, m.confirms, m.reports, m.firstAt]).to.deep.equal([0n, 0n, 0n, 0n]);
    });
  });

  describe("gas", function () {
    // Prints the figures used in README.md and PRD.md section 10.7.
    it("measures deploy, add, confirm and report", async function () {
      const [, ayu, bima, citra] = await ethers.getSigners();
      const Colok = await ethers.getContractFactory("Colok");
      const colok = await Colok.deploy();
      const deployGas = (await colok.deploymentTransaction().wait()).gasUsed;

      const gas = async (tx) => (await (await tx).wait()).gasUsed;
      const fullName = "n".repeat(48);
      const fullNote = "x".repeat(160);
      const addFirst = await gas(colok.connect(ayu).addSpot(GAMBIR.lat, GAMBIR.lng, 3, 0, fullName, fullNote));
      const addNewMapper = await gas(
        colok.connect(citra).addSpot(GAMBIR.lat - 300, GAMBIR.lng, 13, 6, "Kopi Tepi Rel, back room", "Two outlets by the sofa; ask for the Wi-Fi code")
      );
      const addTypical = await gas(
        colok.connect(ayu).addSpot(GAMBIR.lat + 120, GAMBIR.lng, 9, 1, "Perpustakaan Nasional, lt. 4", "Outlets under the window desks")
      );
      const confirmFirst = await gas(colok.connect(bima).confirm(1));
      const confirmAgain = await gas(colok.connect(bima).confirm(2));
      const [, , , , dewi] = await ethers.getSigners();
      const reportFirst = await gas(colok.connect(dewi).report(1, 1));

      const bot = (g) => ethers.formatEther(g * 20_000_000_000n);
      console.log("      Action                                   Gas        BOT at 20 gwei");
      console.log(`      Deploy                                   ${deployGas}    ${bot(deployGas)}`);
      console.log(`      Add spot (48-byte name, 160-byte note)   ${addFirst}     ${bot(addFirst)}`);
      console.log(`      Add spot (24-byte name, 47-byte note, new wallet) ${addNewMapper} ${bot(addNewMapper)}`);
      console.log(`      Add spot (28-byte name, 30-byte note, repeat)    ${addTypical}     ${bot(addTypical)}`);
      console.log(`      Confirm (wallet's first contribution)    ${confirmFirst}     ${bot(confirmFirst)}`);
      console.log(`      Confirm (wallet already a mapper)        ${confirmAgain}     ${bot(confirmAgain)}`);
      console.log(`      Report (wallet's first contribution)     ${reportFirst}     ${bot(reportFirst)}`);

      expect(addFirst).to.be.below(500_000n);
      expect(confirmFirst).to.be.below(200_000n);
    });

    it("answers a full map query within a normal eth_call gas cap", async function () {
      const [, ayu] = await ethers.getSigners();
      const Colok = await ethers.getContractFactory("Colok");
      const colok = await Colok.deploy();
      // 30 spots in one cell, then ask for 48 cells at the frontend's perCell of 30.
      for (let i = 0; i < 30; i++) {
        await colok.connect(ayu).addSpot(GAMBIR.lat + i * 100, GAMBIR.lng, 1, 0, `Spot number ${i}`.padEnd(40, "."), "");
      }
      const cells = [GAMBIR_CELL, ...Array.from({ length: 47 }, (_, i) => GAMBIR_CELL + i + 1)];
      const estimate = await ethers.provider.estimateGas({
        to: await colok.getAddress(),
        data: colok.interface.encodeFunctionData("getSpotsInCells", [cells, 30]),
      });
      console.log(`      getSpotsInCells, 48 cells, 30 spots returned: ${estimate} gas`);
      expect(estimate).to.be.below(5_000_000n);
    });
  });
});
