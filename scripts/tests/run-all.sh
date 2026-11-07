#!/usr/bin/env bash
# Runs every test file plus scripts/test-e2ee.mts. Exits non-zero if any file fails.
# Run from anywhere: bash scripts/tests/run-all.sh
cd "$(dirname "$0")/../.." || exit 2

files=(scripts/test-e2ee.mts scripts/tests/e2ee-edge.mts scripts/tests/filters.mts scripts/tests/api-mock.mts)
failed=()
for f in "${files[@]}"; do
  echo "=== $f"
  if ! npx tsx "$f"; then failed+=("$f"); fi
done

echo
if [ ${#failed[@]} -eq 0 ]; then
  echo "ALL TEST FILES PASSED (${#files[@]} files)"
  exit 0
fi
echo "########################################"
echo "FAILED TEST FILES (${#failed[@]} of ${#files[@]}):"
for f in "${failed[@]}"; do echo "  FAIL  $f"; done
echo "########################################"
exit 1
