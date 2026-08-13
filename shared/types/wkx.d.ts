declare module "wkx" {
  export class Geometry {
    static parse(buffer: Buffer): Geometry;
    toGeoJSON(): unknown;
  }
}
