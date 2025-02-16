export interface Env {
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_TOKEN: string;
  WEBHOOK_HMAC_KEY: string;
  STAGING_R2_BUCKET: R2Bucket;
}

/**
 * Data structure for your build entries in `desktop-builds.json`.
 * Adapt as needed for your real JSON schema.
 */
export interface BuildEntry {
  id: string;
  version: string;
  createdAt?: string;
  isReleased: boolean;
}

export type NewReleaseWebhook = {
  appId: string;
  buildId: string;
  userId: string;
  buildStartedAt: string;
  buildEndedAt: string;
  appName: string;
  appVersion: string;
  appNotarizaionBundleId: string;
  electronVersionUsed: string;
  electronVersionSpecified: string;
  sourcePackageManager: string;
  versionControlInfo: {
    branchName: string;
    commitDate: string;
    commitId: string;
    commitMessage: string;
    hasUncommittedChanges: boolean;
    repositoryRemoteUrl: string;
    versionControlSystemName: string;
  };
  releaseInfo?: DesktopReleasesJSON;
};

export type PlatformName = "windows" | "mac" | "linux";

export type ReleaseRedirection =
  | {
      feedUrl: string;
      ipList: string[];
      rule: "appByIp";
    }
  | {
      buildId: string;
      ipList: string[];
      rule: "buildByIp";
    }
  | {
      buildId: string;
      rule: "build";
    }
  | {
      buildId: string;
      platforms: PlatformName[];
      rule: "buildByPlatform";
    };

export interface DesktopReleasesJSON {
  latestReleaseBuildId?: string;
  releaseRedirections?: ReleaseRedirection[];
}
