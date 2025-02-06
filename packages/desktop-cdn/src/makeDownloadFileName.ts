export default function makeDownloadFileName(
  objectName: string,
  isDownload?: boolean,
  buildId?: string
): string {
  const isFileRequiredDirectly = isDownload;
  const isBuildIdInRequest = Boolean(buildId);

  const fileName = objectName.split("/").pop();
  if (isFileRequiredDirectly || isBuildIdInRequest) {
    return fileName;
  }

  return removeBuildIdFromFileName(fileName);
}

function removeBuildIdFromFileName(fileName: string) {
  if (fileName.includes("-build-")) {
    return fileName.replace(/-build-\w+-?/, "");
  } else {
    return fileName.replace(/Build \w+-/, "");
  }
}
