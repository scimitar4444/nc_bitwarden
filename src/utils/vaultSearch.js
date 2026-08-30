export function normalizeVaultSearch(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase()
}

export function vaultItemSearchText(item) {
  const customFieldValues = (
    item?.fields
    ?? []
  ).flatMap(field => {
    const values = [
      field?.name,
    ]

    if (
      Number(field?.type) === 0
      || Number(field?.type) === 2
    ) {
      values.push(field?.value)
    }

    return values
  })

  const values = [
    item?.name,
    item?.notes,
    item?.login?.username,
    ...(item?.login?.uris ?? []).map(uri => uri?.uri),
    item?.card?.cardholderName,
    item?.card?.brand,
    item?.identity?.title,
    item?.identity?.firstName,
    item?.identity?.middleName,
    item?.identity?.lastName,
    item?.identity?.username,
    item?.identity?.company,
    item?.identity?.email,
    item?.identity?.phone,
    item?.identity?.address1,
    item?.identity?.address2,
    item?.identity?.address3,
    item?.identity?.city,
    item?.identity?.state,
    item?.identity?.postalCode,
    item?.identity?.country,
    item?.sshKey?.publicKey,
    item?.sshKey?.keyFingerprint,
    ...(item?.attachments ?? []).map(
      attachment => attachment?.fileName,
    ),
    ...customFieldValues,
  ]

  return normalizeVaultSearch(
    values
      .filter(value =>
        value !== null
        && value !== undefined,
      )
      .map(value => String(value))
      .join('\n'),
  )
}

export function createVaultSearchIndex(items) {
  return new Map(
    (items ?? []).map(item => [
      item,
      vaultItemSearchText(item),
    ]),
  )
}
