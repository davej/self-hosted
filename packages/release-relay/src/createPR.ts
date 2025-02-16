import { BuildEntry, DesktopReleasesJSON, Env } from "./types";

interface DesktopBuildsJSON extends Array<BuildEntry> {}

async function githubRequest<T>(
  env: Env,
  endpoint: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const { GITHUB_TOKEN } = env;
  const baseUrl = "https://api.github.com";
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "ToDesktop Self-Hosted Release Relay",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const responseText = await response.text();
  let responseData;
  try {
    responseData = responseText ? JSON.parse(responseText) : null;
  } catch (e) {
    responseData = responseText;
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API request failed: ${response.status} ${response.statusText} - ${
        responseData?.message || responseText
      } (${endpoint})`
    );
  }

  return responseData as T;
}

export async function createPullRequestForNewBuild(
  buildId: string,
  version: string,
  releaseInfo: DesktopReleasesJSON,
  env: Env
): Promise<void> {
  // 1) Get default branch (and HEAD commit SHA)
  const { defaultBranch, commitSha } = await getDefaultBranchAndCommit(env);
  console.log("Default branch:", defaultBranch);

  // 2) Create a new branch for this release (now captures the actual branch name used)
  const newBranchName = `release-build-${buildId}`;
  const actualBranchName = await createBranch(env, newBranchName, commitSha);
  console.log("Actual branch name:", actualBranchName);
  // 3) Fetch, update and commit desktop-builds.json
  const buildPath = "desktop-builds.json"; // Adjust if you store it elsewhere
  const { content: buildsContent, sha: buildsSha } = await fetchOrCreateFile(
    env,
    buildPath,
    defaultBranch
  );

  console.log("Builds content:", buildsContent);

  const updatedBuildContent = updateDesktopBuilds(buildsContent, {
    id: buildId,
    version,
    createdAt: new Date().toISOString(),
    isReleased: true,
  });

  console.log("Updated builds content:", updatedBuildContent);

  const buildCommitMessage = `Add build ${buildId} (v${version}) to desktop-builds.json`;
  await commitFileChanges(
    env,
    buildPath,
    updatedBuildContent,
    buildsSha,
    buildCommitMessage,
    actualBranchName
  );

  console.log("Committed builds file changes.");

  if (releaseInfo) {
    // 4) Fetch, update and commit desktop-releases.json
    const releasesPath = "desktop-releases.json"; // Adjust if you store it elsewhere
    const { content: releasesContent, sha: releasesSha } =
      await fetchOrCreateFile(env, releasesPath, defaultBranch);

    console.log("Releases content:", releasesContent, releaseInfo);

    const updatedReleasesContent = updateDesktopReleases(
      releasesContent,
      releaseInfo
    );

    console.log("Updated releases content:", updatedReleasesContent);

    const releasesCommitMessage = `Release v${version} in desktop-releases.json`;
    await commitFileChanges(
      env,
      releasesPath,
      updatedReleasesContent,
      releasesSha,
      releasesCommitMessage,
      actualBranchName
    );
  }

  // 5) Open a pull request
  const prTitle = `[release] Add build ${buildId} (v${version})`;
  const prBody = `This PR adds a new build (ID = ${buildId}, version = ${version}) to desktop-builds.json${
    releaseInfo ? ` and releases it in desktop-releases.json` : ""
  }.
  
Please review the changes. Once approved and merged, the staging bucket files will be promoted to production.`;
  await createPullRequest(
    env,
    prTitle,
    prBody,
    actualBranchName,
    defaultBranch
  );
  console.log(`Successfully created PR for build ${buildId}.`);
}

/**
 * GET the default branch and HEAD commit SHA from the repository.
 */
async function getDefaultBranchAndCommit(env: Env): Promise<{
  defaultBranch: string;
  commitSha: string;
}> {
  const { GITHUB_OWNER, GITHUB_REPO } = env;

  const repoData = await githubRequest<{ default_branch: string }>(
    env,
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}`
  );
  const defaultBranch = repoData.default_branch;

  // Next, get the commit SHA for the default branch
  const branchData = await githubRequest<{ object: { sha: string } }>(
    env,
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${defaultBranch}`
  );
  const commitSha = branchData.object.sha;

  return { defaultBranch, commitSha };
}

/**
 * Create a new branch from a given commit SHA.
 * If branch exists, append "-1", "-2", etc. until we find an available name.
 */
async function createBranch(
  env: Env,
  branchName: string,
  baseSha: string
): Promise<string> {
  const { GITHUB_OWNER, GITHUB_REPO } = env;
  let currentBranchName = branchName;
  let counter = 1;

  while (true) {
    try {
      await githubRequest(
        env,
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`,
        {
          method: "POST",
          body: {
            ref: `refs/heads/${currentBranchName}`,
            sha: baseSha,
          },
        }
      );
      console.log(
        `Created branch ${currentBranchName} from commit ${baseSha}.`
      );
      return currentBranchName;
    } catch (error) {
      // 422 means branch already exists
      if (error.message.includes("422")) {
        currentBranchName = `${branchName}-${counter}`;
        counter++;
        continue;
      }
      throw error;
    }
  }
}

