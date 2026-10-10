#!/usr/bin/env bash
set -euo pipefail

TAG_NAME=""
MESSAGE="KBird stable release"
DRY_RUN="false"

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN="true"
      ;;
    *)
      if [[ -z "${TAG_NAME}" ]]; then
        TAG_NAME="$arg"
      elif [[ "${MESSAGE}" == "KBird stable release" ]]; then
        MESSAGE="$arg"
      fi
      ;;
  esac
done

if [[ -z "${TAG_NAME}" ]]; then
  TAG_NAME="stable-$(date +%Y%m%d-%H%M)"
fi

if git tag --list "${TAG_NAME}" | grep -q "^${TAG_NAME}$"; then
  echo "标签 '${TAG_NAME}' 已存在，请换一个名称。" >&2
  exit 1
fi

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "🧪 DryRun: 将创建标签 ${TAG_NAME}"
  echo "🧪 DryRun: 将写入 .last-stable-tag"
  echo "🧪 DryRun: 将执行 git tag -a \"${TAG_NAME}\" -m \"${MESSAGE}\""
  exit 0
fi

git tag -a "${TAG_NAME}" -m "${MESSAGE}"
echo "${TAG_NAME}" > "$(dirname "$0")/../.last-stable-tag"

echo "✅ 稳定版本标签已创建: ${TAG_NAME}"
echo "📌 已记录到 .last-stable-tag"
echo "如需推送标签请执行: git push origin ${TAG_NAME}"
