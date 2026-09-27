#!/usr/bin/env python3
"""Simplify Natural Earth Kenya outline to a compact SVG path + projection constants."""
import json, math

g = json.load(open('/tmp/kenya_outline.json'))
rings = []
for poly in g['coordinates']:
    ring = poly[0]
    # close ring check
    if ring[0] != ring[-1]:
        ring = ring + [ring[0]]
    rings.append(ring)

def dp(points, eps):
    """Douglas-Peucker simplification on lon/lat points."""
    if len(points) < 3:
        return points
    def perp(p, a, b):
        ax, ay = a; bx, by = b; px, py = p
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        if L == 0:
            return math.hypot(px - ax, py - ay)
        return abs(dx * (ay - py) - dy * (ax - px)) / L
    dmax, idx = 0, 0
    for i in range(1, len(points) - 1):
        d = perp(points[i], points[0], points[-1])
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        left = dp(points[:idx + 1], eps)
        right = dp(points[idx:], eps)
        return left[:-1] + right
    return [points[0], points[-1]]

# Bounding box of Kenya
lons = [p[0] for r in rings for p in r]
lats = [p[1] for r in rings for p in r]
LON0, LON1 = min(lons), max(lons)
LAT0, LAT1 = min(lats), max(lats)

# Projection: equirectangular with cos(lat_mid) x-scale, into viewBox W x H
W, H = 420, 460
PAD = 10
lat_mid = (LAT0 + LAT1) / 2
kx = math.cos(math.radians(lat_mid))
span_x = (LON1 - LON0) * kx
span_y = (LAT1 - LAT0)
scale = min((W - 2 * PAD) / span_x, (H - 2 * PAD) / span_y)

def project(lon, lat):
    x = (lon - LON0) * kx * scale + PAD
    y = H - ((lat - LAT0) * scale + PAD)  # flip Y for SVG
    return x, y

paths = []
for ring in rings:
    # drop tiny rings (islands) — keep rings with > 8 points and area span
    if len(ring) < 8:
        continue
    # simplify in projected space
    pts = [project(p[0], p[1]) for p in ring]
    simp = dp(pts, 1.1)
    if len(simp) < 4:
        continue
    d = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in simp) + " Z"
    paths.append(d)

path_str = " ".join(paths)
print("rings kept:", len(paths), "points:", sum(p.count('L') for p in paths) + len(paths))
print("bbox lon:", LON0, LON1, "lat:", LAT0, LAT1)
print("kx:", kx, "scale:", scale)
print()
print("PATH:", path_str[:400], "...")
json.dump({
    "viewBox": f"0 0 {W} {H}",
    "path": path_str,
    "proj": {"lon0": LON0, "lat0": LAT0, "kx": kx, "scale": scale, "pad": PAD, "w": W, "h": H},
}, open('/tmp/kenya_svg.json', 'w'), indent=1)
print("saved /tmp/kenya_svg.json")

# also sanity-print projected coords for a few known cities
for name, lon, lat in [("Nairobi", 36.82, -1.29), ("Mombasa", 39.67, -4.05), ("Lodwar", 35.60, 2.49), ("Garissa", 39.64, 0.46), ("Kisumu", 34.77, -0.09), ("Nakuru", 36.07, -0.30)]:
    print(name, [f"{v:.1f}" for v in project(lon, lat)])
