export interface DeviceStatus {
  deviceId: string;
  status: "trial" | "active" | "expired" | "blocked";
  canStream: boolean;
  daysRemaining: number;
  trialEndsAt?: string;
  subscriptionExpiresAt?: string;
  phone?: string;
  recoveryToken?: string;
}

export function getNativeDeviceId(): string {
  return "bujuu_device_free";
}

export function useDeviceTrial() {
  return {
    deviceId: "bujuu_device_free",
    status: "active" as const,
    canStream: true,
    daysRemaining: 9999,
    trialEndsAt: undefined,
    subscriptionExpiresAt: undefined,
    recoveryToken: undefined,
    phone: undefined,
    isLoading: false,
    refresh: () => Promise.resolve(),
    confirmPayment: async () => ({ success: true }),
    transferSubscription: async () => ({ success: true }),
    transferViaGoogleAccount: async () => ({ success: true }),
  };
}
