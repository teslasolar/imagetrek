/**
 * VOXGEN Main Entry Point
 * WebGPU-based infinite voxel world generator with diffusion model cascades
 */

import { World } from './core/World';
import { Renderer } from './render/Renderer';
import { DiffusionPipeline } from './models/DiffusionPipeline';
import { Vec3 } from './core/types';

interface VoxGenApp {
  world: World;
  renderer: Renderer;
  pipeline: DiffusionPipeline;
  canvas: HTMLCanvasElement;
  isRunning: boolean;
}

// Global app state
let app: VoxGenApp | null = null;

/**
 * Initialize VOXGEN application
 */
async function init(): Promise<VoxGenApp> {
  // Create canvas
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  // Set canvas size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Create world
  const world = new World({
    chunkSize: 8,
    voxelSize: 1.0,
    renderDistance: 128,
    maxLod: 4,
  });

  // Initialize WebGPU
  const gpuInitialized = await world.init();
  if (!gpuInitialized) {
    throw new Error('WebGPU initialization failed');
  }

  // Create renderer
  const renderer = new Renderer(canvas, world);
  const rendererInitialized = await renderer.init();
  if (!rendererInitialized) {
    throw new Error('Renderer initialization failed');
  }

  // Create diffusion pipeline
  const pipeline = new DiffusionPipeline();
  const device = world.getDevice();
  if (device) {
    await pipeline.init(device);
  }

  // Set up event listeners
  setupEventListeners(canvas, renderer, world);

  // Set up world events
  world.on('taskComplete', (data) => {
    console.log('Generation complete:', data);
    updateStats(world);
  });

  world.on('cascadeStep', (data) => {
    const { model, step, total } = data as { model: string; step: number; total: number };
    updateStatus(`Cascade: ${model} (${step}/${total})`);
  });

  return {
    world,
    renderer,
    pipeline,
    canvas,
    isRunning: false,
  };
}

/**
 * Set up input event listeners
 */
function setupEventListeners(
  canvas: HTMLCanvasElement,
  renderer: Renderer,
  world: World
): void {
  // Camera controls
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let cameraDistance = 30;
  let cameraAngleX = 0;
  let cameraAngleY = 0.3;

  const updateCamera = () => {
    const x = Math.sin(cameraAngleX) * Math.cos(cameraAngleY) * cameraDistance;
    const y = Math.sin(cameraAngleY) * cameraDistance;
    const z = Math.cos(cameraAngleX) * Math.cos(cameraAngleY) * cameraDistance;

    renderer.setCamera(
      { x, y, z },
      { x: 0, y: 0, z: 0 }
    );
  };

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    cameraAngleX += dx * 0.01;
    cameraAngleY = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraAngleY + dy * 0.01));

    updateCamera();

    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('wheel', (e) => {
    cameraDistance = Math.max(5, Math.min(200, cameraDistance + e.deltaY * 0.1));
    updateCamera();
  });

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      // Generate at cursor position
      const prompt = (document.getElementById('prompt') as HTMLInputElement)?.value || 'crystal cave';
      world.generate(prompt, { x: 0, y: 0, z: 0 }, ['sd15', 'sdxl']);
    }
  });

  // Window resize
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.resize(canvas.width, canvas.height);
  });

  // Initialize camera
  updateCamera();
}

/**
 * Update status display
 */
function updateStatus(message: string): void {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
  }
}

/**
 * Update stats display
 */
function updateStats(world: World): void {
  const stats = world.getStats();
  const statsEl = document.getElementById('stats');
  if (statsEl) {
    statsEl.innerHTML = `
      Blocks: ${stats.blocks}<br>
      Voxels: ${stats.voxels}<br>
      Queue: ${stats.queueLength}
    `;
  }
}

/**
 * Generate voxels from prompt
 */
async function generate(prompt: string, position: Vec3): Promise<void> {
  if (!app) return;

  updateStatus('Generating...');
  app.world.generate(prompt, position, ['sd15', 'sdxl']);
}

/**
 * Start render loop
 */
function start(): void {
  if (!app || app.isRunning) return;

  app.isRunning = true;
  app.renderer.start();
  updateStatus('Running');
}

/**
 * Stop render loop
 */
function stop(): void {
  if (!app || !app.isRunning) return;

  app.isRunning = false;
  app.renderer.stop();
  updateStatus('Stopped');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Show loading
    updateStatus('Initializing WebGPU...');

    // Initialize app
    app = await init();

    // Generate initial content
    updateStatus('Generating initial world...');

    // Generate a few sample blocks
    app.world.generate('crystal cave with glowing gems', { x: 0, y: 0, z: 0 }, ['sd15']);
    app.world.generate('ancient stone temple', { x: 8, y: 0, z: 0 }, ['sd15']);
    app.world.generate('mystical forest floor', { x: 0, y: 0, z: 8 }, ['sd15']);

    // Start rendering
    start();

    // Start evolution loop
    setInterval(() => {
      if (app) {
        app.world.evolve();
        updateStats(app.world);
      }
    }, 5000);

    updateStatus('Ready - Click and drag to rotate, scroll to zoom');

  } catch (error) {
    console.error('Initialization failed:', error);
    updateStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Expose API to window
declare global {
  interface Window {
    voxgen: {
      generate: typeof generate;
      start: typeof start;
      stop: typeof stop;
      getWorld: () => World | null;
      getRenderer: () => Renderer | null;
    };
  }
}

window.voxgen = {
  generate,
  start,
  stop,
  getWorld: () => app?.world ?? null,
  getRenderer: () => app?.renderer ?? null,
};

// Start on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
