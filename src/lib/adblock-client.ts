/**
 * Brave-grade client-side ad-blocking, privacy protection, and anti-adblock bypass system.
 * Works seamlessly in web and WebView environments with resource redirection, cosmetic DOM hiding,
 * scriptlet injection, and continuous mutation observation.
 */

// 1. Transparent 1x1 PNG bytes
const TRANSPARENT_1X1_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// 2. Dummy mock JavaScript to satisfy video players and trackers without crashing
const MOCK_NOOP_JS = `
(function() {
  window.noop = function() {};
  window.canRunAds = true;
  window.isAdBlockActive = false;
  window.adblock = false;
  window.google_ad_client = null;
  window.google_ad_status = 1;
  window.googletag = window.googletag || {
    cmd: [],
    display: function() {},
    defineSlot: function() { return this; },
    addService: function() { return this; },
    enableServices: function() {},
    pubads: function() {
      return {
        addEventListener: function() {},
        clear: function() {},
        refresh: function() {},
        enableSingleRequest: function() {},
        collapseEmptyDivs: function() {}
      };
    }
  };
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.loaded = true;
})();
`;

// Known ad and tracking domain suffixes
const AD_DOMAINS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "popads.net",
  "popcash.net",
  "propellerads.com",
  "adsterra.com",
  "exoclick.com",
  "juicyads.com",
  "monetag.com",
  "yllix.com",
  "taboola.com",
  "outbrain.com",
  "trafficjunky.com",
  "clickadu.com",
  "admaven.com",
  "hilltopads.com",
  "richpush.co",
  "evadav.com",
  "zeropark.com",
  "popmyads.com",
  "clicksor.com",
  "adcash.com",
  "mgid.com",
  "bidvertiser.com",
  "revenuehits.com",
  "adnxs.com",
  "criteo.com",
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "scorecardresearch.com",
  "quantserve.com",
  "hotjar.com",
  "clarity.ms",
  "bet365.com",
  "1xbet.com",
];

// Essential domains that must never be blocked
const SAFE_HOSTS = [
  "localhost",
  "127.0.0.1",
  "bujuu.tv",
  "supabase.co",
  "lovable.cloud",
  "themoviedb.org",
  "tmdb.org",
  "google.com",
  "accounts.google.com",
  "googleusercontent.com",
  "gstatic.com",
];

