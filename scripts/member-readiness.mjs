import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {sanitizeDiagnostics} from '../auth/diagnostics.js';

// This checker reads an exported snapshot and Git objects only. It cannot change
// gates, authenticate, send upstream requests, provision identities or write data.
export function assessMemberReadiness(report, {readSource, now = Date.now()} = {}) {
  if (report?.ok !== true || report.evidenceClass !== 'authenticated-read-only-runtime-snapshot' ||
      !/^[0-9a-f]{40}$/.test(report.vercel?.gitSha || '') || typeof readSource !== 'function')
    throw new Error('An authenticated diagnostics export and local Git source are required.');
  const backend = sanitizeDiagnostics(report.backend);
  const age = now - Date.parse(backend.checkedAt);
  if (!Number.isFinite(age)) throw new Error('Invalid snapshot time.');
  const hash = source => createHash('sha256').update(source).digest('hex');
  const backendHash = hash(readSource(backend.source.gitSha));
  const vercelHash = hash(readSource(report.vercel.gitSha));
  const rows = [
    {check:'Snapshot freshness',state:age >= -60000 && age <= 15*60000 ? 'PASS' : 'PENDING'},
    {check:'Production Vercel artifact',state:report.vercel.environment === 'production' ? 'PASS' : 'PENDING'},
    {check:'Backend source digest',state:backendHash === backend.source.canonicalSha256 ? 'PASS' : 'FAIL'},
    {check:'Apps Script content agrees with Vercel source',state:vercelHash === backendHash ? 'PASS' : 'FAIL'},
    ...['memberSetup','memberDashboard','memberMealsEdit'].map(gate=>({check:`Both ${gate} gates enabled`,state:report.vercel[gate] === true && backend.gates[gate] === true ? 'PASS' : 'PENDING'})),
    {check:'Production Clerk credentials',state:report.vercel.clerkPublishableKeyMode === 'production' && report.vercel.clerkSecretKeyMode === 'production' ? 'PASS' : 'PENDING'},
    {check:'Meals fixture and unchanged neighboring records',state:'NOT_TESTED'},
    {check:'Real secondary identity and revocation tests',state:'NOT_TESTED'},
    {check:'Authenticated meal/grocery runtime tests',state:'NOT_TESTED'}
  ];
  return {evidenceClass:'local-analysis-of-exported-runtime-snapshot',checkedAt:backend.checkedAt,
    sameCommit:report.vercel.gitSha === backend.source.gitSha,checks:rows,
    immutableVersionVerified:false,memberCommissioningComplete:false,julieReady:false,
    webpageCutoverApproved:false};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/member-readiness.mjs DIAGNOSTICS.json');
    const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const result = assessMemberReadiness(report, {readSource:sha=>{
      if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Unverified source SHA.');
      return execFileSync('git',['show',`${sha}:google_apps_script_Code.gs`],{maxBuffer:8*1024*1024,stdio:['ignore','pipe','ignore']});
    }});
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if (result.checks.some(row=>row.state==='FAIL')) process.exitCode=1;
  } catch { console.error('Readiness unavailable: use a valid diagnostics export with both source commits present in this checkout.');process.exitCode=1; }
}
