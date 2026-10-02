/**
 * PIC Materials & Batch Tracker — Apps Script backend
 *
 * ONE-TIME SETUP (do this first, in this Sheet's Apps Script project):
 *   1. Run `setup` once from the function dropdown above ▸ Run. Approve the
 *      permission prompts (it needs to read/write this Sheet and send email).
 *      This creates the Materials / Recipes / Transactions / Settings tabs,
 *      seeds them with the confirmed PIC recipes, and installs the daily
 *      7:00am low-stock digest trigger.
 *   2. Open Settings tab and set the PIN and the AdminEmails (comma-separated)
 *      if you want something other than the placeholder values.
 *   3. Deploy ▸ New deployment ▸ Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *      Click Deploy, authorize again if asked, then copy the Web App URL.
 *   4. Send that URL back — it gets pasted into config.js in the inventory
 *      tool's page so the tablet/browser can talk to this Sheet.
 *
 * Re-running `setup` later is safe: it will NOT overwrite Materials,
 * Recipes or Settings if those tabs already have rows in them, and it
 * won't install a second daily trigger if one already exists.
 */

const SHEET_MATERIALS = 'Materials';
const SHEET_RECIPES = 'Recipes';
const SHEET_TRANSACTIONS = 'Transactions';
const SHEET_SETTINGS = 'Settings';

/* ============================= SEED DATA ============================= */
// Mirrors the verified prototype exactly as of the recipe-verification pass.

const SEED_MATERIALS = [
  ['pl2500', 'PL-2500 Concentrate', 'g', 20000, 5000],
  ['black', 'Black Pigment', 'g', 4000, 800],
  ['white', 'White Pigment', 'g', 6000, 1200],
  ['yellow', 'Yellow Pigment', 'g', 3000, 600],
  ['red', 'Red Pigment', 'g', 3000, 600],
  ['blue', 'Blue Pigment', 'g', 3000, 600],
  ['green', 'Green Pigment', 'g', 3000, 600],
  ['violet', 'Violet Pigment', 'g', 2500, 500],
  ['orange', 'Orange Pigment', 'g', 2500, 500],
  ['m419c', 'Mclube 419 Concentrate', 'g', 3000, 600],
  ['m1800c', 'Mclube 1800 Concentrate', 'g', 1500, 300],
  ['m1829c', 'Mclube 1829 Concentrate', 'g', 1500, 300],
  ['klubertopc', 'Klubertop (Kluber Silicone) Concentrate', 'g', 1500, 300],
  ['dianix', 'Dianix Red Dye', 'spoon', 20, 5],
  ['mac424c', 'Mclube 424S Concentrate', 'g', 1500, 300],
];

