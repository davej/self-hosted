export interface DownloadParams {
  appVersion?: string;
  arch?: Arch;
  artifactName?: string;
  buildId?: string;
  platform?: PlatformName;
}

export interface Env {
  R2_BUCKET: R2Bucket; // R2 client instance
}

export const supportedPlatforms = ["linux", "mac", "windows"] as const;
export type PlatformName = (typeof supportedPlatforms)[number];

export const supportedArchs = ["ia32", "x64", "arm64", "universal"] as const;
export type Arch = (typeof supportedArchs)[number];

export class HTTPError extends Error {
  responseCode: number;

  constructor(responseCode: number, message?: string) {
    // Call the parent constructor (Error) with the provided message
    super(message);

    // Set the responseCode property
    this.responseCode = responseCode || 500;

    // Set the prototype explicitly, to ensure instanceof works correctly
    Object.setPrototypeOf(this, new.target.prototype);

    // Set the name property to the name of the class
    this.name = this.constructor.name;
  }
}
