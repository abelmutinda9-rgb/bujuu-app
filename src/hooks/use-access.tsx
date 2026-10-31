import { useDeviceTrial } from "./use-device-trial";

export function useAccess() {
  const trial = useDeviceTrial();

  return {
    ready: !trial.isLoading,
    loading: trial.isLoading,
    active: trial.canStream,
    premium: trial.status === "active",
    canStream: trial.canStream,
    status: trial.status,
    daysRemaining: trial.daysRemaining,
    recoveryToken: trial.recoveryToken,
    phone: trial.phone,
    lockedOut: trial.status === "blocked",
    creds: { deviceId: trial.deviceId, deviceSecret: trial.deviceSecret },
    invalidate: trial.refresh,
  };
}

export function useDevice() {
  const trial = useDeviceTrial();
  return {
    creds: { deviceId: trial.deviceId, deviceSecret: trial.deviceSecret },
    ready: !trial.isLoading,
  };
}
