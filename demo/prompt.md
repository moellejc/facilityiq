# Demo prompt

This prompt is for `demo/with-vs-without.sh` only. It is a small route-add request. It is not the FAIQ-36 cost-by-category ticket. Do not implement cost-by-category or any other finance feature.

Add a read-only page at `src/app/(dashboard)/operations/dock-status/page.tsx` that shows the active facility's name and a one-line dock status for the signed-in user.

Follow this repository's existing App Router, service, and test patterns. Include `loading.tsx` and `error.tsx` in the new segment, and add a test that asserts the dock status text rendered for the signed-in user.

Do not edit CI, guards, auth, or finance pages.
