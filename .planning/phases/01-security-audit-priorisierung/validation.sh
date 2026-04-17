#!/bin/bash
# Validate .planning/research/01-security-audit.md structural integrity
# Usage: bash .planning/phases/01-security-audit-priorisierung/validation.sh
#
# Exit 0 = all checks pass; Exit 1 = at least one check failed.
# Referenced specs:
#   - .planning/ROADMAP.md §"Phase 1" Success Criteria
#   - .planning/phases/01-security-audit-priorisierung/01-CONTEXT.md §D-06, D-08, D-15, D-16
#   - .planning/phases/01-security-audit-priorisierung/01-VALIDATION.md Per-Task-Verification-Map

DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$DIR"

AUDIT=".planning/research/01-security-audit.md"
KOPF=".planning/phases/01-security-audit-priorisierung/kopf-review.md"

FAIL=0

check() {
  local label="$1"
  local status="$2"
  if [ "$status" = "PASS" ]; then
    echo "PASS $label"
  else
    echo "FAIL $label"
    FAIL=1
  fi
}

# --- Check 1: SC1 Audit-Datum header present ---
if grep -qE '^\*\*Audit-Datum:\*\*' "$AUDIT" 2>/dev/null; then
  check "SC1 Audit-Datum header" PASS
else
  check "SC1 Audit-Datum header" FAIL
fi

# --- Check 2-6: SC2a-e All 5 mandatory meta-fields per finding ---
FINDING_COUNT=$(grep -cE '^### \[F-' "$AUDIT" 2>/dev/null || echo 0)
for FIELD_PATTERN in "Severity" "Datei-Pfad.e." "Current Mitigation" "Fix-Ansatz" "Target Phase"; do
  FIELD_COUNT=$(grep -cE "^- \*\*${FIELD_PATTERN}:\*\*" "$AUDIT" 2>/dev/null || echo 0)
  if [ "$FIELD_COUNT" -ge "$FINDING_COUNT" ]; then
    check "SC2 All findings have ${FIELD_PATTERN}" PASS
  else
    check "SC2 All findings have ${FIELD_PATTERN} (found $FIELD_COUNT vs expected >= $FINDING_COUNT)" FAIL
  fi
done

# --- Check 7: SC3a Severity order Critical < High < Medium < Low ---
L4=$(grep -nE '^## 4\. Findings' "$AUDIT" 2>/dev/null | head -1 | cut -d: -f1)
L5=$(grep -nE '^## 5\. Findings' "$AUDIT" 2>/dev/null | head -1 | cut -d: -f1)
L6=$(grep -nE '^## 6\. Findings' "$AUDIT" 2>/dev/null | head -1 | cut -d: -f1)
L7=$(grep -nE '^## 7\. Findings' "$AUDIT" 2>/dev/null | head -1 | cut -d: -f1)
if [ -n "$L4" ] && [ -n "$L5" ] && [ -n "$L6" ] && [ -n "$L7" ] && [ "$L4" -lt "$L5" ] && [ "$L5" -lt "$L6" ] && [ "$L6" -lt "$L7" ]; then
  check "SC3a Severity header order" PASS
else
  check "SC3a Severity header order (lines: 4=$L4 5=$L5 6=$L6 7=$L7)" FAIL
fi

# --- Check 8: SC3b No Critical/High with Target Phase v2 or out-of-scope ---
# Each F-block is a fixed window: reset on every new ### header (F- or other),
# so a missing Target-Phase cannot leak sev into the next finding.
VIOL=$(awk '
  /^### / { capture=0; sev=""; tp="" }
  /^### \[F-/ { capture=1 }
  capture && /^- \*\*Severity:\*\*/ { sev=$0 }
  capture && /^- \*\*Target Phase:\*\*/ {
    tp=$0
    if (sev ~ /(Critical|High)/ && tp ~ /(v2|out-of-scope)/) print "FAIL: " sev " -> " tp
    capture=0; sev=""; tp=""
  }
' "$AUDIT" 2>/dev/null)
if [ -z "$VIOL" ]; then
  check "SC3b No Critical/High on v2/out-of-scope" PASS
else
  check "SC3b Critical/High found on v2/out-of-scope: $VIOL" FAIL
fi

# --- Check 9: SC4 Deferred section + Warum nicht jetzt per item ---
DEFERRED_COUNT=$(grep -cE '^### \[D-' "$AUDIT" 2>/dev/null || echo 0)
WARUM_COUNT=$(grep -cE '^- \*\*Warum nicht jetzt:\*\*' "$AUDIT" 2>/dev/null || echo 0)
if grep -qE '^## 9\. Deferred / Accepted Risks' "$AUDIT" 2>/dev/null && [ "$WARUM_COUNT" -ge "$DEFERRED_COUNT" ] && [ "$DEFERRED_COUNT" -ge 1 ]; then
  check "SC4 Deferred section + Warum nicht jetzt" PASS
else
  check "SC4 Deferred section (deferred=$DEFERRED_COUNT warum=$WARUM_COUNT)" FAIL
fi

# --- Check 10: D-13 Kopf-Review protocol exists ---
if [ -f "$KOPF" ] || grep -qE '^## .*Appendix.*Kopf-Review' "$AUDIT" 2>/dev/null; then
  check "D-13 Kopf-Review protocol present" PASS
else
  check "D-13 Kopf-Review protocol missing" FAIL
fi

# --- Check 11: D-15 Operational findings tagged Class: Operational ---
OP_COUNT=$(grep -cE '^### \[OP-' "$AUDIT" 2>/dev/null || echo 0)
OP_CLASS_COUNT=$(grep -cE '^- \*\*Class:\*\* Operational' "$AUDIT" 2>/dev/null || echo 0)
if [ "$OP_COUNT" -ge 1 ] && [ "$OP_CLASS_COUNT" -eq "$OP_COUNT" ]; then
  check "D-15 Operational findings tagged Class: Operational" PASS
else
  check "D-15 Operational tagging (OP=$OP_COUNT ClassTag=$OP_CLASS_COUNT)" FAIL
fi

# --- Check 12: TRACE SEC-02..07 covered ---
TRACE_MISS=""
for req in SEC-02 SEC-03 SEC-04 SEC-05 SEC-06 SEC-07; do
  if ! grep -qE "^\| $req " "$AUDIT" 2>/dev/null; then
    TRACE_MISS="$TRACE_MISS $req"
  fi
done
if [ -z "$TRACE_MISS" ]; then
  check "TRACE SEC-02..07 covered" PASS
else
  check "TRACE missing SEC requirements:$TRACE_MISS" FAIL
fi

# --- Check 13: VOL 15-25 F-findings ---
if [ "$FINDING_COUNT" -ge 15 ] && [ "$FINDING_COUNT" -le 25 ]; then
  check "VOL 15-25 findings (actual=$FINDING_COUNT)" PASS
else
  check "VOL 15-25 findings violated (actual=$FINDING_COUNT)" FAIL
fi

# --- Exit ---
if [ "$FAIL" = "0" ]; then
  echo ""
  echo "All 13 structural checks passed."
  exit 0
else
  echo ""
  echo "At least one structural check failed."
  exit 1
fi
