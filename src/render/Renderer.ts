/**
 * WebGPU Renderer for Voxel World
 * Ray marching and mesh-based rendering
 */

import { World } from '../core/World';
import { Block } from '../core/Block';
import { Vec3, MeshGeometry } from '../core/types';
import { rayMarchShader, meshShader, compositeShader } from './shaders';

interface Camera {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  fov: number;
  near: number;
  far: number;
}

interface RenderState {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  depthTexture: GPUTexture;

  rayMarchPipeline: GPURenderPipeline;
  meshPipeline: GPURenderPipeline;
  compositePipeline: GPURenderPipeline;

  uniformBuffer: GPUBuffer;
  voxelBuffer: GPUBuffer;
  voxelCountBuffer: GPUBuffer;
  uniformBindGroup: GPUBindGroup;

  sampler: GPUSampler;
  defaultTexture: GPUTexture;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private world: World;
  private camera: Camera;
  private state: RenderState | null = null;
  private animationId: number = 0;
  private startTime: number = 0;

  constructor(canvas: HTMLCanvasElement, world: World) {
    this.canvas = canvas;
    this.world = world;

    this.camera = {
      position: { x: 0, y: 10, z: 30 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      fov: 60,
      near: 0.1,
      far: 1000,
    };

    this.startTime = performance.now();
  }

  /**
   * Initialize WebGPU renderer
   */
  async init(): Promise<boolean> {
    const device = this.world.getDevice();
    if (!device) {
      console.error('WebGPU device not available');
      return false;
    }

    const context = this.canvas.getContext('webgpu');
    if (!context) {
      console.error('WebGPU context not available');
      return false;
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });

    // Create depth texture
    const depthTexture = device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Create uniform buffer
    const uniformBuffer = device.createBuffer({
      size: 256, // Aligned size for uniforms
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create voxel count buffer (separate for bind group compatibility)
    const voxelCountBuffer = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create voxel storage buffer
    const voxelBuffer = device.createBuffer({
      size: 1024 * 1024, // 1MB for voxel data
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Create sampler
    const sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });

    // Create default texture
    const defaultTexture = device.createTexture({
      size: [1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture(
      { texture: defaultTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      [1, 1]
    );

    // Create ray march pipeline
    const rayMarchModule = device.createShaderModule({ code: rayMarchShader });
    const rayMarchPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: rayMarchModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: rayMarchModule,
        entryPoint: 'fragmentMain',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    // Create bind group for ray march
    const uniformBindGroup = device.createBindGroup({
      layout: rayMarchPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: voxelBuffer } },
        { binding: 2, resource: { buffer: voxelCountBuffer } },
      ],
    });

    // Create mesh pipeline
    const meshModule = device.createShaderModule({ code: meshShader });
    const meshPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: meshModule,
        entryPoint: 'vertexMain',
        buffers: [
          {
            arrayStride: 32,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
              { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
              { shaderLocation: 2, offset: 24, format: 'float32x2' }, // uv
            ],
          },
        ],
      },
      fragment: {
        module: meshModule,
        entryPoint: 'fragmentMain',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });

    // Create composite pipeline
    const compositeModule = device.createShaderModule({ code: compositeShader });
    const compositePipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: compositeModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: compositeModule,
        entryPoint: 'fragmentMain',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    this.state = {
      device,
      context,
      format,
      depthTexture,
      rayMarchPipeline,
      meshPipeline,
      compositePipeline,
      uniformBuffer,
      voxelBuffer,
      voxelCountBuffer,
      uniformBindGroup,
      sampler,
      defaultTexture,
    };

    return true;
  }

  /**
   * Update uniforms
   */
  private updateUniforms(): void {
    if (!this.state) return;

    const { device, uniformBuffer } = this.state;
    const time = (performance.now() - this.startTime) / 1000;

    // Calculate view-projection matrix
    const viewMatrix = this.lookAt(
      this.camera.position,
      this.camera.target,
      this.camera.up
    );

    const projMatrix = this.perspective(
      this.camera.fov * Math.PI / 180,
      this.canvas.width / this.canvas.height,
      this.camera.near,
      this.camera.far
    );

    const viewProj = this.multiplyMatrices(projMatrix, viewMatrix);

    // Write uniforms
    const uniformData = new Float32Array(48);
    uniformData.set(viewProj, 0);
    uniformData[32] = this.camera.position.x;
    uniformData[33] = this.camera.position.y;
    uniformData[34] = this.camera.position.z;
    uniformData[35] = time;
    uniformData[36] = this.canvas.width;
    uniformData[37] = this.canvas.height;

    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  }

  /**
   * Update voxel data buffer
   */
  private updateVoxels(): void {
    if (!this.state) return;

    const { device, voxelBuffer } = this.state;
    const blocks = this.world.getVisibleBlocks(this.camera.position);

    // Pack voxel data
    const voxelData: number[] = [];
    let voxelCount = 0;

    for (const block of blocks) {
      for (let z = 0; z < 8; z++) {
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const voxel = block.getVoxel(x, y, z);
            if (voxel?.solid) {
              // World position
              const worldX = block.position.x * 8 + x;
              const worldY = block.position.y * 8 + y;
              const worldZ = block.position.z * 8 + z;

              voxelData.push(
                worldX, worldY, worldZ, 0, // position + padding
                0.5 + Math.random() * 0.5, // R
                0.5 + Math.random() * 0.5, // G
                0.5 + Math.random() * 0.5, // B
                1.0 // A
              );
              voxelCount++;

              if (voxelCount >= 16384) break;
            }
          }
          if (voxelCount >= 16384) break;
        }
        if (voxelCount >= 16384) break;
      }
      if (voxelCount >= 16384) break;
    }

