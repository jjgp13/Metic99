import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type Phaser from "phaser";
import { ENEMY, GAME, PLAYER, RENDER3D } from "../config/constants";
import type Alien from "../objects/Alien";
import type { Bullet } from "../objects/Bullet";
import { createNumberBall } from "./NumberBall";
import { voxelizeFrame, type VoxelModel } from "./voxelize";

/** What the renderer needs from the game each frame. It only reads this. */
export interface WorldSnapshot {
  shipX: number;
  /** x the ship is sliding toward (drives banking), or null when idle. */
  shipTargetX: number | null;
  aliens: readonly Alien[];
  bullets: readonly Bullet[];
  /** Pause hides the field so sums can't be solved on a break. */
  aliensHidden: boolean;
}

interface AlienView {
  root: THREE.Group;
  body: THREE.Mesh;
  phase: number;
}

interface Debris {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
}

const toWorldX = (x: number) => x - GAME.WIDTH / 2;
const toWorldY = (y: number) => GAME.HEIGHT / 2 - y;

/**
 * The 3D view of the playfield, drawn with Three.js on a canvas that sits
 * *under* Phaser's (transparent) canvas. Phaser keeps menus, HUD, keypad, input
 * and audio; this class only mirrors game state into meshes.
 *
 * It is a "dumb" renderer: `render(snapshot)` diffs the snapshot against the
 * views it already has (create new, move existing, drop missing), so game logic
 * never touches Three.js. One instance lives for the whole page — WebGL
 * contexts are scarce on mobile — and is shown/hidden per run.
 */
export default class World3D {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly cameraZ: number;

  private textures: Phaser.Textures.TextureManager | null = null;
  private phaserCanvas: HTMLCanvasElement | null = null;
  private lastRect = "";

