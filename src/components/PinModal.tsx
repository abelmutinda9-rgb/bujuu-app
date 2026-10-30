import React, { useState, useEffect } from "react";
import { Lock, X, Delete } from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { toast } from "sonner";

export function PinModal() {
  const { isPinModalOpen, closePinModal, verifyPinAndSwitch } = useProfile();
  const [pinDigits, setPinDigits] = useState<string[]>([]);

  useEffect(() => {
    if (!isPinModalOpen) {
      setPinDigits([]);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        appendDigit(e.key);
      } else if (e.key === "Backspace") {
        removeDigit();
      } else if (e.key === "Escape") {
        closePinModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPinModalOpen, pinDigits]);

  if (!isPinModalOpen) return null;

  const appendDigit = (digit: string) => {
    if (pinDigits.length < 4) {
      const next = [...pinDigits, digit];
      setPinDigits(next);
      if (next.length === 4) {
        const fullPin = next.join("");
        setTimeout(() => {
          const success = verifyPinAndSwitch(fullPin);
          if (!success) {
            toast.error("Incorrect PIN. Please try again.");
            setPinDigits([]);
          } else {
            toast.success("Switched to Adult profile");
          }
        }, 150);
      }
    }
  };

  const removeDigit = () => {
    setPinDigits((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="w-full max-w-xs rounded-3xl border border-zinc-800 bg-zinc-900/95 p-6 shadow-2xl text-center space-y-6">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">
            Parental Lock
          </span>
          <button
            onClick={closePinModal}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Enter Parent PIN</h3>
          <p className="text-xs text-zinc-400">
            Enter 4-digit code to switch from Kids to Adult profile
          </p>
        </div>

        {/* PIN Dots */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all ${
                i < pinDigits.length
                  ? "bg-rose-500 border-rose-500 scale-110"
                  : "border-zinc-700 bg-zinc-800"
              }`}
            />
          ))}
        </div>

        {/* Numeric keypad for Touch and TV remote navigation */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              tabIndex={0}
              onClick={() => appendDigit(num)}
              className="h-12 rounded-xl bg-zinc-800/80 text-lg font-bold text-white hover:bg-rose-600 focus:bg-rose-600 focus:ring-2 focus:ring-rose-400 outline-none transition-all active:scale-95"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            type="button"
            tabIndex={0}
            onClick={() => appendDigit("0")}
            className="h-12 rounded-xl bg-zinc-800/80 text-lg font-bold text-white hover:bg-rose-600 focus:bg-rose-600 focus:ring-2 focus:ring-rose-400 outline-none transition-all active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            tabIndex={0}
            onClick={removeDigit}
            className="h-12 flex items-center justify-center rounded-xl bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 focus:bg-zinc-700 outline-none transition-all active:scale-95"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