export function isAdUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();

  // Never block media streams or app infrastructure
  if (lower.includes(".m3u8") || lower.includes(".mpd") || lower.includes(".ts")) {
    return false;
  }

  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const host = parsed.hostname.toLowerCase();

    for (const safe of SAFE_HOSTS) {
      if (host === safe || host.endsWith("." + safe)) return false;
    }

    for (const ad of AD_DOMAINS) {
      if (host === ad || host.endsWith("." + ad)) return true;
    }

    // Pattern matching for typical ad scripts and tracking pixels
    if (
      lower.includes("/popunder") ||
      lower.includes("/adsterra") ||
      lower.includes("/monetag") ||
      lower.includes("adsbygoogle") ||
      lower.includes("/vpaid") ||
      lower.includes("/vast-tag")
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Injects cosmetic CSS into the document head to eliminate ad containers, sponsored blocks,
 * and overlay placeholders with `display: none !important`.
 */
export function injectCosmeticStyles() {
  if (typeof document === "undefined") return;
  const STYLE_ID = "bujuu-adblock-cosmetic";
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .ad, .ads, .ad-banner, .advertisement, [id^="ad_"], [class*="sponsored"],
    [class*="banner-ad"], [id*="google_ads"], iframe[src*="doubleclick"],
    iframe[src*="adsterra"], iframe[src*="popads"], iframe[src*="exoclick"],
    iframe[src*="monetag"], .video-ad-overlay, .vpaid-ad, .preroll-ad,
    [class*="ad-container"], [id*="ad-container"], [class*="popup-ad"],
    .floating-ad, [class*="adbox"], [id*="adbox"], div[data-ad], ins.adsbygoogle {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      width: 0 !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

/**
 * Injects anti-adblock bypass mocks so video players and embeds run without anti-adblock detection.
 */
export function injectScriptletMocks() {
  if (typeof window === "undefined") return;

  try {
    const w = window as any;
    w.canRunAds = true;
    w.isAdBlockActive = false;
    w.adblock = false;
    w.google_ad_client = null;
    w.google_ad_status = 1;
    w.adsbygoogle = w.adsbygoogle || [];
    w.adsbygoogle.loaded = true;

    // Neutralize intrusive popup/popunder triggers via window.open
    const originalOpen = window.open;
    window.open = function (url?: string | URL, target?: string, features?: string) {
      if (url) {
        const urlStr = url.toString();
        if (isAdUrl(urlStr)) {
          console.log("[AdBlock] Neutralized popup window.open:", urlStr);
          return null;
        }
      }
      return originalOpen.apply(this, arguments as any);
    };
  } catch {
    /* ignore */
  }
}

/**
 * Intercepts window.fetch and XMLHttpRequest to drop ad/tracker requests or
 * redirect them to dummy mock assets.
 */
export function interceptNetworkRequests() {
  if (typeof window === "undefined") return;

  // 1. Intercept fetch
  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch;
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (isAdUrl(urlStr)) {
        console.log("[AdBlock] Intercepted fetch to ad/tracker:", urlStr);
        if (urlStr.includes(".js") || urlStr.includes("/js/")) {
          return new Response(MOCK_NOOP_JS, {
            status: 200,
            headers: { "Content-Type": "application/javascript" },
          });
        }
        if (urlStr.includes(".png") || urlStr.includes(".gif") || urlStr.includes(".jpg")) {
          const byteChars = atob(TRANSPARENT_1X1_PNG_BASE64);
          const byteNums = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNums[i] = byteChars.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNums);
          return new Response(byteArray, {
            status: 200,
            headers: { "Content-Type": "image/png" },
          });
        }
        return new Response("", { status: 200, headers: { "Content-Type": "text/plain" } });
      }

      return originalFetch.apply(this, arguments as any);
    };
  }

  // 2. Intercept XMLHttpRequest
  if (typeof XMLHttpRequest !== "undefined") {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async: boolean = true,
      username?: string | null,
      password?: string | null,
    ) {
      const urlStr = url.toString();
      (this as any).__bujuu_is_ad = isAdUrl(urlStr);
      (this as any).__bujuu_url = urlStr;
      return originalOpen.apply(this, arguments as any);
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      if ((this as any).__bujuu_is_ad) {
        console.log("[AdBlock] Intercepted XHR to ad/tracker:", (this as any).__bujuu_url);
        // Emulate immediate successful empty completion
        Object.defineProperty(this, "status", { value: 200, writable: false });
        Object.defineProperty(this, "readyState", { value: 4, writable: false });
        Object.defineProperty(this, "responseText", { value: "", writable: false });
        setTimeout(() => {
          if (typeof this.onreadystatechange === "function") {
            this.onreadystatechange(new Event("readystatechange"));
          }
          if (typeof this.onload === "function") {
            this.onload(new ProgressEvent("load"));
          }
        }, 0);
        return;
      }
      return originalSend.apply(this, arguments as any);
    };
  }
}

/**
 * Continuous client-side MutationObserver to eliminate dynamically injected ad elements,
 * third-party ad scripts, and tracking iframes across stream updates and infinite scrolls.
 */
export function startContinuousMutationObserver() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();

          // Intercept dynamic ad script tags and tracker iframes
          if (tag === "script" || tag === "iframe") {
            const src = (el as HTMLScriptElement | HTMLIFrameElement).src || "";
            if (isAdUrl(src)) {
              console.log("[AdBlock] Removed dynamic ad element:", tag, src);
              el.remove();
              continue;
            }
          }

          // Check for ad containers and white space placeholders
          if (
            el.matches &&
            el.matches(
              ".ad, .ads, [class*='sponsored'], [id^='ad_'], .video-ad-overlay, [class*='banner-ad'], ins.adsbygoogle",
            )
          ) {
            el.style.setProperty("display", "none", "important");
            el.style.setProperty("height", "0", "important");
            el.style.setProperty("opacity", "0", "important");
          }
        }
      }
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}

let initialized = false;

/**
 * Master initializer for Brave-grade ad-blocking on web and inside WebView clients.
 */
export function initClientAdBlock() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  injectCosmeticStyles();
  injectScriptletMocks();
  interceptNetworkRequests();
  startContinuousMutationObserver();
}
