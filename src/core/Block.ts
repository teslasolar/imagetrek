/**
 * Block - Voxel Block Class with Octree Structure
 * pos{x,y,z,t}, prev, hash, voxels[8³], textures{}, children[], lod, parent
 */

import { Vec3, Vec4, RayHit, MeshGeometry, Voxel, VoxelFace } from './types';
import { Gen } from './Gen';

const BLOCK_SIZE = 8; // 8³ voxels per block
const BLOCK_SIZE_CUBED = BLOCK_SIZE * BLOCK_SIZE * BLOCK_SIZE; // 512 voxels

export class Block {
  readonly position: Vec4;
  readonly hash: string;
  prev: string | null;
  parent: Block | null;
  children: Block[];
  lod: number;

  private voxels: (Voxel | null)[];
  private textures: Map<string, ImageBitmap>;
  private dirty: boolean;
  private meshCache: MeshGeometry | null;

  constructor(
    x: number,
    y: number,
    z: number,
    t: number = 0,
    parent: Block | null = null
  ) {
    this.position = { x, y, z, t };
    this.hash = Block.computeHash(x, y, z, t);
    this.prev = null;
    this.parent = parent;
    this.children = [];
    this.lod = parent ? parent.lod + 1 : 0;

    this.voxels = new Array(BLOCK_SIZE_CUBED).fill(null);
    this.textures = new Map();
    this.dirty = true;
    this.meshCache = null;
  }

  /**
   * Compute deterministic hash from position
   */
  static computeHash(x: number, y: number, z: number, t: number): string {
    let hash = 0;
    const values = [x, y, z, t];
    for (const v of values) {
      hash = ((hash << 5) - hash + v) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Convert 3D coordinates to linear index
   */
  private coordToIndex(x: number, y: number, z: number): number {
    if (x < 0 || x >= BLOCK_SIZE || y < 0 || y >= BLOCK_SIZE || z < 0 || z >= BLOCK_SIZE) {
      return -1;
    }
    return x + y * BLOCK_SIZE + z * BLOCK_SIZE * BLOCK_SIZE;
  }

  /**
   * Convert linear index to 3D coordinates
   */
  private indexToCoord(idx: number): Vec3 {
    return {
      x: idx % BLOCK_SIZE,
      y: Math.floor(idx / BLOCK_SIZE) % BLOCK_SIZE,
      z: Math.floor(idx / (BLOCK_SIZE * BLOCK_SIZE)),
    };
  }

  /**
   * Place a generation at specified local coordinates
   */
  place(gen: Gen, x: number, y: number, z: number): boolean {
    const idx = this.coordToIndex(x, y, z);
    if (idx < 0) return false;

    const image = gen.getImage();
    if (image) {
      this.textures.set(gen.id, image);
    }

    const voxel: Voxel = {
      faces: this.createFaces(gen.id),
      solid: true,
      materialId: gen.id,
    };

    this.voxels[idx] = voxel;
    this.dirty = true;
    this.meshCache = null;

    return true;
  }

  /**
   * Create 6 faces for a voxel
   */
  private createFaces(textureId: string): VoxelFace[] {
    const normals: Vec3[] = [
      { x: 1, y: 0, z: 0 },   // +X
      { x: -1, y: 0, z: 0 },  // -X
      { x: 0, y: 1, z: 0 },   // +Y
      { x: 0, y: -1, z: 0 },  // -Y
      { x: 0, y: 0, z: 1 },   // +Z
      { x: 0, y: 0, z: -1 },  // -Z
    ];

    return normals.map(normal => ({
      textureId,
      ao: 0,
      normal,
    }));
  }

  /**
   * Get voxel at local coordinates
   */
  getVoxel(x: number, y: number, z: number): Voxel | null {
    const idx = this.coordToIndex(x, y, z);
    if (idx < 0) return null;
    return this.voxels[idx];
  }

  /**
   * Set voxel at local coordinates
   */
  setVoxel(x: number, y: number, z: number, voxel: Voxel | null): void {
    const idx = this.coordToIndex(x, y, z);
    if (idx < 0) return;
    this.voxels[idx] = voxel;
    this.dirty = true;
    this.meshCache = null;
  }

  /**
   * Subdivide block into 8 children for LOD
   */
  subdivide(): Block[] {
    if (this.children.length > 0) {
      return this.children;
    }

    const halfSize = BLOCK_SIZE / 2;
    const { x, y, z, t } = this.position;

    for (let dz = 0; dz < 2; dz++) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const childX = x * 2 + dx * halfSize;
          const childY = y * 2 + dy * halfSize;
          const childZ = z * 2 + dz * halfSize;

          const child = new Block(childX, childY, childZ, t, this);
          this.children.push(child);
        }
      }
    }

