export interface DetectedClientDevice {
  formFactor: 'laptop' | 'desktop' | 'mobile' | 'tablet';
  os: 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'other';
  osDisplayName: string;
  browser: string;
  fullDeviceName: string;
}

export function detectClientDevice(userAgent = ''): DetectedClientDevice {
  const ua = (userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();

  // Detect OS
  let os: 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'other' = 'other';
  let osDisplayName = 'Unknown OS';

  if (ua.includes('win')) {
    os = 'windows';
    osDisplayName = 'Windows';
  } else if (ua.includes('macintosh') || (ua.includes('mac os') && !ua.includes('iphone') && !ua.includes('ipad'))) {
    os = 'macos';
    osDisplayName = 'macOS';
  } else if (ua.includes('iphone')) {
    os = 'ios';
    osDisplayName = 'iOS (iPhone)';
  } else if (ua.includes('ipad')) {
    os = 'ios';
    osDisplayName = 'iPadOS (iPad)';
  } else if (ua.includes('android')) {
    os = 'android';
    osDisplayName = 'Android';
  } else if (ua.includes('linux')) {
    os = 'linux';
    osDisplayName = 'Linux';
  }

  // Detect Form Factor
  let formFactor: 'laptop' | 'desktop' | 'mobile' | 'tablet' = 'laptop';
  if (os === 'ios') {
    formFactor = ua.includes('ipad') ? 'tablet' : 'mobile';
  } else if (os === 'android') {
    formFactor = ua.includes('mobile') ? 'mobile' : 'tablet';
  } else if (os === 'windows' || os === 'macos' || os === 'linux') {
    // Check battery API availability or touch points
    const hasTouch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0;
    formFactor = hasTouch ? 'laptop' : 'desktop';
  }

  // Detect Browser
  let browser = 'Browser';
  if (ua.includes('edg/')) {
    browser = 'Microsoft Edge';
  } else if (ua.includes('chrome') && !ua.includes('chromium')) {
    browser = 'Google Chrome';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Apple Safari';
  } else if (ua.includes('firefox')) {
    browser = 'Mozilla Firefox';
  } else if (ua.includes('opr/') || ua.includes('opera')) {
    browser = 'Opera';
  }

  const fullDeviceName = `${osDisplayName} ${formFactor === 'mobile' ? 'Mobile' : formFactor === 'tablet' ? 'Tablet' : 'PC'} (${browser})`;

  return {
    formFactor,
    os,
    osDisplayName,
    browser,
    fullDeviceName,
  };
}
