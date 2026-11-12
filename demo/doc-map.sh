# Sourced by the demo scripts. Maps a guard rule id to documentation links.
# Next.js URLs were checked against nextjs.org and against
# node_modules/next/dist/docs for next@16.4.5 (see package.json).
# Pages Router links document the APIs the bad patch uses. App Router links
# are the replacement. In-repo links are paths in this repository.

doc_links_for_rule() {
  local rule="$1"
  case "$rule" in
    gssp)
      cat <<'EOF'
https://nextjs.org/docs/pages/building-your-application/data-fetching/get-server-side-props
https://nextjs.org/docs/app/getting-started/server-and-client-components
https://nextjs.org/docs/app/guides/upgrading/version-16
.cursor/skills/facilityiq-nextjs-app-router/SKILL.md
docs/guardrails.md
codemod: pnpm dlx @next/codemod@canary upgrade latest
EOF
      ;;
    next-router)
      cat <<'EOF'
https://nextjs.org/docs/app/api-reference/functions/use-router
https://nextjs.org/docs/app/guides/upgrading/version-16
.cursor/skills/facilityiq-nextjs-app-router/SKILL.md
docs/guardrails.md
EOF
      ;;
    next-head)
      cat <<'EOF'
https://nextjs.org/docs/pages/api-reference/components/head
https://nextjs.org/docs/app/api-reference/functions/generate-metadata
https://nextjs.org/docs/app/getting-started/metadata-and-og-images
.cursor/skills/facilityiq-nextjs-app-router/SKILL.md
docs/guardrails.md
EOF
      ;;
    legacy-image)
      cat <<'EOF'
https://nextjs.org/docs/app/guides/upgrading/version-16
.cursor/skills/facilityiq-ui-design-system/SKILL.md
docs/guardrails.md
EOF
      ;;
    sync-params)
      cat <<'EOF'
https://nextjs.org/docs/app/guides/upgrading/version-16
https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes
.cursor/skills/facilityiq-nextjs-app-router/SKILL.md
docs/guardrails.md
codemod: npx @next/codemod@canary next-async-request-api .
EOF
      ;;
    async-client)
      cat <<'EOF'
https://nextjs.org/docs/app/api-reference/directives/use-client
https://nextjs.org/docs/app/getting-started/server-and-client-components
.cursor/skills/facilityiq-nextjs-app-router/SKILL.md
docs/guardrails.md
EOF
      ;;
    client-imports-server)
      cat <<'EOF'
https://nextjs.org/docs/app/api-reference/directives/use-client
https://nextjs.org/docs/app/getting-started/server-and-client-components
.cursor/skills/facilityiq-nextjs-app-router/SKILL.md
docs/guardrails.md
EOF
      ;;
    route-or-page-imports-db | route-imports-repository | ui-imports-repository | repository-imports-service)
      cat <<'EOF'
.cursor/skills/facilityiq-api-routes/SKILL.md
.cursor/skills/facilityiq-services-and-domain-logic/SKILL.md
docs/guardrails.md
EOF
      ;;
    adhoc-tofixed)
      cat <<'EOF'
.cursor/skills/facilityiq-ui-design-system/SKILL.md
docs/guardrails.md
EOF
      ;;
    public-secret | protected-path | raw-error-to-client)
      cat <<'EOF'
.cursor/skills/facilityiq-security-review/SKILL.md
docs/guardrails.md
EOF
      ;;
    logic-without-tests | no-assertion | weak-assertion | focused-or-skipped-only | focused-or-skipped-skip | focused-or-skipped-todo)
      cat <<'EOF'
.cursor/skills/facilityiq-unit-testing/SKILL.md
docs/guardrails.md
EOF
      ;;
    tenancy-test-missing)
      cat <<'EOF'
.cursor/skills/facilityiq-multi-tenancy-rls/SKILL.md
docs/guardrails.md
EOF
      ;;
    new-dependency)
      cat <<'EOF'
.cursor/skills/facilityiq-dependency-upgrades/SKILL.md
docs/guardrails.md
EOF
      ;;
    *)
      echo "docs/guardrails.md"
      ;;
  esac
}

# Read a pnpm guard / pre-pr.mjs report and print finding -> rule -> doc link.
print_findings_with_docs() {
  local report="$1"
  local found=0
  local line level rule where link
  while IFS= read -r line; do
    [[ "$line" == "| error "* || "$line" == "| warn "* ]] || continue
    found=1
    level="$(awk -F'|' '{ gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2 }' <<<"$line")"
    rule="$(awk -F'|' '{ gsub(/`/, "", $3); gsub(/^[ \t]+|[ \t]+$/, "", $3); print $3 }' <<<"$line")"
    where="$(awk -F'|' '{ gsub(/`/, "", $4); gsub(/^[ \t]+|[ \t]+$/, "", $4); print $4 }' <<<"$line")"
    echo "finding: ${where}"
    echo "  level: ${level}"
    echo "  rule: ${rule}"
    while IFS= read -r link; do
      [[ -n "$link" ]] || continue
      if [[ "$link" == codemod:* ]]; then
        echo "  ${link}"
      else
        echo "  doc: ${link}"
      fi
    done < <(doc_links_for_rule "$rule")
    echo
  done <"$report"
  if [[ "$found" -eq 0 ]]; then
    echo "(no error or warning rows)"
  fi
}