// key -> { ing: [[materialId, amount], ...], note }
const SEED_RECIPES = {
  'p2500|qt|black':   { ing: [['pl2500',150],['black',40]] },
  'p2500|qt|white':   { ing: [['pl2500',150],['white',80]] },
  'p2500|qt|yellow':  { ing: [['pl2500',150],['yellow',40]] },
  'p2500|qt|lightpink': { ing: [['pl2500',150],['white',80],['red',12]] },
  'p2500|qt|purple':  { ing: [['pl2500',150],['white',25],['violet',30]] },
  'p2500|qt|brown':   { ing: [['black',25]], note: 'Also uses 1 QT of an already-made Orange batch — not deducted here since that batch already drew PL-2500/Orange pigment when it was made.' },
  'p2500|qt|mediumblue': { ing: [['pl2500',250],['white',80],['blue',30]] },
  'p2500|qt|orange':  { ing: [['pl2500',150],['orange',25]] },
  'p2500|qt|lightgray': { ing: [['pl2500',150],['white',80],['black',20]] },
  'p2500|qt|darkgreen': { ing: [['pl2500',150],['white',5],['green',55]] },
  'p2500|qt|olivegreen': { ing: [], note: 'Made entirely from already-mixed Yellow (600g), Green (300g) and White (30g) batches — no new raw material draw.' },
  'p2500|qt|mediumgreen': { ing: [['pl2500',150],['white',40],['green',40]] },
  'p2500|qt|red':     { ing: [['pl2500',150],['red',25]] },
  'p2500|qt|lightgreen': { ing: [['pl2500',150],['white',40],['green',20]] },
  'p2500|qt|darkpink': { ing: [['white',80]], note: 'Also uses 1 QT of an already-made Red batch (already accounted for).' },
  'p2500|qt|elastotechmediumgreen': { ing: [['pl2500',150],['white',25],['green',50]] },
  'p2500|qt|mauve':   { ing: [['white',20]], note: 'Also uses 800g of an already-made Red batch (already accounted for).' },
  'p2500|qt|magenta': { ing: [['white',40],['violet',40]], note: 'Also uses 800g of an already-made Red batch (already accounted for).' },
  'p2500|qt|elasticrust': { ing: [['pl2500',150],['orange',25],['black',2]] },
  'p2500|qt|burgundy': { ing: [], note: 'Made entirely from already-mixed Red (935g) and Black (17g) batches — no new raw material draw.' },

  'p2500|gal|black':  { ing: [['pl2500',800],['black',160]] },
  'p2500|gal|yellow': { ing: [['pl2500',800],['yellow',300]] },
  'p2500|gal|mediumblue': { ing: [['pl2500',800],['white',160],['blue',120]] },
  'p2500|gal|lightblue': { ing: [['pl2500',800],['white',300],['blue',5]] },
  'p2500|gal|lightgray': { ing: [['pl2500',800],['white',320],['black',80]] },
  'p2500|gal|red':    { ing: [['pl2500',800],['red',100]] },
  'p2500|gal|pink':   { ing: [['pl2500',800],['white',320],['red',48]] },
  'p2500|gal|darkpink': { ing: [['pl2500',800],['white',320],['red',100]] },
  'p2500|gal|mauve':  { ing: [['white',130]], note: 'Also uses 250g of an already-made Red batch.' },
  'p2500|gal|burgundy': { ing: [], note: 'Made entirely from already-mixed Red (3200g) and Black (68g) batches.' },
  'p2500|gal|darkgray': { ing: [['pl2500',800],['white',200],['black',80]] },
  'p2500|gal|rust':   { ing: [], note: 'Made entirely from already-mixed Orange (3200g) and Black (25g) batches.' },
  'p2500|gal|brown':  { ing: [['pl2500',800],['orange',90],['black',20]] },
  'p2500|gal|orange': { ing: [['pl2500',800],['orange',90]] },
  'p2500|gal|darkgreen': { ing: [['pl2500',800],['white',15],['green',220]] },
  'p2500|gal|mediumgreen': { ing: [['pl2500',800],['white',160],['green',160]] },
  'p2500|gal|lightgreen': { ing: [['pl2500',800],['white',160],['green',80]] },
  'p2500|gal|olive':  { ing: [], note: 'Made entirely from already-mixed Yellow (2400g), Green (1200g) and White (120g) batches.' },
  'p2500|gal|patone272purple': { ing: [['white',300]], note: 'Also uses already-made Purple (2000g) and Blue (600g) batches.' },
  'p2500|gal|darkpurple': { ing: [['pl2500',800],['white',140],['violet',180],['black',40]] },
  'p2500|gal|purple': { ing: [['pl2500',800],['white',100],['violet',180]] },
  'p2500|gal|realsealpurple': { ing: [['white',600]], note: 'Also uses 3000g of an already-made Purple batch.' },
  'p2500|gal|magenta': { ing: [['violet',160],['white',160]], note: 'Also uses 3200g of an already-made Red batch.' },
  'p2500|gal|elastotecred': { ing: [['pl2500',800],['red',100],['black',20]] },
  'p2500|gal|injectecgreen': { ing: [], note: 'Made entirely from already-mixed Yellow (1300g) and Green (1500g) batches.' },
  'p2500|gal|darkred': { ing: [['black',48]], note: 'Also uses 3200g of an already-made Red batch.' },
  'p2500|gal|white':  { ing: [['pl2500',800],['white',240]] },
  'p2500|gal|clear':  { ing: [['pl2500',800]] },

  'p2500|5gal|clear': { ing: [['pl2500',3500]] },
  'p2500|5gal|darkblue': { ing: [['pl2500',3500],['blue',650],['white',50]] },
  'p2500|5gal|mediumblue': { ing: [['pl2500',3500],['white',800],['blue',600]] },
  'p2500|5gal|lightblue': { ing: [['pl2500',3500],['white',1000]], note: 'Also uses 400g of an already-made Dark Blue batch.' },
  'p2500|5gal|red':   { ing: [['pl2500',3500],['red',650]] },
  'p2500|5gal|brown': { ing: [['pl2500',3500],['orange',450],['black',100]] },
  'p2500|5gal|orange': { ing: [['pl2500',3500],['orange',450]] },
  'p2500|5gal|mediumgreen': { ing: [['pl2500',3500],['white',800],['green',800]] },
  'p2500|5gal|darkgreen': { ing: [['pl2500',3500],['white',75],['green',1100]] },
  'p2500|5gal|lightpink': { ing: [['pl2500',3500],['white',1600],['red',240]] },
  'p2500|5gal|darkpink': { ing: [['pl2500',3500],['white',1600],['red',500]] },
  'p2500|5gal|purple': { ing: [['pl2500',3500],['white',500],['violet',900]] },
  'p2500|5gal|darkpurple': { ing: [['pl2500',3500],['white',700],['violet',900],['black',200]] },
  'p2500|5gal|lightgray': { ing: [['pl2500',3500],['white',1600],['black',400]] },
  'p2500|5gal|yellow': { ing: [['pl2500',3500],['yellow',1200]] },

  'm419|qt|-':  { ing: [['m419c',300]], note: 'Water fills the rest of the container (untracked).' },
  'm419|gal|-': { ing: [['m419c',1200]], note: 'Water fills the rest of the container (untracked).' },
  'm1800|qt|-': { ing: [['m1800c',300]], note: 'Water fills the rest of the container (untracked).' },
  'm1800|gal|-': { ing: [['m1800c',1200]], note: 'Water fills the rest of the container (untracked).' },
  'm1829|qt|-': { ing: [['m1829c',300]], note: 'Water fills the rest of the container (untracked).' },
  'm1829|gal|-': { ing: [['m1829c',1200]], note: 'Water fills the rest of the container (untracked).' },
  'klubertop|qt|silicone': { ing: [['klubertopc',300]], note: '300g Klubertop + 700g water per quart batch.' },
  'klubertop|qt|rubber': { ing: [['klubertopc',600]], note: 'Straight/undiluted concentrate, no water.' },
  'klubertop|gal|rubber': { ing: [['klubertopc',2400]], note: 'Straight/undiluted concentrate, no water.' },
  'klubertop|gal|silicone': { ing: [['klubertopc',1200]], note: '1200g Klubertop + 2800g water per gallon batch.' },
  'dianix|qt|-': { ing: [['dianix',1]], note: 'Unit on the sheet is "1 spoon".' },
  'mac424|qt|-': { ing: [['mac424c',200]], note: 'Water fills the rest of the container (untracked).' },
};

