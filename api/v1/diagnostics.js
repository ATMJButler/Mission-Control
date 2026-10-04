import {requireMissionControlOrigin} from "../../auth/origin.js";
import {installUpstreamDirectoryAdapter} from "../../auth/upstream-directory.js";
import {installClerkIdentityAdapter} from "../../auth/clerk-adapter.js";
import {requireVerifiedIdentity} from "../../auth/session.js";
import {resolveAccessContext} from "../../auth/directory.js";
import {authorize} from "../../auth/authorization.js";
import {readUpstreamDiagnostics, deploymentDiagnostics} from "../../auth/diagnostics.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Cookie, Authorization, Origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ok: false, code: "METHOD_NOT_ALLOWED"}); }
  try {
    requireMissionControlOrigin(req);
    installClerkIdentityAdapter(); installUpstreamDirectoryAdapter();
    const identity = await requireVerifiedIdentity(req);
    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; } catch { body = null; }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => k !== "householdId") ||
        typeof body.householdId !== "string" || !body.householdId.trim() || body.householdId.length > 120)
      return res.status(400).json({ok: false, code: "INVALID_DIAGNOSTICS_REQUEST"});
    const ctx = await resolveAccessContext(identity, body.householdId);
    const auth = authorize({...ctx, resource: "diagnostics", operation: "read"});
    if (!auth.ok) return res.status(403).json({ok: false, code: "DIAGNOSTICS_FORBIDDEN"});
    const backend = await readUpstreamDiagnostics({householdId: auth.householdId, userId: auth.userId});
    const vercel = deploymentDiagnostics();
    const sourceMatch = vercel.gitSha && backend.source.gitSha !== "unversioned" ? vercel.gitSha === backend.source.gitSha : null;
    return res.status(200).json({ok: true, evidenceClass: "authenticated-read-only-runtime-snapshot", vercel, backend,
      verification: {sourceMatch, bothDispatchGatesEnabled: vercel.projectV1Dispatch && backend.gates.projectV1TrustedDispatch,
        immutableVersionVerified: false, commissioningComplete: false, webpageCutoverApproved: false}});
  } catch (error) {
    const allowed = new Set(["UNAUTHENTICATED", "AUTH_NOT_CONFIGURED", "ORIGIN_NOT_CONFIGURED", "ORIGIN_FORBIDDEN", "CROSS_SITE_FORBIDDEN",
      "AUTHORIZED_PARTIES_NOT_CONFIGURED", "USER_NOT_PROVISIONED", "IDENTITY_BINDING_NOT_UNIQUE", "HOUSEHOLD_INACTIVE_OR_MISSING",
      "MEMBERSHIP_NOT_UNIQUE", "MEMBERSHIP_INACTIVE_OR_MISSING", "PRINCIPAL_REQUIRED", "DIAGNOSTICS_UPSTREAM_UNAVAILABLE"]);
    const code = allowed.has(error?.code) ? error.code : "DIAGNOSTICS_UNAVAILABLE";
    const status = [401,403,409,502,503].includes(error?.statusCode) ? error.statusCode : 500;
    return res.status(status).json({ok: false, code});
  }
}
