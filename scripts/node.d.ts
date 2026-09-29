// The scripts run in Node (vite-node) but the project has no Node types;
// declare the little they use.
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}
declare module "node:fs" {
  export function writeFileSync(path: string, data: string): void;
}
declare module "node:fs" {
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string): Uint8Array;
}
