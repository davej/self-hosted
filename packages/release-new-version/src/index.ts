#!/usr/bin/env node

import axios from "axios";
import fs from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import ora, { Ora } from "ora";
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import inquirer from "inquirer";
import { exec } from "child_process";
import { promisify } from "util";
import type {
  Args,
  BuildJSON,
  Artifacts,
  Env,
  UploadDetails,
} from "./types/types.js";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const execAsync = promisify(exec);

const requiredEnvVars: (keyof Env)[] = [
  "DOWNLOAD_CDN_URL",
  "APP_ID",
  "BUCKET_NAME",
  "BUCKET_TYPE",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(
      `${envVar} is not set. Please set the environment variable.`
    );
  }
}

if (process.env.BUCKET_TYPE === "R2" && !process.env.CLOUDFLARE_ACCOUNT_ID) {
  throw new Error(
    "CLOUDFLARE_ACCOUNT_ID is not set. Please set the environment variable."
  );
}

if (process.env.BUCKET_TYPE === "S3" && !process.env.AWS_REGION) {
  throw new Error(
    "AWS_REGION is not set. Please set the environment variable."
  );
}

async function parseArgs(): Promise<Args> {
  const argv = await yargs(hideBin(process.argv))
    .option("buildId", {
      type: "string",
      description: "Build ID",
      demandOption: true,
    })
    .option("mac", {
      type: "boolean",
      description: "Download Mac assets",
      default: false,
    })
    .option("linux", {
      type: "boolean",
      description: "Download Linux assets",
      default: false,
    })
    .option("windows", {
      type: "boolean",
      description: "Download Windows assets",
      default: false,
    })
    .option("usePreviousDownload", {
      type: "boolean",
      description: "Use the previous download directory, if it exists",
      default: false,
    })
    .option("uploadToLocalR2", {
      type: "boolean",
      description: "Upload to local simulated R2 (via Wrangler)",
      default: false,
    })
    .help()
    .alias("help", "h").argv;

  return {
    buildId: argv.buildId,
    mac: argv.mac,
    linux: argv.linux,
    windows: argv.windows,
    usePreviousDownload: argv.usePreviousDownload,
    uploadToLocalR2: argv.uploadToLocalR2,
    help: argv.help as boolean,
  };
}

function getDownloadDir(appId: string, buildId: string): string {
  return path.normalize(
    path.join(
      process.cwd(),
      "..",
      "..",
      "distributables-for-release",
      appId,
      buildId
    )
  );
}

function emptyDirSync(dir: string) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const filePath = path.join(dir, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        // Recursively remove directories
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        // Remove files
        fs.unlinkSync(filePath);
      }
    });
  }
}

function createDownloadDir(appId: string, buildId: string): string {
  const downloadPath = getDownloadDir(appId, buildId);
  fs.mkdirSync(downloadPath, { recursive: true });
  emptyDirSync(downloadPath);
  return downloadPath;
}

function buildUrls(appId: string, buildId: string): string[] {
  const baseUrl = `https://download.todesktop.com/${appId}`;
  return [
    `${baseUrl}/td-latest-build-${buildId}.json`,
    `${baseUrl}/td-latest-linux-build-${buildId}.json`,
    `${baseUrl}/td-latest-mac-build-${buildId}.json`,
  ];
}

async function downloadFile(
  url: string,
  dest: string,
  spinner: Ora,
  searchString?: string,
  replaceString?: string
): Promise<void> {
  try {
    const isManifest = url.endsWith(".json") || url.endsWith(".yml");

    const response = await axios.get(url, {
      responseType: isManifest ? "text" : "arraybuffer",
    });

    if (isManifest && searchString && replaceString) {
      response.data = response.data.replace(
        new RegExp(searchString, "g"),
        replaceString
      );
    }

    await fs.promises.writeFile(
      dest,
      response.data,
      isManifest ? "utf8" : undefined
    );
  } catch (error) {
    spinner.fail(chalk.red(`Failed to download ${url}: ${error}`));
    throw error;
  }
}

