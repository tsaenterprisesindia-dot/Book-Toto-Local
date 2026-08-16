const NATIVE_API = 'http://10.201.57.168:5000';

function isNative() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
}

export function apiBase() {
  if (isNative()) return NATIVE_API;
  return '';
}

export function socketBase() {
  if (isNative()) return { url: NATIVE_API, options: { transports: ['websocket'] } };
  return { url: undefined, options: {} };
}
