import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'
import { babelParse, compileScript, parse } from 'vue/compiler-sfc'

import {
  decryptEncString,
  generateUserSymmetricKey,
} from '../src/services/crypto.js'

const formUrl = new URL('../src/components/ItemForm.vue', import.meta.url)
const source = await readFile(formUrl, 'utf8')
const compiled = compileScript(parse(source).descriptor, {
  id: 'item-form-save-regression',
  genDefaultAs: 'ItemFormUnderTest',
})
const imports = babelParse(compiled.content, { sourceType: 'module' })
  .program.body.filter(node => node.type === 'ImportDeclaration')

// Exercise the real Vue setup, payload builder, save branches and cryptography.
// Only visual children, localization and outbound API calls are substituted.
let setupSource = compiled.content
for (const declaration of [...imports].reverse()) {
  setupSource = setupSource.slice(0, declaration.start)
    + setupSource.slice(declaration.end)
}

const accountId = '11111111-1111-4111-8111-111111111111'
const organizationId = '22222222-2222-4222-8222-222222222222'
const otherOrganizationId = '33333333-3333-4333-8333-333333333333'
const cipherId = '44444444-4444-4444-8444-444444444444'
const createdCipherId = '55555555-5555-4555-8555-555555555555'
const revisionDate = '2026-10-21T07:00:00.000Z'
const personalKey = generateUserSymmetricKey()
const organizationKey = generateUserSymmetricKey()
const otherOrganizationKey = generateUserSymmetricKey()

function existingItem(owner = null) {
  return {
    id: cipherId,
    type: 1,
    name: 'Existing entry',
    notes: 'Existing note',
    revisionDate,
    organizationId: owner,
    collectionIds: owner ? [`collection-${owner}`] : [],
    login: {
      username: 'test-user',
      password: 'test-password',
      uris: [],
    },
  }
}

async function itemForm(options = {}) {
  const requests = []
  const saved = []
  const props = {
    userKey: personalKey,
    vaultUserId: accountId,
    organizationKeys: {
      [organizationId]: organizationKey,
      [otherOrganizationId]: otherOrganizationKey,
    },
    collections: [organizationId, otherOrganizationId].map(id => ({
      id: `collection-${id}`,
      organizationId: id,
      name: 'Collection',
      readOnly: false,
    })),
    advancedMode: true,
    onSaved: value => saved.push(value),
    ...options,
  }
  const api = Object.fromEntries([
    'updateCipher', 'createCipher', 'createOrganizationCipher',
    'shareCipher', 'deleteCipher', 'updateCipherCollections',
  ].map(method => [method, async (...args) => {
    requests.push({ method, args })
    const body = args.at(-1)
    const payload = body?.cipher ?? body
    return {
      ...payload,
      id: ['updateCipher', 'shareCipher'].includes(method) ? args[0] : createdCipherId,
      revisionDate,
      collectionIds: body?.collectionIds ?? [],
    }
  }]))

  const bindings = {}
  for (const declaration of imports) {
    const moduleName = declaration.source.value
    let module
    if (moduleName === 'vue') {
      module = vue
    } else if (moduleName === '@nextcloud/l10n') {
      module = { t: (_app, text) => text }
    } else if (moduleName === '../services/api.js') {
      module = { VaultwardenApi: api }
    } else if (moduleName === '../services/attachments.js') {
      module = { copyCipherAttachments: async () => {} }
    } else if (moduleName.endsWith('.vue') || moduleName.startsWith('@nextcloud/vue/')) {
      module = { default: {} }
    } else {
      module = await import(new URL(moduleName, formUrl))
    }
    for (const specifier of declaration.specifiers) {
      const imported = specifier.type === 'ImportDefaultSpecifier'
        ? 'default'
        : specifier.imported.name
      bindings[specifier.local.name] = module[imported]
    }
  }

  const component = new Function(
    ...Object.keys(bindings),
    `${setupSource}\nreturn ItemFormUnderTest`,
  )(...Object.values(bindings))
  let model
  await renderToString(vue.createSSRApp({
    ...component,
    setup(componentProps, context) {
      model = component.setup(componentProps, context)
      return () => null
    },
  }, props))
  return { model, requests, saved }
}

async function plaintext(encrypted, key) {
  return decryptEncString(encrypted, key.encKey, key.macKey)
}

