import * as THREE from "three";
import { RENDER3D } from "../config/constants";

/**
 * A number ball: a glass sphere with its digit floating inside.
 *
 * The digit is a camera-facing plane textured from a canvas (crisp at any size,
 * no font geometry). The sphere is a cheap custom "glass" shader: nearly clear
 * in the middle so the digit reads, tinted and bright at the rim (fresnel), plus
 * one baked specular highlight. It ignores scene lights on purpose, so balls
 * always read the same and cost no lighting math — important on phones.
 *
 * Kept as its own Group so future variants (lids that open/close like an eye to
 * hide the number, monsters built out of balls) can attach parts to it.
 */

const SPHERE_SEGMENTS = { width: 20, height: 14 };

const digitMaterials = new Map<number, THREE.MeshBasicMaterial>();
const glassMaterials = new Map<number, THREE.ShaderMaterial>();
let sphereGeometry: THREE.SphereGeometry | null = null;
let digitGeometry: THREE.PlaneGeometry | null = null;

function digitMaterial(n: number): THREE.MeshBasicMaterial {
  let mat = digitMaterials.get(n);
  if (mat) return mat;

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const label = String(n);
  ctx.font = `bold ${label.length > 1 ? 38 : 50}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Dark outline keeps the digit legible against the tinted glass.
  ctx.lineJoin = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(5, 6, 15, 0.85)";
  ctx.strokeText(label, size / 2, size / 2 + 3);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, size / 2, size / 2 + 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  digitMaterials.set(n, mat);
  return mat;
}

function glassMaterial(tint: number): THREE.ShaderMaterial {
  let mat = glassMaterials.get(tint);
  if (mat) return mat;
  mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(tint) } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec3 n = normalize(vNormal);
        float rim = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 2.0);
        float spec = pow(max(dot(n, normalize(vec3(-0.45, 0.6, 0.66))), 0.0), 36.0);
        vec3 color = uColor * (0.85 + 0.7 * rim) + vec3(spec);
        float alpha = clamp(0.34 + 0.66 * rim + spec, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  glassMaterials.set(tint, mat);
  return mat;
}

/**
 * Build one ball showing `n`, tinted by its math operation. Centered on the
 * origin. With `lidColor` it gets two eyelids (see setBallCover).
 */
export function createNumberBall(n: number, tint: number, lidColor?: number): THREE.Group {
  const r = RENDER3D.BALL_RADIUS;
  sphereGeometry ??= new THREE.SphereGeometry(r, SPHERE_SEGMENTS.width, SPHERE_SEGMENTS.height);
  digitGeometry ??= new THREE.PlaneGeometry(r * 1.6, r * 1.6);

  // Digit first, glass second: both are transparent, so renderOrder decides.
  const digit = new THREE.Mesh(digitGeometry, digitMaterial(n));
  digit.renderOrder = 1;
  const glass = new THREE.Mesh(sphereGeometry, glassMaterial(tint));
  glass.renderOrder = 2;

  const ball = new THREE.Group();
  ball.add(digit, glass);
  if (lidColor !== undefined) addLids(ball, lidColor);
  setBallCover(ball, 0);
  return ball;
}

const lidMaterials = new Map<number, THREE.MeshStandardMaterial>();
let lidGeometry: THREE.SphereGeometry | null = null;

/**
 * Eyelids: two opaque hemispherical shells just outside the glass, hinged on
 * the ball's horizontal axis. Open, they rest tilted back behind the ball (their
 * inner faces are culled, so only a thin rim shows at the top and bottom edge);
 * closing swings the upper lid down and the lower lid up until they meet.
 */
function addLids(ball: THREE.Group, color: number): void {
  lidGeometry ??= new THREE.SphereGeometry(
    RENDER3D.BALL_RADIUS * 1.12,
    16,
    6,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2, // the +Y hemisphere
  );
  let mat = lidMaterials.get(color);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true });
    lidMaterials.set(color, mat);
  }
  const upper = new THREE.Group().add(new THREE.Mesh(lidGeometry, mat));
  const lowerShell = new THREE.Mesh(lidGeometry, mat);
  lowerShell.rotation.z = Math.PI; // the -Y hemisphere
  const lower = new THREE.Group().add(lowerShell);
  upper.name = "lid_upper";
  lower.name = "lid_lower";
  ball.add(upper, lower);
}

/** Close a ball's lids: 0 = open (number readable) … 1 = shut. No-op without lids. */
export function setBallCover(ball: THREE.Object3D, cover: number): void {
  const angle = RENDER3D.BALL_LID_OPEN_ANGLE * (1 - cover);
  const upper = ball.getObjectByName("lid_upper");
  const lower = ball.getObjectByName("lid_lower");
  // Rotating about X by -a tips the upper shell's pole (+Y) away from the camera.
  if (upper) upper.rotation.x = -angle;
  if (lower) lower.rotation.x = angle;
}
