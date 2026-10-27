#!/usr/bin/env bash
# Push using the personal GitHub profile for this repository.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
account_script="${repo_root}/scripts/git-account.sh"

if [[ ! -x "$account_script" ]]; then
  echo "error: missing executable $account_script" >&2
  exit 1
fi

"$account_script" apply
git -C "$repo_root" push "$@"