const SEED_SETTINGS = {
  PIN: '1234',                 // CHANGE THIS after setup — see the Settings tab
  AdminEmails: 'cgardner@precisecoatings.com',
};

/* ============================= SETUP ============================= */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  seedMaterials_(ss);
  seedRecipes_(ss);
  seedTransactions_(ss);
  seedSettings_(ss);
  installDailyTrigger_();
  SpreadsheetApp.getUi().alert('Setup complete. Materials, Recipes, Transactions and Settings tabs are ready, and the daily 7am low-stock digest is scheduled. Now deploy this as a Web App (Deploy ▸ New deployment) and send the URL back.');
}

function getOrCreateSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function seedMaterials_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_MATERIALS);
  if (sh.getLastRow() > 0) return; // already has data, don't clobber
  sh.appendRow(['id', 'name', 'unit', 'stock', 'threshold']);
  SEED_MATERIALS.forEach(row => sh.appendRow(row));
  sh.setFrozenRows(1);
}

function seedRecipes_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_RECIPES);
  if (sh.getLastRow() > 0) return;
  sh.appendRow(['key', 'ingredients_json', 'note']);
  Object.keys(SEED_RECIPES).forEach(key => {
    const r = SEED_RECIPES[key];
    sh.appendRow([key, JSON.stringify(r.ing), r.note || '']);
  });
  sh.setFrozenRows(1);
}

function seedTransactions_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_TRANSACTIONS);
  if (sh.getLastRow() > 0) return;
  sh.appendRow(['id', 'timestamp', 'label', 'ingredients_json', 'ref']);
  sh.setFrozenRows(1);
}

function seedSettings_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_SETTINGS);
  if (sh.getLastRow() > 0) return;
  sh.appendRow(['key', 'value']);
  Object.keys(SEED_SETTINGS).forEach(k => sh.appendRow([k, SEED_SETTINGS[k]]));
  sh.setFrozenRows(1);
}

function installDailyTrigger_() {
  const already = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'dailyDigest');
  if (already) return;
  ScriptApp.newTrigger('dailyDigest').timeBased().everyDays(1).atHour(7).create();
}

/* ============================= READ HELPERS ============================= */

