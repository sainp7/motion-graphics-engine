#!/usr/bin/env bash
# npm run setup [-- --models]
#
# One-time local setup (macOS first; Linux works with your package manager). Safe to re-run:
# every step checks first and skips what is already in place.
#
#   system tools   uv, sox, espeak-ng (Homebrew on macOS), Node >= 20
#   node packages  npm install, when node_modules is missing or older than the lockfile
#   python         Python 3.12 for the voice pipeline (via uv)
#   house audio    sound kit + music stems, generated (CC0) when missing
#   claude code    .claude/settings.json (pre-approved studio commands) and the studio plugin
#   --models       also pre-download the voice models (~5.5 GB): Qwen3-TTS 1.7B, Whisper small.en, Kokoro
set -euo pipefail
cd "$(dirname "$0")/.."

MODELS=0
for a in "$@"; do [[ "$a" == "--models" ]] && MODELS=1; done

step() { printf "\n\033[1m→ %s\033[0m\n" "$1"; }
ok() { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

step "System tools"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if (( NODE_MAJOR >= 20 )); then ok "node $(node -v)"; else warn "Node 20+ required (found $(node -v 2>/dev/null || echo none))"; exit 1; fi
if [[ "$(uname)" == "Darwin" ]]; then
  have brew || { warn "Homebrew is required: https://brew.sh"; exit 1; }
  for pkg in uv sox espeak-ng; do
    if have "$pkg"; then ok "$pkg"; else echo "  installing $pkg…"; brew install "$pkg"; ok "$pkg"; fi
  done
else
  for pkg in uv sox espeak-ng; do
    have "$pkg" && ok "$pkg" || warn "$pkg missing: install it with your package manager (uv: https://docs.astral.sh/uv/)"
  done
fi

step "Node packages"
if [[ ! -d node_modules || package-lock.json -nt node_modules/.package-lock.json ]]; then
  npm install
  ok "installed"
else
  ok "node_modules up to date"
fi

step "Python for the voice pipeline"
if uv python find 3.12 >/dev/null 2>&1; then ok "python 3.12 ($(uv python find 3.12))"; else uv python install 3.12; ok "python 3.12 installed"; fi

step "House sound kit and music"
if [[ -f public/sfx/pop.wav && -f public/music/transit-drive/bass.flac && -f public/music/house-night-transit/bed.flac ]]; then
  ok "already generated (npm run house-audio regenerates)"
else
  npm run --silent house-audio
  ok "generated public/sfx and public/music"
fi

step "Claude Code"
if [[ -f .claude/settings.json ]]; then
  ok ".claude/settings.json exists (left as is)"
else
  mkdir -p .claude && cp docs/claude-settings.json .claude/settings.json
  ok ".claude/settings.json: studio commands pre-approved"
fi
if have claude; then
  claude plugin marketplace add ./ >/dev/null 2>&1 || true # already added is fine
  if claude plugin install studio@motion-graphics-engine >/dev/null 2>&1; then
    ok "studio plugin installed (/studio:new-video)"
  else
    warn "could not install the plugin automatically; run: claude plugin install studio@motion-graphics-engine"
  fi
else
  warn "Claude Code not found. Install it (https://docs.claude.com/en/docs/claude-code/setup), then re-run npm run setup"
fi

if (( MODELS )); then
  step "Voice models (~5.5 GB, into ~/.cache/huggingface)"
  uv run --python 3.12 --with huggingface_hub python - <<'PY'
from huggingface_hub import snapshot_download
for repo in ["Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice", "Systran/faster-whisper-small.en", "hexgrad/Kokoro-82M"]:
    print(f"  {repo}")
    snapshot_download(repo)
PY
  ok "models cached"
else
  echo
  echo "  Voice models download on the first \`npm run voice\` (or now: npm run setup -- --models)."
fi

printf "\n\033[1mReady.\033[0m Next:\n"
echo "  npm run check -- 001-cache-stampede      # lint the reference episode"
echo "  npm run voice -- 001-cache-stampede      # Qwen3-TTS narration (first run downloads the model)"
echo "  npm run studio                           # the review studio"
echo "  claude  →  /studio:new-video <idea or links>"