    if (voxelData.length > 0) {
      const data = new Float32Array(voxelData);
      device.queue.writeBuffer(voxelBuffer, 0, data);
    }

    // Write voxel count
    const countData = new Uint32Array([voxelCount]);
    device.queue.writeBuffer(this.state.voxelCountBuffer, 0, countData);
  }

  /**
   * Render frame
   */
  render(): void {
    if (!this.state) return;

    const { device, context, rayMarchPipeline, uniformBindGroup, depthTexture } = this.state;

    this.updateUniforms();
    this.updateVoxels();

    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    // Ray march pass (no depth needed for fullscreen quad)
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    renderPass.setPipeline(rayMarchPipeline);
    renderPass.setBindGroup(0, uniformBindGroup);
    renderPass.draw(3);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Start render loop
   */
  start(): void {
    const loop = () => {
      this.render();
      this.animationId = requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * Stop render loop
   */
  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
  }

  /**
   * Set camera position
   */
  setCamera(position: Vec3, target?: Vec3): void {
    this.camera.position = position;
    if (target) {
      this.camera.target = target;
    }
  }

  /**
   * Get current camera
   */
  getCamera(): Camera {
    return { ...this.camera };
  }

  /**
   * Handle canvas resize
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;

    if (this.state) {
      // Recreate depth texture
      this.state.depthTexture.destroy();
      this.state.depthTexture = this.state.device.createTexture({
        size: [width, height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
  }

  // Matrix math helpers
  private lookAt(eye: Vec3, target: Vec3, up: Vec3): Float32Array {
    const zAxis = this.normalize({
      x: eye.x - target.x,
      y: eye.y - target.y,
      z: eye.z - target.z,
    });
    const xAxis = this.normalize(this.cross(up, zAxis));
    const yAxis = this.cross(zAxis, xAxis);

    return new Float32Array([
      xAxis.x, yAxis.x, zAxis.x, 0,
      xAxis.y, yAxis.y, zAxis.y, 0,
      xAxis.z, yAxis.z, zAxis.z, 0,
      -this.dot(xAxis, eye), -this.dot(yAxis, eye), -this.dot(zAxis, eye), 1,
    ]);
  }

  private perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);

    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  }

  private multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] =
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }
    return result;
  }

  private normalize(v: Vec3): Vec3 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  private cross(a: Vec3, b: Vec3): Vec3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  private dot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }
}
