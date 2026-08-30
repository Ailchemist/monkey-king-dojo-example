import * as THREE from 'three';

type Surface = 'stucco' | 'concrete' | 'asphalt' | 'metal' | 'glass';
interface TextureSet { color: THREE.DataTexture; normal: THREE.DataTexture; roughness: THREE.DataTexture; ao: THREE.DataTexture }
export interface SurfaceLibrary {
  stucco: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  aluminum: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  displayGlass: THREE.MeshBasicMaterial;
  concrete: THREE.MeshStandardMaterial;
  asphalt: THREE.MeshStandardMaterial;
  inside: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  glassCoat: THREE.MeshPhysicalMaterial;
  projected: Map<THREE.Material, THREE.Material>;
  materials: THREE.Material[];
  textures: THREE.Texture[];
  environment: THREE.DataTexture;
}

function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(u: number, v: number, cells: number, seed: number) {
  const x = u*cells, y = v*cells;
  const ix = Math.floor(x), iy = Math.floor(y);
  let tx = x-ix, ty = y-iy;
  tx *= tx*(3-2*tx); ty *= ty*(3-2*ty);
  const a = hash(ix%cells,iy%cells,seed), b = hash((ix+1)%cells,iy%cells,seed);
  const c = hash(ix%cells,(iy+1)%cells,seed), d = hash((ix+1)%cells,(iy+1)%cells,seed);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,tx),THREE.MathUtils.lerp(c,d,tx),ty);
}

/** Independent albedo, height-derived normals, roughness and cavity signals. */
function surfaceMaps(kind: Surface, base: number[], size: number, seed: number, anisotropy: number): TextureSet {
  const count=size*size;
  const color=new Uint8Array(count*4), normal=new Uint8Array(count*4), roughness=new Uint8Array(count*4), ao=new Uint8Array(count*4);
  const height=new Float32Array(count);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const i=y*size+x, p=i*4, u=x/size, v=y/size;
    const macro=noise(u,v,4,seed), meso=noise(u,v,96,seed+37), micro=hash(x,y,seed+17);
    const colorNoise=noise(u,v,16,seed+911);
    const roughNoise=noise(u,v,32,seed+401);
    const metal=kind==='metal', glass=kind==='glass';
    let h=macro*.13+meso*.55+micro*.32;
    let variation=1+(colorNoise-.5)*.095+(hash(x,y,seed+512)-.5)*.03;
    if(kind==='asphalt') { h=meso*.2+micro*.8; variation=1+(macro-.5)*.15+(micro-.5)*.26; }
    if(kind==='concrete') variation=1+(macro-.5)*.12+(colorNoise-.5)*.07+(micro-.5)*.035;
    if(metal) { h=hash(x,0,seed)*.17+micro*.025; variation=1+(hash(x,0,seed+17)-.5)*.03; }
    if(glass) { h=noise(u,v*.06,64,seed)*.035; variation=1; }
    height[i]=h;
    color[p]=Math.min(255,base[0]*variation); color[p+1]=Math.min(255,base[1]*variation); color[p+2]=Math.min(255,base[2]*variation); color[p+3]=255;
    const r=metal?.74+roughNoise*.23:glass?.5+roughNoise*.5:.87+roughNoise*.13;
    roughness[p]=roughness[p+1]=roughness[p+2]=Math.round(r*255); roughness[p+3]=255;
    const cavity=kind==='asphalt'?.89+meso*.11:.96+noise(u,v,20,seed+807)*.04;
    ao[p]=ao[p+1]=ao[p+2]=Math.round(cavity*255); ao[p+3]=255;
  }
  const strength=kind==='metal'?.4:kind==='glass'?.16:kind==='concrete'?.68:kind==='asphalt'?1.0:1.05;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const p=(y*size+x)*4;
    const dx=(height[y*size+((x+1)%size)]-height[y*size+((x-1+size)%size)])*strength;
    const dy=(height[((y+1)%size)*size+x]-height[((y-1+size)%size)*size+x])*strength;
    const inv=1/Math.sqrt(dx*dx+dy*dy+1);
    normal[p]=(-dx*inv*.5+.5)*255; normal[p+1]=(-dy*inv*.5+.5)*255; normal[p+2]=(inv*.5+.5)*255; normal[p+3]=255;
  }
  function texture(data: Uint8Array, isColor=false) {
    const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
    map.colorSpace=isColor?THREE.SRGBColorSpace:THREE.NoColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;
    map.magFilter=THREE.LinearFilter;
    map.minFilter=THREE.LinearMipmapLinearFilter;
    map.generateMipmaps=true;
    map.anisotropy=anisotropy;
    map.channel=1;
    map.needsUpdate=true;
    return map;
  }
  return { color:texture(color,true), normal:texture(normal), roughness:texture(roughness), ao:texture(ao) };
}

