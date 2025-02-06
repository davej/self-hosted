import { PlatformName, supportedPlatforms } from "../types";

function includes<T extends U, U>(coll: ReadonlyArray<T>, el: U): el is T {
  return coll.includes(el as T);
}

export function isSupportedPlatform(
  platform: string
): platform is PlatformName {
  return includes(supportedPlatforms, platform);
}
