#!/usr/bin/env bash
set -euo pipefail

# Stage 10 rollback helper.
# Expected env vars:
# - RELEASE_IMAGE_TAG (currently deployed tag)
# - ROLLBACK_IMAGE_TAG (previous known-good tag)
# - DEPLOY_CMD (deploy command template; optional)

if [[ -z "${ROLLBACK_IMAGE_TAG:-}" ]]; then
  echo "ROLLBACK_IMAGE_TAG is required."
  exit 1
fi

echo "Starting rollback to tag: ${ROLLBACK_IMAGE_TAG}"

if [[ -n "${DEPLOY_CMD:-}" ]]; then
  echo "Executing custom deploy command."
  # shellcheck disable=SC2086
  eval ${DEPLOY_CMD}
else
  echo "No DEPLOY_CMD provided. Run your platform deployment command with tag ${ROLLBACK_IMAGE_TAG}."
fi

echo "Rollback command completed."
