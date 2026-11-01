import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const credentials = z.object({ deviceId: z.string().uuid(), deviceSecret: z.string().min(32) });
const pin = z.string().regex(/^\d{4}$/, "PIN must contain exactly four digits.");

async function verifyDevice(input: z.infer<typeof credentials>) {
  const { admin, resolveAccess, rateLimit, clientIp } = await import("@/lib/bujuu.server");
  await rateLimit("profile_device", clientIp(), 120, 3600);
  const access = await resolveAccess(input);
  if (!access.deviceRow || access.reason === "device_revoked") throw new Error("This device is not authorized.");
  return { db: await admin(), device: access.deviceRow };
}

async function getOrCreateControl(db: any, deviceId: string) {
  const { data, error } = await db.from("device_controls").select("active_profile,pin_salt,pin_hash,pin_failures,pin_locked_until").eq("device_id", deviceId).maybeSingle();
  if (error) throw new Error("Parental controls are unavailable. Please try again.");
  if (data) return data;
  const { data: created, error: createError } = await db.from("device_controls").insert({ device_id: deviceId }).select("active_profile,pin_salt,pin_hash,pin_failures,pin_locked_until").single();
  if (createError) throw new Error("Could not initialize parental controls.");
  return created;
}

async function derivePin(pinValue: string, saltHex: string) {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g) ?? [], (x) => parseInt(x, 16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pinValue), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 310000 }, key, 256);
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const getDeviceProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) => credentials.parse(input))
  .handler(async ({ data }) => {
    const { db, device } = await verifyDevice(data);
    const controls = await getOrCreateControl(db, device.id);
    return { profile: controls.active_profile as "adult" | "kids", hasPin: Boolean(controls.pin_hash) };
  });

export const setDeviceProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) => credentials.extend({ profile: z.enum(["adult", "kids"]) }).parse(input))
  .handler(async ({ data }) => {
    const { db, device } = await verifyDevice(data);
    const controls = await getOrCreateControl(db, device.id);
    if (data.profile === "adult" && controls.active_profile === "kids" && controls.pin_hash) {
      throw new Error("Enter the parental PIN to switch to Adult mode.");
    }
    const { error } = await db.from("device_controls").update({ active_profile: data.profile, updated_at: new Date().toISOString() }).eq("device_id", device.id);
    if (error) throw new Error("Could not update profile.");
    return { profile: data.profile, hasPin: Boolean(controls.pin_hash) };
  });

export const setDevicePin = createServerFn({ method: "POST" })
  .validator((input: unknown) => credentials.extend({ pin: pin.nullable(), currentPin: pin.optional() }).parse(input))
  .handler(async ({ data }) => {
    const { db, device } = await verifyDevice(data);
    const controls = await getOrCreateControl(db, device.id);
    if (controls.pin_hash) {
      if (!data.currentPin) throw new Error("Enter the current parental PIN first.");
      const now = Date.now();
      if (controls.pin_locked_until && new Date(controls.pin_locked_until).getTime() > now) throw new Error("PIN entry is temporarily locked. Try again later.");
      const candidate = await derivePin(data.currentPin, controls.pin_salt);
      if (!constantTimeEqual(candidate, controls.pin_hash)) {
        const failures = Number(controls.pin_failures ?? 0) + 1;
        await db.from("device_controls").update({ pin_failures: failures, pin_locked_until: failures >= 5 ? new Date(now + 15 * 60_000).toISOString() : null }).eq("device_id", device.id);
        throw new Error("Current PIN is incorrect.");
      }
    }
    const patch = data.pin ? (() => { const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,"0")).join(""); return derivePin(data.pin, salt).then(hash => ({ pin_salt: salt, pin_hash: hash })); })() : Promise.resolve({ pin_salt: null, pin_hash: null });
    const pinFields = await patch;
    const { error } = await db.from("device_controls").update({ ...pinFields, pin_failures: 0, pin_locked_until: null, updated_at: new Date().toISOString() }).eq("device_id", device.id);
    if (error) throw new Error("Could not save parental PIN.");
    return { hasPin: Boolean(data.pin) };
  });

export const verifyDevicePin = createServerFn({ method: "POST" })
  .validator((input: unknown) => credentials.extend({ pin: pin }).parse(input))
  .handler(async ({ data }) => {
    const { db, device } = await verifyDevice(data);
    const controls = await getOrCreateControl(db, device.id);
    if (controls.pin_locked_until && new Date(controls.pin_locked_until).getTime() > Date.now()) throw new Error("PIN entry is temporarily locked. Try again later.");
    if (!controls.pin_hash) throw new Error("A parental PIN has not been configured.");
    const candidate = await derivePin(data.pin, controls.pin_salt);
    if (!constantTimeEqual(candidate, controls.pin_hash)) {
      const failures = Number(controls.pin_failures ?? 0) + 1;
      await db.from("device_controls").update({ pin_failures: failures, pin_locked_until: failures >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null }).eq("device_id", device.id);
      return { verified: false };
    }
    await db.from("device_controls").update({ pin_failures: 0, pin_locked_until: null, active_profile: "adult", updated_at: new Date().toISOString() }).eq("device_id", device.id);
    return { verified: true, profile: "adult" as const };
  });
