import React, { createContext, useContext, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeviceTrial } from "@/hooks/use-device-trial";
import { getDeviceProfile, setDeviceProfile, setDevicePin, verifyDevicePin } from "@/lib/device-controls.functions";

export type ProfileType = "adult" | "kids";
interface ProfileContextType {
  profile: ProfileType;
  isKids: boolean;
  switchProfile: (target: ProfileType) => Promise<void>;
  hasPin: boolean;
  pin: boolean;
  setParentPin: (pin: string, currentPin?: string) => Promise<void>;
  isPinModalOpen: boolean;
  closePinModal: () => void;
  verifyPinAndSwitch: (inputPin: string) => Promise<boolean>;
}
const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const trial = useDeviceTrial();
  const queryClient = useQueryClient();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const key = ["device-profile", trial.deviceId];
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(trial.deviceId && trial.deviceSecret),
    queryFn: () => getDeviceProfile({ data: { deviceId: trial.deviceId, deviceSecret: trial.deviceSecret } }),
    retry: false,
    staleTime: 30_000,
  });
  const profile: ProfileType = query.data?.profile ?? "kids"; // fail closed while server state is unavailable
  const hasPin = Boolean(query.data?.hasPin);

  const switchProfile = useCallback(async (target: ProfileType) => {
    if (target === "adult" && profile === "kids" && hasPin) {
      setIsPinModalOpen(true);
      return;
    }
    if (!trial.deviceId || !trial.deviceSecret) throw new Error("This device is not registered yet.");
    await setDeviceProfile({ data: { deviceId: trial.deviceId, deviceSecret: trial.deviceSecret, profile: target } });
    await queryClient.invalidateQueries({ queryKey: key });
  }, [profile, hasPin, trial.deviceId, trial.deviceSecret, queryClient]);

  const verifyPinAndSwitch = useCallback(async (inputPin: string) => {
    if (!trial.deviceId || !trial.deviceSecret) return false;
    const result = await verifyDevicePin({ data: { deviceId: trial.deviceId, deviceSecret: trial.deviceSecret, pin: inputPin } });
    if (result.verified) {
      setIsPinModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: key });
      return true;
    }
    return false;
  }, [trial.deviceId, trial.deviceSecret, queryClient]);

  const setParentPin = useCallback(async (value: string, currentPin?: string) => {
    if (!trial.deviceId || !trial.deviceSecret) throw new Error("This device is not registered yet.");
    await setDevicePin({ data: { deviceId: trial.deviceId, deviceSecret: trial.deviceSecret, pin: value ? value : null, ...(currentPin ? { currentPin } : {}) } });
    await queryClient.invalidateQueries({ queryKey: key });
  }, [trial.deviceId, trial.deviceSecret, queryClient]);

  return <ProfileContext.Provider value={{ profile, isKids: profile === "kids", switchProfile, hasPin, pin: hasPin, setParentPin, isPinModalOpen, closePinModal: () => setIsPinModalOpen(false), verifyPinAndSwitch }}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used within a ProfileProvider");
  return context;
}
