<?php

return [
	'routes' => [
		['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],

		['name' => 'vaultwarden_api#prelogin',    'url' => '/api/prelogin',      'verb' => 'POST'],
		['name' => 'vaultwarden_api#login',        'url' => '/api/login',         'verb' => 'POST'],
		['name' => 'vaultwarden_api#refresh',      'url' => '/api/refresh',       'verb' => 'POST'],
		['name' => 'vaultwarden_api#logout',       'url' => '/api/logout',        'verb' => 'POST'],
		['name' => 'vaultwarden_api#setPassword',    'url' => '/api/accounts/set-password', 'verb' => 'POST'],
		['name' => 'vaultwarden_api#changePassword', 'url' => '/api/accounts/password',     'verb' => 'POST'],

		['name' => 'sso#start',    'url' => '/sso/start',      'verb' => 'POST'],
		['name' => 'sso#callback', 'url' => '/sso/callback',   'verb' => 'GET'],
		['name' => 'sso#twoFactor', 'url' => '/api/sso/two-factor', 'verb' => 'POST'],
		['name' => 'sso#result',   'url' => '/api/sso/result', 'verb' => 'GET'],
		['name' => 'vaultwarden_api#sync',         'url' => '/api/sync',          'verb' => 'GET'],
		['name' => 'vaultwarden_api#getCiphers',   'url' => '/api/ciphers',       'verb' => 'GET'],
		['name' => 'vaultwarden_api#getCipher',    'url' => '/api/ciphers/{id}',  'verb' => 'GET'],
		['name' => 'vaultwarden_api#createCipher',              'url' => '/api/ciphers',                  'verb' => 'POST'],
		['name' => 'vaultwarden_api#createOrganizationCipher',  'url' => '/api/ciphers/create',           'verb' => 'POST'],
		['name' => 'vaultwarden_api#shareCipher',               'url' => '/api/ciphers/{id}/share',       'verb' => 'POST'],
		['name' => 'vaultwarden_api#updateCipherCollections',   'url' => '/api/ciphers/{id}/collections', 'verb' => 'POST'],
		['name' => 'vaultwarden_api#updateCipher',              'url' => '/api/ciphers/{id}',             'verb' => 'PUT'],
		['name' => 'vaultwarden_api#updateCipherPartial',       'url' => '/api/ciphers/{id}/partial',     'verb' => 'POST'],
		['name' => 'vaultwarden_api#trashCipher',   'url' => '/api/ciphers/{id}/delete',  'verb' => 'PUT'],
		['name' => 'vaultwarden_api#restoreCipher', 'url' => '/api/ciphers/{id}/restore', 'verb' => 'PUT'],
		['name' => 'vaultwarden_api#deleteCipher',  'url' => '/api/ciphers/{id}',         'verb' => 'DELETE'],
		['name' => 'vaultwarden_api#createAttachment',   'url' => '/api/ciphers/{id}/attachment/v2',                       'verb' => 'POST'],
		['name' => 'vaultwarden_api#uploadAttachment',   'url' => '/api/ciphers/{id}/attachment/{attachmentId}',           'verb' => 'POST'],
		['name' => 'vaultwarden_api#downloadAttachment', 'url' => '/api/ciphers/{id}/attachment/{attachmentId}',           'verb' => 'GET'],
		['name' => 'vaultwarden_api#deleteAttachment',   'url' => '/api/ciphers/{id}/attachment/{attachmentId}',           'verb' => 'DELETE'],
		['name' => 'vaultwarden_api#getFolders',   'url' => '/api/folders',       'verb' => 'GET'],
		['name' => 'vaultwarden_api#createFolder', 'url' => '/api/folders',       'verb' => 'POST'],
		['name' => 'vaultwarden_api#updateFolderPost',   'url' => '/api/folders/{id}',        'verb' => 'POST'],
		['name' => 'vaultwarden_api#updateFolderPut',    'url' => '/api/folders/{id}',        'verb' => 'PUT'],
		['name' => 'vaultwarden_api#deleteFolderPost',   'url' => '/api/folders/{id}/delete', 'verb' => 'POST'],
		['name' => 'vaultwarden_api#deleteFolderDelete', 'url' => '/api/folders/{id}',        'verb' => 'DELETE'],

		['name' => 'vaultwarden_api#getCollectionDetails',    'url' => '/api/organizations/{organizationId}/collections/{collectionId}/details', 'verb' => 'GET'],
		['name' => 'vaultwarden_api#createCollection',        'url' => '/api/organizations/{organizationId}/collections',                        'verb' => 'POST'],
		['name' => 'vaultwarden_api#updateCollectionPost',    'url' => '/api/organizations/{organizationId}/collections/{collectionId}',         'verb' => 'POST'],
		['name' => 'vaultwarden_api#updateCollectionPut',     'url' => '/api/organizations/{organizationId}/collections/{collectionId}',         'verb' => 'PUT'],
		['name' => 'vaultwarden_api#deleteCollectionPost',    'url' => '/api/organizations/{organizationId}/collections/{collectionId}/delete',  'verb' => 'POST'],
		['name' => 'vaultwarden_api#deleteCollectionDelete',  'url' => '/api/organizations/{organizationId}/collections/{collectionId}',         'verb' => 'DELETE'],

		[
			'name' => 'attachment_settings#getSettings',
			'url' => '/attachment-settings',
			'verb' => 'GET',
		],
		[
			'name' => 'attachment_settings#saveSettings',
			'url' => '/attachment-settings',
			'verb' => 'POST',
		],

		['name' => 'admin_settings#getSettings',  'url' => '/admin-settings', 'verb' => 'GET'],
		['name' => 'admin_settings#saveSettings', 'url' => '/admin-settings', 'verb' => 'POST'],

		['name' => 'passkey_unlock#getConfig',    'url' => '/passkey-unlock', 'verb' => 'GET'],
		['name' => 'passkey_unlock#saveConfig',   'url' => '/passkey-unlock', 'verb' => 'POST'],
		['name' => 'passkey_unlock#deleteConfig', 'url' => '/passkey-unlock', 'verb' => 'DELETE'],

		['name' => 'settings#getSettings',      'url' => '/settings',             'verb' => 'GET'],
		['name' => 'settings#saveSettings',     'url' => '/settings',             'verb' => 'POST'],
		['name' => 'settings#getPreferences',   'url' => '/settings/preferences', 'verb' => 'GET'],
		['name' => 'settings#savePreferences',  'url' => '/settings/preferences', 'verb' => 'POST'],
	],
];
