/**
 * GreedyMesher - Optimized voxel meshing algorithm
 * Merges adjacent faces with same texture into larger quads
 */

import { MeshGeometry, Vec3, Voxel } from '../core/types';

interface VoxelGetter {
  (x: number, y: number, z: number): Voxel | null;
}

interface MeshFace {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  axis: number;
  direction: number;
  textureId: string;
}

export class GreedyMesher {
  private size: number;

  constructor(size: number = 8) {
    this.size = size;
  }

  /**
   * Generate optimized mesh from voxel data
   */
  mesh(getVoxel: VoxelGetter): MeshGeometry {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Process each axis
    for (let axis = 0; axis < 3; axis++) {
      const axis1 = (axis + 1) % 3;
      const axis2 = (axis + 2) % 3;

      // Process both directions for this axis
      for (let direction = -1; direction <= 1; direction += 2) {
        const faces = this.extractFaces(getVoxel, axis, direction, axis1, axis2);
        const merged = this.mergeFaces(faces, axis1, axis2);

        for (const face of merged) {
          this.addQuad(face, vertices, normals, uvs, indices);
        }
      }
    }

    return {
      vertices: new Float32Array(vertices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices),
    };
  }

  /**
   * Extract visible faces for one axis direction
   */
  private extractFaces(
    getVoxel: VoxelGetter,
    axis: number,
    direction: number,
    axis1: number,
    axis2: number
  ): MeshFace[] {
    const faces: MeshFace[] = [];
    const dims = [this.size, this.size, this.size];

    for (let d = 0; d <= dims[axis]; d++) {
      for (let v = 0; v < dims[axis2]; v++) {
        for (let u = 0; u < dims[axis1]; u++) {
          const pos = [0, 0, 0];
          pos[axis] = d;
          pos[axis1] = u;
          pos[axis2] = v;

          // Get voxels on either side
          const posA = [...pos];
          const posB = [...pos];
          posA[axis] = d - 1;

          const voxelA = d > 0 ? getVoxel(posA[0], posA[1], posA[2]) : null;
          const voxelB = d < dims[axis] ? getVoxel(posB[0], posB[1], posB[2]) : null;

          // Check if face should be visible
          const solidA = voxelA?.solid ?? false;
          const solidB = voxelB?.solid ?? false;

          if (solidA !== solidB) {
            const voxel = solidA ? voxelA : voxelB;
            const faceDir = solidA ? -1 : 1;

            if (faceDir === direction && voxel) {
              faces.push({
                x: pos[0],
                y: pos[1],
                z: pos[2],
                width: 1,
                height: 1,
                axis,
                direction: faceDir,
                textureId: voxel.materialId || 'default',
              });
            }
          }
        }
      }
    }

    return faces;
  }

