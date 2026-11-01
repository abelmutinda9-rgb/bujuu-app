import React, { useState, useEffect } from "react";
import { Lock, X, Delete } from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { toast } from "sonner";

export function PinModal() {
  const { isPinModalOpen, closePinModal, verifyPinAndSwitch } = useProfile();
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!isPinModalOpen) {
      setPinDigits([]);
      setIsVerifying(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isVerifying) return;
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
  }, [isPinModalOpen, pinDigits, isVerifying]);

  if (!isPinModalOpen) return null;

  const appendDigit = (digit: string) => {
    if (isVerifying) return;
    if (pinDigits.length < 4) {
      const next = [...pinDigits, digit];
      setPinDigits(next);
      if (next.length === 4) {
        setIsVerifying(true);
        const fullPin = next.join("");
        setTimeout(async () => {
          try {
            const success = await verifyPinAndSwitch(fullPin);
            if (!success) {
              toast.error("Incorrect PIN. Please try again.");
              setPinDigits([]);
            } else {
              toast.success("Switched to Adult profile");
            }
          } catch {
            toast.error("Failed to verify PIN");
          } finally {
            setIsVerifying(false);
          }
        }, 100);
      }
    }
  };

  const removeDigit = () => {
    if (isVerifying) return;
    setPinDigits((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-xs rounded-3xl border border-zinc-800/80 bg-zinc-950/95 p-6 shadow-2xl text-center space-y-6">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Parental Lock
          </span>
          <button
            onClick={closePinModal}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-inner">
            <Lock className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">Enter Parent PIN</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Enter your 4-digit code to unlock the full Adult catalog
          </p>
        </div>

        {/* PIN Dots */}
        <div className="flex justify-center gap-3 py-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${
                i < pinDigits.length
                  ? "bg-rose-500 border-rose-500 scale-110 shadow-lg shadow-rose-500/40"
                  : "border-zinc-700 bg-zinc-900/60"
              }`}
            />
          ))}
        </div>

        {/* Numeric keypad for Touch and TV remote navigation */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              tabIndex={0}
              disabled={isVerifying}
              onClick={() => appendDigit(num)}
              className="h-12 rounded-2xl bg-zinc-900/90 border border-zinc-800/60 text-lg font-bold text-white hover:bg-rose-600 hover:border-rose-500 focus:bg-rose-600 focus:ring-2 focus:ring-rose-400 outline-none transition-all active:scale-95 shadow-sm disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            type="button"
            tabIndex={0}
            disabled={isVerifying}
            onClick={() => appendDigit("0")}
            className="h-12 rounded-2xl bg-zinc-900/90 border border-zinc-800/60 text-lg font-bold text-white hover:bg-rose-600 hover:border-rose-500 focus:bg-rose-600 focus:ring-2 focus:ring-rose-400 outline-none transition-all active:scale-95 shadow-sm disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            tabIndex={0}
            disabled={isVerifying}
            onClick={removeDigit}
            className="h-12 flex items-center justify-center rounded-2xl bg-zinc-900/90 border border-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800 focus:bg-zinc-800 outline-none transition-all active:scale-95 shadow-sm disabled:opacity-50"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
