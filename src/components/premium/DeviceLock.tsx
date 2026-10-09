import { Link } from "@tanstack/react-router";
import { MonitorSmartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";

/**
 * Full-screen lock shown when this number has been claimed on another device.
 * It covers everything so playback cannot continue here.
 */
export function DeviceLock() {
  const { lockedOut } = useAccess();
  if (!lockedOut) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/95 p-6 backdrop-blur-md">
      <div className="max-w-sm text-center">
        <MonitorSmartphone className="mx-auto h-10 w-10 text-brand" />
        <h1 className="mt-4 text-xl font-bold">Watching moved to another device</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your number is now in use somewhere else, so premium access is switched off here. Enter
          your M-Pesa number below to bring it back to this device.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link to="/subscribe">Use this device instead</Link>
        </Button>
      </div>
    </div>
  );
}