  /**
   * Merge adjacent faces with same texture using greedy algorithm
   */
  private mergeFaces(faces: MeshFace[], axis1: number, axis2: number): MeshFace[] {
    if (faces.length === 0) return [];

    // Group by position on main axis and texture
    const groups = new Map<string, MeshFace[]>();

    for (const face of faces) {
      const key = `${face.axis}-${[face.x, face.y, face.z][face.axis]}-${face.textureId}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(face);
    }

    const merged: MeshFace[] = [];

    for (const groupFaces of groups.values()) {
      // Create mask
      const mask = new Map<string, MeshFace | null>();
      for (const face of groupFaces) {
        const pos = [face.x, face.y, face.z];
        const key = `${pos[axis1]},${pos[axis2]}`;
        mask.set(key, face);
      }

      // Greedy merge
      for (const face of groupFaces) {
        const pos = [face.x, face.y, face.z];
        const startKey = `${pos[axis1]},${pos[axis2]}`;

        if (!mask.get(startKey)) continue;

        let width = 1;
        let height = 1;

        // Expand width
        while (true) {
          const nextU = pos[axis1] + width;
          if (nextU >= this.size) break;

          const checkKey = `${nextU},${pos[axis2]}`;
          const neighbor = mask.get(checkKey);

          if (!neighbor || neighbor.textureId !== face.textureId) break;

          width++;
        }

        // Expand height
        heightLoop: while (true) {
          const nextV = pos[axis2] + height;
          if (nextV >= this.size) break;

          for (let u = 0; u < width; u++) {
            const checkKey = `${pos[axis1] + u},${nextV}`;
            const neighbor = mask.get(checkKey);

            if (!neighbor || neighbor.textureId !== face.textureId) {
              break heightLoop;
            }
          }

          height++;
        }

        // Clear merged cells
        for (let v = 0; v < height; v++) {
          for (let u = 0; u < width; u++) {
            const clearKey = `${pos[axis1] + u},${pos[axis2] + v}`;
            mask.set(clearKey, null);
          }
        }

        merged.push({
          ...face,
          width,
          height,
        });
      }
    }

    return merged;
  }

  /**
   * Add quad vertices for a face
   */
  private addQuad(
    face: MeshFace,
    vertices: number[],
    normals: number[],
    uvs: number[],
    indices: number[]
  ): void {
    const startIndex = vertices.length / 3;

    const { axis, direction, width, height } = face;
    const axis1 = (axis + 1) % 3;
    const axis2 = (axis + 2) % 3;

    // Calculate corner positions
    const corners: Vec3[] = [];
    const basePos = [face.x, face.y, face.z];

    for (let v = 0; v <= 1; v++) {
      for (let u = 0; u <= 1; u++) {
        const pos = [...basePos];
        pos[axis1] += u * width;
        pos[axis2] += v * height;

        corners.push({ x: pos[0], y: pos[1], z: pos[2] });
      }
    }

    // Calculate normal
    const normal: Vec3 = { x: 0, y: 0, z: 0 };
    if (axis === 0) normal.x = direction;
    else if (axis === 1) normal.y = direction;
    else normal.z = direction;

    // Add vertices in correct winding order
    const order = direction > 0 ? [0, 1, 2, 3] : [0, 2, 1, 3];

    for (const i of order) {
      const corner = corners[i];
      vertices.push(corner.x, corner.y, corner.z);
      normals.push(normal.x, normal.y, normal.z);

      // UV coordinates
      const u = i % 2;
      const v = Math.floor(i / 2);
      uvs.push(u * width, v * height);
    }

    // Add indices for two triangles
    if (direction > 0) {
      indices.push(
        startIndex, startIndex + 1, startIndex + 2,
        startIndex + 1, startIndex + 3, startIndex + 2
      );
    } else {
      indices.push(
        startIndex, startIndex + 2, startIndex + 1,
        startIndex + 1, startIndex + 2, startIndex + 3
      );
    }
  }

  /**
   * Calculate mesh statistics
   */
  static getStats(geometry: MeshGeometry): { vertices: number; triangles: number; quads: number } {
    return {
      vertices: geometry.vertices.length / 3,
      triangles: geometry.indices.length / 3,
      quads: geometry.indices.length / 6,
    };
  }
}

/**
 * LODManager - Level of Detail management
 */
export class LODManager {
  private levels: number[];

  constructor(maxLod: number = 5) {
    this.levels = [];
    for (let i = 0; i <= maxLod; i++) {
      this.levels.push(Math.pow(2, i));
    }
  }

  /**
   * Calculate appropriate LOD level based on distance
   */
  getLodLevel(distance: number, lodDistances: number[] = [16, 32, 64, 128, 256]): number {
    for (let i = 0; i < lodDistances.length; i++) {
      if (distance < lodDistances[i]) {
        return i;
      }
    }
    return lodDistances.length;
  }

  /**
   * Get voxel scale for LOD level
   */
  getScale(lodLevel: number): number {
    return this.levels[Math.min(lodLevel, this.levels.length - 1)];
  }

  /**
   * Downsample voxel data for lower LOD
   */
  downsample(
    getVoxel: VoxelGetter,
    size: number,
    scale: number
  ): VoxelGetter {
    const newSize = Math.ceil(size / scale);
    const cache = new Map<string, Voxel | null>();

    return (x: number, y: number, z: number) => {
      const key = `${x},${y},${z}`;
      if (cache.has(key)) {
        return cache.get(key)!;
      }

      // Sample from higher resolution
      let solidCount = 0;
      let materialId: string | undefined;

      for (let dz = 0; dz < scale; dz++) {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const srcX = x * scale + dx;
            const srcY = y * scale + dy;
            const srcZ = z * scale + dz;

            if (srcX < size && srcY < size && srcZ < size) {
              const voxel = getVoxel(srcX, srcY, srcZ);
              if (voxel?.solid) {
                solidCount++;
                materialId = voxel.materialId;
              }
            }
          }
        }
      }

      // Majority voting for solid status
      const threshold = (scale * scale * scale) / 2;
      const result: Voxel | null = solidCount > threshold
        ? {
            solid: true,
            materialId,
            faces: [],
          }
        : null;

      cache.set(key, result);
      return result;
    };
  }
}
