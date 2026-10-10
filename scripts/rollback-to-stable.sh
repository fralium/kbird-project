#!/usr/bin/env bash
set -euo pipefail

TAG_NAME=""
FORCE="false"
DRY_RUN="false"

for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE="true"
      ;;
    --dry-run)
      DRY_RUN="true"
      ;;
    *)
      if [[ -z "${TAG_NAME}" ]]; then
        TAG_NAME="$arg"
      fi
      ;;
  esac
done

if [[ -z "${TAG_NAME}" && -f "$(dirname "$0")/../.last-stable-tag" ]]; then
  TAG_NAME="$(cat "$(dirname "$0")/../.last-stable-tag")"
fi

if [[ -z "${TAG_NAME}" ]]; then
  echo "未提供标签，且 .last-stable-tag 不存在。" >&2
  exit 1
fi

TAG_EXISTS="false"
if git tag --list "${TAG_NAME}" | grep -q "^${TAG_NAME}$"; then
  TAG_EXISTS="true"
fi

if [[ "${TAG_EXISTS}" != "true" && "${DRY_RUN}" != "true" ]]; then
  echo "找不到标签: ${TAG_NAME}" >&2
  exit 1
fi

if [[ "${FORCE}" == "true" ]]; then
  if [[ "${DRY_RUN}" == "true" ]]; then
    if [[ "${TAG_EXISTS}" != "true" ]]; then
      echo "🧪 DryRun: 标签 ${TAG_NAME} 当前不存在（演练模式允许）。"
    fi
    echo "🧪 DryRun: 将执行 git switch --detach --force \"${TAG_NAME}\""
    exit 0
  fi
  git switch --detach --force "${TAG_NAME}"
else
  if [[ "${DRY_RUN}" == "true" ]]; then
    if [[ "${TAG_EXISTS}" != "true" ]]; then
      echo "🧪 DryRun: 标签 ${TAG_NAME} 当前不存在（演练模式允许）。"
    fi
    echo "🧪 DryRun: 将执行 git switch --detach \"${TAG_NAME}\""
    exit 0
  fi
  git switch --detach "${TAG_NAME}"
fi

echo "✅ 已切换到稳定标签: ${TAG_NAME}"
echo "提示：确认无误后，可基于该标签创建 hotfix 分支。"
