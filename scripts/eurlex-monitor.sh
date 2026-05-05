#!/usr/bin/env bash
# EUR-Lex full-text fetch monitor + ingest trigger.
# Runs daily on Toronto via systemd timer. Reaches the RunPod over the
# existing SSH key, reports progress, restarts dead tmux sessions, and once
# the corpus crosses an ingest threshold runs the chunk+embed+upsert.
set -euo pipefail

POD_SSH=(ssh -i /home/bbrelin/.ssh/id_ed25519_pod -p 22181
         -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=20
         root@194.68.245.154)
POD_RSYNC_SSH='ssh -i /home/bbrelin/.ssh/id_ed25519_pod -p 22181 -o StrictHostKeyChecking=no -o BatchMode=yes'

LOCAL_DATA=/home/bbrelin/sudacka-mreza/data/eurlex
LOCAL_CURSORS=$LOCAL_DATA/cursors
INGEST_THRESHOLD_LINES=50000
INGEST_THRESHOLD_BYTES=$((500 * 1024 * 1024))
EN_QUEUE=167571
HR_QUEUE=86523
DONE_PCT=95
LOG=/home/bbrelin/sudacka-mreza/data/eurlex/monitor.log

mkdir -p "$LOCAL_DATA" "$LOCAL_CURSORS"
exec >>"$LOG" 2>&1
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo "$(ts) $*"; }

log "=== monitor run ==="

# --- Pod status ---------------------------------------------------------------
POD_STATUS=$("${POD_SSH[@]}" '
  set -e
  EN_LINES=$(wc -l </workspace/eurlex/corpus_en.jsonl 2>/dev/null || echo 0)
  HR_LINES=$(wc -l </workspace/eurlex/corpus_hr.jsonl 2>/dev/null || echo 0)
  EN_BYTES=$(stat -c %s /workspace/eurlex/corpus_en.jsonl 2>/dev/null || echo 0)
  HR_BYTES=$(stat -c %s /workspace/eurlex/corpus_hr.jsonl 2>/dev/null || echo 0)
  TMUX_LIST=$(tmux ls 2>/dev/null | awk -F: "{print \$1}" | tr "\n" "," || echo "")
  printf "EN_LINES=%s\nHR_LINES=%s\nEN_BYTES=%s\nHR_BYTES=%s\nTMUX=%s\n" \
    "$EN_LINES" "$HR_LINES" "$EN_BYTES" "$HR_BYTES" "$TMUX_LIST"
') || { log "pod ssh failed"; exit 1; }
eval "$POD_STATUS"

EN_PCT=$(( EN_LINES * 100 / EN_QUEUE ))
HR_PCT=$(( HR_LINES * 100 / HR_QUEUE ))
log "EN: $EN_LINES lines / ${EN_BYTES}B (${EN_PCT}% of $EN_QUEUE) | HR: $HR_LINES lines / ${HR_BYTES}B (${HR_PCT}% of $HR_QUEUE) | tmux=[$TMUX]"

# --- Restart tmux if dead and we're not done ---------------------------------
if [[ "$TMUX" != *"fetch_en"* && $EN_PCT -lt $DONE_PCT ]]; then
  log "fetch_en session dead, restarting"
  "${POD_SSH[@]}" 'cd /workspace/eurlex && tmux new-session -d -s fetch_en "node fetch.mjs --index=index_en.csv --out=corpus_en.jsonl --langs=en --max=200000 2>&1 | tee -a fetch_en.log"' || log "restart fetch_en failed"
fi
if [[ "$TMUX" != *"fetch_hr"* && $HR_PCT -lt $DONE_PCT ]]; then
  log "fetch_hr session dead, restarting"
  "${POD_SSH[@]}" 'cd /workspace/eurlex && tmux new-session -d -s fetch_hr "node fetch.mjs --index=index_hr.csv --out=corpus_hr.jsonl --langs=hr --max=200000 2>&1 | tee -a fetch_hr.log"' || log "restart fetch_hr failed"
fi

# --- Stop condition ----------------------------------------------------------
if [[ $EN_PCT -ge $DONE_PCT && $HR_PCT -ge $DONE_PCT ]]; then
  log "both languages at >=${DONE_PCT}% — disabling timer"
  sudo systemctl disable --now eurlex-monitor.timer || true
fi

# --- Ingest trigger ----------------------------------------------------------
should_ingest=0
if [[ $EN_LINES -ge $INGEST_THRESHOLD_LINES || $EN_BYTES -ge $INGEST_THRESHOLD_BYTES ]]; then
  should_ingest=1
fi
if [[ $HR_LINES -ge $INGEST_THRESHOLD_LINES || $HR_BYTES -ge $INGEST_THRESHOLD_BYTES ]]; then
  should_ingest=1
fi

if [[ $should_ingest -eq 0 ]]; then
  log "below ingest threshold, monitor only"
  exit 0
fi

# --- Sync JSONL back to Toronto ----------------------------------------------
log "syncing corpus from pod"
rsync -av --partial --inplace -e "$POD_RSYNC_SSH" \
  root@194.68.245.154:/workspace/eurlex/corpus_en.jsonl "$LOCAL_DATA/" || log "rsync EN failed"
rsync -av --partial --inplace -e "$POD_RSYNC_SSH" \
  root@194.68.245.154:/workspace/eurlex/corpus_hr.jsonl "$LOCAL_DATA/" || log "rsync HR failed"

# --- Run ingest --------------------------------------------------------------
log "running ingest"
node /home/bbrelin/sudacka-mreza/scripts/eurlex-ingest.mjs \
  --in="$LOCAL_DATA/corpus_en.jsonl" --cursor="$LOCAL_CURSORS/en.cursor" --lang=en
node /home/bbrelin/sudacka-mreza/scripts/eurlex-ingest.mjs \
  --in="$LOCAL_DATA/corpus_hr.jsonl" --cursor="$LOCAL_CURSORS/hr.cursor" --lang=hr

log "monitor run done"
