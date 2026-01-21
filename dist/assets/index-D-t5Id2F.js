(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))n(o);new MutationObserver(o=>{for(const s of o)if(s.type==="childList")for(const i of s.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&n(i)}).observe(document,{childList:!0,subtree:!0});function e(o){const s={};return o.integrity&&(s.integrity=o.integrity),o.referrerPolicy&&(s.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?s.credentials="include":o.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(o){if(o.ep)return;o.ep=!0;const s=e(o);fetch(o.href,s)}})();const p=8,L=p*p*p;class C{position;hash;prev;parent;children;lod;voxels;textures;dirty;meshCache;constructor(t,e,n,o=0,s=null){this.position={x:t,y:e,z:n,t:o},this.hash=C.computeHash(t,e,n,o),this.prev=null,this.parent=s,this.children=[],this.lod=s?s.lod+1:0,this.voxels=new Array(L).fill(null),this.textures=new Map,this.dirty=!0,this.meshCache=null}static computeHash(t,e,n,o){let s=0;const i=[t,e,n,o];for(const r of i)s=(s<<5)-s+r|0;return Math.abs(s).toString(16).padStart(8,"0")}coordToIndex(t,e,n){return t<0||t>=p||e<0||e>=p||n<0||n>=p?-1:t+e*p+n*p*p}indexToCoord(t){return{x:t%p,y:Math.floor(t/p)%p,z:Math.floor(t/(p*p))}}place(t,e,n,o){const s=this.coordToIndex(e,n,o);if(s<0)return!1;const i=t.getImage();i&&this.textures.set(t.id,i);const r={faces:this.createFaces(t.id),solid:!0,materialId:t.id};return this.voxels[s]=r,this.dirty=!0,this.meshCache=null,!0}createFaces(t){return[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:-1,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}].map(n=>({textureId:t,ao:0,normal:n}))}getVoxel(t,e,n){const o=this.coordToIndex(t,e,n);return o<0?null:this.voxels[o]}setVoxel(t,e,n,o){const s=this.coordToIndex(t,e,n);s<0||(this.voxels[s]=o,this.dirty=!0,this.meshCache=null)}subdivide(){if(this.children.length>0)return this.children;const t=p/2,{x:e,y:n,z:o,t:s}=this.position;for(let i=0;i<2;i++)for(let r=0;r<2;r++)for(let a=0;a<2;a++){const d=e*2+a*t,l=n*2+r*t,c=o*2+i*t,h=new C(d,l,c,s,this);this.children.push(h)}return this.children}raycast(t,e){const n=Math.sqrt(e.x**2+e.y**2+e.z**2),o={x:e.x/n,y:e.y/n,z:e.z/n},s={x:t.x-this.position.x*p,y:t.y-this.position.y*p,z:t.z-this.position.z*p};let i=Math.floor(s.x),r=Math.floor(s.y),a=Math.floor(s.z);const d=o.x>=0?1:-1,l=o.y>=0?1:-1,c=o.z>=0?1:-1,h=Math.abs(1/o.x),u=Math.abs(1/o.y),x=Math.abs(1/o.z);let f=o.x!==0?(o.x>0?i+1-s.x:s.x-i)*h:1/0,v=o.y!==0?(o.y>0?r+1-s.y:s.y-r)*u:1/0,w=o.z!==0?(o.z>0?a+1-s.z:s.z-a)*x:1/0;const M=p*3;let z={x:0,y:0,z:0};for(let g=0;g<M;g++){if(i>=0&&i<p&&r>=0&&r<p&&a>=0&&a<p){const b=this.voxels[this.coordToIndex(i,r,a)];if(b?.solid){const S=Math.min(f,v,w);return{position:{x:s.x+o.x*S,y:s.y+o.y*S,z:s.z+o.z*S},normal:z,textureId:b.materialId||"",distance:S,voxelIndex:this.coordToIndex(i,r,a)}}}if(f<v?f<w?(i+=d,f+=h,z={x:-d,y:0,z:0}):(a+=c,w+=x,z={x:0,y:0,z:-c}):v<w?(r+=l,v+=u,z={x:0,y:-l,z:0}):(a+=c,w+=x,z={x:0,y:0,z:-c}),i<0||i>=p||r<0||r>=p||a<0||a>=p)break}return null}mesh(){if(this.meshCache&&!this.dirty)return this.meshCache;const t=[],e=[],n=[],o=[];for(let s=0;s<3;s++){const i=(s+1)%3,r=(s+2)%3,a=[p,p,p],d=new Array(a[i]*a[r]).fill(null);for(let l=0;l<=a[s];l++){for(let c=0;c<a[r];c++)for(let h=0;h<a[i];h++){const u=[0,0,0];u[s]=l,u[i]=h,u[r]=c;const x=h+c*a[i],f=l>0?this.getVoxelByAxis(u,s,-1):null,v=l<a[s]?this.getVoxelByAxis(u,s,0):null;f?.solid!==v?.solid?d[x]=f?.solid?f:v:d[x]=null}for(let c=0;c<a[r];c++)for(let h=0;h<a[i];){const u=h+c*a[i];if(!d[u]){h++;continue}const x=d[u];let f=1;for(;h+f<a[i]&&d[h+f+c*a[i]]===x;)f++;let v=1,w=!1;for(;c+v<a[r]&&!w;){for(let g=0;g<f;g++)if(d[h+g+(c+v)*a[i]]!==x){w=!0;break}w||v++}const M=t.length/3,z=[0,0,0];z[s]=l,z[i]=h,z[r]=c;for(let g=0;g<4;g++){const b=[...z];(g===1||g===2)&&(b[i]+=f),(g===2||g===3)&&(b[r]+=v),t.push(b[0],b[1],b[2]);const S=[0,0,0];S[s]=x===d[u]?1:-1,e.push(S[0],S[1],S[2]),n.push(g===1||g===2?f:0,g===2||g===3?v:0)}o.push(M,M+1,M+2,M,M+2,M+3);for(let g=0;g<v;g++)for(let b=0;b<f;b++)d[h+b+(c+g)*a[i]]=null;h+=f}}}return this.meshCache={vertices:new Float32Array(t),normals:new Float32Array(e),uvs:new Float32Array(n),indices:new Uint32Array(o)},this.dirty=!1,this.meshCache}getVoxelByAxis(t,e,n){const o=[...t];return o[e]+=n,this.getVoxel(o[0],o[1],o[2])}getTexture(t){return this.textures.get(t)}getTextures(){return this.textures}isEmpty(){return!this.voxels.some(t=>t?.solid)}getSolidCount(){return this.voxels.filter(t=>t?.solid).length}serialize(){return{position:this.position,hash:this.hash,prev:this.prev,lod:this.lod,voxels:this.voxels.map(t=>t?{solid:t.solid,materialId:t.materialId}:null),childHashes:this.children.map(t=>t.hash)}}static deserialize(t,e=null){const n=t.position,o=new C(n.x,n.y,n.z,n.t,e);o.prev=t.prev,o.lod=t.lod;const s=t.voxels;return o.voxels=s.map(i=>i?{solid:i.solid,materialId:i.materialId,faces:o.createFaces(i.materialId||"")}:null),o}}const k={sd15:{size:512,speed:"fast",vram:"4gb"},sdxl:{size:1024,quality:"high",vram:"8gb"},flux:{size:1024,photorealistic:!0,vram:"12gb"},cascade:{size:1024,quality:"high",vram:"10gb"}},T=[{model:"sd15",strength:1,steps:15},{model:"sdxl",strength:.7,steps:20},{model:"flux",strength:.3,steps:10}],B={chunkSize:8,voxelSize:1,renderDistance:256,maxLod:5};class I{seed;id;steps;cfg;denoise;model;loras;negativePrompt;latent=null;noise=null;prediction=null;image=null;clipScore=0;constructor(t){this.seed=t.seed??I.randomSeed(),this.id=I.hashSeed(this.seed),this.steps=t.steps??20,this.cfg=t.cfg??7.5,this.denoise=t.denoise??1,this.model=t.model??"sd15",this.loras=t.loras??[],this.negativePrompt=t.negativePrompt??""}static randomSeed(){return Math.floor(Math.random()*4294967295)}static hashSeed(t){let e=t;return e=(e>>16^e)*73244475,e=(e>>16^e)*73244475,e=e>>16^e,e.toString(16).padStart(8,"0")}decode(){if(!this.latent||!this.noise||!this.prediction)throw new Error("No generation data available");return{latent:this.latent,noise:this.noise,prediction:this.prediction}}async diffuse(t,e,n){this.latent||this.initializeLatent();const o=await n(this.latent,t,e);this.prediction=o;const s=this.calculateSigma(t);if(this.latent&&this.noise)for(let i=0;i<this.latent.data.length;i++)this.latent.data[i]-=this.noise[i]*s;return o}initializeLatent(){const e=k[this.model].size/8,n=4,o=[1,n,e,e],s=n*e*e,i=new Float32Array(s),r=new Float32Array(s);let a=this.seed;const d=()=>(a=a*1103515245+12345&2147483647,a/2147483647*2-1);for(let l=0;l<s;l+=2){const c=(d()+1)/2,h=(d()+1)/2,u=Math.sqrt(-2*Math.log(Math.max(c,1e-10))),x=2*Math.PI*h;i[l]=u*Math.cos(x),r[l]=i[l],l+1<s&&(i[l+1]=u*Math.sin(x),r[l+1]=i[l+1])}this.latent={data:i,shape:o},this.noise=r}calculateSigma(t){const o=85e-5+.01115*t;return Math.sqrt(o)}async upscale(t){if(!this.image)throw new Error("No image to upscale");return this.image=await t(this.image),this.image}merge(t,e=.5){if(!this.latent||!t.latent)throw new Error("Both generations must have latent data");for(let n=0;n<this.latent.data.length;n++)this.latent.data[n]=this.latent.data[n]*(1-e)+t.latent.data[n]*e}valid(){return this.steps>=20&&this.clipScore>.23}setImage(t){this.image=t}getImage(){return this.image}setClipScore(t){this.clipScore=t}getClipScore(){return this.clipScore}getLatent(){return this.latent}setLatent(t){this.latent=t}clone(){const t=new I({seed:this.seed,steps:this.steps,cfg:this.cfg,denoise:this.denoise,model:this.model,loras:[...this.loras],negativePrompt:this.negativePrompt});return this.latent&&t.setLatent({data:new Float32Array(this.latent.data),shape:[...this.latent.shape]}),t}toJSON(){return{seed:this.seed,id:this.id,steps:this.steps,cfg:this.cfg,denoise:this.denoise,model:this.model,loras:this.loras,negativePrompt:this.negativePrompt,clipScore:this.clipScore}}static fromJSON(t){const e=new I({seed:t.seed,steps:t.steps,cfg:t.cfg,denoise:t.denoise,model:t.model,loras:t.loras,negativePrompt:t.negativePrompt});return t.clipScore&&e.setClipScore(t.clipScore),e}}class O{root;config;octree;models;queue;workers;device;adapter;processing;eventListeners;constructor(t={}){this.config={...B,...t},this.root=new C(0,0,0,0),this.octree=new Map,this.octree.set(this.root.hash,this.root),this.models=new Map,this.queue=[],this.workers=typeof navigator<"u"&&navigator.hardwareConcurrency||4,this.device=null,this.adapter=null,this.processing=!1,this.eventListeners=new Map}async init(){if(!navigator.gpu)return console.error("WebGPU not supported"),!1;try{return this.adapter=await navigator.gpu.requestAdapter({powerPreference:"high-performance"}),this.adapter?(this.device=await this.adapter.requestDevice({requiredFeatures:[],requiredLimits:{maxStorageBufferBindingSize:1024*1024*1024,maxBufferSize:1024*1024*1024}}),await this.loadModels(),this.emit("init",{success:!0}),!0):(console.error("No GPU adapter found"),!1)}catch(t){return console.error("WebGPU initialization failed:",t),!1}}async loadModels(){const t=[["sd15",4],["sdxl",8],["flux",12]];for(const[e,n]of t)this.models.set(e,{name:e,loaded:!1,vram:n});this.emit("modelsReady",{models:Array.from(this.models.keys())})}get(t,e,n){const o=Math.floor(t/this.config.chunkSize),s=Math.floor(e/this.config.chunkSize),i=Math.floor(n/this.config.chunkSize),r=C.computeHash(o,s,i,0);return this.octree.get(r)||null}set(t,e,n,o){const s=Math.floor(t/this.config.chunkSize),i=Math.floor(e/this.config.chunkSize),r=Math.floor(n/this.config.chunkSize),a=o||new C(s,i,r,0);return this.octree.set(a.hash,a),a}generate(t,e,n=["sd15","sdxl"]){const o=`task-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,s={id:o,prompt:t,position:e,cascade:n,priority:0,status:"pending"};return this.queue.push(s),this.processQueue(),o}async processQueue(){if(!(this.processing||this.queue.length===0)){for(this.processing=!0;this.queue.length>0;){const t=this.queue.shift();t.status="processing",this.emit("taskStart",{taskId:t.id});try{const e=await this.executeCascade(t.prompt,t.cascade);t.result=e,t.status="complete";const n=this.set(t.position.x,t.position.y,t.position.z),o=new I({prompt:t.prompt});o.setImage(e);const s=t.position.x%this.config.chunkSize,i=t.position.y%this.config.chunkSize,r=t.position.z%this.config.chunkSize;n.place(o,s,i,r),this.emit("taskComplete",{taskId:t.id,result:e})}catch(e){t.status="failed",this.emit("taskFailed",{taskId:t.id,error:e})}}this.processing=!1}}async cascade(t){return this.executeCascade(t,["sd15","sdxl","flux"])}async executeCascade(t,e){let n=null,o=null;for(let s=0;s<e.length;s++){const i=e[s],r=T.find(c=>c.model===i),a=r?.strength??1,d=r?.steps??20,l=new I({prompt:t,model:i,steps:d,denoise:s===0?1:a});if(n&&o){const c=await this.imageToLatent(o,i);l.setLatent(c)}o=await this.runDiffusion(l,t),l.setImage(o),n=l,this.emit("cascadeStep",{model:i,step:s+1,total:e.length})}if(!o)throw new Error("Cascade generation failed");return o}async runDiffusion(t,e){const n=new OffscreenCanvas(512,512),o=n.getContext("2d");let i=t.seed;const r=()=>(i=i*1103515245+12345&2147483647,i/2147483647),a=o.createImageData(512,512);for(let d=0;d<512;d++)for(let l=0;l<512;l++){const c=(d*512+l)*4,h=r(),u=(l+d)/1024;a.data[c]=Math.floor((h*.3+u*.7)*255),a.data[c+1]=Math.floor((h*.4+(1-u)*.6)*200),a.data[c+2]=Math.floor((h*.5+u*.5)*255),a.data[c+3]=255}o.putImageData(a,0,0),o.fillStyle=`hsl(${this.hashString(e)%360}, 50%, 30%)`,o.globalAlpha=.3;for(let d=0;d<5;d++){const l=r()*512,c=r()*512,h=r()*100+50;o.beginPath(),o.arc(l,c,h,0,Math.PI*2),o.fill()}return n.transferToImageBitmap()}async imageToLatent(t,e){const s=new Float32Array(16384),r=new OffscreenCanvas(t.width,t.height).getContext("2d");r.drawImage(t,0,0);const a=r.getImageData(0,0,t.width,t.height),d=t.width/64,l=t.height/64;for(let c=0;c<64;c++)for(let h=0;h<64;h++){const u=Math.floor(h*d),f=(Math.floor(c*l)*t.width+u)*4,v=a.data[f]/255,w=a.data[f+1]/255,M=a.data[f+2]/255,z=c*64+h;s[z]=(v-.5)*2,s[z+64*64]=(w-.5)*2,s[z+64*64*2]=(M-.5)*2,s[z+64*64*3]=((v+w+M)/3-.5)*2}return{data:s,shape:[1,4,64,64]}}hashString(t){let e=0;for(let n=0;n<t.length;n++)e=(e<<5)-e+t.charCodeAt(n)|0;return Math.abs(e)}interlace(t,e,n,o=[.4,.4,.2]){const s=t.clone(),i=t.getLatent(),r=e.getLatent(),a=n.getLatent();if(!i||!r||!a)throw new Error("All generations must have latent data");const d=new Float32Array(i.data.length);for(let l=0;l<d.length;l++)d[l]=i.data[l]*o[0]+r.data[l]*o[1]+a.data[l]*o[2];return s.setLatent({data:d,shape:i.shape}),s}evolve(){const t=Array.from(this.octree.values());for(const e of t){if(e.isEmpty())continue;const n=this.evaluateBlock(e);n<.3?this.emit("evolve",{hash:e.hash,action:"mutate",score:n}):n>.7&&this.emit("evolve",{hash:e.hash,action:"propagate",score:n})}}evaluateBlock(t){return this.hashString(t.hash)%100/100}getVisibleBlocks(t){const e=[],n=this.config.renderDistance/this.config.chunkSize;for(const o of this.octree.values()){const s=o.position.x-t.x/this.config.chunkSize,i=o.position.y-t.y/this.config.chunkSize,r=o.position.z-t.z/this.config.chunkSize;Math.sqrt(s*s+i*i+r*r)<=n&&e.push(o)}return e}getDevice(){return this.device}getOctree(){return this.octree}on(t,e){this.eventListeners.has(t)||this.eventListeners.set(t,new Set),this.eventListeners.get(t).add(e)}off(t,e){this.eventListeners.get(t)?.delete(e)}emit(t,e){this.eventListeners.get(t)?.forEach(n=>n(e))}serialize(){const t=[];for(const e of this.octree.values())t.push(e.serialize());return{config:this.config,rootHash:this.root.hash,blocks:t}}getStats(){let t=0,e=this.octree.size;for(const n of this.octree.values())t+=n.getSolidCount();return{blocks:e,voxels:t,queueLength:this.queue.length,workers:this.workers}}}const V=`
struct Uniforms {
  viewProjection: mat4x4<f32>,
  cameraPosition: vec3<f32>,
  time: f32,
  resolution: vec2<f32>,
  padding: vec2<f32>,
}

struct Voxel {
  position: vec3<f32>,
  textureId: u32,
  color: vec4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> voxels: array<Voxel>;
@group(0) @binding(2) var<uniform> voxelCount: u32;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) rayDir: vec3<f32>,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // Fullscreen triangle
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );

  var output: VertexOutput;
  let pos = positions[vertexIndex];
  output.position = vec4<f32>(pos, 0.0, 1.0);

  // Calculate ray direction
  let aspect = uniforms.resolution.x / uniforms.resolution.y;
  output.rayDir = normalize(vec3<f32>(pos.x * aspect, pos.y, -1.0));

  return output;
}