/** Dark interior blinds, with no photographic emblems baked into the glazing. */
function displayPaneTexture(anisotropy: number) {
  const size = 512;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const edge = Math.pow(Math.max(Math.abs(u - .5), Math.abs(v - .5)) * 2, 3);
    const slat = v * 53;
    const seam = Math.exp(-Math.pow((slat % 1) / .13, 2));
    const variation = noise(u, v, 9, 513) * 5 + hash(x, y, 310) * 2;
    const shade = variation + seam * 5 + (1 - edge) * 3;
    const i = (y * size + x) * 4;
    data[i] = 13 + shade; data[i + 1] = 17 + shade; data[i + 2] = 15 + shade;
    data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/** A deterministic HDR sky/horizon for outdoor reflections; no remote assets. */
export function createEnvironmentMap(): THREE.DataTexture {
  const w=512,h=256,data=new Float32Array(w*h*4);
  const zenith=new THREE.Color('#89acc7'), horizon=new THREE.Color('#e6dfce'), ground=new THREE.Color('#8f806d');
  const color=new THREE.Color();
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const u=x/w,v=y/h;
    if(v>=.5) color.copy(horizon).lerp(zenith,Math.pow((v-.5)*2,.55));
    else color.copy(horizon).lerp(ground,Math.min(1,(.5-v)*8));
    const skyline=.494+.017*hash(Math.floor(u*63),0,71);
    if(v>.475&&v<skyline) color.multiplyScalar(.72+.12*hash(Math.floor(u*160),0,22));
    const sun=Math.exp(-((u-.175)**2+(v-.79)**2)/.00009)*16;
    const cloud=Math.exp(-((v-.63)**2)/.008)*(noise(u,v,16,105)-.45)*.12;
    const i=(y*w+x)*4;
    data[i]=Math.max(0,color.r*1.25+sun+cloud); data[i+1]=Math.max(0,color.g*1.25+sun*.9+cloud); data[i+2]=Math.max(0,color.b*1.25+sun*.72+cloud); data[i+3]=1;
  }
  const texture=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
  texture.mapping=THREE.EquirectangularReflectionMapping;
  texture.colorSpace=THREE.LinearSRGBColorSpace;
  texture.needsUpdate=true;
  return texture;
}

