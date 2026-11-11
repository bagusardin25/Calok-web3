// Fills a LOCAL chain with sample spots so the interface has something to show.
// Refuses to run anywhere else: invented places do not belong on a public network.
//
//   npx hardhat run scripts/seed.js --network localhost
//
// The names are generic on purpose; none of them describes a real, checked place.
// To show the Stale status, the script moves the local chain's clock 91 days forward
// halfway through. The web app reads time from the chain, so it stays consistent.
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const A = { POWER: 1, WIFI: 2, WATER: 4, SEATING: 8 };
const P = { TRANSIT: 0, LIBRARY: 1, PARK: 2, CAMPUS: 3, MALL: 4, WORSHIP: 5, CAFE: 6, OTHER: 7 };
const R = { GONE: 0, BROKEN: 1, NOT_FREE: 2, WRONG_PLACE: 3 };
const micro = (deg) => Math.round(deg * 100_000) * 10;

async function main() {
  const { ethers, network } = hre;
  if (network.name !== "localhost" && network.name !== "hardhat") {
    throw new Error(`seed.js only runs on a local chain, not "${network.name}".`);
  }

  const file = path.join(__dirname, "..", "deployments", "localhost.json");
  if (!fs.existsSync(file)) throw new Error("Deploy first: npx hardhat run scripts/deploy.js --network localhost");
  const { address } = JSON.parse(fs.readFileSync(file, "utf8"));

  // Accounts 0, 7, 8 and 9 are the browser's dev wallets; keep them free of votes so they can
  // confirm and report anything.
  const [, ayu, bima, citra, dewi, eko, fitri] = await ethers.getSigners();
  const colok = await ethers.getContractAt("Colok", address);
  const as = (signer) => colok.connect(signer);
  const send = async (tx) => (await tx).wait();
  let id = Number(await colok.spotCount());
  const add = async (signer, lat, lng, amenities, place, name, note) => {
    await send(as(signer).addSpot(micro(lat), micro(lng), amenities, place, name, note));
    id += 1;
    return id;
  };

  // ── Older spots, which will be Stale after the clock moves ──
  await add(fitri, -6.18712, 106.82254, A.SEATING, P.TRANSIT, "Bus shelter benches, south side", "Covered benches, no outlets.");
  const tap = await add(eko, -6.16934, 106.83688, A.WATER, P.PARK, "Riverside park drinking tap", "Next to the footbridge stairs.");
  await send(as(ayu).confirm(tap));
  await send(as(bima).confirm(tap));

  await network.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
  await network.provider.send("evm_mine");

  // ── Current spots ──
  const station = await add(
    ayu, -6.17664, 106.83063, A.POWER | A.WIFI | A.SEATING, P.TRANSIT,
    "Station concourse, east gate", "Two outlets on the pillar by the ticket machines, level 2."
  );
  await send(as(bima).confirm(station));
  await send(as(citra).confirm(station));

  const library = await add(
    bima, -6.19432, 106.82211, A.POWER | A.WIFI | A.SEATING, P.LIBRARY,
    "City library, reading room 2", "Outlets under every second desk. Quiet floor."
  );
  await send(as(ayu).confirm(library));
  await send(as(citra).confirm(library));
  await send(as(dewi).confirm(library));

  const campus = await add(
    citra, -6.20871, 106.84590, A.POWER | A.WIFI | A.WATER | A.SEATING, P.CAMPUS,
    "Campus food court", "Refill station by the stairs; outlets along the back wall."
  );
  await send(as(eko).confirm(campus));

  const mall = await add(dewi, -6.19530, 106.82310, A.POWER, P.MALL, "Mall atrium, by the escalator", "Floor outlet near the bench.");
  await send(as(ayu).report(mall, R.NOT_FREE));
  await send(as(eko).report(mall, R.GONE));

  const mosque = await add(eko, -6.17010, 106.83110, A.WATER | A.SEATING, P.WORSHIP, "Mosque courtyard tap", "Drinking tap at the north entrance.");
  await send(as(ayu).confirm(mosque));
  await send(as(fitri).confirm(mosque));

  await add(fitri, -6.18205, 106.84122, A.POWER | A.WIFI, P.CAFE, "Corner café, back room", "Ask staff for the Wi-Fi password.");

  await add(citra, -6.16420, 106.81780, A.WIFI | A.SEATING, P.OTHER, "Community hall lobby", "Open Wi-Fi in the lobby during office hours.");

  const terminal = await add(
    bima, -6.21120, 106.81050, A.POWER | A.SEATING, P.TRANSIT,
    "Bus terminal waiting hall", "Charging kiosk next to gate 4."
  );
  await send(as(citra).confirm(terminal));
  await send(as(dewi).confirm(terminal));

  // Added last on purpose: the map opens on the newest spot, and this one sits mid-area.
  const pavilion = await add(ayu, -6.18500, 106.82800, A.SEATING | A.WATER, P.PARK, "Park pavilion by the pond", "");
  await send(as(dewi).report(pavilion, R.BROKEN));

  const s = await colok.stats();
  console.log(
    `Seeded ${s.spots} spots (${s.verified} reached Verified), ${s.confirmations} confirmations, ` +
      `${s.reports} reports, ${s.mappers} mappers. Chain clock moved 91 days forward.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
