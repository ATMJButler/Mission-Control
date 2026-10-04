(() => {
  let report = null, generation = 0, sessionId = null, listening = false;
  const element = id => document.getElementById(id);
  const signedIn = () => Boolean(window.Clerk?.isSignedIn && window.Clerk?.session?.id);
  function clearReport() {
    report = null;
    element("checkResults").hidden = true;
    element("checkReport").textContent = "";
    element("checkSummary").replaceChildren();
    element("downloadReport").disabled = true;
  }
  function updateSession() {
    const next = signedIn() ? window.Clerk.session.id : null;
    if (next !== sessionId) {
      generation++; clearReport(); sessionId = next;
      element("checkStatus").textContent = next ? "Ready. Principal membership is checked on every request." : "Sign in to continue.";
    }
    element("runChecks").disabled = !next;
  }
  window.addEventListener("mc-authenticated", () => {
    updateSession();
    if (!listening) { listening = true; window.Clerk.addListener(updateSession); }
  });
  window.addEventListener("DOMContentLoaded", () => {
    element("householdId").addEventListener("input", () => {generation++; clearReport(); element("runChecks").disabled = !signedIn();});
    element("checkForm").addEventListener("submit", async event => {
      event.preventDefault();
      if (!signedIn()) {updateSession(); return;}
      const current = ++generation, currentSession = window.Clerk.session.id;
      clearReport(); element("runChecks").disabled = true;
      element("checkStatus").textContent = "Checking deployment and shared state…";
      try {
        const response = await fetch("/api/v1/diagnostics", {method:"POST", credentials:"same-origin", cache:"no-store",
          headers:{"Content-Type":"application/json"}, body:JSON.stringify({householdId:element("householdId").value.trim()})});
        const body = await response.json();
        if (generation !== current || !signedIn() || window.Clerk.session.id !== currentSession) return;
        if (!response.ok || body.ok !== true) {
          element("checkStatus").textContent = response.status === 403 ? "Principal access denied. No report was returned." :
            response.status === 401 ? "Your session is no longer authenticated. Sign in again." :
            "Checks unavailable. Confirm the diagnostics Apps Script version is promoted, then try again.";
          return;
        }
        report = body;
        const {vercel, backend, verification} = body;
        const rows = [
          ["Checked at", backend.checkedAt], ["Vercel source", vercel.gitSha || "Unverified"],
          ["Apps Script source", backend.source.gitSha], ["Source agreement", verification.sourceMatch === null ? "Unverified" : verification.sourceMatch ? "Matches" : "Mismatch — stop commissioning"],
          ["Vercel dispatcher gate", vercel.projectV1Dispatch ? "Enabled" : "Disabled"],
          ["Apps Script dispatcher gate", backend.gates.projectV1TrustedDispatch ? "Enabled" : "Disabled"],
          ["Clerk key modes", `Public: ${vercel.clerkPublishableKeyMode}; private: ${vercel.clerkSecretKeyMode}`],
          ["Legacy Projects", backend.sheets.legacyProjects.recordCount ?? "Unverified / not applicable"],
          ["Project Resources", backend.sheets.projectResources.recordCount ?? "Unverified"],
          ["Project Operation Audit", backend.sheets.projectOperationAudit.present ? `${backend.sheets.projectOperationAudit.recordCount ?? "Unverified"} household records` : "Not present"],
          ["Disposable fixture", !backend.sheets.projectResources.headersValid ? "Unverified — resource schema unavailable" : !backend.fixture.present ? "Not present" : !backend.fixture.unique ? "Duplicate ID — stop commissioning" : `Version ${backend.fixture.version ?? "unverified"}; ${backend.fixture.lifecycle ?? "unverified"}`],
          ["Fixture lifecycle metadata", backend.fixture.lifecycleCoherent === null ? "Unverified" : backend.fixture.lifecycleCoherent ? "Coherent" : "Inconsistent — inspect before commissioning"],
          ["Runtime commissioning", "Not established by this report"], ["Webpage cutover", "Still blocked"]
        ];
        for (const [label, value] of rows) {
          const term = document.createElement("dt"), detail = document.createElement("dd");
          term.textContent = label; detail.textContent = String(value); element("checkSummary").append(term, detail);
        }
        element("checkReport").textContent = JSON.stringify(report, null, 2);
        element("checkResults").hidden = false; element("downloadReport").disabled = false;
        element("checkStatus").textContent = "Read-only snapshot received. No production data was changed.";
      } catch {
        if (generation === current && signedIn()) element("checkStatus").textContent = "Checks unavailable. No report was saved; no mutation was requested.";
      } finally {
        if (generation === current) element("runChecks").disabled = !signedIn();
      }
    });
    element("downloadReport").addEventListener("click", () => {
      if (!report || !signedIn() || window.Clerk.session.id !== sessionId) {clearReport();return;}
      const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)], {type:"application/json"}));
      const link = document.createElement("a"); link.href = url; link.download = "mission-control-diagnostics.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  });
})();
