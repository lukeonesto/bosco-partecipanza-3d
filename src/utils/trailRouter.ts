import { CategoryId, PoiFeature, TrailFeature } from '../types';
import { haversineDistanceM } from './geo';

type Coord = [number, number]; // [lon, lat]

interface GraphEdge {
  to: number;
  weight: number;
}

interface TrailSegment {
  nodeA: number;
  nodeB: number;
  coordA: Coord;
  coordB: Coord;
  lengthM: number;
}

export interface TrailGraph {
  coords: Coord[];
  adj: GraphEdge[][];
  segments: TrailSegment[];
}

export interface SnapResult {
  segmentIndex: number;
  point: Coord;
  snapDistM: number;
  distToA: number;
  distToB: number;
}

export interface NearestRouteResult {
  poi: PoiFeature;
  totalDistanceM: number;
  trailDistanceM: number;
  offTrailDistanceM: number;
  estimatedMinutes: number;
  pathCoordinates: Coord[];
  mode: 'trail' | 'direct';
}

const MAX_SNAP_DISTANCE_M = 1500;
const WALKING_SPEED_M_PER_MIN = 4000 / 60; // 4 km/h

function coordKey([lon, lat]: Coord): string {
  return `${lon.toFixed(6)},${lat.toFixed(6)}`;
}

/**
 * Project point P onto segment AB using a local equirectangular approximation
 * (accurate at forest scale ~10 km) and return the closest point + distances.
 */
function projectPointOnSegment(p: Coord, a: Coord, b: Coord): { point: Coord; t: number } {
  const cosLat = Math.cos(((a[1] + b[1]) * 0.5 * Math.PI) / 180);
  const ax = a[0] * cosLat;
  const ay = a[1];
  const bx = b[0] * cosLat;
  const by = b[1];
  const px = p[0] * cosLat;
  const py = p[1];

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return { point: [a[0], a[1]], t: 0 };
  }

  const rawT = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  const t = Math.max(0, Math.min(1, rawT));
  return {
    point: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
    t,
  };
}

/**
 * Build an undirected weighted graph from all LineString features in trails.geojson.
 * Shared vertices across trails are merged by quantized coordinates.
 */
export function buildTrailGraph(trails: TrailFeature[]): TrailGraph {
  const keyToId = new Map<string, number>();
  const coords: Coord[] = [];
  const adj: GraphEdge[][] = [];
  const segments: TrailSegment[] = [];

  const getOrCreateNode = (c: Coord): number => {
    const key = coordKey(c);
    const existing = keyToId.get(key);
    if (existing !== undefined) return existing;
    const id = coords.length;
    keyToId.set(key, id);
    coords.push([c[0], c[1]]);
    adj.push([]);
    return id;
  };

  for (const trail of trails) {
    const line = trail.geometry.coordinates;
    if (line.length < 2) continue;

    let prevId = getOrCreateNode(line[0]);
    for (let i = 1; i < line.length; i++) {
      const currId = getOrCreateNode(line[i]);
      if (currId === prevId) continue;

      const lengthM = haversineDistanceM(coords[prevId], coords[currId]);
      if (lengthM > 0) {
        adj[prevId].push({ to: currId, weight: lengthM });
        adj[currId].push({ to: prevId, weight: lengthM });
        segments.push({
          nodeA: prevId,
          nodeB: currId,
          coordA: coords[prevId],
          coordB: coords[currId],
          lengthM,
        });
      }
      prevId = currId;
    }
  }

  return { coords, adj, segments };
}

/**
 * Find the closest point on the trail network for a given coordinate.
 */
export function snapToTrailNetwork(graph: TrailGraph, p: Coord): SnapResult | null {
  if (graph.segments.length === 0) return null;

  let bestSegIdx = -1;
  let bestPoint: Coord = p;
  let bestDist = Infinity;

  for (let i = 0; i < graph.segments.length; i++) {
    const seg = graph.segments[i];
    const { point } = projectPointOnSegment(p, seg.coordA, seg.coordB);
    const d = haversineDistanceM(p, point);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = point;
      bestSegIdx = i;
    }
  }

  if (bestSegIdx === -1) return null;
  const seg = graph.segments[bestSegIdx];
  return {
    segmentIndex: bestSegIdx,
    point: bestPoint,
    snapDistM: bestDist,
    distToA: haversineDistanceM(bestPoint, seg.coordA),
    distToB: haversineDistanceM(bestPoint, seg.coordB),
  };
}

