// Staging password gate for every page on this Pages project (production and preview hosts).
// Credentials come from the Pages secrets BASIC_AUTH_USER and BASIC_AUTH_PASS.
// If either secret is missing the site stays closed rather than going public.

const REALM = "QueerGlobal staging";

function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  const len = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < len; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

export function isAuthorized(header, user, pass) {
  if (!user || !pass) return false;
  if (!header || !header.startsWith("Basic ")) return false;
  let decoded;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const okUser = safeEqual(decoded.slice(0, i), user);
  const okPass = safeEqual(decoded.slice(i + 1), pass);
  return okUser && okPass;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  if (!isAuthorized(request.headers.get("Authorization"), env.BASIC_AUTH_USER, env.BASIC_AUTH_PASS)) {
    return unauthorized();
  }
  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  return out;
}