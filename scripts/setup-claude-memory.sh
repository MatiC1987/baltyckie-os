#!/bin/bash
# Kopiuje pliki pamięci Claude do właściwego katalogu systemowego.
# Uruchom raz po sklonowaniu repo na nowym komputerze.

PROJECT_PATH="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_KEY=$(echo "$PROJECT_PATH" | sed 's|/|-|g' | sed 's|^-||')
MEMORY_TARGET="$HOME/.claude/projects/$PROJECT_KEY/memory"

mkdir -p "$MEMORY_TARGET"
cp "$PROJECT_PATH/.claude/memory/"*.md "$MEMORY_TARGET/"

echo "✓ Pamięć Claude skopiowana do: $MEMORY_TARGET"
echo "  Pliki: $(ls "$MEMORY_TARGET" | tr '\n' ' ')"