/**
 * Min-heap priority queue for Dijkstra.
 */
class MinHeap {
  private items: { node: number; dist: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(node: number, dist: number): void {
    this.items.push({ node, dist });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].dist <= this.items[i].dist) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): { node: number; dist: number } | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      const n = this.items.length;
      while (true) {
        let smallest = i;
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        if (left < n && this.items[left].dist < this.items[smallest].dist) smallest = left;
        if (right < n && this.items[right].dist < this.items[smallest].dist) smallest = right;
        if (smallest === i) break;
        [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
        i = smallest;
      }
    }
    return top;
  }
}

interface DijkstraResult {
  dist: Float64Array;
  prev: Int32Array;
  startEntryNode: Int32Array; // 0 if entered via nodeA, 1 if entered via nodeB
}

function runDijkstraFromSnap(graph: TrailGraph, startSnap: SnapResult): DijkstraResult {
  const n = graph.coords.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const startEntryNode = new Int32Array(n).fill(-1);

  const seg = graph.segments[startSnap.segmentIndex];
  const heap = new MinHeap();

  dist[seg.nodeA] = startSnap.distToA;
  startEntryNode[seg.nodeA] = seg.nodeA;
  heap.push(seg.nodeA, startSnap.distToA);

  if (startSnap.distToB < dist[seg.nodeB]) {
    dist[seg.nodeB] = startSnap.distToB;
    startEntryNode[seg.nodeB] = seg.nodeB;
    heap.push(seg.nodeB, startSnap.distToB);
  }

  while (heap.size > 0) {
    const cur = heap.pop()!;
    if (cur.dist > dist[cur.node]) continue;

    for (const edge of graph.adj[cur.node]) {
      const nd = cur.dist + edge.weight;
      if (nd < dist[edge.to]) {
        dist[edge.to] = nd;
        prev[edge.to] = cur.node;
        startEntryNode[edge.to] = startEntryNode[cur.node];
        heap.push(edge.to, nd);
      }
    }
  }

  return { dist, prev, startEntryNode };
}

function appendUniqueCoord(path: Coord[], c: Coord): void {
  const last = path[path.length - 1];
  if (!last || last[0] !== c[0] || last[1] !== c[1]) {
    path.push(c);
  }
}

