import * as THREE from "three";
import type Phaser from "phaser";

/** A voxel mesh built from one sprite frame, plus its colors for debris. */
export interface VoxelModel {
  geometry: THREE.BufferGeometry;
  /** Colors of every solid pixel (hex), so a random pick is frequency-weighted. */
  palette: number[];
}

const ALPHA_CUTOFF = 127;

/**
 * Extrude a pixel-art frame into a voxel mesh: every opaque pixel becomes a
 * 1×1×depth box colored like the pixel. Only faces that are actually exposed
 * are emitted (front/back always, sides only where the neighbour is empty), so a
 * 16×16 sprite stays a few hundred triangles. The model is centered on the
 * origin with +y up; 1 voxel = 1 source pixel, so scale the mesh like the sprite.
 */
export function voxelizeFrame(
  textures: Phaser.Textures.TextureManager,
  key: string,
  frame: number,
  depth: number,
): VoxelModel {
  const f = textures.getFrame(key, frame);
  const w = f.cutWidth;
  const h = f.cutHeight;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, w, h, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;

  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 4 + 3] > ALPHA_CUTOFF;

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const palette: number[] = [];
  const color = new THREE.Color();

  // Corners are given counter-clockwise as seen from outside the face.
  const quad = (corners: number[][], n: [number, number, number]) => {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      positions.push(...corners[i]);
      normals.push(...n);
      colors.push(color.r, color.g, color.b);
    }
  };

  const z0 = -depth / 2;
  const z1 = depth / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      const i = (y * w + x) * 4;
      color.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, THREE.SRGBColorSpace);
      palette.push(color.getHex());

      const x0 = x - w / 2;
      const x1 = x0 + 1;
      const y1 = h / 2 - y; // image rows grow downward; world y grows upward
      const y0 = y1 - 1;

      quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
      quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]);
      if (!solid(x + 1, y))
        quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0]);
      if (!solid(x - 1, y))
        quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]);
      if (!solid(x, y - 1))
        quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0]);
      if (!solid(x, y + 1))
        quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return { geometry, palette };
}
