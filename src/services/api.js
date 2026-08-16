import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

const base = (path) => generateUrl(`/apps/nc_bitwarden${path}`)

export const VaultwardenApi = {
  async getSettings() { return (await axios.get(base('/settings'))).data },
  async saveSettings(data) { return (await axios.post(base('/settings'), data)).data },
  async getPreferences() {
    return (
      await axios.get(base('/settings/preferences'))
    ).data
  },
  async savePreferences(preferences) {
    return (
      await axios.post(
        base('/settings/preferences'),
        { preferences },
      )
    ).data
  },

  async getPasskeyUnlockConfig() {
    return (
      await axios.get(base('/passkey-unlock'))
    ).data
  },

  async savePasskeyUnlockConfig(config) {
    return (
      await axios.post(
        base('/passkey-unlock'),
        { config },
      )
    ).data
  },

  async deletePasskeyUnlockConfig() {
    return (
      await axios.delete(base('/passkey-unlock'))
    ).data
  },

  async getAdminSettings() {
    return (
      await axios.get(base('/admin-settings'))
    ).data
  },

  async saveAdminSettings(data) {
    return (
      await axios.post(base('/admin-settings'), data)
    ).data
  },

  async getCurrentUserProfile() {
    const userId = document.head?.getAttribute('data-user')

    if (!userId) {
      return null
    }

    const response = await axios.get(
      generateUrl(`/ocs/v2.php/cloud/users/${encodeURIComponent(userId)}`),
      {
        headers: {
          'OCS-APIRequest': 'true',
        },
        params: {
          format: 'json',
        },
      },
    )

    return response.data?.ocs?.data ?? null
  },

  async prelogin(email) { return (await axios.post(base('/api/prelogin'), { email })).data },
  async login(email, passwordHash, twoFactorToken = null) {
    const data = { email, passwordHash }

    if (twoFactorToken) {
      data.twoFactorProvider = 0
      data.twoFactorToken = twoFactorToken
      data.twoFactorRemember = false
    }

    return (await axios.post(base('/api/login'), data)).data
  },
  async refresh() { return (await axios.post(base('/api/refresh'))).data },
  async logout() { return (await axios.post(base('/api/logout'))).data },
  async setMasterPassword(data) {
    return (
      await axios.post(
        base('/api/accounts/set-password'),
        data,
      )
    ).data
  },

  async changeMasterPassword(data) {
    return (
      await axios.post(
        base('/api/accounts/password'),
        data,
      )
    ).data
  },

  async startSso() {
    return (
      await axios.post(base('/sso/start'))
    ).data
  },

  async completeSsoTwoFactor(twoFactorToken) {
    return (
      await axios.post(
        base('/api/sso/two-factor'),
        { twoFactorToken },
      )
    ).data
  },

  async getSsoResult() {
    return (
      await axios.get(base('/api/sso/result'))
    ).data
  },

  async sync() { return (await axios.get(base('/api/sync'))).data },
  async getCiphers() { return (await axios.get(base('/api/ciphers'))).data },
  async getCipher(id) {
    return (
      await axios.get(base(`/api/ciphers/${id}`))
    ).data
  },
  async createCipher(data) {
    return (
      await axios.post(base('/api/ciphers'), data)
    ).data
  },

  async createOrganizationCipher(data) {
    return (
      await axios.post(base('/api/ciphers/create'), data)
    ).data
  },

  async shareCipher(id, data) {
    return (
      await axios.post(
        base(`/api/ciphers/${id}/share`),
        data,
      )
    ).data
  },

  async updateCipherCollections(id, collectionIds) {
    return (
      await axios.post(
        base(`/api/ciphers/${id}/collections`),
        { collectionIds },
      )
    ).data
  },

  async updateCipher(id, data) {
    return (
      await axios.put(base(`/api/ciphers/${id}`), data)
    ).data
  },
  async updateCipherPartial(id, data) {
    return (
      await axios.post(
        base(`/api/ciphers/${id}/partial`),
        data,
      )
    ).data
  },
  async trashCipher(id) {
    return (
      await axios.put(
        base(`/api/ciphers/${id}/delete`),
      )
    ).data
  },

  async restoreCipher(id) {
    return (
      await axios.put(
        base(`/api/ciphers/${id}/restore`),
      )
    ).data
  },

  async deleteCipher(id) {
    return (
      await axios.delete(
        base(`/api/ciphers/${id}`),
      )
    ).data
  },

  async createAttachment(id, data) {
    return (
      await axios.post(
        base(`/api/ciphers/${id}/attachment/v2`),
        data,
      )
    ).data
  },

  async uploadAttachment(
    id,
    attachmentId,
    encryptedData,
    encryptedFileName,
  ) {
    const formData = new FormData()

    formData.append(
      'data',
      new Blob(
        [encryptedData],
        { type: 'application/octet-stream' },
      ),
      encryptedFileName || 'data',
    )

    return (
      await axios.post(
        base(
          `/api/ciphers/${id}`
          + `/attachment/${attachmentId}`,
        ),
        formData,
      )
    ).data
  },

  async downloadAttachment(id, attachmentId) {
    return (
      await axios.get(
        base(
          `/api/ciphers/${id}`
          + `/attachment/${attachmentId}`,
        ),
        {
          responseType: 'arraybuffer',
        },
      )
    ).data
  },

  async deleteAttachment(id, attachmentId) {
    return (
      await axios.delete(
        base(
          `/api/ciphers/${id}`
          + `/attachment/${attachmentId}`,
        ),
      )
    ).data
  },

  async getFolders() { return (await axios.get(base('/api/folders'))).data },
  async createFolder(data) { return (await axios.post(base('/api/folders'), data)).data },
  async updateFolder(id, data) { return (await axios.post(base(`/api/folders/${id}`), data)).data },
  async deleteFolder(id) { return (await axios.post(base(`/api/folders/${id}/delete`))).data },

  async getCollectionDetails(organizationId, collectionId) {
    return (
      await axios.get(
        base(`/api/organizations/${organizationId}/collections/${collectionId}/details`),
      )
    ).data
  },

  async createCollection(organizationId, data) {
    return (
      await axios.post(
        base(`/api/organizations/${organizationId}/collections`),
        data,
      )
    ).data
  },

  async updateCollection(organizationId, collectionId, data) {
    return (
      await axios.post(
        base(`/api/organizations/${organizationId}/collections/${collectionId}`),
        data,
      )
    ).data
  },

  async deleteCollection(organizationId, collectionId) {
    return (
      await axios.post(
        base(`/api/organizations/${organizationId}/collections/${collectionId}/delete`),
      )
    ).data
  },
}
