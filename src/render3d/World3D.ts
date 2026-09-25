import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type Phaser from "phaser";
import { ENEMY, GAME, PLAYER, RENDER3D } from "../config/constants";
import type Alien from "../objects/Alien";
import type { Bullet } from "../objects/Bullet";
import { Shielded } from "../objects/abilities";
import { createNumberBall, setBallCover } from "./NumberBall";
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
  body: THREE.Object3D;
  /** Blender model name, or null when drawn with the sprite-voxel fallback. */
  model: string | null;
  phase: number;
  /** Row origin (the model's socket_balls) and the ball groups built there. */
  ballsAt: THREE.Vector3;
  balls: THREE.Group[];
  /** Alien.sumVersion the balls were built for; a change rebuilds them. */
  sumVersion: number;
  /** ms left of the "new sum" pop-in. */
  popLeft: number;
  /** Model parts named anim_<role>, keyed by role (e.g. "lid", "nucleus_L"). */
  parts: Map<string, THREE.Object3D>;
  /** Shield bubble while a Shielded alien's shield is up. */
  shield: THREE.Group | null;
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
  private readonly ballSockets = new Map<string, THREE.Vector3 | null>();
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
  /** Shared shield geometry/materials, built on first use. */
  private shieldParts: {
    dome: THREE.IcosahedronGeometry;
    edges: THREE.EdgesGeometry;
    ring: THREE.TorusGeometry;
    domeMat: THREE.MeshBasicMaterial;
    edgeMat: THREE.LineBasicMaterial;
    ringMat: THREE.MeshBasicMaterial;
  } | null = null;
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

  /**
   * Start drawing a run. Needs Phaser's textures (to voxelize), its canvas (to
   * align) and the player's ship model (picked on the menu).
   */
  public begin(
    textures: Phaser.Textures.TextureManager,
    phaserCanvas: HTMLCanvasElement,
    shipModel: string,
  ): void {
    this.textures = textures;
    this.phaserCanvas = phaserCanvas;
    this.clearViews();

    this.shipBody = this.instantiate(shipModel) ?? this.voxelShip();
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
    this.syncAliens(s, time, delta);
    this.syncBullets(s);
    this.updateDebris(dt, delta);
    this.updateCameraShake(delta);
    this.renderer.render(this.scene, this.camera);
  }

  /** Burst an alien into voxel debris at logical (x, y). */
  public explode(x: number, y: number, alien?: Alien): void {
    const view = alien && this.alienViews.get(alien);
    const palette = view?.model
      ? (RENDER3D.ALIEN_MODELS[view.model] ?? RENDER3D.ABILITY_MODELS[view.model])
      : alien
        ? this.model(alien.bodyKey, 0, RENDER3D.ALIEN_DEPTH).palette
        : [0xffd166, 0xef476f, 0x4ea1ff];
    this.burst(x, y, palette, RENDER3D.DEBRIS_COUNT);
    this.flash.position.set(toWorldX(x), toWorldY(y), 60);
    this.flashLeft = RENDER3D.FLASH_MS;
  }

  /** Throw `count` voxel debris cubes in `palette` colors out of logical (x, y). */
  private burst(x: number, y: number, palette: readonly number[], count: number): void {
    const wx = toWorldX(x);
    const wy = toWorldY(y);
    const { min, max } = RENDER3D.DEBRIS_SPEED;

    for (let i = 0; i < count; i++) {
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

  private syncAliens(s: WorldSnapshot, time: number, delta: number): void {
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
      this.syncAbility(a, v, time, delta);
    }
    for (const [a, v] of this.alienViews) {
      if (seen.has(a)) continue;
      this.scene.remove(v.root);
      this.alienViews.delete(a);
    }
  }

  /** Mirror an alien's sum and ability state into its view. */
  private syncAbility(a: Alien, v: AlienView, time: number, delta: number): void {
    // A new sum (e.g. a shield broke): rebuild the balls and pop them in.
    if (a.sumVersion !== v.sumVersion) {
      this.buildBalls(a, v);
      v.popLeft = RENDER3D.SUM_POP_MS;
    }
    if (v.popLeft > 0) {
      v.popLeft = Math.max(0, v.popLeft - delta);
      const k = v.popLeft / RENDER3D.SUM_POP_MS;
      v.balls.forEach((b) => b.scale.setScalar(1 + (RENDER3D.SUM_POP_SCALE - 1) * k * k));
    }

    const cover = a.ability?.cover ?? 0;
    for (const b of v.balls) setBallCover(b, cover);
    // The Blinker's own eyelid (pivoted at its top edge) closes with its balls.
    // Blender's Y axis is the glTF node's Z after the Y-up export.
    const lid = v.parts.get("lid");
    if (lid) lid.scale.z = Math.max(0.05, cover);

    // Pulsing parts: nuclei (splitter/splitling) and the shield emitter.
    for (const [role, part] of v.parts) {
      if (role.startsWith("nucleus")) {
        const off = role.endsWith("_L") ? Math.PI : 0;
        part.scale.setScalar(1 + 0.15 * Math.sin(time * 0.006 + off + v.phase));
      }
    }

    const shieldUp = a.ability instanceof Shielded && a.ability.shieldUp;
    const emitter = v.parts.get("emitter");
    if (emitter) emitter.scale.setScalar(shieldUp ? 1 + 0.2 * Math.sin(time * 0.008) : 0.6);
    if (shieldUp && !v.shield) {
      v.shield = this.createShield();
      v.root.add(v.shield);
    } else if (!shieldUp && v.shield) {
      v.root.remove(v.shield);
      v.shield = null;
      this.burst(a.x, a.y, [RENDER3D.SHIELD_COLOR, 0xf5d0ff], RENDER3D.SHIELD_SHARDS);
    }
    if (v.shield) v.shield.scale.setScalar(1 + 0.04 * Math.sin(time * 0.005 + v.phase));
  }

  /**
   * Shield bubble: a faint faceted dome around the body plus a bold ring that
   * reads at phone size. Its radius stays inside the ball row, so it never
   * covers a number. Magenta, never a ball (operation) color.
   */
  private createShield(): THREE.Group {
    const r = RENDER3D.SHIELD_RADIUS;
    if (!this.shieldParts) {
      const dome = new THREE.IcosahedronGeometry(r, 1);
      this.shieldParts = {
        dome,
        edges: new THREE.EdgesGeometry(dome),
        ring: new THREE.TorusGeometry(r, 1.7, 6, 28),
        domeMat: new THREE.MeshBasicMaterial({
          color: RENDER3D.SHIELD_COLOR,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        }),
        edgeMat: new THREE.LineBasicMaterial({
          color: RENDER3D.SHIELD_COLOR,
          transparent: true,
          opacity: 0.55,
        }),
        ringMat: new THREE.MeshBasicMaterial({ color: RENDER3D.SHIELD_COLOR }),
      };
    }
    const p = this.shieldParts;
    return new THREE.Group().add(
      new THREE.Mesh(p.dome, p.domeMat),
      new THREE.LineSegments(p.edges, p.edgeMat),
      new THREE.Mesh(p.ring, p.ringMat),
    );
  }

  private createAlienView(a: Alien): AlienView {
    const root = new THREE.Group();
    // Ability aliens wear their ability's model; others a random monster.
    const loaded = Object.keys(RENDER3D.ALIEN_MODELS).filter((m) => this.gltfModels.has(m));
    const model =
      a.model && this.gltfModels.has(a.model)
        ? a.model
        : loaded.length
          ? loaded[Math.floor(Math.random() * loaded.length)]
          : null;
    let body: THREE.Object3D;
    let ballsAt = new THREE.Vector3(0, ENEMY.BALL_OFFSET_Y, 0);
    const parts = new Map<string, THREE.Object3D>();
    if (model) {
      body = this.instantiate(model)!;
      ballsAt = this.ballSocket(model) ?? ballsAt;
      body.traverse((o) => {
        if (o.name.startsWith("anim_")) parts.set(o.name.slice(5), o);
      });
    } else {
      body = new THREE.Mesh(this.model(a.bodyKey, 0, RENDER3D.ALIEN_DEPTH).geometry, this.litMaterial);
      body.scale.setScalar(ENEMY.SCALE);
    }
    root.add(body);

    const v: AlienView = {
      root,
      body,
      model,
      phase: Math.random() * Math.PI * 2,
      ballsAt,
      balls: [],
      sumVersion: -1,
      popLeft: 0,
      parts,
      shield: null,
    };
    this.buildBalls(a, v);
    this.scene.add(root);
    return v;
  }

  /**
   * Number balls sit in a row above the body and never rotate, so the digits
   * always face the camera and stay readable. Blinker balls get eyelids.
   */
  private buildBalls(a: Alien, v: AlienView): void {
    v.balls.forEach((b) => v.root.remove(b));
    const totalW = (a.digits.length - 1) * ENEMY.BALL_SPACING;
    const tint = RENDER3D.BALL_TINT[a.ballTexture] ?? RENDER3D.BALL_TINT.blueBalls;
    const lids = a.ability?.kind === "blinker" ? RENDER3D.BALL_LID_COLOR : undefined;
    v.balls = a.digits.map((d, i) => {
      const ball = createNumberBall(d, tint, lids);
      ball.position.set(v.ballsAt.x - totalW / 2 + i * ENEMY.BALL_SPACING, v.ballsAt.y, 0);
      v.root.add(ball);
      return ball;
    });
    v.sumVersion = a.sumVersion;
  }

  /** Where a model's `socket_balls` empty sits, in view space (cached per model). */
  private ballSocket(model: string): THREE.Vector3 | null {
    if (!this.ballSockets.has(model)) {
      const probe = this.instantiate(model);
      const socket = probe?.getObjectByName("socket_balls");
      probe?.updateMatrixWorld(true);
      this.ballSockets.set(model, socket ? socket.getWorldPosition(new THREE.Vector3()) : null);
    }
    return this.ballSockets.get(model) ?? null;
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
