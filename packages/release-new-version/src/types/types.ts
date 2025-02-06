export type Artifact = {
  [key: string]: ArtifactDetail | null;
};

export type ArtifactDetail = {
  path: string;
  url: string;
};

export type Artifacts = {
  appx: Artifact | null;
  msi: Artifact | null;
  nsis: Artifact | null;
  "nsis-web": Artifact | null;
  "nsis-web-7z": Artifact | null;
};

export type BuildJSON = {
  artifacts: Artifacts;
  createdAt: string;
  version: string;
};

export type Args = {
  buildId: string;
  mac: boolean;
  linux: boolean;
  windows: boolean;
  help: boolean;
  usePreviousDownload: boolean;
  uploadToLocalR2: boolean;
};

export type Env = {
  DOWNLOAD_CDN_URL: string;
  APP_ID: string;
  BUCKET_NAME: string;
  BUCKET_TYPE: "S3" | "R2";
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  AWS_REGION?: string;
};

export type UploadDetails =
  | {
      provider: "Amazon S3";
      bucket: string;
      region: string;
    }
  | {
      provider: "Cloudflare R2";
      bucket: string;
      cloudflareAccountId: string;
    };
