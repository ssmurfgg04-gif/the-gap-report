/**
 * Simplified Kenya outline (Natural Earth, 1:50m, Douglas-Peucker simplified)
 * projected into a 420x460 SVG viewBox with an equirectangular projection.
 * project(lat, lng) maps geographic coordinates into the same space so zone
 * markers align with the outline.
 */
export const KENYA_VIEWBOX = "0 0 420 460" as const;

export const KENYA_OUTLINE_PATH =
  "M 316.5,340.5 L 314.9,340.9 L 315.7,338.4 L 320.4,335.3 L 322.4,336.0 L 321.8,338.0 L 316.5,340.5 Z M 10.1,290.6 L 11.9,239.8 L 15.9,234.6 L 21.3,221.1 L 32.1,209.8 L 35.1,202.3 L 40.3,197.3 L 48.8,193.5 L 48.2,187.6 L 56.0,176.3 L 56.6,170.7 L 56.0,158.2 L 52.5,142.8 L 53.5,140.2 L 46.4,125.5 L 39.8,120.9 L 36.9,112.5 L 33.7,110.6 L 31.6,99.8 L 33.2,89.6 L 21.4,82.5 L 22.3,80.1 L 20.0,79.3 L 13.3,65.0 L 69.1,10.0 L 69.0,13.5 L 71.6,15.5 L 77.8,13.2 L 89.7,16.4 L 91.7,19.2 L 92.1,24.5 L 90.5,39.6 L 101.7,54.2 L 139.8,56.7 L 190.8,89.6 L 251.7,98.0 L 258.7,92.7 L 266.7,80.9 L 306.6,62.7 L 322.8,76.1 L 354.9,75.4 L 331.5,109.0 L 315.2,125.7 L 315.8,284.9 L 339.3,315.2 L 339.7,320.5 L 328.3,331.3 L 321.3,332.9 L 316.5,331.5 L 314.7,336.1 L 312.0,334.7 L 313.4,342.1 L 312.3,345.3 L 301.4,357.0 L 291.0,357.7 L 283.1,363.4 L 281.3,369.1 L 281.9,377.7 L 278.5,387.7 L 273.2,392.0 L 267.5,401.8 L 261.9,419.8 L 251.5,440.8 L 246.6,447.1 L 242.7,446.4 L 239.9,450.0 L 238.5,449.3 L 178.4,406.0 L 174.6,400.2 L 170.2,398.4 L 173.6,387.5 L 171.7,378.8 L 16.5,292.2 L 10.1,290.6 Z";

// projection constants (derived from the Natural Earth Kenya bounding box)
const LON0 = 33.9090916421;
const LAT0 = -4.6923837474;
const KX = 0.9999756367;
const SCALE = 43.2021937288;
const PAD = 10;
const H = 460;

/** Project (lat, lng) into the 420x460 map space. */
export function projectKenya(lat: number, lng: number): { x: number; y: number } {
  const x = (lng - LON0) * KX * SCALE + PAD;
  const y = H - ((lat - LAT0) * SCALE + PAD);
  return { x, y };
}
