// Proves that the web app files spots under the same cell as the contract does.
// Loads web/src/geo/cells.ts directly; Node 22.18+ strips the TypeScript types on import.
const path = require("path");
const { pathToFileURL } = require("url");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const GEO = pathToFileURL(path.join(__dirname, "..", "..", "web", "src", "geo", "cells.ts")).href;

/** Small deterministic PRNG, so a failure can be reproduced. */
function rng(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}

describe("Geo parity: web/src/geo/cells.ts vs Colok.sol", function () {
  let geo;
  let colok;

  before(async function () {
    geo = await import(GEO);
    const Colok = await ethers.getContractFactory("Colok");
    colok = await Colok.deploy();
  });

  it("uses the same constants", async function () {
    expect(geo.MAX_LAT).to.equal(Number(await colok.MAX_LAT()));
    expect(geo.MAX_LNG).to.equal(Number(await colok.MAX_LNG()));
    expect(geo.CELL_SIZE).to.equal(Number(await colok.CELL_SIZE()));
    expect(geo.CELL_ROWS).to.equal(Number(await colok.CELL_ROWS()));
    expect(geo.CELL_COLUMNS).to.equal(Number(await colok.CELL_COLUMNS()));
    expect(geo.MAX_CELLS).to.equal(Number(await colok.MAX_CELLS()));
  });

  it("agrees on cell edges, poles, the antimeridian and both sides of zero", async function () {
    const edges = [-90_000_000, -89_999_999, -100_001, -100_000, -99_999, -1, 0, 1, 99_999, 100_000, 89_999_999, 90_000_000];
    const lngEdges = [-180_000_000, -179_999_999, -100_001, -100_000, -1, 0, 1, 100_000, 179_999_999, 180_000_000];
    for (const lat of edges) {
      for (const lng of lngEdges) {
        expect(geo.cellOf(lat, lng), `cell of ${lat}, ${lng}`).to.equal(Number(await colok.cellOf(lat, lng)));
      }
    }
  });

  it("agrees on 400 random coordinates rounded the way the app rounds them", async function () {
    const next = rng(677);
    for (let i = 0; i < 400; i++) {
      const lat = geo.toMicro(next() * 180 - 90);
      const lng = geo.toMicro(next() * 360 - 180);
      expect(lat % 10, "five decimals").to.equal(0);
      expect(geo.cellOf(lat, lng), `cell of ${lat}, ${lng}`).to.equal(Number(await colok.cellOf(lat, lng)));
    }
  });

  it("rounds degrees to five decimals and never produces -0", function () {
    expect(geo.toMicro(-6.1766449)).to.equal(-6_176_640);
    expect(geo.toMicro(106.8306251)).to.equal(106_830_630);
    expect(Object.is(geo.toMicro(-0.000001), 0)).to.equal(true);
    expect(geo.toMicro(90)).to.equal(90_000_000);
    expect(geo.toMicro(-180)).to.equal(-180_000_000);
  });

  it("lists the cells of a map view, including one across the antimeridian", function () {
    const cells = geo.cellsInBounds({ south: -6.25, west: 106.75, north: -6.15, east: 106.85 });
    // rows 837–838, columns 2867–2868
    expect(cells).to.deep.equal([837 * 3600 + 2867, 837 * 3600 + 2868, 838 * 3600 + 2867, 838 * 3600 + 2868]);

    const wrap = geo.cellsInBounds({ south: 0.01, west: 179.95, north: 0.02, east: 180.05 });
    expect(wrap).to.deep.equal([900 * 3600 + 3599, 900 * 3600 + 0]);

    expect(geo.cellsInBounds({ south: -10, west: 100, north: 10, east: 120 })).to.equal(null);
  });
});
