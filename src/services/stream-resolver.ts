import { buildEmbedUrl, SERVER_COUNT, SERVER_LABELS } from "@/services/embeds";
import type { StreamTarget } from "@/services/remote-config";

export type StreamKind = "embed";

export interface ResolvedStream {
  kind: StreamKind;
  streamUrl: string;
  providerName: string;
  serverIndex: number;
}

export type { StreamTarget };

/**
 * Resolves the embed stream source directly from the selected server provider.
 * Zero external proxy delay or Render server dependency.
 */
export async function resolveStreamSource(
  target: StreamTarget,
  requestedServerIndex = 0,
): Promise<ResolvedStream> {
  const normalizedIndex =
    requestedServerIndex >= 0 && requestedServerIndex < SERVER_COUNT ? requestedServerIndex : 0;

  const embed = buildEmbedUrl(target, normalizedIndex);

  return {
    kind: "embed",
    streamUrl: embed.url,
    providerName: embed.name || SERVER_LABELS[normalizedIndex] || `Server ${normalizedIndex + 1}`,
    serverIndex: normalizedIndex,
  };
}

export { SERVER_COUNT, SERVER_LABELS };