  private readonly models = new Map<string, VoxelModel>();
  /** Parsed Blender models by name (docs/ART_SPEC.md); cloned per instance. */
  private readonly gltfModels = new Map<string, THREE.Object3D>();
  private readonly litMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    metalness: 0.1,
    flatShading: true,
  });
  private readonly glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

  private ship: THREE.Group | null = null;
  private shipBody: THREE.Object3D | null = null;
  /** Model parts named `anim_flame*`; flickered every frame. */
  private shipFlames: THREE.Object3D[] = [];
  private bank = 0;
  private readonly alienViews = new Map<Alien, AlienView>();
  private readonly bulletViews = new Map<Bullet, THREE.Mesh>();

  private readonly stars: THREE.Points;
  private readonly starHalfH: Float32Array;

  private debris: Debris[] = [];
  private readonly debrisGeometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly debrisMaterials = new Map<number, THREE.MeshStandardMaterial>();
  // One reusable light for explosion flashes: adding/removing lights at runtime
  // forces shader recompiles (a visible hitch), so we move this one instead.
  private readonly flash = new THREE.PointLight(0xffd166, 0, 260, 0);
  private flashLeft = 0;

  private shakeLeft = 0;
  private shakeDuration = 0;
  private shakeIntensity = 0;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(GAME.BG_COLOR);
    const c = this.renderer.domElement;
    c.style.position = "fixed";
    c.style.pointerEvents = "none";
    c.style.zIndex = "0";
    c.style.display = "none";
    document.body.appendChild(c);

    // Place the camera so the z = 0 plane exactly fills the logical playfield.
    const fov = RENDER3D.FOV;
    this.cameraZ = GAME.HEIGHT / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    this.camera = new THREE.PerspectiveCamera(fov, GAME.WIDTH / GAME.HEIGHT, 1, 6000);
    this.camera.position.set(0, 0, this.cameraZ);

    this.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x1a1a3a, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-0.6, 0.8, 1);
    this.scene.add(key);
    this.scene.add(this.flash);

    const n = RENDER3D.STAR_COUNT;
    this.starHalfH = new Float32Array(n);
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const z = THREE.MathUtils.lerp(RENDER3D.STAR_NEAR_Z, RENDER3D.STAR_FAR_Z, Math.random());
      const { halfW, halfH } = this.visibleHalfExtents(z);
      this.starHalfH[i] = halfH;
      pos[i * 3] = THREE.MathUtils.randFloatSpread(halfW * 2);
      pos[i * 3 + 1] = THREE.MathUtils.randFloatSpread(halfH * 2);
      pos[i * 3 + 2] = z;
      tint.setHSL(0.6 + Math.random() * 0.1, 0.5, 0.6 + Math.random() * 0.4);
      col.set([tint.r, tint.g, tint.b], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ size: 4, vertexColors: true, sizeAttenuation: true }),
    );
    this.scene.add(this.stars);
  }

  /**
   * Parse the Blender-built .glb files (loaded as binaries by BootScene). A model
   * that is missing or fails to parse is skipped, and its sprite-voxel version is
   * used instead, so art can land one model at a time.
   */
  public async loadModels(files: ReadonlyArray<readonly [name: string, data: ArrayBuffer | undefined]>): Promise<void> {
    const loader = new GLTFLoader();
    await Promise.all(
      files.map(async ([name, data]) => {
        if (!data) return;
        try {
          const gltf = await loader.parseAsync(data, "");
          this.gltfModels.set(name, gltf.scene);
        } catch (e) {
          console.warn(`[World3D] model "${name}" failed to parse; using voxel fallback`, e);
        }
      }),
    );
  }

  /** Start drawing a run. Needs Phaser's textures (to voxelize) and canvas (to align). */
  public begin(textures: Phaser.Textures.TextureManager, phaserCanvas: HTMLCanvasElement): void {
    this.textures = textures;
    this.phaserCanvas = phaserCanvas;
    this.clearViews();

    this.shipBody = this.instantiate("ship_player") ?? this.voxelShip();
    this.shipFlames = [];
    this.shipBody.traverse((o) => {
      if (o.name.startsWith("anim_flame")) this.shipFlames.push(o);
    });
    this.ship = new THREE.Group().add(this.shipBody);
    this.scene.add(this.ship);
    this.bank = 0;

    this.lastRect = "";
    this.renderer.domElement.style.display = "block";
  }

  /** Stop drawing (leaving the game scene). */
  public end(): void {
    this.clearViews();
    this.renderer.domElement.style.display = "none";
  }

  public render(s: WorldSnapshot, time: number, delta: number): void {
    const dt = delta / 1000;
    this.syncCanvasRect();
    this.updateStars(dt);
    this.syncShip(s, time, dt);
    this.syncAliens(s, time);
    this.syncBullets(s);
    this.updateDebris(dt, delta);
    this.updateCameraShake(delta);
    this.renderer.render(this.scene, this.camera);
  }

  /** Burst an alien into voxel debris at logical (x, y). */
  public explode(x: number, y: number, alien?: Alien): void {
    const palette = alien
      ? this.model(alien.bodyKey, 0, RENDER3D.ALIEN_DEPTH).palette
      : [0xffd166, 0xef476f, 0x4ea1ff];
    const wx = toWorldX(x);
    const wy = toWorldY(y);
    const { min, max } = RENDER3D.DEBRIS_SPEED;

    for (let i = 0; i < RENDER3D.DEBRIS_COUNT; i++) {
      const hex = palette[Math.floor(Math.random() * palette.length)];
      const mesh = new THREE.Mesh(this.debrisGeometry, this.debrisMaterial(hex));
      mesh.position.set(wx, wy, 0);
      mesh.scale.setScalar(RENDER3D.DEBRIS_SIZE);
      // Random direction, biased toward the camera so the burst pops out of the plane.
      const dir = new THREE.Vector3().randomDirection();
      dir.z = Math.abs(dir.z);
      const vel = dir.multiplyScalar(THREE.MathUtils.randFloat(min, max));
      const spin = new THREE.Vector3().randomDirection().multiplyScalar(12);
      this.scene.add(mesh);
      this.debris.push({ mesh, vel, spin, age: 0 });
    }

    this.flash.position.set(wx, wy, 60);
    this.flashLeft = RENDER3D.FLASH_MS;
  }

  /** Same semantics as Phaser's camera.shake (intensity = fraction of view). */
  public shake(durationMs: number, intensity: number): void {
    this.shakeLeft = this.shakeDuration = durationMs;
    this.shakeIntensity = intensity;
  }

  // ---------------------------------------------------------------------------

  private model(key: string, frame: number, depth: number): VoxelModel {
    const id = `${key}:${frame}:${depth}`;
    let m = this.models.get(id);
    if (!m) {
      m = voxelizeFrame(this.textures!, key, frame, depth);
      this.models.set(id, m);
    }
    return m;
  }

  /**
   * Clone a loaded Blender model (geometry and materials are shared). Blender
   * models are authored nose +Y / top +Z; after the glTF Y-up export, rotating
   * +90° about X puts the nose at screen-up and the top toward the camera.
   */
  private instantiate(name: string): THREE.Object3D | null {
    const src = this.gltfModels.get(name);
    if (!src) return null;
    const model = src.clone(true);
    model.rotation.x = Math.PI / 2;
    return new THREE.Group().add(model);
  }

  private voxelShip(): THREE.Object3D {
    const mesh = new THREE.Mesh(this.model("ship", 0, RENDER3D.SHIP_DEPTH).geometry, this.litMaterial);
    mesh.scale.setScalar(PLAYER.SCALE);
    return mesh;
  }

  private debrisMaterial(hex: number): THREE.MeshStandardMaterial {
    let m = this.debrisMaterials.get(hex);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, flatShading: true });
      this.debrisMaterials.set(hex, m);
    }
    return m;
  }

  /** Half width/height of the view frustum at world depth z. */
  private visibleHalfExtents(z: number): { halfW: number; halfH: number } {
    const halfH = Math.tan(THREE.MathUtils.degToRad(RENDER3D.FOV / 2)) * (this.cameraZ - z);
    return { halfW: halfH * (GAME.WIDTH / GAME.HEIGHT), halfH };
  }

  /** Keep our canvas exactly under Phaser's (Scale.FIT letterboxes and moves it). */
  private syncCanvasRect(): void {
    if (!this.phaserCanvas) return;
    const r = this.phaserCanvas.getBoundingClientRect();
    const key = `${r.left},${r.top},${r.width},${r.height}`;
    if (key === this.lastRect) return;
    this.lastRect = key;
    const c = this.renderer.domElement;
    c.style.left = `${r.left}px`;
    c.style.top = `${r.top}px`;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER3D.MAX_PIXEL_RATIO));
    this.renderer.setSize(r.width, r.height);
  }

  private updateStars(dt: number): void {
    const attr = this.stars.geometry.getAttribute("position") as THREE.BufferAttribute;
    const pos = attr.array as Float32Array;
    for (let i = 0; i < this.starHalfH.length; i++) {
      const h = this.starHalfH[i];
      let y = pos[i * 3 + 1] - RENDER3D.STAR_DRIFT * dt;
      if (y < -h) y += h * 2;
      pos[i * 3 + 1] = y;
    }
    attr.needsUpdate = true;
  }

  private syncShip(s: WorldSnapshot, time: number, dt: number): void {
    if (!this.ship || !this.shipBody) return;
    this.ship.position.set(toWorldX(s.shipX), toWorldY(PLAYER.Y), 0);
    // Bank into the slide: positive yaw tips the right wing away from the camera.
    const target =
      s.shipTargetX === null
        ? 0
        : THREE.MathUtils.clamp(
            (s.shipTargetX - s.shipX) * RENDER3D.SHIP_BANK_PER_PX,
            -RENDER3D.SHIP_BANK_MAX,
            RENDER3D.SHIP_BANK_MAX,
          );
    this.bank += (target - this.bank) * Math.min(1, dt * RENDER3D.SHIP_BANK_RESPONSE);
    this.shipBody.rotation.y = this.bank + Math.sin(time * 0.003) * 0.1;
    this.shipFlames.forEach((f, i) => {
      f.scale.setScalar(0.85 + 0.2 * Math.sin(time * 0.045 + i * 1.7) + 0.08 * Math.random());
    });
  }

  private syncAliens(s: WorldSnapshot, time: number): void {
    const seen = new Set<Alien>();
    for (const a of s.aliens) {
      if (!a.active) continue;
      seen.add(a);
      let v = this.alienViews.get(a);
      if (!v) {
        v = this.createAlienView(a);
        this.alienViews.set(a, v);
      }
      v.root.position.set(toWorldX(a.x), toWorldY(a.y), 0);
      v.root.visible = !s.aliensHidden;
      v.body.rotation.y =
        Math.sin(time * RENDER3D.ALIEN_SWAY_SPEED + v.phase) * RENDER3D.ALIEN_SWAY;
    }
    for (const [a, v] of this.alienViews) {
      if (seen.has(a)) continue;
      this.scene.remove(v.root);
      this.alienViews.delete(a);
    }
  }

  private createAlienView(a: Alien): AlienView {
    const root = new THREE.Group();
    const body = new THREE.Mesh(
      this.model(a.bodyKey, 0, RENDER3D.ALIEN_DEPTH).geometry,
      this.litMaterial,
    );
    body.scale.setScalar(ENEMY.SCALE);
    root.add(body);

    // Number balls sit in a row above the body and never rotate, so the digits
    // always face the camera and stay readable.
    const totalW = (a.digits.length - 1) * ENEMY.BALL_SPACING;
    const tint = RENDER3D.BALL_TINT[a.ballTexture] ?? RENDER3D.BALL_TINT.blueBalls;
    a.digits.forEach((d, i) => {
      const ball = createNumberBall(d, tint);
      ball.position.set(-totalW / 2 + i * ENEMY.BALL_SPACING, ENEMY.BALL_OFFSET_Y, 0);
      root.add(ball);
    });

    this.scene.add(root);
    return { root, body, phase: Math.random() * Math.PI * 2 };
  }

  private syncBullets(s: WorldSnapshot): void {
    const seen = new Set<Bullet>();
    for (const b of s.bullets) {
      if (!b.active) continue;
      seen.add(b);
      let m = this.bulletViews.get(b);
      if (!m) {
        m = new THREE.Mesh(
          this.model("bullet", 0, RENDER3D.BULLET_DEPTH).geometry,
          this.glowMaterial,
        );
        this.scene.add(m);
        this.bulletViews.set(b, m);
      }
      m.position.set(toWorldX(b.x), toWorldY(b.y), 0);
    }
    for (const [b, m] of this.bulletViews) {
      if (seen.has(b)) continue;
      this.scene.remove(m);
      this.bulletViews.delete(b);
    }
  }

  private updateDebris(dt: number, delta: number): void {
    this.debris = this.debris.filter((d) => {
      d.age += delta;
      const t = d.age / RENDER3D.DEBRIS_LIFE_MS;
      if (t >= 1) {
        this.scene.remove(d.mesh);
        return false;
      }
      d.mesh.position.addScaledVector(d.vel, dt);
      d.vel.multiplyScalar(1 - 1.8 * dt); // drag
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;
      d.mesh.scale.setScalar(RENDER3D.DEBRIS_SIZE * (1 - t));
      return true;
    });

    this.flashLeft = Math.max(0, this.flashLeft - delta);
    this.flash.intensity = RENDER3D.FLASH_INTENSITY * (this.flashLeft / RENDER3D.FLASH_MS);
  }

  private updateCameraShake(delta: number): void {
    if (this.shakeLeft <= 0) {
      this.camera.position.set(0, 0, this.cameraZ);
      return;
    }
    this.shakeLeft -= delta;
    const k = this.shakeIntensity * (this.shakeLeft / this.shakeDuration);
    this.camera.position.set(
      THREE.MathUtils.randFloatSpread(2) * k * GAME.WIDTH,
      THREE.MathUtils.randFloatSpread(2) * k * GAME.HEIGHT,
      this.cameraZ,
    );
  }

  private clearViews(): void {
    for (const v of this.alienViews.values()) this.scene.remove(v.root);
    this.alienViews.clear();
    for (const m of this.bulletViews.values()) this.scene.remove(m);
    this.bulletViews.clear();
    for (const d of this.debris) this.scene.remove(d.mesh);
    this.debris = [];
    if (this.ship) this.scene.remove(this.ship);
    this.ship = null;
    this.shipBody = null;
    this.shipFlames = [];
    this.flashLeft = 0;
    this.shakeLeft = 0;
  }
}

let instance: World3D | null = null;

/** The page-wide 3D view, created on first use. */
export function getWorld3D(): World3D {
  instance ??= new World3D();
  return instance;
}
