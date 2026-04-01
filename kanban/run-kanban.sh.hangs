#!/usr/bin/env bash
# Kanban Runner — loops through PROMPT_*.md files in 1_planning
# Usage: cd to any project with a kanban/ folder, then run:
#   Mac/Linux:  bash kanban/run-kanban.sh
#   Windows:    & "C:\Program Files\Git\bin\bash.exe" -l kanban/run-kanban.sh

set -e

PROJECT_ROOT="$(pwd)"
PLANNING="$PROJECT_ROOT/kanban/1_planning"
TESTING="$PROJECT_ROOT/kanban/2_testing"

# Verify folders exist
if [ ! -d "$PLANNING" ]; then
    echo "ERROR: $PLANNING not found. Run this from your project root."
    exit 1
fi
mkdir -p "$TESTING"

# Collect prompt files
PROMPTS=($(ls "$PLANNING"/PROMPT_*.md 2>/dev/null | sort))

if [ ${#PROMPTS[@]} -eq 0 ]; then
    echo "No PROMPT_*.md files found in $PLANNING"
    exit 0
fi

echo "========================================"
echo "Found ${#PROMPTS[@]} prompt(s) to process:"
for f in "${PROMPTS[@]}"; do
    echo "  - $(basename "$f")"
done
echo "========================================"

COMPLETED=0
FAILED=0

for FILE in "${PROMPTS[@]}"; do
    NAME=$(basename "$FILE")
    CONTENT=$(cat "$FILE")

    echo ""
    echo "========================================"
    echo "RUNNING: $NAME"
    echo "========================================"
    echo ""

    PROMPT="You are working in project: $PROJECT_ROOT

CONTEXT MANAGEMENT: If your context usage exceeds 110k tokens out of 200k, immediately run /compact to summarize context before continuing.

REFERENCE FILES: The kanban/1_planning/ folder contains plan files (without PROMPT_ prefix) that may be referenced in this task. Read them if the prompt below refers to them.

TASK — Execute the following prompt completely. Do not ask questions. Do not stop until every requirement is met. If something fails, fix it and retry up to 3 times before moving on.

---

$CONTENT"

    if echo "$PROMPT" | claude -p --dangerously-skip-permissions; then
        mv "$FILE" "$TESTING/$NAME"
        echo ""
        echo "MOVED $NAME -> 2_testing"
        COMPLETED=$((COMPLETED + 1))
    else
        echo ""
        echo "FAILED $NAME (leaving in 1_planning)"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "========================================"
echo "ALL PROMPTS PROCESSED"
echo "  Completed: $COMPLETED"
echo "  Failed:    $FAILED"
echo "========================================"
