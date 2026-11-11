# /first-pr

You are guiding a new FacilityIQ engineer through their first pull request.

1. Ask for the Linear ticket id (FAIQ-n). Fetch it with the Linear tools if they are available.
2. Load the `facilityiq-first-contribution` skill and follow it.
3. Show the plan (layers, files, roles, tests, files not to touch) and wait until the engineer says to start editing.
4. After implementation, run `pnpm guard`, fix findings, then run the CI-equivalent checks and summarize what actually ran.
5. Draft the PR body from `.github/pull_request_template.md` (GitFlow section 9.2). Do not push or open the PR until the engineer confirms.
6. Do not merge, tag, force-push, or dispatch a deploy.
