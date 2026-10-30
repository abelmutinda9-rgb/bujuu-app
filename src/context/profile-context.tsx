import React, { createContext, useContext, useState } from "react";

export type ProfileType = "adult" | "kids";

interface ProfileContextType {
  profile: ProfileType;
  isKids: boolean;
  switchProfile: (target: ProfileType) => void;
  pin: string | null;
  setParentPin: (pin: string) => void;
  isPinModalOpen: boolean;
  closePinModal: () => void;
  verifyPinAndSwitch: (inputPin: string) => boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<ProfileType>(() => {
    try {
      const saved = localStorage.getItem("bujuu_active_profile");
      return saved === "kids" ? "kids" : "adult";
    } catch {
      return "adult";
    }
  });

  const [pin, setPinState] = useState<string | null>(() => {
    try {
      return localStorage.getItem("bujuu_parent_pin") || null;
    } catch {
      return null;
    }
  });

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const switchProfile = (target: ProfileType) => {
    if (target === "adult" && profile === "kids" && pin) {
      // Require PIN to switch from Kids back to Adult
      setIsPinModalOpen(true);
      return;
    }

    setProfileState(target);
    try {
      localStorage.setItem("bujuu_active_profile", target);
    } catch {}
  };

  const verifyPinAndSwitch = (inputPin: string): boolean => {
    if (!pin || inputPin === pin) {
      setProfileState("adult");
      try {
        localStorage.setItem("bujuu_active_profile", "adult");
      } catch {}
      setIsPinModalOpen(false);
      return true;
    }
    return false;
  };

  const setParentPin = (newPin: string) => {
    setPinState(newPin);
    try {
      if (newPin) {
        localStorage.setItem("bujuu_parent_pin", newPin);
      } else {
        localStorage.removeItem("bujuu_parent_pin");
      }
    } catch {}
  };

  const closePinModal = () => {
    setIsPinModalOpen(false);
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isKids: profile === "kids",
        switchProfile,
        pin,
        setParentPin,
        isPinModalOpen,
        closePinModal,
        verifyPinAndSwitch,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
