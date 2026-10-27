#!/usr/bin/env bash
# Configure local git identity and origin for this repo's GitHub account.
set -euo pipefail

readonly GITHUB_USER="viveksingh1987"
readonly REPO_NAME="ai-learning-tracker"
readonly GIT_EMAIL="viveksingh87@outlook.in"
readonly GIT_NAME="Vivek Singh"
readonly SSH_HOST="github.com-personal"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage: git-account.sh [apply|status]

  apply   Set viveksingh1987 SSH + email and origin for this repo (default).
  status  Print local user.* and origin URL.

Requires Host github.com-personal in ~/.ssh/config — see scripts/ssh-config/github-personal.snippet
EOF
}

require_git_repo() {
  if ! git -C "$repo_root" rev-parse --git-dir >/dev/null 2>&1; then
    echo "error: not a git repository: $repo_root" >&2
    exit 1
  fi
}

ssh_host_configured() {
  grep -q "^Host ${SSH_HOST}$" "${HOME}/.ssh/config" 2>/dev/null
}

origin_url() {
  echo "git@${SSH_HOST}:${GITHUB_USER}/${REPO_NAME}.git"
}

apply() {
  require_git_repo
  if ! ssh_host_configured; then
    echo "error: Host ${SSH_HOST} missing in ~/.ssh/config" >&2
    echo "       Add scripts/ssh-config/github-personal.snippet and retry." >&2
    exit 1
  fi
  git -C "$repo_root" config user.email "$GIT_EMAIL"
  git -C "$repo_root" config user.name "$GIT_NAME"
  if git -C "$repo_root" remote get-url origin >/dev/null 2>&1; then
    git -C "$repo_root" remote set-url origin "$(origin_url)"
  else
    git -C "$repo_root" remote add origin "$(origin_url)"
  fi
  echo "Configured GitHub (${GITHUB_USER}) for $(basename "$repo_root")"
  show_status
}

show_status() {
  require_git_repo
  echo "---"
  echo "repo:   $repo_root"
  echo "name:   $(git -C "$repo_root" config user.name)"
  echo "email:  $(git -C "$repo_root" config user.email)"
  echo "origin: $(git -C "$repo_root" config --get remote.origin.url 2>/dev/null || echo "(no origin)")"
}

main() {
  local cmd="${1:-apply}"
  case "$cmd" in
    apply | personal) apply ;;
    status) show_status ;;
    -h | --help | help) usage ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
