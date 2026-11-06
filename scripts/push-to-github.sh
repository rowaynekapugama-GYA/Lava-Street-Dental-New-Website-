#!/usr/bin/env bash
# Lava Street Dental: put a release on GitHub from Terminal (macOS or Linux).
#
#   bash push-to-github.sh stage <zip or folder>   the cms branch = main + this release (Vercel builds a preview)
#   bash push-to-github.sh status                   what is live and what is staged
#   bash push-to-github.sh promote                  type LIVE: move main to the tested cms commit (production)
#   bash push-to-github.sh rollback                 type ROLLBACK: put main back to before the last promote
#
# Works in a fresh clone in ~/gya-deploy/lava-street-dental every time, so nothing on your computer
# is changed. The live site only changes on promote. Needs git with access to the repository.
# bash 3.2 and BSD tools safe (stock macOS).
set -euo pipefail

REPO_DEFAULT="https://github.com/rowaynekapugama-GYA/Lava-Street-Dental-New-Website-.git"
WORK="${HOME}/gya-deploy/lava-street-dental"
CONF="${HOME}/gya-deploy/.lava-street-dental-repo"
LAST="${HOME}/gya-deploy/.lava-street-dental-main-before-promote"

say() { printf '\n> %s\n' "$*"; }
die() { printf '\nStopped: %s\n' "$*" >&2; exit 1; }

repo_url() {
  if [ -f "$CONF" ]; then cat "$CONF"; return; fi
  printf 'Repository address [%s]: ' "$REPO_DEFAULT" >&2
  read -r url
  url="${url:-$REPO_DEFAULT}"
  mkdir -p "$(dirname "$CONF")"
  printf '%s\n' "$url" > "$CONF"
  printf '%s\n' "$url"
}

fresh_clone() {
  local url; url="$(repo_url)"
  rm -rf "$WORK"
  mkdir -p "$(dirname "$WORK")"
  say "Cloning $url"
  git clone --quiet "$url" "$WORK"
  cd "$WORK"
  git fetch --quiet origin
}

cmd="${1:-}"
case "$cmd" in
  stage)
    src="${2:-}"
    [ -n "$src" ] || die "give the release zip or folder: bash push-to-github.sh stage ~/Downloads/lava-street-dental-v1.3.0.zip"
    case "$src" in /*) ;; *) src="$(pwd)/$src" ;; esac
    tmp="$(mktemp -d)"
    if [ -d "$src" ]; then
      rel="$src"
    elif [ -f "$src" ]; then
      unzip -q "$src" -d "$tmp"
      # the release has one top folder; use it (awk, not sed \t, for macOS)
      top="$(ls -1 "$tmp" | awk 'NR==1')"
      if [ "$(ls -1 "$tmp" | wc -l | tr -d ' ')" = "1" ] && [ -d "$tmp/$top" ]; then rel="$tmp/$top"; else rel="$tmp"; fi
    else
      die "not found: $src"
    fi
    [ -f "$rel/package.json" ] && [ -d "$rel/content" ] || die "that does not look like the Lava Street Dental release (no package.json or content/)"
    [ ! -e "$rel/.env" ] || die "the release contains a .env file with secrets. Remove it first."
    fresh_clone
    # always rebuild cms from the live main, never from an old cms branch
    git switch --quiet -C cms origin/main
    say "Replacing every file with the release (files the release does not have are removed)"
    git ls-files -z | xargs -0 rm -f
    (cd "$rel" && tar -cf - --exclude .git --exclude node_modules --exclude .next .) | tar -xf -
    git add -A
    removed="$(git diff --cached --name-only --diff-filter=D | wc -l | tr -d ' ')"
    changed="$(git diff --cached --name-only | wc -l | tr -d ' ')"
    if [ "$changed" = "0" ]; then die "nothing to change: main already has this release"; fi
    git diff --cached --stat | tail -1
    if [ "$removed" != "0" ]; then
      say "These files are removed (the release moved or replaced them):"
      git diff --cached --name-only --diff-filter=D | awk '{print "  - " $0}' | head -60
    fi
    printf '\nPut this on the cms branch for a Vercel preview? The live site is not touched. Type yes: '
    read -r ok
    [ "$ok" = "yes" ] || die "nothing pushed"
    git -c user.name="${GIT_AUTHOR_NAME:-GYA}" -c user.email="${GIT_AUTHOR_EMAIL:-rowayne@gyaclients.com}" \
      commit --quiet -m "$(cd "$rel" && node -p "'v' + require('./package.json').version" 2>/dev/null || echo release): staged from push-to-github.sh"
    git push --quiet --force origin cms
    say "Staged on cms: $(git rev-parse --short HEAD). Vercel builds a preview of the cms branch."
    say "When it is tested: bash push-to-github.sh promote"
    ;;
  status)
    fresh_clone
    say "Live (main):   $(git log -1 --format='%h %s (%cr)' origin/main)"
    if git rev-parse --quiet --verify origin/cms >/dev/null; then
      say "Staged (cms):  $(git log -1 --format='%h %s (%cr)' origin/cms)"
      if git merge-base --is-ancestor origin/main origin/cms; then echo "  cms is main plus the staged release: ready to promote"; else echo "  main has moved since staging: stage again before promoting"; fi
    else
      say "Nothing staged (no cms branch)"
    fi
    ;;
  promote)
    fresh_clone
    git rev-parse --quiet --verify origin/cms >/dev/null || die "nothing staged: run stage first"
    git merge-base --is-ancestor origin/main origin/cms || die "main has changed since the release was staged (someone uploaded to main). Stage it again."
    [ "$(git rev-parse origin/main)" != "$(git rev-parse origin/cms)" ] || die "main is already the staged release"
    say "Live now:  $(git log -1 --format='%h %s' origin/main)"
    say "Goes live: $(git log -1 --format='%h %s' origin/cms)"
    printf '\nThis changes the live website. Type LIVE to go ahead: '
    read -r ok
    [ "$ok" = "LIVE" ] || die "nothing changed"
    git rev-parse origin/main > "$LAST"
    git push --quiet origin origin/cms:refs/heads/main
    say "main is now $(git rev-parse --short origin/cms). Vercel deploys production. rollback undoes it."
    ;;
  rollback)
    [ -f "$LAST" ] || die "no promote recorded on this computer"
    fresh_clone
    back="$(cat "$LAST")"
    say "main goes back to: $(git log -1 --format='%h %s' "$back")"
    printf '\nThis changes the live website. Type ROLLBACK to go ahead: '
    read -r ok
    [ "$ok" = "ROLLBACK" ] || die "nothing changed"
    git push --quiet --force origin "$back:refs/heads/main"
    say "main is back at $(git rev-parse --short "$back"). Vercel deploys it."
    ;;
  *)
    sed -n '2,10p' "$0"
    exit 1
    ;;
esac