async function fetchJSON(url: string, spinner: Ora): Promise<BuildJSON> {
  try {
    const response = await axios.get<BuildJSON>(url);
    return response.data;
  } catch (error) {
    spinner.fail(chalk.red(`Failed to fetch JSON from ${url}: ${error}`));
    throw error;
  }
}

interface Asset {
  url: string;
  category: string;
}

function extractDownloadUrls(buildJson: BuildJSON): Asset[] {
  const assets: Asset[] = [];

  const artifacts = buildJson.artifacts;
  for (const category in artifacts) {
    const artifactCategory = artifacts[category as keyof Artifacts];
    if (artifactCategory) {
      for (const subKey in artifactCategory) {
        const artifactDetail = artifactCategory[subKey];
        if (artifactDetail && artifactDetail.url) {
          assets.push({ url: artifactDetail.url, category });
        }
      }
    }
  }

  return assets;
}

function buildYmlUrls(appId: string, buildId: string): string[] {
  const baseUrl = `https://download.todesktop.com/${appId}`;
  return [
    `${baseUrl}/latest-build-${buildId}.yml`,
    `${baseUrl}/latest-linux-build-${buildId}.yml`,
    `${baseUrl}/latest-mac-build-${buildId}.yml`,
  ];
}

function getDestinationPath(downloadDir: string, asset: Asset): string {
  // If the asset belongs to 'nsis-web', place it in the 'nsis-web' subdirectory
  if (asset.category === "nsis-web" || asset.category === "nsis-web-7z") {
    const subDir = path.join(downloadDir, "nsis-web");
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
    return path.join(subDir, path.basename(new URL(asset.url).pathname));
  }

  // Place in the main download directory. Replace %20 with spaces.
  return path.join(
    downloadDir,
    path.basename(new URL(asset.url).pathname).replace(/%20/g, " ")
  );
}

async function uploadFileToS3(
  filePath: string,
  bucketName: string,
  key: string,
  s3Client: S3Client
): Promise<void> {
  const fileContent = fs.readFileSync(filePath);

  const params: PutObjectCommandInput = {
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
  };

  const command = new PutObjectCommand(params);

  try {
    await s3Client.send(command);
  } catch (error) {
    console.log((error as any)?.$response);
    throw new Error(
      `Failed to upload ${filePath} to S3: ${error} ${
        (error as any)?.$response
      }`
    );
  }
}

