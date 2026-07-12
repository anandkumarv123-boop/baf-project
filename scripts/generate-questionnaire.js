// scripts/generate-questionnaire.js — regenerates BAF_Questionnaire.docx from
// BAF_Simulator_v6.html's LAYERS array (the same single source of truth used by
// tests/test-cases.js's TC14 ceiling checks), so the printable questionnaire never
// drifts from the live engine. Mirrors all micro-indicators 1:1 with sub-layer ids,
// per Architecture doc Section 9.4's human-subject backtesting protocol.
//
// Usage: node scripts/generate-questionnaire.js

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} = require('docx');

const ROOT = path.join(__dirname, '..');

function loadLayers() {
  const html = fs.readFileSync(path.join(ROOT, 'BAF_Simulator_v6.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const snippet = script.slice(script.indexOf('const DIMS'), script.indexOf('const TOTAL_SUBS'));
  const tmp = path.join(os.tmpdir(), '_questionnaire_layers.js');
  fs.writeFileSync(tmp, snippet + '\nmodule.exports = { LAYERS, DIMS };');
  delete require.cache[require.resolve(tmp)];
  const mod = require(tmp);
  fs.unlinkSync(tmp);
  return mod;
}

const DIM_LABELS = {
  RT: 'Risk Tolerance', SC: 'Social Conformity', ER: 'Emotional Reactivity',
  AR: 'Authority Deference', DS: 'Independent Decision-Making', SR: 'Stress Resilience',
};

function heading(text, level) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function body(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 100 } });
}

function buildDocument(LAYERS) {
  const totalSubs = LAYERS.reduce((a, l) => a + l.subs.length, 0);
  const totalMicro = LAYERS.reduce((a, l) => a + l.subs.reduce((b, s) => b + s.micro.length, 0), 0);

  const children = [];

  children.push(new Paragraph({
    text: 'BAF Questionnaire',
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
  }));
  children.push(new Paragraph({
    text: 'Human-Subject Backtesting Instrument — mirrors all engine micro-indicators 1:1 (Architecture doc Section 9.4)',
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
  }));

  children.push(heading('Protocol', HeadingLevel.HEADING_1));
  [
    'This form mirrors every micro-indicator scored by the BAF engine, one item per line, grouped by layer and sub-layer.',
    '1. Before answering anything below, complete Part 1 — an independent baseline self-rating on the six output dimensions.',
    '2. Then answer every item in Part 2 (categorical picks and 1–5 self-report statements).',
    '3. Answers are re-entered into BAF_Simulator_v6.html via Guided Mode, or as an exact vector via the Precision Test Mode / JSON Test Console, using each item\'s [id].',
    '4. Compare the engine\'s output to the Part 1 baseline; log any gaps per dimension.',
    'This is a self-report consistency check, not validation against objective ground truth — see Architecture doc Section 9.5 for the honest scope of what this backtesting protocol can and cannot claim.',
  ].forEach(t => children.push(body(t)));

  children.push(body(`Respondent code: ____________________     Date: ____________________`, { break: 1 }));

  children.push(heading('Part 1 — Baseline Self-Rating (complete before Part 2)', HeadingLevel.HEADING_1));
  children.push(body('Rate yourself on each dimension below, 1 (strongly toward the left description) to 5 (strongly toward the right description), before seeing any engine output.'));
  const dimPairs = {
    RT: ['leans cautious, prefers predictability', 'seeks novelty, accepts uncertainty'],
    SC: ['acts independent of group expectation', 'calibrates to group norms'],
    ER: ['even emotional baseline under pressure', 'heightened emotional reactivity to shifts'],
    AR: ['questions or resists authority', 'defers to authority/structure'],
    DS: ['consensus-seeking, intuitive decisions', 'independent, analytical decisions'],
    SR: ['reduced buffering under stress', 'strong resilience under stress'],
  };
  Object.entries(DIM_LABELS).forEach(([k, label]) => {
    const [lo, hi] = dimPairs[k];
    children.push(body(`${label} (${k}):  1=${lo}  ...  5=${hi}   Your rating: ____`));
  });

  children.push(heading('Part 2 — Structured Items', HeadingLevel.HEADING_1));
  children.push(body(`${totalSubs} sub-layers, ${totalMicro} micro-indicators, across ${LAYERS.length} layers.`));

  LAYERS.forEach((layer, li) => {
    children.push(heading(`${layer.title}  (weight ${(layer.weight * 100).toFixed(0)}%)`, HeadingLevel.HEADING_2));
    layer.subs.forEach((sub) => {
      children.push(heading(`${sub.title}  [id: ${sub.id}]`, HeadingLevel.HEADING_3));
      sub.micro.forEach((m) => {
        if (m.type === 'select') {
          children.push(body(`Categorical — pick one:  [id: ${m.id}]`, { italics: true }));
          m.options.forEach((o, i) => {
            const letter = String.fromCharCode(65 + i);
            children.push(body(`   ${letter}. ${o.name}`));
          });
        } else {
          children.push(body(`Self-report statement (1–5):  [id: ${m.id}]`, { italics: true }));
          children.push(body(`   "${m.prompt}"`));
          children.push(body('   1 = Strongly disagree   2 = Disagree   3 = Neutral   4 = Agree   5 = Strongly agree'));
        }
      });
    });
  });

  children.push(heading('Disclaimer', HeadingLevel.HEADING_1));
  children.push(body('Heuristic self-reflection instrument only — not a psychological assessment, diagnosis, or predictive instrument. No physiognomic, medical, or criminal-history items appear anywhere in this questionnaire.'));

  return new Document({ sections: [{ children }] });
}

async function main() {
  const { LAYERS } = loadLayers();
  const doc = buildDocument(LAYERS);
  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(ROOT, 'BAF_Questionnaire.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath} (${LAYERS.reduce((a, l) => a + l.subs.length, 0)} sub-layers, ${LAYERS.reduce((a, l) => a + l.subs.reduce((b, s) => b + s.micro.length, 0), 0)} micro-indicators)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