function computeRouteToTarget(
  graph: TrailGraph,
  userCoords: Coord,
  startSnap: SnapResult,
  dijkstra: DijkstraResult,
  targetCoords: Coord
): Omit<NearestRouteResult, 'poi'> {
  const directDist = haversineDistanceM(userCoords, targetCoords);
  const endSnap = snapToTrailNetwork(graph, targetCoords);

  if (
    !endSnap ||
    startSnap.snapDistM > MAX_SNAP_DISTANCE_M ||
    endSnap.snapDistM > MAX_SNAP_DISTANCE_M
  ) {
    return {
      totalDistanceM: directDist,
      trailDistanceM: 0,
      offTrailDistanceM: directDist,
      estimatedMinutes: Math.max(1, Math.round(directDist / WALKING_SPEED_M_PER_MIN)),
      pathCoordinates: [userCoords, targetCoords],
      mode: 'direct',
    };
  }

  const offTrailDist = startSnap.snapDistM + endSnap.snapDistM;

  // Check if both points snap onto the exact same trail segment
  if (startSnap.segmentIndex === endSnap.segmentIndex) {
    const alongSeg = haversineDistanceM(startSnap.point, endSnap.point);
    const totalSameSeg = offTrailDist + alongSeg;
    if (totalSameSeg <= directDist * 3.5 || directDist > 40) {
      const path: Coord[] = [];
      appendUniqueCoord(path, userCoords);
      appendUniqueCoord(path, startSnap.point);
      appendUniqueCoord(path, endSnap.point);
      appendUniqueCoord(path, targetCoords);
      return {
        totalDistanceM: totalSameSeg,
        trailDistanceM: alongSeg,
        offTrailDistanceM: offTrailDist,
        estimatedMinutes: Math.max(1, Math.round(totalSameSeg / WALKING_SPEED_M_PER_MIN)),
        pathCoordinates: path,
        mode: 'trail',
      };
    }
  }

  const endSeg = graph.segments[endSnap.segmentIndex];
  const optA = dijkstra.dist[endSeg.nodeA] + endSnap.distToA;
  const optB = dijkstra.dist[endSeg.nodeB] + endSnap.distToB;

  const bestExitNode = optA <= optB ? endSeg.nodeA : endSeg.nodeB;
  const trailDist = Math.min(optA, optB);

  if (!Number.isFinite(trailDist)) {
    return {
      totalDistanceM: directDist,
      trailDistanceM: 0,
      offTrailDistanceM: directDist,
      estimatedMinutes: Math.max(1, Math.round(directDist / WALKING_SPEED_M_PER_MIN)),
      pathCoordinates: [userCoords, targetCoords],
      mode: 'direct',
    };
  }

  // Reconstruct node chain from startEntry -> bestExitNode
  const chain: number[] = [];
  let curr = bestExitNode;
  while (curr !== -1) {
    chain.push(curr);
    curr = dijkstra.prev[curr];
  }
  chain.reverse();

  const path: Coord[] = [];
  appendUniqueCoord(path, userCoords);
  appendUniqueCoord(path, startSnap.point);
  for (const nodeId of chain) {
    appendUniqueCoord(path, graph.coords[nodeId]);
  }
  appendUniqueCoord(path, endSnap.point);
  appendUniqueCoord(path, targetCoords);

  const totalDist = offTrailDist + trailDist;
  return {
    totalDistanceM: totalDist,
    trailDistanceM: trailDist,
    offTrailDistanceM: offTrailDist,
    estimatedMinutes: Math.max(1, Math.round(totalDist / WALKING_SPEED_M_PER_MIN)),
    pathCoordinates: path,
    mode: 'trail',
  };
}

/**
 * Find the nearest POI in a category following the trail network when possible,
 * falling back to direct haversine distance if off-network or disconnected.
 */
export function findNearestPoiAlongTrails(
  userCoords: Coord,
  pois: PoiFeature[],
  graph: TrailGraph,
  category?: CategoryId
): NearestRouteResult | null {
  const candidates = category
    ? pois.filter((p) => p.properties.categoria === category)
    : pois;

  if (candidates.length === 0) return null;

  const startSnap = snapToTrailNetwork(graph, userCoords);
  if (!startSnap || startSnap.snapDistM > MAX_SNAP_DISTANCE_M) {
    // Fallback to direct distance if user is far from trail network
    let best = candidates[0];
    let bestDist = haversineDistanceM(userCoords, best.geometry.coordinates);
    for (let i = 1; i < candidates.length; i++) {
      const d = haversineDistanceM(userCoords, candidates[i].geometry.coordinates);
      if (d < bestDist) {
        bestDist = d;
        best = candidates[i];
      }
    }
    return {
      poi: best,
      totalDistanceM: bestDist,
      trailDistanceM: 0,
      offTrailDistanceM: bestDist,
      estimatedMinutes: Math.max(1, Math.round(bestDist / WALKING_SPEED_M_PER_MIN)),
      pathCoordinates: [userCoords, best.geometry.coordinates],
      mode: 'direct',
    };
  }

  const dijkstra = runDijkstraFromSnap(graph, startSnap);
  let bestResult: NearestRouteResult | null = null;

  for (const poi of candidates) {
    const route = computeRouteToTarget(
      graph,
      userCoords,
      startSnap,
      dijkstra,
      poi.geometry.coordinates
    );
    if (!bestResult || route.totalDistanceM < bestResult.totalDistanceM) {
      bestResult = { poi, ...route };
    }
  }

  return bestResult;
}
