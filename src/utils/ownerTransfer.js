export const OWNER_TRANSFER_UNVERIFIED =
  'owner_transfer_unverified'

export function responseStatus(exception) {
  return Number(
    exception?.response?.status
    ?? exception?.response?.data?.status
    ?? exception?.status
    ?? 0,
  ) || 0
}

function unverifiedTransferError(
  deleteError,
  verificationError,
) {
  const exception = new Error(
    'The source deletion could not be verified.',
  )

  exception.code = OWNER_TRANSFER_UNVERIFIED
  exception.cause = verificationError
  exception.deleteError = deleteError

  return exception
}

async function rollbackTarget(
  targetId,
  deleteCipher,
  onRollbackError,
) {
  try {
    await deleteCipher(targetId)
  } catch (exception) {
    onRollbackError(exception)
  }
}

export async function completeOwnerTransfer({
  sourceId,
  targetId,
  copyAttachments,
  deleteCipher,
  getCipher,
  onRollbackError = () => {},
}) {
  try {
    await copyAttachments()
  } catch (exception) {
    await rollbackTarget(
      targetId,
      deleteCipher,
      onRollbackError,
    )
    throw exception
  }

  try {
    await deleteCipher(sourceId)
    return
  } catch (deleteError) {
    try {
      await getCipher(sourceId)
    } catch (verificationError) {
      if (responseStatus(verificationError) === 404) {
        return
      }

      throw unverifiedTransferError(
        deleteError,
        verificationError,
      )
    }

    await rollbackTarget(
      targetId,
      deleteCipher,
      onRollbackError,
    )
    throw deleteError
  }
}
