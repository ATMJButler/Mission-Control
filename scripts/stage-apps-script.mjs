import fs from "node:fs";
import crypto from "node:crypto";

export function stageAppsScript(source, sha) {
  if (!/^[0-9a-f]{40}$/.test(sha || "")) throw new Error("Full release SHA required");
  const digest = crypto.createHash("sha256").update(source).digest("hex");
  for (const [name, value] of [["MC_SOURCE_SHA", sha], ["MC_CANONICAL_SHA256", digest]]) {
    const marker = `const ${name} = 'unversioned';`;
    if (source.split(marker).length !== 2) throw new Error(`Exactly one ${name} marker required`);
    source = source.replace(marker, `const ${name} = '${value}';`);
  }
  return source;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const source = fs.readFileSync("google_apps_script_Code.gs", "utf8");
  fs.mkdirSync("apps-script-dist", {recursive: true});
  fs.writeFileSync("apps-script-dist/Code.gs", stageAppsScript(source, process.env.GITHUB_SHA));
}