export async function createSurfaceLibrary(assetBase: string, anisotropy: number, size=1024): Promise<SurfaceLibrary> {
  const textures: THREE.Texture[]=[];
  const materials: THREE.Material[]=[];
  const source=await new THREE.TextureLoader().loadAsync(`${assetBase}textures/facade-albedo-bb8813aca50c.webp`);
  source.colorSpace=THREE.SRGBColorSpace;
  source.anisotropy=anisotropy;
  textures.push(source);
  function maps(kind: Surface, base: number[], seed: number) {
    const set=surfaceMaps(kind,base,size,seed,anisotropy);
    textures.push(...Object.values(set));
    return set;
  }
  const plaster=maps('stucco',[202,187,163],7128);
  const stone=maps('concrete',[175,158,135],8133);
  const road=maps('asphalt',[97,93,86],9531);
  const metal=maps('metal',[160,157,147],2371);
  const glazing=maps('glass',[35,45,41],5117);
  function standard(set: TextureSet, roughness: number, metalness=0, normalScale=.5) {
    const m=new THREE.MeshStandardMaterial({map:set.color,normalMap:set.normal,roughnessMap:set.roughness,aoMap:set.ao,aoMapIntensity:.32,roughness,metalness,normalScale:new THREE.Vector2(normalScale,normalScale)});
    materials.push(m); return m;
  }
  const stucco=standard(plaster,.94,0,.66);
  const concrete=standard(stone,.96,0,.53);
  const asphalt=standard(road,.99,0,.2);
  // World-space variation prevents a one-metre albedo tile from stamping the road.
  asphalt.map = null;
  asphalt.color.set('#8c7567');
  asphalt.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRoadWorld;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRoadWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying vec3 vRoadWorld;
      float roadHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float roadNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(roadHash(i), roadHash(i + vec2(1., 0.)), f.x), mix(roadHash(i + vec2(0., 1.)), roadHash(i + vec2(1., 1.)), f.x), f.y);
      }
    `).replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 roadUv = vRoadWorld.xz;
      float broad = roadNoise(roadUv * .38);
      float grit = roadNoise(roadUv * 85.0);
      float footprint = max(length(dFdx(roadUv)), length(dFdy(roadUv))) * 85.0;
      grit = mix(grit, .5, smoothstep(.35, 1.3, footprint));
      diffuseColor.rgb *= .90 + .13 * broad + .025 * roadNoise(roadUv * 5.7) + .055 * grit;
    `);
  };
  asphalt.customProgramCacheKey = () => 'dojo-world-asphalt-v1';
  const aluminum=standard(metal,.43,.93,.25);
  const paint=standard(plaster,.92,0,.54);
  paint.color.set('#4c4840');
  const glass=standard(glazing,.15,0,.08);
  const displayTexture = displayPaneTexture(anisotropy);
  textures.push(displayTexture);
  const displayGlass = new THREE.MeshBasicMaterial({ map: displayTexture, toneMapped: false });
  materials.push(displayGlass);
  const rubber=new THREE.MeshStandardMaterial({color:'#111711',roughness:.96});
  const inside=new THREE.MeshStandardMaterial({color:'#1a211d',roughness:.92});
  materials.push(rubber,inside);
  const projected=new Map<THREE.Material,THREE.Material>();
  function photo(base: THREE.MeshStandardMaterial, normalScale: number) {
    const m=base.clone(); m.map=source; m.color.setRGB(.78,.78,.78); m.normalScale.setScalar(normalScale); materials.push(m); projected.set(base,m); return m;
  }
  photo(stucco,.53);
  photo(paint,.48);
  const photoMetal=photo(aluminum,.18);
  photoMetal.metalness=.62;
  photoMetal.roughness=.48;
  photoMetal.color.setScalar(1.35);
  const graphicLayer=new THREE.MeshBasicMaterial({map:source,color:'#ffffff',toneMapped:false});
  materials.push(graphicLayer); projected.set(glass,graphicLayer);
  const glassCoat=new THREE.MeshPhysicalMaterial({color:'#b0c2bc',metalness:0,roughness:.095,roughnessMap:glazing.roughness,normalMap:glazing.normal,normalScale:new THREE.Vector2(.035,.035),transparent:true,opacity:.16,depthWrite:false,clearcoat:1,clearcoatRoughness:.075,ior:1.5,envMapIntensity:.65});
  glassCoat.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      float facing = max(dot(normal, normalize(vViewPosition)), 0.0);
      diffuseColor.a = 0.055 + 0.40 * pow(1.0 - facing, 4.0);
      #include <opaque_fragment>
    `);
  };
  glassCoat.customProgramCacheKey=()=> 'dojo-fresnel-glass-v1';
  materials.push(glassCoat);
  const environment=createEnvironmentMap(); textures.push(environment);
  return {stucco,paint,aluminum,glass,displayGlass,concrete,asphalt,inside,rubber,glassCoat,projected,materials,textures,environment};
}
