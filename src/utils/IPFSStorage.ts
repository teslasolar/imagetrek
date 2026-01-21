/**
 * IPFSStorage - Decentralized storage for voxel worlds
 * Handles serialization, pinning, and retrieval via IPFS
 */

import { Block } from '../core/Block';
import { World } from '../core/World';
import { Vec4 } from '../core/types';

interface IPFSNode {
  cid: string;
  data: Uint8Array;
  links: IPFSLink[];
}

interface IPFSLink {
  name: string;
  cid: string;
  size: number;
}

interface WorldDAG {
  version: number;
  root: string;
  blocks: Record<string, string>; // hash -> CID
  metadata: WorldMetadata;
}

interface WorldMetadata {
  name: string;
  description: string;
  created: number;
  modified: number;
  author?: string;
  blockCount: number;
  voxelCount: number;
}

type ProgressCallback = (progress: { loaded: number; total: number; stage: string }) => void;

export class IPFSStorage {
  private gateway: string;
  private localCache: Map<string, Uint8Array>;
  private pinned: Set<string>;

  constructor(gateway: string = 'https://ipfs.io/ipfs/') {
    this.gateway = gateway;
    this.localCache = new Map();
    this.pinned = new Set();
  }

  /**
   * Serialize and store world to IPFS
   */
  async storeWorld(
    world: World,
    metadata: Partial<WorldMetadata> = {},
    onProgress?: ProgressCallback
  ): Promise<string> {
    const octree = world.getOctree();
    const blockCIDs: Record<string, string> = {};
    let processed = 0;
    const total = octree.size;

    // Store each block
    for (const [hash, block] of octree) {
      const blockData = this.serializeBlock(block);
      const cid = await this.storeData(blockData);
      blockCIDs[hash] = cid;
      processed++;

      onProgress?.({
        loaded: processed,
        total,
        stage: 'Storing blocks',
      });
    }

    // Create world DAG
    const stats = world.getStats();
    const dag: WorldDAG = {
      version: 1,
      root: world.root?.hash || '',
      blocks: blockCIDs,
      metadata: {
        name: metadata.name || 'Untitled World',
        description: metadata.description || '',
        created: metadata.created || Date.now(),
        modified: Date.now(),
        author: metadata.author,
        blockCount: stats.blocks,
        voxelCount: stats.voxels,
      },
    };

    // Store DAG
    const dagData = this.encodeCBOR(dag);
    const worldCID = await this.storeData(dagData);

    // Pin world
    await this.pin(worldCID);

    onProgress?.({
      loaded: total,
      total,
      stage: 'Complete',
    });

    return worldCID;
  }

  /**
   * Load world from IPFS
   */
  async loadWorld(
    cid: string,
    onProgress?: ProgressCallback
  ): Promise<{ world: World; metadata: WorldMetadata }> {
    // Fetch world DAG
    onProgress?.({ loaded: 0, total: 1, stage: 'Loading manifest' });

    const dagData = await this.fetchData(cid);
    const dag = this.decodeCBOR(dagData) as WorldDAG;

    // Create world
    const world = new World();
    await world.init();

    // Load blocks
    const blockHashes = Object.keys(dag.blocks);
    let loaded = 0;

    for (const hash of blockHashes) {
      const blockCID = dag.blocks[hash];
      const blockData = await this.fetchData(blockCID);
      const blockObj = this.decodeCBOR(blockData) as Record<string, unknown>;
      const block = Block.deserialize(blockObj);

      // Add to world
      const pos = block.position;
      world.set(pos.x * 8, pos.y * 8, pos.z * 8, block);

      loaded++;
      onProgress?.({
        loaded,
        total: blockHashes.length,
        stage: 'Loading blocks',
      });
    }

    return { world, metadata: dag.metadata };
  }

  /**
   * Store individual block
   */
  async storeBlock(block: Block): Promise<string> {
    const data = this.serializeBlock(block);
    return this.storeData(data);
  }

  /**
   * Load individual block
   */
  async loadBlock(cid: string): Promise<Block> {
    const data = await this.fetchData(cid);
    const obj = this.decodeCBOR(data) as Record<string, unknown>;
    return Block.deserialize(obj);
  }

  /**
   * Serialize block to bytes
   */
  private serializeBlock(block: Block): Uint8Array {
    const obj = block.serialize();
    return this.encodeCBOR(obj);
  }