    return this.children;
  }

  /**
   * DDA Raycast through voxel grid
   * Returns hit information or null
   */
  raycast(origin: Vec3, direction: Vec3): RayHit | null {
    // Normalize direction
    const len = Math.sqrt(
      direction.x ** 2 + direction.y ** 2 + direction.z ** 2
    );
    const dir = {
      x: direction.x / len,
      y: direction.y / len,
      z: direction.z / len,
    };

    // Transform ray to local block space
    const localOrigin = {
      x: origin.x - this.position.x * BLOCK_SIZE,
      y: origin.y - this.position.y * BLOCK_SIZE,
      z: origin.z - this.position.z * BLOCK_SIZE,
    };

    // DDA setup
    let x = Math.floor(localOrigin.x);
    let y = Math.floor(localOrigin.y);
    let z = Math.floor(localOrigin.z);

    const stepX = dir.x >= 0 ? 1 : -1;
    const stepY = dir.y >= 0 ? 1 : -1;
    const stepZ = dir.z >= 0 ? 1 : -1;

    const tDeltaX = Math.abs(1 / dir.x);
    const tDeltaY = Math.abs(1 / dir.y);
    const tDeltaZ = Math.abs(1 / dir.z);

    let tMaxX = dir.x !== 0
      ? (dir.x > 0 ? (x + 1 - localOrigin.x) : (localOrigin.x - x)) * tDeltaX
      : Infinity;
    let tMaxY = dir.y !== 0
      ? (dir.y > 0 ? (y + 1 - localOrigin.y) : (localOrigin.y - y)) * tDeltaY
      : Infinity;
    let tMaxZ = dir.z !== 0
      ? (dir.z > 0 ? (z + 1 - localOrigin.z) : (localOrigin.z - z)) * tDeltaZ
      : Infinity;

    const maxSteps = BLOCK_SIZE * 3;
    let normal: Vec3 = { x: 0, y: 0, z: 0 };

    for (let i = 0; i < maxSteps; i++) {
      // Check current voxel
      if (x >= 0 && x < BLOCK_SIZE && y >= 0 && y < BLOCK_SIZE && z >= 0 && z < BLOCK_SIZE) {
        const voxel = this.voxels[this.coordToIndex(x, y, z)];
        if (voxel?.solid) {
          const distance = Math.min(tMaxX, tMaxY, tMaxZ);
          return {
            position: {
              x: localOrigin.x + dir.x * distance,
              y: localOrigin.y + dir.y * distance,
              z: localOrigin.z + dir.z * distance,
            },
            normal,
            textureId: voxel.materialId || '',
            distance,
            voxelIndex: this.coordToIndex(x, y, z),
          };
        }
      }

      // Step to next voxel
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          tMaxX += tDeltaX;
          normal = { x: -stepX, y: 0, z: 0 };
        } else {
          z += stepZ;
          tMaxZ += tDeltaZ;
          normal = { x: 0, y: 0, z: -stepZ };
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          tMaxY += tDeltaY;
          normal = { x: 0, y: -stepY, z: 0 };
        } else {
          z += stepZ;
          tMaxZ += tDeltaZ;
          normal = { x: 0, y: 0, z: -stepZ };
        }
      }

      // Exit if outside block
      if (x < 0 || x >= BLOCK_SIZE || y < 0 || y >= BLOCK_SIZE || z < 0 || z >= BLOCK_SIZE) {
        break;
      }
    }

    return null;
  }

  /**
   * Generate mesh using greedy meshing algorithm
   */
  mesh(): MeshGeometry {
    if (this.meshCache && !this.dirty) {
      return this.meshCache;
    }

    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Greedy meshing for each axis
    for (let axis = 0; axis < 3; axis++) {
      const axis1 = (axis + 1) % 3;
      const axis2 = (axis + 2) % 3;

      const dims = [BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE];
      const mask = new Array(dims[axis1] * dims[axis2]).fill(null);

      // Sweep through each slice
      for (let d = 0; d <= dims[axis]; d++) {
        // Create mask for this slice
        for (let v = 0; v < dims[axis2]; v++) {
          for (let u = 0; u < dims[axis1]; u++) {
            const pos = [0, 0, 0];
            pos[axis] = d;
            pos[axis1] = u;
            pos[axis2] = v;

            const idx = u + v * dims[axis1];

            // Check voxel on each side of the slice
            const voxelA = d > 0 ? this.getVoxelByAxis(pos, axis, -1) : null;
            const voxelB = d < dims[axis] ? this.getVoxelByAxis(pos, axis, 0) : null;

            // Generate face if one side is solid and other is not
            if (voxelA?.solid !== voxelB?.solid) {
              mask[idx] = voxelA?.solid ? voxelA : voxelB;
            } else {
              mask[idx] = null;
            }
          }
        }

        // Merge mask faces using greedy algorithm
        for (let v = 0; v < dims[axis2]; v++) {
          for (let u = 0; u < dims[axis1]; ) {
            const idx = u + v * dims[axis1];
            if (!mask[idx]) {
              u++;
              continue;
            }

            const currentMask = mask[idx];

            // Calculate width
            let width = 1;
            while (
              u + width < dims[axis1] &&
              mask[u + width + v * dims[axis1]] === currentMask
            ) {
              width++;
            }

            // Calculate height
            let height = 1;
            let done = false;
            while (v + height < dims[axis2] && !done) {
              for (let w = 0; w < width; w++) {
                if (mask[u + w + (v + height) * dims[axis1]] !== currentMask) {
                  done = true;
                  break;
                }
              }
              if (!done) height++;
            }

            // Generate quad
            const quadStart = vertices.length / 3;
            const pos = [0, 0, 0];
            pos[axis] = d;
            pos[axis1] = u;
            pos[axis2] = v;

            // Add 4 vertices for the quad
            for (let vert = 0; vert < 4; vert++) {
              const vPos = [...pos];
              if (vert === 1 || vert === 2) vPos[axis1] += width;
              if (vert === 2 || vert === 3) vPos[axis2] += height;

              vertices.push(vPos[0], vPos[1], vPos[2]);

              const normal = [0, 0, 0];
              normal[axis] = currentMask === mask[idx] ? 1 : -1;
              normals.push(normal[0], normal[1], normal[2]);

              uvs.push(
                vert === 1 || vert === 2 ? width : 0,
                vert === 2 || vert === 3 ? height : 0
              );
            }

            // Add indices for two triangles
            indices.push(
              quadStart, quadStart + 1, quadStart + 2,
              quadStart, quadStart + 2, quadStart + 3
            );

            // Clear mask
            for (let h = 0; h < height; h++) {
              for (let w = 0; w < width; w++) {
                mask[u + w + (v + h) * dims[axis1]] = null;
              }
            }

            u += width;
          }
        }
      }
    }

    this.meshCache = {
      vertices: new Float32Array(vertices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices),
    };
    this.dirty = false;

    return this.meshCache;
  }

  /**
   * Helper for greedy meshing - get voxel by axis offset
   */
  private getVoxelByAxis(pos: number[], axis: number, offset: number): Voxel | null {
    const p = [...pos];
    p[axis] += offset;
    return this.getVoxel(p[0], p[1], p[2]);
  }

  /**
   * Get texture by ID
   */
  getTexture(id: string): ImageBitmap | undefined {
    return this.textures.get(id);
  }

  /**
   * Get all textures
   */
  getTextures(): Map<string, ImageBitmap> {
    return this.textures;
  }

  /**
   * Check if block has any solid voxels
   */
  isEmpty(): boolean {
    return !this.voxels.some(v => v?.solid);
  }

  /**
   * Get count of solid voxels
   */
  getSolidCount(): number {
    return this.voxels.filter(v => v?.solid).length;
  }

  /**
   * Serialize block to CBOR-compatible object
   */
  serialize(): Record<string, unknown> {
    return {
      position: this.position,
      hash: this.hash,
      prev: this.prev,
      lod: this.lod,
      voxels: this.voxels.map(v => v ? {
        solid: v.solid,
        materialId: v.materialId,
      } : null),
      childHashes: this.children.map(c => c.hash),
    };
  }

  /**
   * Create block from serialized data
   */
  static deserialize(data: Record<string, unknown>, parent: Block | null = null): Block {
    const pos = data.position as Vec4;
    const block = new Block(pos.x, pos.y, pos.z, pos.t, parent);
    block.prev = data.prev as string | null;
    block.lod = data.lod as number;

    const voxelData = data.voxels as Array<{ solid: boolean; materialId?: string } | null>;
    block.voxels = voxelData.map(v => v ? {
      solid: v.solid,
      materialId: v.materialId,
      faces: block.createFaces(v.materialId || ''),
    } : null);

    return block;
  }
}
