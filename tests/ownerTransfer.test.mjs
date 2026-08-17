import assert from 'node:assert/strict'
import test from 'node:test'
import {
	completeOwnerTransfer,
	OWNER_TRANSFER_UNVERIFIED,
} from '../src/utils/ownerTransfer.js'

function httpError(status, message = 'request failed') {
	const exception = new Error(message)
	exception.response = { status }

	return exception
}

test('owner transfer deletes the source after attachments were copied', async () => {
	const calls = []

	await completeOwnerTransfer({
		sourceId: 'source',
		targetId: 'target',
		copyAttachments: async () => {
			calls.push('copy')
		},
		deleteCipher: async (id) => {
			calls.push(`delete:${id}`)
		},
		getCipher: async () => {
			calls.push('verify')
		},
	})

	assert.deepEqual(calls, [
		'copy',
		'delete:source',
	])
})

test('attachment-copy failure rolls back only the target', async () => {
	const copyError = new Error('copy failed')
	const deleted = []

	await assert.rejects(
		completeOwnerTransfer({
			sourceId: 'source',
			targetId: 'target',
			copyAttachments: async () => {
				throw copyError
			},
			deleteCipher: async (id) => {
				deleted.push(id)
			},
			getCipher: async () => {
				throw new Error('verification must not run')
			},
		}),
		(exception) => exception === copyError,
	)

	assert.deepEqual(deleted, ['target'])
})

test('failed source deletion rolls back the target when the source still exists', async () => {
	const deleteError = new Error('delete timed out')
	const deleted = []

	await assert.rejects(
		completeOwnerTransfer({
			sourceId: 'source',
			targetId: 'target',
			copyAttachments: async () => {},
			deleteCipher: async (id) => {
				deleted.push(id)
				if (id === 'source') {
					throw deleteError
				}
			},
			getCipher: async (id) => ({ id }),
		}),
		(exception) => exception === deleteError,
	)

	assert.deepEqual(deleted, [
		'source',
		'target',
	])
})

test('source deletion is accepted when verification returns not found', async () => {
	const deleted = []

	await completeOwnerTransfer({
		sourceId: 'source',
		targetId: 'target',
		copyAttachments: async () => {},
		deleteCipher: async (id) => {
			deleted.push(id)
			throw new Error('connection closed after delete')
		},
		getCipher: async () => {
			throw httpError(404, 'not found')
		},
	})

	assert.deepEqual(deleted, ['source'])
})

test('rollback failure preserves the original transfer error', async () => {
	const copyError = new Error('copy failed')
	const rollbackError = new Error('rollback failed')
	const rollbackErrors = []

	await assert.rejects(
		completeOwnerTransfer({
			sourceId: 'source',
			targetId: 'target',
			copyAttachments: async () => {
				throw copyError
			},
			deleteCipher: async () => {
				throw rollbackError
			},
			getCipher: async () => {},
			onRollbackError: (exception) => {
				rollbackErrors.push(exception)
			},
		}),
		(exception) => exception === copyError,
	)

	assert.deepEqual(rollbackErrors, [rollbackError])
})

test('unverifiable source deletion preserves the target', async () => {
	const deleted = []

	await assert.rejects(
		completeOwnerTransfer({
			sourceId: 'source',
			targetId: 'target',
			copyAttachments: async () => {},
			deleteCipher: async (id) => {
				deleted.push(id)
				throw new Error('delete timed out')
			},
			getCipher: async () => {
				throw httpError(502, 'verification unavailable')
			},
		}),
		(exception) => exception.code === OWNER_TRANSFER_UNVERIFIED,
	)

	assert.deepEqual(deleted, ['source'])
})