fn intersectAABB(origin: vec3<f32>, dir: vec3<f32>, boxMin: vec3<f32>, boxMax: vec3<f32>) -> vec2<f32> {
  let invDir = 1.0 / dir;
  let t1 = (boxMin - origin) * invDir;
  let t2 = (boxMax - origin) * invDir;

  let tmin = min(t1, t2);
  let tmax = max(t1, t2);

  let tNear = max(max(tmin.x, tmin.y), tmin.z);
  let tFar = min(min(tmax.x, tmax.y), tmax.z);

  return vec2<f32>(tNear, tFar);
}

fn sampleVoxel(pos: vec3<f32>) -> vec4<f32> {
  let voxelPos = floor(pos);

  for (var i = 0u; i < voxelCount; i = i + 1u) {
    let v = voxels[i];
    if (all(abs(v.position - voxelPos) < vec3<f32>(0.5))) {
      return v.color;
    }
  }

  return vec4<f32>(0.0);
}

fn getNormal(p: vec3<f32>) -> vec3<f32> {
  let eps = 0.001;
  return normalize(vec3<f32>(
    sampleVoxel(p + vec3<f32>(eps, 0.0, 0.0)).a - sampleVoxel(p - vec3<f32>(eps, 0.0, 0.0)).a,
    sampleVoxel(p + vec3<f32>(0.0, eps, 0.0)).a - sampleVoxel(p - vec3<f32>(0.0, eps, 0.0)).a,
    sampleVoxel(p + vec3<f32>(0.0, 0.0, eps)).a - sampleVoxel(p - vec3<f32>(0.0, 0.0, eps)).a
  ));
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let rayOrigin = uniforms.cameraPosition;
  let rayDir = normalize(input.rayDir);

  // Ray march through voxel space
  var color = vec4<f32>(0.1, 0.1, 0.15, 1.0); // Background

  let worldMin = vec3<f32>(-64.0);
  let worldMax = vec3<f32>(64.0);
  let bounds = intersectAABB(rayOrigin, rayDir, worldMin, worldMax);

  if (bounds.x < bounds.y && bounds.y > 0.0) {
    var t = max(bounds.x, 0.0);
    let maxT = min(bounds.y, 256.0);
    let step = 0.5;

    for (var i = 0; i < 512; i = i + 1) {
      if (t > maxT) { break; }

      let pos = rayOrigin + rayDir * t;
      let voxel = sampleVoxel(pos);

      if (voxel.a > 0.5) {
        // Hit a solid voxel
        let normal = getNormal(pos);
        let light = normalize(vec3<f32>(1.0, 2.0, 1.5));
        let diffuse = max(dot(normal, light), 0.2);

        // Ambient occlusion approximation
        let ao = 1.0 - smoothstep(0.0, 8.0, f32(i) * step) * 0.5;

        color = vec4<f32>(voxel.rgb * diffuse * ao, 1.0);
        break;
      }

      t = t + step;
    }
  }

  // Fog
  let fogDist = length(rayOrigin);
  let fog = 1.0 - exp(-fogDist * 0.002);
  color = mix(color, vec4<f32>(0.5, 0.6, 0.8, 1.0), fog * 0.3);

  return color;
}
`,U=`
struct Uniforms {
  viewProjection: mat4x4<f32>,
  modelMatrix: mat4x4<f32>,
  cameraPosition: vec3<f32>,
  time: f32,
}

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var voxelTexture: texture_2d<f32>;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let worldPos = uniforms.modelMatrix * vec4<f32>(input.position, 1.0);
  output.position = uniforms.viewProjection * worldPos;
  output.worldPos = worldPos.xyz;
  output.normal = normalize((uniforms.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz);
  output.uv = input.uv;

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  // Sample texture
  let texColor = textureSample(voxelTexture, textureSampler, input.uv);

  // Basic lighting
  let lightDir = normalize(vec3<f32>(1.0, 2.0, 1.5));
  let viewDir = normalize(uniforms.cameraPosition - input.worldPos);
  let halfDir = normalize(lightDir + viewDir);

  let ambient = 0.2;
  let diffuse = max(dot(input.normal, lightDir), 0.0);
  let specular = pow(max(dot(input.normal, halfDir), 0.0), 32.0);

  let lighting = ambient + diffuse * 0.7 + specular * 0.2;

  // Ambient occlusion from UV (corner darkening)
  let ao = 1.0 - smoothstep(0.0, 0.2, min(input.uv.x, input.uv.y)) * 0.3;

  return vec4<f32>(texColor.rgb * lighting * ao, texColor.a);
}
`,F=`
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var colorTexture: texture_2d<f32>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );

  var uvs = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(2.0, 1.0),
    vec2<f32>(0.0, -1.0)
  );

  var output: VertexOutput;
  output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let color = textureSample(colorTexture, textureSampler, input.uv);

  // Tone mapping (ACES)
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  let mapped = clamp((color.rgb * (a * color.rgb + b)) / (color.rgb * (c * color.rgb + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));

  // Gamma correction
  let gamma = pow(mapped, vec3<f32>(1.0 / 2.2));

  return vec4<f32>(gamma, color.a);
}
`;class q{canvas;world;camera;state=null;animationId=0;startTime=0;constructor(t,e){this.canvas=t,this.world=e,this.camera={position:{x:0,y:10,z:30},target:{x:0,y:0,z:0},up:{x:0,y:1,z:0},fov:60,near:.1,far:1e3},this.startTime=performance.now()}async init(){const t=this.world.getDevice();if(!t)return console.error("WebGPU device not available"),!1;const e=this.canvas.getContext("webgpu");if(!e)return console.error("WebGPU context not available"),!1;const n=navigator.gpu.getPreferredCanvasFormat();e.configure({device:t,format:n,alphaMode:"premultiplied"});const o=t.createTexture({size:[this.canvas.width,this.canvas.height],format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT}),s=t.createBuffer({size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),i=t.createBuffer({size:1024*1024,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),r=t.createSampler({magFilter:"linear",minFilter:"linear",mipmapFilter:"linear",addressModeU:"repeat",addressModeV:"repeat"}),a=t.createTexture({size:[1,1],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});t.queue.writeTexture({texture:a},new Uint8Array([255,255,255,255]),{bytesPerRow:4},[1,1]);const d=t.createShaderModule({code:V}),l=t.createRenderPipeline({layout:"auto",vertex:{module:d,entryPoint:"vertexMain"},fragment:{module:d,entryPoint:"fragmentMain",targets:[{format:n}]},primitive:{topology:"triangle-list"}}),c=t.createBindGroup({layout:l.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:s}},{binding:1,resource:{buffer:i}},{binding:2,resource:{buffer:s,offset:192,size:4}}]}),h=t.createShaderModule({code:U}),u=t.createRenderPipeline({layout:"auto",vertex:{module:h,entryPoint:"vertexMain",buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]}]},fragment:{module:h,entryPoint:"fragmentMain",targets:[{format:n}]},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"less"}}),x=t.createShaderModule({code:F}),f=t.createRenderPipeline({layout:"auto",vertex:{module:x,entryPoint:"vertexMain"},fragment:{module:x,entryPoint:"fragmentMain",targets:[{format:n}]},primitive:{topology:"triangle-list"}});return this.state={device:t,context:e,format:n,depthTexture:o,rayMarchPipeline:l,meshPipeline:u,compositePipeline:f,uniformBuffer:s,voxelBuffer:i,uniformBindGroup:c,sampler:r,defaultTexture:a},!0}updateUniforms(){if(!this.state)return;const{device:t,uniformBuffer:e}=this.state,n=(performance.now()-this.startTime)/1e3,o=this.lookAt(this.camera.position,this.camera.target,this.camera.up),s=this.perspective(this.camera.fov*Math.PI/180,this.canvas.width/this.canvas.height,this.camera.near,this.camera.far),i=this.multiplyMatrices(s,o),r=new Float32Array(48);r.set(i,0),r[32]=this.camera.position.x,r[33]=this.camera.position.y,r[34]=this.camera.position.z,r[35]=n,r[36]=this.canvas.width,r[37]=this.canvas.height,t.queue.writeBuffer(e,0,r)}updateVoxels(){if(!this.state)return;const{device:t,voxelBuffer:e}=this.state,n=this.world.getVisibleBlocks(this.camera.position),o=[];let s=0;for(const r of n){for(let a=0;a<8;a++){for(let d=0;d<8;d++){for(let l=0;l<8;l++)if(r.getVoxel(l,d,a)?.solid){const h=r.position.x*8+l,u=r.position.y*8+d,x=r.position.z*8+a;if(o.push(h,u,x,0,.5+Math.random()*.5,.5+Math.random()*.5,.5+Math.random()*.5,1),s++,s>=16384)break}if(s>=16384)break}if(s>=16384)break}if(s>=16384)break}if(o.length>0){const r=new Float32Array(o);t.queue.writeBuffer(e,0,r)}const i=new Uint32Array([s]);t.queue.writeBuffer(this.state.uniformBuffer,192,i)}render(){if(!this.state)return;const{device:t,context:e,rayMarchPipeline:n,uniformBindGroup:o,depthTexture:s}=this.state;this.updateUniforms(),this.updateVoxels();const i=t.createCommandEncoder(),r=e.getCurrentTexture().createView(),a=i.beginRenderPass({colorAttachments:[{view:r,clearValue:{r:.1,g:.1,b:.15,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:s.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});a.setPipeline(n),a.setBindGroup(0,o),a.draw(3),a.end(),t.queue.submit([i.finish()])}start(){const t=()=>{this.render(),this.animationId=requestAnimationFrame(t)};t()}stop(){this.animationId&&(cancelAnimationFrame(this.animationId),this.animationId=0)}setCamera(t,e){this.camera.position=t,e&&(this.camera.target=e)}getCamera(){return{...this.camera}}resize(t,e){this.canvas.width=t,this.canvas.height=e,this.state&&(this.state.depthTexture.destroy(),this.state.depthTexture=this.state.device.createTexture({size:[t,e],format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT}))}lookAt(t,e,n){const o=this.normalize({x:t.x-e.x,y:t.y-e.y,z:t.z-e.z}),s=this.normalize(this.cross(n,o)),i=this.cross(o,s);return new Float32Array([s.x,i.x,o.x,0,s.y,i.y,o.y,0,s.z,i.z,o.z,0,-this.dot(s,t),-this.dot(i,t),-this.dot(o,t),1])}perspective(t,e,n,o){const s=1/Math.tan(t/2),i=1/(n-o);return new Float32Array([s/e,0,0,0,0,s,0,0,0,0,(o+n)*i,-1,0,0,2*o*n*i,0])}multiplyMatrices(t,e){const n=new Float32Array(16);for(let o=0;o<4;o++)for(let s=0;s<4;s++)n[o*4+s]=t[o*4+0]*e[0*4+s]+t[o*4+1]*e[1*4+s]+t[o*4+2]*e[2*4+s]+t[o*4+3]*e[3*4+s];return n}normalize(t){const e=Math.sqrt(t.x*t.x+t.y*t.y+t.z*t.z);return{x:t.x/e,y:t.y/e,z:t.z/e}}cross(t,e){return{x:t.y*e.z-t.z*e.y,y:t.z*e.x-t.x*e.z,z:t.x*e.y-t.y*e.x}}dot(t,e){return t.x*e.x+t.y*e.y+t.z*e.z}}class R{device=null;models;scheduler=null;textEncoder=null;constructor(){this.models=new Map;for(const[t,e]of Object.entries(k))this.models.set(t,{type:t,loaded:!1,config:e})}async init(t){this.device=t,this.initScheduler(),await this.initTextEncoder()}initScheduler(){const o=new Float32Array(1e3);for(let c=0;c<1e3;c++)o[c]=85e-5+(.012-85e-5)*(c/999);const s=new Float32Array(1e3),i=new Float32Array(1e3),r=new Float32Array(1e3);let a=1;for(let c=0;c<1e3;c++)s[c]=1-o[c],a*=s[c],i[c]=a,r[c]=Math.sqrt((1-i[c])/i[c]);const d=[],l=20;for(let c=0;c<l;c++)d.push(Math.floor(999*(1-c/(l-1))));this.scheduler={alphas:i,sigmas:r,timesteps:d}}async initTextEncoder(){this.textEncoder={encode:async t=>this.hashTextToEmbedding(t)}}hashTextToEmbedding(t){const e=new Float32Array(768);let n=0;for(let s=0;s<t.length;s++)n=(n<<5)-n+t.charCodeAt(s)|0;for(let s=0;s<768;s++)n=n*1103515245+12345&2147483647,e[s]=n/2147483647*2-1;let o=0;for(let s=0;s<768;s++)o+=e[s]*e[s];o=Math.sqrt(o);for(let s=0;s<768;s++)e[s]/=o;return e}async loadModel(t){const e=this.models.get(t);return e?(e.loaded||(console.log(`Loading model: ${t}`),e.loaded=!0),!0):!1}async txt2img(t,e="",n={}){const{model:o="sd15",seed:s=I.randomSeed(),steps:i=20,cfg:r=7.5,width:a=k[o].size,height:d=k[o].size}=n;await this.loadModel(o);const l=new I({prompt:t,negativePrompt:e,seed:s,steps:i,cfg:r,model:o,width:a,height:d});return this.runInference(l,t,e)}async img2img(t,e,n="",o={}){const{model:s="sdxl",seed:i=I.randomSeed(),steps:r=20,cfg:a=7.5,strength:d=.7}=o;await this.loadModel(s);const l=new I({prompt:e,negativePrompt:n,seed:i,steps:r,cfg:a,model:s,denoise:d}),c=await this.encodeImage(t,s);return l.setLatent(c),this.runInference(l,e,n,Math.floor(r*(1-d)))}async cascade(t,e="",n={}){const{seed:o=I.randomSeed(),levels:s=3}=n;let i=null;const r=T.slice(0,s);for(let a=0;a<r.length;a++){const d=r[a];a===0?i=await this.txt2img(t,e,{model:d.model,seed:o,steps:d.steps}):i&&(i=await this.img2img(i,t,e,{model:d.model,seed:o,steps:d.steps,strength:d.strength}))}if(!i)throw new Error("Cascade generation failed");return i}async runInference(t,e,n,o=0){if(!this.scheduler||!this.textEncoder)throw new Error("Pipeline not initialized");const s=await this.textEncoder.encode(e),i=await this.textEncoder.encode(n||""),r=this.scheduler.timesteps.slice(o);for(let a=0;a<r.length;a++){const l=r[a]/1e3;await t.diffuse(l,e,async(c,h,u)=>this.simulateUNet(c,s,i,t.cfg))}return this.decodeLatent(t.getLatent(),t.model)}simulateUNet(t,e,n,o){const s=new Float32Array(t.data.length);for(let i=0;i<s.length;i++)s[i]=t.data[i]*.95+(Math.random()-.5)*.1;return s}async encodeImage(t,e){const o=new OffscreenCanvas(t.width,t.height).getContext("2d");o.drawImage(t,0,0);const s=o.getImageData(0,0,t.width,t.height),i=t.width/8,r=t.height/8,a=4,d=new Float32Array(a*i*r);for(let l=0;l<r;l++)for(let c=0;c<i;c++){let h=0,u=0,x=0;for(let v=0;v<8;v++)for(let w=0;w<8;w++){const M=c*8+w,g=((l*8+v)*t.width+M)*4;h+=s.data[g],u+=s.data[g+1],x+=s.data[g+2]}h/=64*255,u/=64*255,x/=64*255;const f=l*i+c;d[f]=(h-.5)*2,d[f+i*r]=(u-.5)*2,d[f+i*r*2]=(x-.5)*2,d[f+i*r*3]=((h+u+x)/3-.5)*2}return{data:d,shape:[1,a,r,i]}}async decodeLatent(t,e){const[,n,o,s]=t.shape,i=s*8,r=o*8,a=new OffscreenCanvas(i,r),d=a.getContext("2d"),l=d.createImageData(i,r);for(let c=0;c<r;c++)for(let h=0;h<i;h++){const u=Math.floor(h/8),f=Math.floor(c/8)*s+u,v=t.data[f],w=t.data[f+s*o],M=t.data[f+s*o*2],z=Math.max(0,Math.min(255,(v/2+.5)*255)),g=Math.max(0,Math.min(255,(w/2+.5)*255)),b=Math.max(0,Math.min(255,(M/2+.5)*255)),S=(c*i+h)*4;l.data[S]=z,l.data[S+1]=g,l.data[S+2]=b,l.data[S+3]=255}return d.putImageData(l,0,0),a.transferToImageBitmap()}getModelInfo(t){return this.models.get(t)}isModelLoaded(t){return this.models.get(t)?.loaded??!1}}let y=null;async function G(){const m=document.getElementById("canvas");if(!m)throw new Error("Canvas element not found");m.width=window.innerWidth,m.height=window.innerHeight;const t=new O({chunkSize:8,voxelSize:1,renderDistance:128,maxLod:4});if(!await t.init())throw new Error("WebGPU initialization failed");const n=new q(m,t);if(!await n.init())throw new Error("Renderer initialization failed");const s=new R,i=t.getDevice();return i&&await s.init(i),N(m,n,t),t.on("taskComplete",r=>{console.log("Generation complete:",r),A(t)}),t.on("cascadeStep",r=>{const{model:a,step:d,total:l}=r;P(`Cascade: ${a} (${d}/${l})`)}),{world:t,renderer:n,pipeline:s,canvas:m,isRunning:!1}}function N(m,t,e){let n=!1,o=0,s=0,i=30,r=0,a=.3;const d=()=>{const l=Math.sin(r)*Math.cos(a)*i,c=Math.sin(a)*i,h=Math.cos(r)*Math.cos(a)*i;t.setCamera({x:l,y:c,z:h},{x:0,y:0,z:0})};m.addEventListener("mousedown",l=>{n=!0,o=l.clientX,s=l.clientY}),m.addEventListener("mousemove",l=>{if(!n)return;const c=l.clientX-o,h=l.clientY-s;r+=c*.01,a=Math.max(-Math.PI/2+.1,Math.min(Math.PI/2-.1,a+h*.01)),d(),o=l.clientX,s=l.clientY}),m.addEventListener("mouseup",()=>{n=!1}),m.addEventListener("wheel",l=>{i=Math.max(5,Math.min(200,i+l.deltaY*.1)),d()}),document.addEventListener("keydown",l=>{if(l.key===" "){const c=document.getElementById("prompt")?.value||"crystal cave";e.generate(c,{x:0,y:0,z:0},["sd15","sdxl"])}}),window.addEventListener("resize",()=>{m.width=window.innerWidth,m.height=window.innerHeight,t.resize(m.width,m.height)}),d()}function P(m){const t=document.getElementById("status");t&&(t.textContent=m)}function A(m){const t=m.getStats(),e=document.getElementById("stats");e&&(e.innerHTML=`
      Blocks: ${t.blocks}<br>
      Voxels: ${t.voxels}<br>
      Queue: ${t.queueLength}
    `)}async function Y(m,t){y&&(P("Generating..."),y.world.generate(m,t,["sd15","sdxl"]))}function D(){!y||y.isRunning||(y.isRunning=!0,y.renderer.start(),P("Running"))}function X(){!y||!y.isRunning||(y.isRunning=!1,y.renderer.stop(),P("Stopped"))}async function E(){try{P("Initializing WebGPU..."),y=await G(),P("Generating initial world..."),y.world.generate("crystal cave with glowing gems",{x:0,y:0,z:0},["sd15"]),y.world.generate("ancient stone temple",{x:8,y:0,z:0},["sd15"]),y.world.generate("mystical forest floor",{x:0,y:0,z:8},["sd15"]),D(),setInterval(()=>{y&&(y.world.evolve(),A(y.world))},5e3),P("Ready - Click and drag to rotate, scroll to zoom")}catch(m){console.error("Initialization failed:",m),P(`Error: ${m instanceof Error?m.message:"Unknown error"}`)}}window.voxgen={generate:Y,start:D,stop:X,getWorld:()=>y?.world??null,getRenderer:()=>y?.renderer??null};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",E):E();
//# sourceMappingURL=index-D-t5Id2F.js.map
