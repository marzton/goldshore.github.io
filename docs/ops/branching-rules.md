# Branching & Conflicts

- Default: main; features: feat/*, fix/*, chore/*, docs/*
- Rebase onto main before review; use --force-with-lease only
- Merge: squash for small, rebase for linear history
- Require 1 review + passing CI on protected branches
- Auto-delete merged branches to keep the repo clear of stale work; re-open a new branch if more follow-up is needed.
