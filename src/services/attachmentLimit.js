/**
 */

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

export const DEFAULT_ATTACHMENT_MAX_MB = 25
export const MAX_ATTACHMENT_MAX_MB = 50

const endpoint = () =>
  generateUrl(
    '/apps/nc_bitwarden/attachment-settings',
  )

let cachedSettings = null
let loadingPromise = null

function normalizeSettings(value = {}) {
  const maxMb = Math.max(
    1,
    Math.min(
      MAX_ATTACHMENT_MAX_MB,
      Number(value.maxMb)
        || DEFAULT_ATTACHMENT_MAX_MB,
    ),
  )

  return {
    maxMb,
    maxBytes:
      Number(value.maxBytes)
      || maxMb * 1024 * 1024,
  }
}

export async function loadAttachmentLimit(
  force = false,
) {
  if (!force && cachedSettings) {
    return cachedSettings
  }

  if (!force && loadingPromise) {
    return loadingPromise
  }

  loadingPromise = axios
    .get(endpoint())
    .then(response => {
      cachedSettings = normalizeSettings(
        response.data,
      )

      return cachedSettings
    })
    .finally(() => {
      loadingPromise = null
    })

  return loadingPromise
}

export async function saveAttachmentLimit(maxMb) {
  const normalized = Math.max(
    1,
    Math.min(
      MAX_ATTACHMENT_MAX_MB,
      Number(maxMb) || DEFAULT_ATTACHMENT_MAX_MB,
    ),
  )

  const response = await axios.post(
    endpoint(),
    { maxMb: normalized },
  )

  cachedSettings = normalizeSettings(
    response.data,
  )

  return cachedSettings
}