for (const owner of [null, organizationId]) {
  test(`editing ${owner ? 'an organization' : 'a personal'} item sends the loaded vault user ID`, async () => {
    const { model, requests, saved } = await itemForm({ item: existingItem(owner) })
    await model.save()

    assert.equal(model.error.value, '')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].method, 'updateCipher')
    const payload = requests[0].args[1]
    assert.equal(payload.encryptedFor, accountId)
    assert.equal(payload.organizationId, owner)
    assert.equal(payload.lastKnownRevisionDate, revisionDate)
    const key = owner ? organizationKey : personalKey
    assert.equal(await plaintext(payload.name, key), 'Existing entry')
    assert.equal(await plaintext(payload.login.password, key), 'test-password')
    assert.equal(saved[0].item.name, 'Existing entry')
    assert.equal(saved[0].item.login.password, 'test-password')
  })

  test(`creating ${owner ? 'an organization' : 'a personal'} item includes encryptedFor`, async () => {
    const { model, requests } = await itemForm({
      defaultOrganizationId: owner ?? '',
      defaultCollectionId: owner ? `collection-${owner}` : '',
    })
    model.form.name = 'New entry'
    model.form.password = 'new-password'
    await model.save()

    assert.equal(model.error.value, '')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].method, owner ? 'createOrganizationCipher' : 'createCipher')
    const requestBody = requests[0].args[0]
    const payload = requestBody.cipher ?? requestBody
    assert.equal(payload.encryptedFor, accountId)
    assert.equal(payload.organizationId, owner)
    assert.equal(await plaintext(payload.name, owner ? organizationKey : personalKey), 'New entry')
  })
}

test('inline note saves carry the same vault account context', async () => {
  const { model, requests } = await itemForm({
    item: existingItem(organizationId),
    headless: true,
    autoSave: true,
  })
  model.form.notes = 'Changed inline note'
  await model.save()

  assert.equal(model.error.value, '')
  assert.equal(requests[0].method, 'updateCipher')
  const payload = requests[0].args[1]
  assert.equal(payload.encryptedFor, accountId)
  assert.equal(await plaintext(payload.notes, organizationKey), 'Changed inline note')
})

test('sharing a personal item retains the user ID and encrypts for the organization', async () => {
  const { model, requests } = await itemForm({
    item: existingItem(),
    transferOrganizationId: organizationId,
    transferCollectionId: `collection-${organizationId}`,
  })
  await model.save()

  assert.equal(model.error.value, '')
  assert.equal(requests[0].method, 'shareCipher')
  const payload = requests[0].args[1].cipher
  assert.equal(payload.encryptedFor, accountId)
  assert.equal(payload.organizationId, organizationId)
  assert.equal(await plaintext(payload.login.password, organizationKey), 'test-password')
  await assert.rejects(plaintext(payload.login.password, personalKey))
})

for (const target of [null, otherOrganizationId]) {
  test(`moving an organization item to ${target ? 'another organization' : 'the personal vault'} keeps encryptedFor`, async () => {
    const { model, requests } = await itemForm({ item: existingItem(organizationId) })
    model.form.organizationId = target ?? ''
    model.form.collectionIds = target ? [`collection-${target}`] : []
    await model.save()

    assert.equal(model.error.value, '')
    assert.deepEqual(requests.map(request => request.method), ['createOrganizationCipher', 'deleteCipher'])
    const payload = requests[0].args[0].cipher
    assert.equal(payload.encryptedFor, accountId)
    assert.equal(payload.organizationId, target)
    assert.equal(await plaintext(payload.login.password, target ? otherOrganizationKey : personalKey), 'test-password')
    await assert.rejects(plaintext(payload.login.password, organizationKey))
  })
}

test('missing profile identity prevents sending a save request and retains the edits', async t => {
  t.mock.method(console, 'error', () => {})
  const { model, requests, saved } = await itemForm({
    item: existingItem(),
    vaultUserId: '',
  })
  model.form.notes = 'Unsaved changes'
  await model.save()

  assert.equal(requests.length, 0)
  assert.equal(saved.length, 0)
  assert.match(model.error.value, /vault account could not be identified/u)
  assert.equal(model.form.notes, 'Unsaved changes')
  assert.equal(model.saving.value, false)
})