/**
 * Fetch a file (e.g. `desktop-builds.json`) from the GitHub repo,
 * parse its content, and return the raw text plus the file's current SHA.
 */
async function fetchFileContent(
  env: Env,
  path: string,
  ref: string
): Promise<{ content: string; sha: string }> {
  const { GITHUB_OWNER, GITHUB_REPO } = env;

  const error404 = () => {
    const err = new Error(
      `File ${path} has no content in the repository.`
    ) as Error & { code: string };
    err.code = "ENOENT";
    return err;
  };

  try {
    const json = await githubRequest<{
      content: string;
      sha: string;
    }>(
      env,
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${ref}`
    );

    if (!json.content) {
      throw error404();
    }

    // Content is base64-encoded
    const decoded = atob(json.content);
    return { content: decoded, sha: json.sha };
  } catch (error) {
    if (error.message.includes("404")) {
      throw error404();
    }
    throw error;
  }
}

/**
 * Fetches a file from GitHub or creates a new one if it doesn't exist
 */
async function fetchOrCreateFile(
  env: Env,
  filePath: string,
  defaultBranch: string,
  defaultContent: string = "[]"
): Promise<{ content: string; sha: string }> {
  try {
    const result = await fetchFileContent(env, filePath, defaultBranch);
    return result;
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`${filePath} not found; creating new file.`);
      return {
        content: defaultContent,
        sha: "",
      };
    }
    throw err;
  }
}

/**
 * Takes the old JSON string, parses it, appends the new build entry,
 * then returns the updated JSON as a string.
 */
function updateDesktopBuilds(oldContent: string, newBuild: BuildEntry): string {
  let data: DesktopBuildsJSON;

  try {
    data = JSON.parse(oldContent);
    if (!Array.isArray(data)) {
      throw new Error("desktop-builds.json is not an array!");
    }
  } catch (err) {
    console.warn("desktop-builds.json invalid or empty; starting new array.");
    data = [];
  }

  data.push(newBuild);

  return JSON.stringify(data, null, 2);
}

function updateDesktopReleases(
  oldContent: string,
  releaseInfo: DesktopReleasesJSON
): string {
  let data: DesktopReleasesJSON;

  try {
    data = JSON.parse(oldContent);
    // check if data is an object
    if (typeof data !== "object" || data === null) {
      throw new Error("desktop-releases.json is not an object!");
    }
  } catch (err) {
    console.warn(
      "desktop-releases.json invalid or empty; starting new object."
    );
    data = {};
  }

  // Create a new object to ensure proper structure
  const updatedData = {
    ...(data || {}),
    ...(releaseInfo.latestReleaseBuildId
      ? { latestReleaseBuildId: releaseInfo.latestReleaseBuildId }
      : {}),
    ...(releaseInfo.releaseRedirections
      ? { releaseRedirections: releaseInfo.releaseRedirections }
      : {}),
  };

  console.log("Updated releases content1:", updatedData);

  return JSON.stringify(updatedData, null, 2);
}

/**
 * Commit changes to a single file on a given branch.
 * If the file doesn't exist, you might omit `baseFileSha`.
 */
async function commitFileChanges(
  env: Env,
  filePath: string,
  fileContent: string,
  baseFileSha: string,
  commitMessage: string,
  branchName: string
): Promise<void> {
  const { GITHUB_OWNER, GITHUB_REPO } = env;

  const json = await githubRequest<{ commit: { sha: string } }>(
    env,
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
    {
      method: "PUT",
      body: {
        message: commitMessage,
        content: btoa(fileContent),
        sha: baseFileSha,
        branch: branchName,
      },
    }
  );

  console.log(
    `Committed file changes to branch ${branchName}. New commit: ${json.commit.sha}`
  );
}

/**
 * Create a PR from `branchName` into `base` (e.g. `main`).
 */
async function createPullRequest(
  env: Env,
  title: string,
  body: string,
  branchName: string,
  baseBranch: string
): Promise<void> {
  const { GITHUB_OWNER, GITHUB_REPO } = env;

  const prInfo = await githubRequest<{
    number: number;
    html_url: string;
  }>(env, `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`, {
    method: "POST",
    body: {
      title,
      head: branchName,
      base: baseBranch,
      body,
    },
  });

  console.log(`Pull request #${prInfo.number} created: ${prInfo.html_url}`);
}
