export function useAccess() {
  return {
    ready: true,
    loading: false,
    active: true,
    premium: true,
    canStream: true,
    status: "active" as const,
    daysRemaining: 9999,
    recoveryToken: undefined,
    phone: undefined,
    lockedOut: false,
    creds: { deviceId: "bujuu_guest", deviceSecret: "bujuu_device" },
    invalidate: () => {},
  };
}

export function useDevice() {
  return {
    creds: { deviceId: "bujuu_guest", deviceSecret: "bujuu_device" },
    ready: true,
  };
}