// Function to recursively get all files in a directory
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function download(args: Args, spinner: Ora) {
  const downloadDir = createDownloadDir(process.env.APP_ID, args.buildId);
  spinner.succeed(chalk.green(`Download directory created at ${downloadDir}`));

  const jsonUrls = buildUrls(process.env.APP_ID, args.buildId);

  // Apply platform filters
  let filteredJsonUrls = jsonUrls;
  if (args.mac || args.linux || args.windows) {
    filteredJsonUrls = jsonUrls.filter((url) => {
      if (args.mac && url.includes("mac")) return true;
      if (args.linux && url.includes("linux")) return true;
      if (args.windows && !url.includes("mac") && !url.includes("linux"))
        return true;
      return false;
    });
  }

  // Download JSON files
  for (const url of filteredJsonUrls) {
    const fileName = path.basename(url);
    const dest = path.join(downloadDir, fileName);

    spinner.start(`Downloading JSON file: ${fileName}`);
    await downloadFile(
      url,
      dest,
      spinner,
      `https://download.todesktop.com/${process.env.APP_ID}`,
      process.env.DOWNLOAD_CDN_URL.replace(/\/$/, "")
    );
    spinner.succeed(chalk.green(`Downloaded ${fileName}`));
  }

  // Process each JSON file
  for (const url of filteredJsonUrls) {
    const fileName = path.basename(url);

    spinner.start(`Parsing JSON file: ${fileName}`);
    const buildJson = await fetchJSON(url, spinner);
    spinner.succeed(chalk.green(`Parsed ${fileName}`));

    // Extract URLs along with their categories
    const assets = extractDownloadUrls(buildJson);

    // Apply platform filters to asset URLs
    let filteredAssets = assets;
    if (args.mac || args.linux || args.windows) {
      filteredAssets = assets.filter((asset) => {
        const assetUrlLower = asset.url.toLowerCase();
        if (args.mac && assetUrlLower.includes("mac")) return true;
        if (args.linux && assetUrlLower.includes("linux")) return true;
        if (args.windows && assetUrlLower.endsWith(".exe")) return true;
        return false;
      });
    }

    // Download assets
    for (const asset of filteredAssets) {
      const assetDest = getDestinationPath(downloadDir, asset);

      spinner.start(`Downloading asset: ${path.basename(assetDest)}`);
      await downloadFile(asset.url, assetDest, spinner);
      spinner.succeed(chalk.green(`Downloaded ${path.basename(assetDest)}`));
    }
  }

  // Download additional YML files
  const ymlUrls = buildYmlUrls(process.env.APP_ID, args.buildId);

  // Apply platform filters
  let filteredYmlUrls = ymlUrls;
  if (args.mac || args.linux || args.windows) {
    filteredYmlUrls = ymlUrls.filter((url) => {
      if (args.mac && url.includes("mac")) return true;
      if (args.linux && url.includes("linux")) return true;
      if (args.windows && !url.includes("mac") && !url.includes("linux"))
        return true;
      return false;
    });
  }

  for (const url of filteredYmlUrls) {
    const fileName = path.basename(url);
    // `latest[-linux|-mac].yml`
    const latestFileName = fileName.replace(`-build-${args.buildId}`, "");
    const dest = path.join(downloadDir, fileName);
    const destToCopy = path.join(downloadDir, latestFileName);

    spinner.start(`Downloading YML file: ${fileName}`);
    await downloadFile(url, dest, spinner);
    // extract version number from first line of yaml
    spinner.succeed(chalk.green(`Downloaded ${fileName}`));
    fs.copyFileSync(dest, destToCopy);
    const version = fs.readFileSync(dest, "utf8").split("\n")[0].split(" ")[1];
    const destVersionToCopy = path.join(
      downloadDir,
      latestFileName.replace(".yml", `-${version}.yml`)
    );
    fs.copyFileSync(dest, destVersionToCopy);
    spinner.succeed(chalk.green(`Copied ${fileName} to ${latestFileName}`));
  }

  for (const url of filteredJsonUrls) {
    const fileName = path.basename(url);
    // `td-latest[-linux|-mac].json`
    const latestFileName = fileName.replace(`-build-${args.buildId}`, "");
    const existingFile = path.join(downloadDir, fileName);
    const destToCopy = path.join(downloadDir, latestFileName);

    fs.copyFileSync(existingFile, destToCopy);

    // extract version number from json
    const version = JSON.parse(fs.readFileSync(existingFile, "utf8")).version;
    const destVersionToCopy = path.join(
      downloadDir,
      latestFileName.replace(".json", `-${version}.json`)
    );
    fs.copyFileSync(existingFile, destVersionToCopy);
    spinner.succeed(chalk.green(`Copied ${fileName} to ${latestFileName}`));
  }

  console.log(chalk.blue.bold("\nAll downloads completed successfully!"));

  // Prompt user to confirm upload to S3/R2
  const allFiles = getAllFiles(downloadDir);
  console.log(
    chalk.yellow(
      `\nYou have downloaded ${allFiles.length} files to ${downloadDir}.`
    )
  );
}

