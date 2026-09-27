#!/bin/bash
# Capture screenshots for VLM review round $1 — KAMPS app (hash views) + report
ROUND=${1:-0}
DIR=/home/z/my-project/screenshots
BASE=http://localhost:3000

mkdir -p "$DIR"

goto_view () {
  agent-browser eval "(() => { location.hash = '#view=$1'; window.dispatchEvent(new HashChangeEvent('hashchange')); return true; })()" >/dev/null
  sleep $2
}

agent-browser set viewport 1440 900 >/dev/null
agent-browser set headers '{"Cache-Control": "no-cache", "Pragma": "no-cache"}' >/dev/null 2>&1 || true
agent-browser open "$BASE?_=$ROUND" >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2.5

# ——— App views (desktop, light) ———
goto_view dashboard 3
agent-browser screenshot "$DIR/r$ROUND-d1-dashboard.png" >/dev/null
agent-browser eval "window.scrollBy(0, 700)" >/dev/null; sleep 1
agent-browser screenshot "$DIR/r$ROUND-d2-dashboard2.png" >/dev/null

goto_view map 3
agent-browser screenshot "$DIR/r$ROUND-d3-map.png" >/dev/null
# select Nairobi county
agent-browser eval "(() => { const p = Array.from(document.querySelectorAll('svg path')).find(el => el.getAttribute('aria-label')?.includes('Nairobi')); if (p) p.dispatchEvent(new MouseEvent('click', {bubbles: true})); return !!p; })()" >/dev/null
sleep 1.5
agent-browser screenshot "$DIR/r$ROUND-d4-map-selected.png" >/dev/null

goto_view analytics 3
agent-browser screenshot "$DIR/r$ROUND-d5-analytics-forecast.png" >/dev/null
agent-browser eval "(() => { const t = document.querySelectorAll('h2.sr-only, section'); return true; })()" >/dev/null
agent-browser eval "window.scrollBy(0, 900)" >/dev/null; sleep 1.2
agent-browser screenshot "$DIR/r$ROUND-d6-analytics-bias.png" >/dev/null

goto_view vehicles 2.5
agent-browser screenshot "$DIR/r$ROUND-d7-vehicles.png" >/dev/null

goto_view alerts 2.5
agent-browser screenshot "$DIR/r$ROUND-d8-alerts.png" >/dev/null

goto_view sources 2.5
agent-browser screenshot "$DIR/r$ROUND-d9-sources.png" >/dev/null

goto_view analyst 2.5
agent-browser screenshot "$DIR/r$ROUND-d10-analyst.png" >/dev/null

# ——— Report view (desktop, light) ———
goto_view report 3
agent-browser eval "window.scrollTo(0,0)" >/dev/null; sleep 1
agent-browser screenshot "$DIR/r$ROUND-d11-report-hero.png" >/dev/null
agent-browser eval "document.getElementById('system').scrollIntoView({block:'start'})" >/dev/null; sleep 1.4
agent-browser screenshot "$DIR/r$ROUND-d12-report-system.png" >/dev/null
agent-browser eval "document.getElementById('model').scrollIntoView({block:'start'})" >/dev/null; sleep 2.2
agent-browser screenshot "$DIR/r$ROUND-d13-report-model.png" >/dev/null
agent-browser eval "(() => { document.querySelectorAll('[role=tab]').forEach(t => { if (t.textContent.includes('Bias correction')) t.click(); }); return true; })()" >/dev/null
sleep 1.8
agent-browser screenshot "$DIR/r$ROUND-d14-report-model-bias.png" >/dev/null
agent-browser eval "document.querySelector('footer').scrollIntoView({block:'end'})" >/dev/null; sleep 1.4
agent-browser screenshot "$DIR/r$ROUND-d15-report-footer.png" >/dev/null

# ——— Dark mode (dashboard + map + report model) ———
goto_view dashboard 2.5
agent-browser find role button click --name "Toggle color theme" >/dev/null 2>&1
sleep 1.2
agent-browser screenshot "$DIR/r$ROUND-k1-dark-dashboard.png" >/dev/null
goto_view map 2.5
agent-browser screenshot "$DIR/r$ROUND-k2-dark-map.png" >/dev/null
goto_view report 2.5
agent-browser eval "document.getElementById('model').scrollIntoView({block:'start'})" >/dev/null; sleep 2
agent-browser screenshot "$DIR/r$ROUND-k3-dark-model.png" >/dev/null
agent-browser find role button click --name "Toggle color theme" >/dev/null 2>&1
sleep 0.5

# ——— Mobile (390x844) ———
agent-browser set viewport 390 844 >/dev/null
agent-browser reload >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2.5
goto_view dashboard 3
agent-browser screenshot "$DIR/r$ROUND-m1-dashboard.png" >/dev/null
goto_view map 3
agent-browser screenshot "$DIR/r$ROUND-m2-map.png" >/dev/null
goto_view analytics 3
agent-browser screenshot "$DIR/r$ROUND-m3-analytics.png" >/dev/null
goto_view vehicles 2.5
agent-browser screenshot "$DIR/r$ROUND-m4-vehicles.png" >/dev/null
goto_view alerts 2.5
agent-browser screenshot "$DIR/r$ROUND-m5-alerts.png" >/dev/null
goto_view analyst 2.5
agent-browser screenshot "$DIR/r$ROUND-m6-analyst.png" >/dev/null
goto_view report 3
agent-browser eval "window.scrollTo(0,0)" >/dev/null; sleep 1
agent-browser screenshot "$DIR/r$ROUND-m7-report-hero.png" >/dev/null
agent-browser eval "document.getElementById('model').scrollIntoView({block:'start'})" >/dev/null; sleep 2
agent-browser screenshot "$DIR/r$ROUND-m8-report-model.png" >/dev/null

# restore desktop viewport
agent-browser set viewport 1440 900 >/dev/null
agent-browser eval "window.scrollTo(0,0)" >/dev/null

echo "Captured round $ROUND set:"
ls "$DIR" | grep "r$ROUND-" | wc -l
