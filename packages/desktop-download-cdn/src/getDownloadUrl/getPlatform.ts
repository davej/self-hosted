import * as parseUserAgent from "express-useragent";
import { isSupportedPlatform } from "./isSupportedPlatform";
import { PlatformName } from "../types";

// Get / detect platform
export default ({
  desired,
  userAgent,
}: {
  desired?: string;
  userAgent: string;
}): PlatformName => {
  if (desired && isSupportedPlatform(desired)) {
    return desired as PlatformName;
  }

  const { isChromeOS, isMac, isWindows, isLinux } =
    parseUserAgent.parse(userAgent);

  if (isMac) {
    return "mac";
  } else if (isWindows) {
    return "windows";
  } else if (isChromeOS || isLinux) {
    return "linux";
  }

  return "windows"; // Default to Windows
};