async function upload(args: Args, downloadDir: string) {
  let uploadDetails: UploadDetails | undefined;

  const uploadConfirm = await inquirer.prompt([
    {
      type: "confirm",
      name: "upload",
      message:
        "Do you want to upload these assets to your bucket? Please inspect the files before confirming.",
      default: false,
    },
  ]);

  if (!uploadConfirm.upload) {
    console.log(chalk.blue("Upload step skipped."));
    return;
  }

  uploadDetails = {
    provider: process.env.BUCKET_TYPE === "S3" ? "Amazon S3" : "Cloudflare R2",
    bucket: process.env.BUCKET_NAME,
    region: process.env.AWS_REGION,
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  };
  const { provider, bucket } = uploadDetails;
  const region = "region" in uploadDetails ? uploadDetails.region : undefined;
  const cloudflareAccountId =
    "cloudflareAccountId" in uploadDetails
      ? uploadDetails.cloudflareAccountId
      : undefined;

  const s3Client = new S3Client({
    region: provider === "Amazon S3" ? region : "auto",
    endpoint:
      provider === "Cloudflare R2"
        ? `https://${cloudflareAccountId}.r2.cloudflarestorage.com`
        : undefined,
    forcePathStyle: provider === "Cloudflare R2" ? true : false, // Required for R2
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });

  const uploadSpinner = ora("Uploading assets to S3/R2...").start();

  try {
    const allFiles = getAllFiles(downloadDir);
    for (const filePath of allFiles) {
      const relativePath = path
        .relative(downloadDir, filePath)
        .replace(/\\/g, "/");
      const key = relativePath;

      await uploadFileToS3(filePath, bucket, key, s3Client);
      uploadSpinner.text = `Uploaded: ${relativePath}`;
    }

    uploadSpinner.succeed(
      chalk.green(`All assets have been uploaded to ${provider}.`)
    );
  } catch (error) {
    uploadSpinner.fail(chalk.red("Failed to upload assets to S3/R2."));
    console.error(error);
    process.exit(1);
  }
}

async function populateWranglerR2(downloadDir) {
  const { shouldPopulate } = await inquirer.prompt([
    {
      type: "confirm",
      name: "shouldPopulate",
      message:
        "Do you want to populate the local simulated R2 with these distributables? (uses Wrangler)",
      default: false,
    },
  ]);

  if (!shouldPopulate) {
    console.log(chalk.blue("Skipping local simulated R2 population."));
    return;
  }

  const spinner = ora(
    "Populating local simulated R2 with test distributables..."
  ).start();

  try {
    // Read all files in the distributables directory
    const files = fs.readdirSync(downloadDir);

    for (const filename of files) {
      const filePath = path.join(downloadDir, filename);
      const command = `wrangler r2 object put "desktop-app-distributables/${filename}" --local --file "${filePath}"`;

      spinner.text = `Uploading ${filename} to local desktop-cdn R2 via Wrangler...`;
      await execAsync(command, {
        cwd: path.join(__dirname, "..", "..", "desktop-cdn"),
        env: {
          ...process.env,
          PATH: `${process.env.PATH}:${path.join(
            __dirname,
            "..",
            "..",
            "node_modules",
            ".bin"
          )}`,
        },
      });
      spinner.text = `Uploading ${filename} to local desktop-download-cdn R2 via Wrangler...`;
      await execAsync(command, {
        cwd: path.join(__dirname, "..", "..", "desktop-download-cdn"),
        env: {
          ...process.env,
          PATH: `${process.env.PATH}:${path.join(
            __dirname,
            "..",
            "..",
            "node_modules",
            ".bin"
          )}`,
        },
      });
    }

    spinner.succeed(
      chalk.green(
        "Successfully populated local simulated R2 with test distributables"
      )
    );
  } catch (error) {
    spinner.fail(chalk.red("Error uploading files to local simulated R2"));
    console.error(error);
    throw error;
  }
}

async function main() {
  const args = await parseArgs();

  const spinner = ora("Initializing...").start();

  try {
    const downloadDir = getDownloadDir(process.env.APP_ID, args.buildId);
    if (args.usePreviousDownload && !fs.existsSync(downloadDir)) {
      throw new Error(
        `Previous download directory ${downloadDir} does not exist. Cannot use --usePreviousDownload flag.`
      );
    }
    if (!args.usePreviousDownload) {
      await download(args, spinner);
    }

    spinner.stop();
    if (args.uploadToLocalR2) {
      await populateWranglerR2(downloadDir);
      return;
    }
    await upload(args, downloadDir);
  } catch (error) {
    spinner.fail(chalk.red("An error occurred during the download process."));
    console.error(error);
    process.exit(1);
  }
}

main();
