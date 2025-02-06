import { Arch } from './types';

// Detect Mac architecture based on MacOS version.
export default (
  userAgent: string
): {
  arch: Arch;
  isMacInstallerSupported: boolean;
} => {
  const isARMCompatibleMacOSVersion =
    // MacOS 10.15 does not support ARM (M1) but sometimes MacOS 10 and MacOS 11
    // identify themselves as 10.15.
    // More info here: https://bugs.webkit.org/show_bug.cgi?id=216593

    // Safari/Chrome style UA
    userAgent.includes('Mac OS X 10_15') ||
    // Firefox style UA
    userAgent.includes('Mac OS X 10.15') ||
    userAgent.includes('Mac OS X 11') ||
    userAgent.includes('Mac OS X 12') ||
    // Future macOS versions so we don't get caught out.
    userAgent.includes('Mac OS X 13') ||
    userAgent.includes('Mac OS X 14') ||
    userAgent.includes('Mac OS X 15');

  if (isARMCompatibleMacOSVersion) {
    // MacOS 11 and later support M1 (ARM) so we need to serve a universal installer.
    return {
      arch: 'universal',
      isMacInstallerSupported: true,
    };
  }
  // If the version is earlier than MacOS 11 then the OS does not support M1
  // so we can safely return `x64`.
  return {
    arch: 'x64',
    isMacInstallerSupported: false,
  };
};
