// Coordinate rounding and the 0.1-degree cell index, mirroring Colok.sol exactly.
//
// Everything on chain is an integer number of microdegrees (degrees x 1,000,000). Integers below
// 2^53 are exact in JavaScript, so these functions give the same answer as the contract.
// contracts/test/geo-parity.test.js checks that claim against the deployed bytecode.
//
// Self-contained on purpose (no imports), so Node can load it in the contract tests.

export const MICRO = 1_000_000
export const MAX_LAT = 90_000_000
export const MAX_LNG = 180_000_000
/** Cell edge in microdegrees: 0.1 degree, about 11 km. */
export const CELL_SIZE = 100_000
export const CELL_ROWS = 1800
export const CELL_COLUMNS = 3600
/** Most cells the contract answers for in one getSpotsInCells call. */
export const MAX_CELLS = 48

/** Degrees to integer microdegrees, rounded to five decimals (about one metre). */
export function toMicro(degrees: number): number {
  const micro = Math.round(degrees * 100_000) * 10
  return micro === 0 ? 0 : micro // drop -0
}

export const fromMicro = (micro: number): number => micro / MICRO

export const isValidLat = (lat: number): boolean => Number.isInteger(lat) && lat >= -MAX_LAT && lat <= MAX_LAT
export const isValidLng = (lng: number): boolean => Number.isInteger(lng) && lng >= -MAX_LNG && lng <= MAX_LNG

/** Row of a latitude in microdegrees, counted from the south pole. The north pole joins the top row. */
export function cellRow(lat: number): number {
  const row = Math.floor((lat + MAX_LAT) / CELL_SIZE)
  return row === CELL_ROWS ? CELL_ROWS - 1 : row
}

/** Column of a longitude in microdegrees, counted east from -180. +180 wraps to column 0. */
export function cellCol(lng: number): number {
  const col = Math.floor((lng + MAX_LNG) / CELL_SIZE)
  return col === CELL_COLUMNS ? 0 : col
}

/** The cell id the contract files a spot under: row * 3600 + column. */
export function cellOf(lat: number, lng: number): number {
  if (!isValidLat(lat)) throw new RangeError(`Latitude out of range: ${lat}`)
  if (!isValidLng(lng)) throw new RangeError(`Longitude out of range: ${lng}`)
  return cellRow(lat) * CELL_COLUMNS + cellCol(lng)
}

const clampLat = (deg: number) => Math.max(-90, Math.min(90, deg))

/** Wraps any longitude in degrees into [-180, 180). */
export function wrapLng(deg: number): number {
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180
  return wrapped === 0 ? 0 : wrapped
}

export type Bounds = { south: number; west: number; north: number; east: number }

/**
 * Every cell that touches a box given in degrees. West may be greater than east when the box
 * crosses the antimeridian. Returns null when more than `max` cells would be needed, which is
 * the signal to ask the person to zoom in.
 */
export function cellsInBounds(bounds: Bounds, max = MAX_CELLS): number[] | null {
  const south = cellRow(toMicro(clampLat(bounds.south)))
  const north = cellRow(toMicro(clampLat(bounds.north)))
  const span = bounds.east - bounds.west
  if (span >= 360) return null
  const west = cellCol(toMicro(wrapLng(bounds.west)))
  const east = cellCol(toMicro(wrapLng(bounds.east)))
  // A box that crosses the antimeridian wraps, so its east column is left of its west column.
  const columns = west <= east ? east - west + 1 : east + CELL_COLUMNS - west + 1
  const rows = north - south + 1
  if (rows < 1 || columns < 1 || rows * columns > max) return null

  const cells: number[] = []
  for (let r = south; r <= north; r += 1) {
    for (let i = 0; i < columns; i += 1) {
      cells.push(r * CELL_COLUMNS + ((west + i) % CELL_COLUMNS))
    }
  }
  return cells
}

/** The square block of cells centred on a point, `radius` cells out in every direction. */
export function cellsAround(lat: number, lng: number, radius: number): number[] {
  const row = cellRow(lat)
  const col = cellCol(lng)
  const cells: number[] = []
  for (let r = Math.max(0, row - radius); r <= Math.min(CELL_ROWS - 1, row + radius); r += 1) {
    for (let c = col - radius; c <= col + radius; c += 1) {
      cells.push(r * CELL_COLUMNS + ((c % CELL_COLUMNS) + CELL_COLUMNS) % CELL_COLUMNS)
    }
  }
  return cells
}
