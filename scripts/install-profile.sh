#!/usr/bin/env bash
# Install dsh-plugin-mcp-toggle into a dsh profile (default: web)
# Usage: ./scripts/install-profile.sh [profile]
set -euo pipefail

PROFILE="${1:-web}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE_DIR="$HOME/.dsh/profiles/$PROFILE"
PATCH="$PROFILE_DIR/cordis.patch.yml"

echo "==> Building dsh-plugin-mcp-toggle..."
cd "$ROOT"
npm run build

echo "==> Linking plugin into profile $PROFILE..."
mkdir -p "$PROFILE_DIR/node_modules"
ln -sfT "$ROOT" "$PROFILE_DIR/node_modules/dsh-plugin-mcp-toggle"

echo "==> Updating $PATCH..."
if [ ! -f "$PATCH" ]; then
  cat > "$PATCH" <<'EOF'
- insert:
    - id: mcp-admin
      name: dsh-plugin-mcp-toggle
EOF
  echo "Created $PATCH with mcp-admin entry."
elif grep -q 'dsh-plugin-mcp-toggle' "$PATCH"; then
  echo "Plugin entry already exists in $PATCH."
else
  # Prepend mcp-admin inside an insert block
  python3 -c "
import sys, re
path = '$PATCH'
with open(path, 'r') as f:
    content = f.read()

if '- insert:' in content:
    # Append mcp-admin to existing insert block
    content = content.replace('- insert:', '- insert:\n    - id: mcp-admin\n      name: dsh-plugin-mcp-toggle')
else:
    # Wrap entries in insert block or prepend insert block
    content = '- insert:\n    - id: mcp-admin\n      name: dsh-plugin-mcp-toggle\n\n' + content

with open(path, 'w') as f:
    f.write(content)
"
  echo "Added mcp-admin entry to $PATCH."
fi

echo ""
echo "Installation complete!"
echo "Please restart DSH Web for changes to take effect: bunx @deepseek-ai/dsh web"
