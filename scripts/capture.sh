#!/bin/bash
# Capture screenshots for VLM review round $1
ROUND=${1:-0}
DIR=/home/z/my-project/screenshots
BASE=http://localhost:3000

mkdir -p "$DIR"

agent-browser set viewport 1440 900 >/dev/null
agent-browser set headers '{"Cache-Control": "no-cache", "Pragma": "no-cache"}' >/dev/null 2>&1 || true
agent-browser open "$BASE?_=$ROUND" >/dev/null
agent-browser wait --load networkidle >/dev/null

# ——— Desktop light sections ———
agent-browser eval "window.scrollTo(0,0)" >/dev/null
sleep 1.2
agent-browser screenshot "$DIR/r$ROUND-d1-hero.png" >/dev/null

scroll_shot () {
  agent-browser eval "document.getElementById('$1').scrollIntoView({block:'start'})" >/dev/null
  sleep 1.4
  agent-browser screenshot "$DIR/r$ROUND-$2.png" >/dev/null
}

scroll_shot field   d2-field
scroll_shot matrix  d3-matrix

# ——— Matrix scrolled at tablet width — sticky column engaged ———
agent-browser set viewport 820 900 >/dev/null
agent-browser eval "document.getElementById('matrix').scrollIntoView({block:'start'})" >/dev/null
sleep 1
agent-browser eval "(() => { const el = document.querySelector('.matrix-scroll'); el.scrollLeft = el.scrollWidth; return true; })()" >/dev/null
sleep 0.6
agent-browser screenshot "$DIR/r$ROUND-d9-matrix-scrolled.png" >/dev/null
agent-browser eval "document.querySelector('.matrix-scroll').scrollLeft = 0" >/dev/null
agent-browser set viewport 1440 900 >/dev/null
sleep 0.5

scroll_shot analysis d4-analysis
scroll_shot system  d10-system
agent-browser eval "(() => { const hs = document.querySelectorAll('#system h3'); hs[3]?.scrollIntoView({block:'center'}); return true; })()" >/dev/null
sleep 1.4
agent-browser screenshot "$DIR/r$ROUND-d11-system2.png" >/dev/null
agent-browser eval "(() => { const hs = document.querySelectorAll('#system h3'); hs[4]?.scrollIntoView({block:'center'}); return true; })()" >/dev/null
sleep 1.4
agent-browser screenshot "$DIR/r$ROUND-d16-roadmap.png" >/dev/null
scroll_shot outlook d5-outlook
scroll_shot verdict d6-verdict

# ——— KAMPS live model: tab states ———
scroll_shot model   d12-model
sleep 1.5
agent-browser eval "(() => { document.querySelectorAll('[role=tab]').forEach(t => { if (t.textContent.includes('Bias correction')) t.click(); }); return true; })()" >/dev/null
sleep 2
agent-browser screenshot "$DIR/r$ROUND-d13-model-bias.png" >/dev/null
agent-browser eval "(() => { document.querySelectorAll('[role=tab]').forEach(t => { if (t.textContent.includes('Vehicles')) t.click(); }); return true; })()" >/dev/null
sleep 2
agent-browser screenshot "$DIR/r$ROUND-d14-model-vehicles.png" >/dev/null
agent-browser eval "(() => { document.querySelectorAll('[role=tab]').forEach(t => { if (t.textContent.includes('Alerts')) t.click(); }); return true; })()" >/dev/null
sleep 2
agent-browser screenshot "$DIR/r$ROUND-d15-model-alerts.png" >/dev/null
# back to risk tab for consistency
agent-browser eval "(() => { document.querySelectorAll('[role=tab]').forEach(t => { if (t.textContent.includes('Risk index')) t.click(); }); return true; })()" >/dev/null
sleep 1

# ——— Footer at document bottom ———
agent-browser eval "document.querySelector('footer').scrollIntoView({block:'end'})" >/dev/null
sleep 1.2
agent-browser screenshot "$DIR/r$ROUND-d8-footer.png" >/dev/null

# ——— Accordion open state ———
agent-browser eval "document.getElementById('field').scrollIntoView({block:'start'})" >/dev/null
sleep 0.8
agent-browser find text "HRDAG" click >/dev/null 2>&1
sleep 1
agent-browser screenshot "$DIR/r$ROUND-d7-accordion.png" >/dev/null

# ——— Dark mode ———
agent-browser eval "window.scrollTo(0,0)" >/dev/null
agent-browser find role button click --name "Toggle color theme" >/dev/null 2>&1
sleep 1
agent-browser screenshot "$DIR/r$ROUND-k1-dark-hero.png" >/dev/null
scroll_shot matrix k2-dark-matrix
scroll_shot field  k3-dark-field
scroll_shot model  k4-dark-model

# back to light
agent-browser find role button click --name "Toggle color theme" >/dev/null 2>&1
sleep 0.5

# ——— Mobile ———
agent-browser set viewport 390 844 >/dev/null
agent-browser reload >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 1.5
agent-browser screenshot "$DIR/r$ROUND-m1-hero.png" >/dev/null
scroll_shot field   m2-field
scroll_shot matrix  m3-matrix
# matrix scrolled horizontally on mobile — proves sticky first column
agent-browser eval "(() => { const el = document.querySelector('.matrix-scroll'); el.scrollLeft = el.scrollWidth; return true; })()" >/dev/null
sleep 0.6
agent-browser screenshot "$DIR/r$ROUND-m3b-matrix-scrolled.png" >/dev/null
agent-browser eval "document.querySelector('.matrix-scroll').scrollLeft = 0" >/dev/null
scroll_shot analysis m4-analysis
scroll_shot system  m8-system
agent-browser eval "(() => { const hs = document.querySelectorAll('#system h3'); hs[2]?.scrollIntoView({block:'center'}); return true; })()" >/dev/null
sleep 1.4
agent-browser screenshot "$DIR/r$ROUND-m9-system2.png" >/dev/null
scroll_shot model   m10-model
sleep 1.5
agent-browser eval "(() => { document.querySelectorAll('[role=tab]').forEach(t => { if (t.textContent.includes('Vehicles')) t.click(); }); return true; })()" >/dev/null
sleep 2
agent-browser eval "(() => { document.querySelector('[data-state=active][role=tabpanel] article')?.scrollIntoView({block:'start'}); window.scrollBy(0, -88); return true; })()" >/dev/null
sleep 1
agent-browser screenshot "$DIR/r$ROUND-m11-model-vehicles.png" >/dev/null
scroll_shot outlook m5-outlook
scroll_shot verdict m6-verdict
agent-browser eval "document.querySelector('footer').scrollIntoView({block:'end'})" >/dev/null
sleep 1.2
agent-browser screenshot "$DIR/r$ROUND-m7-footer.png" >/dev/null

# restore desktop viewport
agent-browser set viewport 1440 900 >/dev/null
agent-browser eval "window.scrollTo(0,0)" >/dev/null

echo "Captured round $ROUND set:"
ls "$DIR" | grep "r$ROUND-" || true
