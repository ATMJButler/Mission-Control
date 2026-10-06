import {pathToFileURL} from 'node:url';

const spreadsheetId = '18eft4EyxSy1lCtydd5dwuu20iMiJOBV0AAiHq4gu05Y';
const expectedHeaders = ['key','householdId','schemaVersion','updatedAt','updatedBy','status','json','notes'];

export async function checkStagingGoogle({token, request = fetch}) {
  if (!token) throw new Error('Missing short-lived Google access token.');
  const read = async suffix => {
    const response = await request(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${suffix}`, {
      method: 'GET', headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`Staging Sheets read failed (HTTP ${response.status}); response contents omitted.`);
    try { return await response.json(); }
    catch { throw new Error('Staging Sheets returned an unreadable response; contents omitted.'); }
  };
  const metadata = await read('?fields=spreadsheetId,properties(title)');
  if (metadata.spreadsheetId !== spreadsheetId || metadata.properties?.title !== 'Mission Control - Staging Test Data')
    throw new Error('Staging workbook identity does not match. Stopped.');
  const {values = []} = await read('/values/Meals!A1%3AH4');
  const [headers = [], neighbor = [], blank = [], target = []] = values;
  let meals, other;
  try { meals = JSON.parse(target[6]); other = JSON.parse(neighbor[6]); }
  catch { throw new Error('Expected physical staging Meals rows contain invalid JSON.'); }
  const checks = {
    headers: JSON.stringify(headers) === JSON.stringify(expectedHeaders),
    physicalTarget: target[0] === 'butler-household' && target[1] === 'butler-household' && target[5] === 'approved' && meals.householdId === 'butler-household',
    version13: meals.version === 13,
    groceries: JSON.stringify(meals.approved?.groceryList) === JSON.stringify([{item:'TEST apples',qty:'6',done:true}]),
    plan: meals.approved?.days?.length === 7 && meals.approved.days[0].meal === 'TEST Soup',
    draft: meals.draft?.sentinel === 'KEEP DRAFT',
    history: JSON.stringify(meals.mealHistory) === JSON.stringify(['KEEP HISTORY']),
    rules: meals.rules?.sentinel === 'KEEP RULES',
    notes: target[7] === 'KEEP FIXTURE NOTES',
    blankRow: blank.every(value => value === '' || value == null),
    neighbor: neighbor[0] === 'staging-neighbor' && neighbor[1] === 'staging-neighbor' && other.householdId === 'staging-neighbor' && other.version === 9 && neighbor[7] === 'KEEP NEIGHBOR'
  };
  const report = {evidenceClass:'github-authenticated-staging-sheet-read-only', checkedAt:new Date().toISOString(), mealsVersion:meals.version, checks, pass:Object.values(checks).every(Boolean), writesRequested:0, commissioningComplete:false, julieReady:false};
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await checkStagingGoogle({token:process.env.STAGING_GOOGLE_ACCESS_TOKEN});
    console.log(JSON.stringify(report,null,2));
    if (!report.pass) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error && error.name === 'TypeError' ? 'Google connection failed; transport details omitted.' : error.message);
    process.exitCode = 1;
  }
}
