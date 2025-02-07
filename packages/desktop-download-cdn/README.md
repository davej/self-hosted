# Desktop Download CDN

A CDN service for managing and serving desktop application downloads.

## Available Routes

### Universal Route

- `/`

This route will serve the latest version of the application and use the user agent to determine the platform and architecture.
NOTE: it's not possible to determine the architecture from the user agent on macOS, so it will default to `x64` if a universal installer is not available.

### Latest Version Routes

- `/:platform/:artifactName/:arch`
- `/:platform/:artifactName`
- `/:platform`

These routes will serve the latest version of the application. The parameters are the same as above, but they will always return the most recent release.

### Version-based Routes

- `/versions/:appVersion/:platform/:artifactName/:arch`
- `/versions/:appVersion/:platform/:artifactName`
- `/versions/:appVersion/:platform`
- `/versions/:appVersion`

These routes allow downloading specific versions of the application. The parameters are:

- `appVersion`: The version number of the application (e.g., "1.2.3")
- `platform`: The operating system (e.g., "windows", "mac", "linux")
- `artifactName`: The name of the artifact to download (e.g., "nsis", "dmg", "appimage")
- `arch`: (Optional) The CPU architecture (e.g., "x64", "arm64")

### Build-based Routes

- `/builds/:buildId/:platform/:artifactName/:arch`
- `/builds/:buildId/:platform/:artifactName`
- `/builds/:buildId/:platform`
- `/builds/:buildId`

These routes allow downloading specific builds of the application. The parameters are:

- `buildId`: The unique identifier for the build
- Other parameters are the same as version-based routes

## Examples

### Download the latest Windows installer

`/windows`

### Download version 1.2.3 for Mac ARM

`/versions/1.2.3/mac/arm64`

### Download a specific build for Linux

`/builds/12345/linux/appimage/x64`