  /**
   * Store data and return CID
   */
  private async storeData(data: Uint8Array): Promise<string> {
    // Generate content-addressed hash (simplified)
    const hash = await this.hashData(data);
    const cid = `Qm${hash.slice(0, 44)}`;

    // Store in local cache
    this.localCache.set(cid, data);

    return cid;
  }

  /**
   * Fetch data from IPFS or cache
   */
  private async fetchData(cid: string): Promise<Uint8Array> {
    // Check local cache first
    if (this.localCache.has(cid)) {
      return this.localCache.get(cid)!;
    }

    // Fetch from gateway
    const response = await fetch(`${this.gateway}${cid}`);
    if (!response.ok) {
      throw new Error(`IPFS fetch failed: ${response.status}`);
    }

    const data = new Uint8Array(await response.arrayBuffer());

    // Cache locally
    this.localCache.set(cid, data);

    return data;
  }

  /**
   * Hash data to create content address
   */
  private async hashData(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Encode object to CBOR bytes
   */
  private encodeCBOR(obj: unknown): Uint8Array {
    // Simplified CBOR encoding (JSON fallback)
    const json = JSON.stringify(obj);
    const encoder = new TextEncoder();
    return encoder.encode(json);
  }

  /**
   * Decode CBOR bytes to object
   */
  private decodeCBOR(data: Uint8Array): unknown {
    // Simplified CBOR decoding (JSON fallback)
    const decoder = new TextDecoder();
    const json = decoder.decode(data);
    return JSON.parse(json);
  }

  /**
   * Pin CID to ensure persistence
   */
  async pin(cid: string): Promise<void> {
    this.pinned.add(cid);
    // In production, would pin to IPFS node
    console.log(`Pinned: ${cid}`);
  }

  /**
   * Unpin CID
   */
  async unpin(cid: string): Promise<void> {
    this.pinned.delete(cid);
    console.log(`Unpinned: ${cid}`);
  }

  /**
   * Check if CID is pinned
   */
  isPinned(cid: string): boolean {
    return this.pinned.has(cid);
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    let size = 0;
    for (const data of this.localCache.values()) {
      size += data.length;
    }
    return size;
  }

  /**
   * Clear local cache
   */
  clearCache(): void {
    this.localCache.clear();
  }

  /**
   * Export world as downloadable file
   */
  async exportWorld(world: World, filename: string = 'world.voxgen'): Promise<void> {
    const cid = await this.storeWorld(world);
    const data = this.localCache.get(cid);

    if (!data) {
      throw new Error('World data not found in cache');
    }

    // Create download link
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import world from file
   */
  async importWorld(file: File): Promise<{ world: World; metadata: WorldMetadata }> {
    const data = new Uint8Array(await file.arrayBuffer());
    const cid = await this.storeData(data);
    return this.loadWorld(cid);
  }
}

/**
 * CollabSync - Real-time collaboration via WebSocket
 */
export class CollabSync {
  private ws: WebSocket | null = null;
  private roomId: string;
  private peerId: string;
  private handlers: Map<string, Set<(data: unknown) => void>>;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.peerId = this.generatePeerId();
    this.handlers = new Map();
  }

  /**
   * Connect to collaboration server
   */
  async connect(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${serverUrl}/collab/${this.roomId}`);

      this.ws.onopen = () => {
        this.send('join', { peerId: this.peerId });
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.emit(message.type, message.data);
      };

      this.ws.onclose = () => {
        this.emit('disconnect', { peerId: this.peerId });
      };
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send message to room
   */
  send(type: string, data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type,
        data,
        peerId: this.peerId,
        timestamp: Date.now(),
      }));
    }
  }

  /**
   * Broadcast block update
   */
  broadcastBlockUpdate(block: Block): void {
    this.send('blockUpdate', block.serialize());
  }

  /**
   * Broadcast generation request
   */
  broadcastGeneration(prompt: string, position: Vec4): void {
    this.send('generate', { prompt, position });
  }

  /**
   * Subscribe to events
   */
  on(event: string, handler: (data: unknown) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from events
   */
  off(event: string, handler: (data: unknown) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach(handler => handler(data));
  }

  private generatePeerId(): string {
    return `peer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get peer ID
   */
  getPeerId(): string {
    return this.peerId;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
