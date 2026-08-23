#!/bin/bash

# 🔄 Script untuk Update Date-fns Imports
# 
# Purpose: Otomatis replace semua import date-fns dengan centralized date-utils
# Impact: -25KB bundle size
#
# Usage: 
#   chmod +x scripts/update-date-imports.sh
#   ./scripts/update-date-imports.sh

echo "🔍 Searching for date-fns imports..."

# Files yang perlu diupdate
FILES=(
  "src/components/features/kegiatan/kegiatan-calendar.tsx"
  "src/components/features/kegiatan/kegiatan-form.tsx"
  "src/components/features/arsip/arsip-surat-detail.tsx"
  "src/app/(sistem)/dashboard/log-activity/[id]/page.tsx"
  "src/components/ui/date-range-picker-presets.tsx"
  "src/components/ui/calendar.tsx"
  "src/components/ui/date-picker.tsx"
)

# Backup directory
BACKUP_DIR="backups/date-imports-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creating backups in $BACKUP_DIR..."

# Counter
UPDATED=0
SKIPPED=0

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing: $file"
    
    # Backup original file
    cp "$file" "$BACKUP_DIR/$(basename $file).backup"
    
    # Check if file uses date-fns
    if grep -q "from \"date-fns" "$file"; then
      echo "   Updating imports..."
      
      # Create temp file
      temp_file="${file}.tmp"
      
      # Process file line by line
      while IFS= read -r line; do
        # Replace format import
        if echo "$line" | grep -q 'import.*format.*from "date-fns"'; then
          echo "import { formatDate, formatDateTime, formatTime } from \"@/lib/date-utils\";" >> "$temp_file"
        # Replace locale import
        elif echo "$line" | grep -q 'import.*id.*from "date-fns/locale'; then
          echo "import { idLocale } from \"@/lib/date-utils\";" >> "$temp_file"
        # Keep other lines
        else
          echo "$line" >> "$temp_file"
        fi
      done < "$file"
      
      # Replace original file
      mv "$temp_file" "$file"
      
      UPDATED=$((UPDATED + 1))
      echo "   Updated successfully"
    else
      echo "  ⏭️  No date-fns imports found, skipping"
      SKIPPED=$((SKIPPED + 1))
    fi
  else
    echo "  ⚠️  File not found: $file"
    SKIPPED=$((SKIPPED + 1))
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Update Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo "  - Files updated: $UPDATED"
echo "  - Files skipped: $SKIPPED"
echo "  - Backups saved: $BACKUP_DIR"
echo ""
echo "⚠️  IMPORTANT: Manual updates may still be needed!"
echo ""
echo "📝 Next Steps:"
echo "  1. Review changes: git diff"
echo "  2. Update function calls from format() to formatDate()"
echo "  3. Test locally: npm run dev"
echo "  4. Check for any TypeScript errors"
echo ""
echo "🔄 To restore from backup:"
echo "  cp $BACKUP_DIR/filename.backup src/path/to/filename"
echo ""
