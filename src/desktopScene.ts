import * as THREE from 'three';
import { createDojoModel, CURRENT_STAGE, BUILD_STAGES, type BuildStage, type DojoRuntime } from './createDojoModel';
import { FRONT_FOV, MAX_SCENE_ASPECT, lockedFrame } from './framing';
import { createChannelLinks, type ChannelLinks } from './channelLinks';
import { createDoorInteractions, setDoorProgress, type DoorInteractions } from './doorInteractions';
import { FACADE_NAVIGATION } from './signage';
import type { InfoBoard } from './infoBoard';
import type { ViewOptions, SiteView } from './presentation';
import './desktopScene.css';

export function mountDesktopScene(host: HTMLElement, options: ViewOptions): SiteView {
  const params = new URLSearchParams(location.search);
  const review = import.meta.env.DEV && params.has('review');
  const isolated = review && params.has('isolated');
  const doorsOnly = isolated && params.get('only') === 'doors';
  const stage = review && BUILD_STAGES.includes(params.get('pass') as BuildStage) ? params.get('pass') as BuildStage : CURRENT_STAGE;
  host.style.setProperty('--scene-max-aspect', String(MAX_SCENE_ASPECT));
  if (review) host.style.maxWidth = 'none';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(isolated ? '#ffffff' : '#b9ceda');
  const camera = new THREE.PerspectiveCamera(FRONT_FOV, 1, .08, 400);
  let renderer: THREE.WebGLRenderer | undefined;
  let runtime: DojoRuntime | undefined;
  let channelLinks: ChannelLinks | undefined;
  let doorInteractions: DoorInteractions | undefined;
  let infoBoard: InfoBoard | undefined;
  let boardLoading: Promise<void> | undefined;
  let disposed = false;

  // These views are available only to the local reconstruction checks.
  const reviewViews: Record<string, { position: number[]; target: number[] }> = {
    front: { position: [0, 3.055, 16.8], target: [0, 3.055, 0] },
    angle: { position: [7.2, 4.35, 17.5], target: [0, 3, -.3] },
    detail: { position: [0, 1.78, 8.7], target: [0, 1.78, 0] },
    doors: { position: [-.14, 1.42, 4.7], target: [-.14, 1.42, 0] },
    oblique: { position: [-7.2, 4.1, 17.5], target: [0, 3, -.3] },
    right: { position: [19, 4, -1.8], target: [0, 3, -1.8] },
    left: { position: [-19, 4, -1.8], target: [0, 3, -1.8] },
    rear: { position: [0, 4.4, -25], target: [0, 3.3, -7.2] },
    elevated: { position: [11.5, 13.5, 10.5], target: [0, 3.3, -4.8] },
  };
  const target = new THREE.Vector3();
  const diagnostics = document.createElement('output');
  diagnostics.id = 'scene-diagnostics';
  diagnostics.hidden = true;
  if (import.meta.env.DEV) document.body.append(diagnostics);

  const skyFill = new THREE.HemisphereLight('#d9e7f0', '#8b7654', 1.7);
  const sun = new THREE.DirectionalLight('#fff2d7', 2.5);
  sun.position.set(-8, 13, 11);
  sun.target.position.set(0, 3, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 11, bottom: -7, near: .5, far: 45 });
  sun.shadow.normalBias = .024;
  sun.shadow.bias = -.00015;
  sun.shadow.radius = 3;
  scene.add(skyFill, sun, sun.target);

  function render() {
    if (!renderer || !runtime || disposed) return;
    renderer.render(scene, camera);
    if (import.meta.env.DEV) diagnostics.textContent = JSON.stringify({
      stage, locked: !review, camera: camera.position.toArray(), target: target.toArray(),
      frameWidth: 2 * camera.position.distanceTo(target) * Math.tan(camera.fov * Math.PI / 360) * camera.aspect,
      viewport: [host.clientWidth, host.clientHeight], parts: runtime.parts.size,
      meshes: runtime.meshes.length, triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls,
      signs: FACADE_NAVIGATION.filter(sign => runtime!.parts.has(sign.partId)).map(sign => sign.id),
    });
  }

  function resize() {
    if (!renderer || disposed) return;
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const inspectionView = review ? reviewViews[params.get('view') ?? 'front'] ?? reviewViews.front : undefined;
    if (inspectionView) {
      camera.position.fromArray(inspectionView.position);
      target.fromArray(inspectionView.target);
    } else {
      const frame = lockedFrame(camera.aspect);
      camera.aspect = frame.aspect;
      camera.position.set(0, frame.height, frame.distance);
      target.set(0, frame.height, 0);
    }
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    camera.updateMatrixWorld();
    render();
    channelLinks?.resize();
    doorInteractions?.resize();
    document.documentElement.dataset.viewport = `${width}x${height}`;
  }
  const observer = new ResizeObserver(resize);

  function syncBoardRoute() {
    if (review || disposed) return;
    channelLinks?.reset();
    if (/^#(about|portfolio|contact)(\/|$)/.test(location.hash)) doorInteractions?.reset();
    if (infoBoard) { infoBoard.syncRoute(); return; }
    if (!/^#(about|portfolio|contact)(\/|$)/.test(location.hash) || boardLoading) return;
    boardLoading = import('./infoBoard').then(({ createInfoBoard }) => {
      if (disposed) return;
      infoBoard = createInfoBoard({ base: import.meta.env.BASE_URL, state: options.boardState });
      infoBoard.syncRoute();
    }).catch(error => { console.error('Could not open the information board.', error); boardLoading = undefined; });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('hashchange', syncBoardRoute);
    doorInteractions?.dispose();
    channelLinks?.dispose();
    infoBoard?.dispose();
    runtime?.dispose();
    sun.shadow.map?.dispose();
    renderer?.dispose();
    renderer?.domElement.remove();
    diagnostics.remove();
  }
  function onPageHide(event: PageTransitionEvent) {
    channelLinks?.reset();
    doorInteractions?.reset();
    if (!event.persisted) dispose();
  }
  function onPageShow(event: PageTransitionEvent) {
    if (event.persisted) { channelLinks?.reset(); doorInteractions?.reset(); resize(); syncBoardRoute(); }
  }
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('hashchange', syncBoardRoute);
  if (import.meta.hot) import.meta.hot.dispose(dispose);

  // Direct board links do not have to wait for the 3D model to finish loading.
  syncBoardRoute();
  void (async () => {
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: review });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.domElement.setAttribute('role', 'img');
      renderer.domElement.setAttribute('aria-label', 'Monkey King Dojo. Merch in the left display window; Donate in the right. Portfolio and Contact on the inner pillars. X and Discord above the doors; YouTube and Instagram on the upper door glass; KICK and Twitch on the lower door glass. Hover or focus a door handle to preview the entrance opening. Fixed frontal 3D view.');
      host.append(renderer.domElement);
      resize();
      observer.observe(host);
      window.addEventListener('resize', resize);
      const model = await createDojoModel({ stage, anisotropy: renderer.capabilities.getMaxAnisotropy(), assetBase: import.meta.env.BASE_URL });
      runtime = model.userData.sculptRuntime as DojoRuntime;
      if (disposed) runtime.dispose();
      else {
        scene.add(model);
        if (runtime.environment) { scene.environment = runtime.environment; scene.environmentIntensity = .65; }
        if (isolated) runtime.parts.get('paving')!.visible = false;
        if (doorsOnly) {
          const kept = new Set([runtime.parts.get('door-west'), runtime.parts.get('door-east')]);
          runtime.meshes.forEach(mesh => {
            let node: THREE.Object3D | null = mesh;
            mesh.visible = false;
            while (node) {
              if (kept.has(node as THREE.Group)) { mesh.visible = true; break; }
              node = node.parent;
            }
          });
        }
        await renderer.compileAsync(scene, camera);
        if (!disposed) {
          if (!review) {
            channelLinks = createChannelLinks(host, camera, runtime, render);
            doorInteractions = createDoorInteractions(host, camera, runtime, render, () => channelLinks?.resize());
          } else {
            const doorPreview = params.get('door');
            runtime.doorHandles.forEach(handle => {
              if (doorPreview === 'both' || doorPreview === handle.id) setDoorProgress(handle, 1);
            });
          }
          if (review && params.has('evidence')) {
            const { collectEvidence } = await import('./reviewEvidence');
            const evidence = collectEvidence(model, runtime);
            const report = document.createElement('section');
            report.id = 'model-evidence';
            const batches = Math.ceil(evidence.geometry.meshes.length / 12);
            const summary = document.createElement('output');
            summary.id = 'evidence-summary';
            summary.textContent = JSON.stringify({ manifest: evidence.manifest, measured: evidence.measured, geometry: { ...evidence.geometry, meshes: undefined }, batches });
            report.append(summary);
            for (let batch = 0; batch < batches; batch++) {
              const output = document.createElement('output');
              output.dataset.meshBatch = String(batch);
              output.textContent = JSON.stringify(evidence.geometry.meshes.slice(batch * 12, batch * 12 + 12));
              report.append(output);
            }
            // The evidence URL is an explicit local inspection surface, never the website.
            Object.assign(report.style, { position: 'fixed', inset: '0', overflow: 'auto', background: 'white', whiteSpace: 'pre-wrap', fontSize: '10px' });
            document.body.append(report);
          }
          resize();
          document.documentElement.dataset.ready = 'true';
          document.documentElement.dataset.viewLocked = String(!review);
          document.documentElement.dataset.buildStage = stage;
          syncBoardRoute();
        }
      }
    } catch (error) {
      if (!disposed) {
        const message = document.createElement('p');
        message.className = 'scene-error';
        message.textContent = 'The 3D scene could not load. Please reload, or enable WebGL 2 in your browser.';
        host.append(message);
        document.documentElement.dataset.ready = 'error';
        console.error(error);
      }
    }
  })();
  return { dispose };
}