function readMaterials_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MATERIALS);
  const rows = sh.getDataRange().getValues();
  rows.shift(); // header
  return rows.filter(r => r[0]).map(r => ({ id: r[0], name: r[1], unit: r[2], stock: Number(r[3]), threshold: Number(r[4]) }));
}

function readRecipes_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RECIPES);
  const rows = sh.getDataRange().getValues();
  rows.shift();
  const out = {};
  rows.forEach(r => {
    if (!r[0]) return;
    out[r[0]] = { ing: JSON.parse(r[1] || '[]'), note: r[2] || '' };
  });
  return out;
}

function readTransactions_(limit) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TRANSACTIONS);
  const rows = sh.getDataRange().getValues();
  rows.shift();
  const all = rows.filter(r => r[0]).map(r => ({
    id: r[0], ts: new Date(r[1]).getTime(), label: r[2],
    ing: JSON.parse(r[3] || '[]'), ref: r[4] || '',
  }));
  all.sort((a, b) => b.ts - a.ts);
  return limit ? all.slice(0, limit) : all;
}

function readSettings_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  const rows = sh.getDataRange().getValues();
  rows.shift();
  const out = {};
  rows.forEach(r => { if (r[0]) out[r[0]] = r[1]; });
  return out;
}

function checkPin_(pin) {
  const settings = readSettings_();
  return String(settings.PIN) === String(pin);
}

/* ============================= WRITE HELPERS ============================= */

function deductMaterials_(ing) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MATERIALS);
  const rows = sh.getDataRange().getValues();
  const idCol = 0, stockCol = 3;
  ing.forEach(([matId, amt]) => {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idCol] === matId) {
        const newStock = Math.max(0, Number(rows[i][stockCol]) - Number(amt));
        sh.getRange(i + 1, stockCol + 1).setValue(newStock);
        rows[i][stockCol] = newStock;
        break;
      }
    }
  });
}

function appendTransaction_(label, ing, ref) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TRANSACTIONS);
  const id = Utilities.getUuid();
  sh.appendRow([id, new Date().toISOString(), label, JSON.stringify(ing), ref || '']);
  return id;
}

/* ============================= WEB APP ENTRY POINTS ============================= */

function doGet(e) {
  const payload = {
    ok: true,
    materials: readMaterials_(),
    recipes: readRecipes_(),
    transactions: readTransactions_(200),
  };
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Bad request body' });
  }

  const action = body.action;
  try {
    if (action === 'logBatch' || action === 'customMix') {
      const ing = body.ing || [];
      const label = body.label || (action === 'customMix' ? 'Custom mix' : 'Batch');
      deductMaterials_(ing);
      appendTransaction_(label, ing, body.ref || '');
      return jsonOut_({ ok: true, materials: readMaterials_() });
    }

    if (action === 'checkPin') {
      return jsonOut_({ ok: checkPin_(body.pin) });
    }

    if (action === 'updateMaterial') {
      if (!checkPin_(body.pin)) return jsonOut_({ ok: false, error: 'Incorrect PIN' });
      const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MATERIALS);
      const rows = sh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === body.id) {
          sh.getRange(i + 1, 4).setValue(Number(body.stock));
          sh.getRange(i + 1, 5).setValue(Number(body.threshold));
          break;
        }
      }
      return jsonOut_({ ok: true, materials: readMaterials_() });
    }

    if (action === 'updateRecipe') {
      if (!checkPin_(body.pin)) return jsonOut_({ ok: false, error: 'Incorrect PIN' });
      const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RECIPES);
      const rows = sh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === body.key) {
          sh.getRange(i + 1, 2).setValue(JSON.stringify(body.ing));
          break;
        }
      }
      return jsonOut_({ ok: true, recipes: readRecipes_() });
    }

    return jsonOut_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================= DAILY DIGEST ============================= */

function dailyDigest() {
  const materials = readMaterials_();
  const low = materials.filter(m => m.stock < m.threshold);
  if (low.length === 0) return;

  const settings = readSettings_();
  const emails = String(settings.AdminEmails || '').split(',').map(s => s.trim()).filter(Boolean);
  if (emails.length === 0) return;

  const lines = low.map(m => `- ${m.name}: ${m.stock} ${m.unit} on hand (reorder at ${m.threshold} ${m.unit})`);
  const body = `The following materials are below their reorder threshold:\n\n${lines.join('\n')}\n\n— PIC Materials & Batch Tracker`;
  MailApp.sendEmail({
    to: emails.join(','),
    subject: `PIC Inventory: ${low.length} material${low.length > 1 ? 's' : ''} below reorder threshold`,
    body: body,
  });
}
