# VOXGEN

WebGPU-based infinite voxel world generator with diffusion model cascades. Runs entirely in the browser with no server required.

## Features

- **WebGPU Rendering**: Ray marching and mesh-based voxel rendering
- **Diffusion Model Cascade**: SD1.5 → SDXL → Flux progressive generation
- **Infinite Worlds**: Octree-based spatial structure with LOD
- **Greedy Meshing**: Optimized voxel geometry generation
- **P2P Sync**: IPFS storage and WebSocket collaboration
- **Zero Server**: Complete browser-native implementation

## Quick Start

```typescript
import { createWorld } from 'voxgen';

const canvas = document.getElementById('canvas');
const { world, renderer } = await createWorld(canvas);

world.generate('crystal cave with glowing gems', { x: 0, y: 0, z: 0 });
renderer.start();
```

## Architecture

```
VOXGEN
├── Gen        - Generation entity (seed, steps, cfg, model)
├── Block      - 8³ voxel block with octree structure
├── World      - World manager with generation queue
├── Renderer   - WebGPU ray marching renderer
└── Pipeline   - Diffusion model cascade
```

## Model Cascade

```
L0: SD1.5 (txt2img, 512px)     → Base generation
L1: SDXL  (img2img, strength=0.7) → Enhancement
L2: Flux  (refine, strength=0.3)  → Detail
```

## Development

```bash
npm install
npm run dev
```

## Requirements

- WebGPU-compatible browser (Chrome 113+, Edge 113+)
- GPU with 4GB+ VRAM (8GB+ recommended for full cascade)

## License

MIT
