# release-new-version

A CLI tool to download and release new versions of your ToDesktop application to your CDN.

## Getting Started

1. Copy `.env.template` to `.env` and fill in the required environment variables:

   ```bash
   cp .env.template .env
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the CLI (the `--` syntax is required between the script name and the arguments):
   ```bash
   npm run release-desktop -- --buildId <your-build-id>
   ```

## Command-Line Arguments

- `--buildId` (required): The ToDesktop build ID to download and release
- `--mac`: Download only Mac assets
- `--linux`: Download only Linux assets
- `--windows`: Download only Windows assets
- `--usePreviousDownload`: Use previously downloaded files instead of downloading again
- `--uploadToLocalR2`: Upload to local simulated R2 (via Wrangler) for testing
- `--help`: Show help information

If none of `--mac`, `--linux`, or `--windows` are specified, all platform assets will be downloaded.

## Examples

Download all assets for a specific build and optionally upload it to your R2 bucket as a release:

```bash
npm run release-desktop -- --buildId 24092644c4nvko7
```

Download only Windows assets:

```bash
npm run release-desktop -- --buildId 24092644c4nvko7 --windows
```

Download Mac and Linux assets:

```bash
npm run release-desktop -- --buildId 24092644c4nvko7 --mac --linux
```

Use previously downloaded files and upload to the simulated local R2 (useful for local testing using Wrangler):

```bash
npm run release-desktop -- --buildId 24092644c4nvko7 --usePreviousDownload --uploadToLocalR2
```

## Directory Structure

After executing the CLI, the downloaded files will be organized as follows:

```
distributables-for-release/
│ └── 240113mzl4weu91/
│     └── 24092644c4nvko7/
│         ├── td-latest-build-24092644c4nvko7.json
│         ├── td-latest-linux-build-24092644c4nvko7.json
│         ├── td-latest-mac-build-24092644c4nvko7.json
│         ├── td-latest.json
│         ├── td-latest-linux.json
│         ├── td-latest-mac.json
│         ├── td-latest-0.41.4.json
│         ├── td-latest-linux-0.41.4.json
│         ├── td-latest-mac-0.41.4.json
│         ├── My App Setup 0.41.4 - Build 24092644c4nvko7-arm64.exe
│         ├── My App Setup 0.41.4 - Build 24092644c4nvko7.exe
│         ├── My App Setup 0.41.4 - Build 24092644c4nvko7-x64.exe
│         ├── nsis-web/
│         │   ├── My App Setup 0.41.4 - Build 24092644c4nvko7-arm64.exe
│         │   ├── My App Setup 0.41.4 - Build 24092644c4nvko7.exe
│         │   └── My App Setup 0.41.4 - Build 24092644c4nvko7-x64.exe
│         ├── nsis-web-7z/
│         │   ├── My App-0.41.4-arm64.nsis.7z
│         │   └── My App-0.41.4-x64.nsis.7z
│         ├── latest-build-24092644c4nvko7.yml
│         ├── latest-linux-build-24092644c4nvko7.yml
│         ├── latest-mac-build-24092644c4nvko7.yml
│         ├── latest.yml
│         ├── latest-linux.yml
│         ├── latest-mac.yml
│         ├── latest-0.41.4.yml
│         ├── latest-linux-0.41.4.yml
│         ├── latest-mac-0.41.4.yml
```

- **`distributables-for-release/{appId}/{buildId}/`**: Main directory containing all downloaded assets.
  - **`nsis-web/`**: Subdirectory for `"nsis-web"` category assets.
  - **`nsis-web-7z/`**: Subdirectory for `"nsis-web-7z"` category assets.
  - **JSON and YML Files**: Metadata and configuration files related to the build.

## License

This project is licensed under the MIT License. You are free to use, modify, and distribute it as per the license terms.
