import React, { createContext, useContext, useState } from "react";

export type ProfileType = "main";

interface ProfileContextType {
  profile: ProfileType;
  isKids: boolean;
  switchProfile: (target: string) => void;
  pin: string | null;
  setParentPin: (pin: string) => void;
  isPinModalOpen: boolean;
  closePinModal: () => void;
  verifyPinAndSwitch: (inputPin: string) => boolean;
}

const ProfileContext = createContext<ProfileContextType>({
  profile: "main",
  isKids: false,
  switchProfile: () => {},
  pin: null,
  setParentPin: () => {},
  isPinModalOpen: false,
  closePinModal: () => {},
  verifyPinAndSwitch: () => true,
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  return (
    <ProfileContext.Provider
      value={{
        profile: "main",
        isKids: false,
        switchProfile: () => {},
        pin: null,
        setParentPin: () => {},
        isPinModalOpen: false,
        closePinModal: () => {},
        verifyPinAndSwitch: () => true,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
