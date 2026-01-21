/**
 * WebGPU Shaders for Voxel Rendering
 * Ray marching and mesh rendering
 */

export const rayMarchShader = /* wgsl */ `
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
`;

export const meshShader = /* wgsl */ `
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
`;

export const compositeShader = /* wgsl */ `
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
`;
