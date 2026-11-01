import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ProfileType = "adult" | "kids";

interface ProfileContextType {
  profile: ProfileType;
  isKids: boolean;
  switchProfile: (target: ProfileType) => void;
  hasPin: boolean;
  setParentPin: (pin: string) => Promise<void>;
  isPinModalOpen: boolean;
  closePinModal: () => void;
  verifyPinAndSwitch: (inputPin: string) => Promise<boolean>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const PIN_SALT = "bujuu_salt_parental_v2_";

async function sha256Hex(text: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    // Basic fallback hash for non-standard environments
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(PIN_SALT + text);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<ProfileType>(() => {
    try {
      const saved = localStorage.getItem("bujuu_active_profile");
      return saved === "kids" ? "kids" : "adult";
    } catch {
      return "adult";
    }
  });

  const [pinHash, setPinHash] = useState<string | null>(() => {
    try {
      // Migrate old plaintext pin if found
      const oldPlain = localStorage.getItem("bujuu_parent_pin");
      if (oldPlain && oldPlain.length === 4) {
        localStorage.removeItem("bujuu_parent_pin");
        // We will hash it shortly
      }
      return localStorage.getItem("bujuu_parent_pin_hash") || null;
    } catch {
      return null;
    }
  });

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  useEffect(() => {
    // If an old plaintext PIN is in storage, convert to hash immediately
    try {
      const oldPlain = localStorage.getItem("bujuu_parent_pin");
      if (oldPlain && /^[0-9]{4}$/.test(oldPlain)) {
        localStorage.removeItem("bujuu_parent_pin");
        sha256Hex(oldPlain).then((hashed) => {
          localStorage.setItem("bujuu_parent_pin_hash", hashed);
          setPinHash(hashed);
        });
      }
    } catch {}
  }, []);

  const switchProfile = useCallback((target: ProfileType) => {
    if (target === "adult" && profile === "kids" && pinHash) {
      // Require PIN to switch from Kids back to Adult
      setIsPinModalOpen(true);
      return;
    }

    setProfileState(target);
    try {
      localStorage.setItem("bujuu_active_profile", target);
    } catch {}
  }, [profile, pinHash]);

  const verifyPinAndSwitch = useCallback(async (inputPin: string): Promise<boolean> => {
    if (!pinHash) {
      setProfileState("adult");
      try {
        localStorage.setItem("bujuu_active_profile", "adult");
      } catch {}
      setIsPinModalOpen(false);
      return true;
    }

    const hashedInput = await sha256Hex(inputPin);
    if (hashedInput === pinHash) {
      setProfileState("adult");
      try {
        localStorage.setItem("bujuu_active_profile", "adult");
      } catch {}
      setIsPinModalOpen(false);
      return true;
    }
    return false;
  }, [pinHash]);

  const setParentPin = useCallback(async (newPin: string) => {
    if (!newPin || newPin.trim() === "") {
      setPinHash(null);
      try {
        localStorage.removeItem("bujuu_parent_pin_hash");
        localStorage.removeItem("bujuu_parent_pin");
      } catch {}
      return;
    }

    const hashed = await sha256Hex(newPin.trim());
    setPinHash(hashed);
    try {
      localStorage.setItem("bujuu_parent_pin_hash", hashed);
      localStorage.removeItem("bujuu_parent_pin");
    } catch {}
  }, []);

  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false);
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isKids: profile === "kids",
        switchProfile,
        hasPin: Boolean(pinHash),
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
