<?php

declare(strict_types=1);

use OCA\NcBitwarden\Service\SsoAccountStateDetector;

require_once __DIR__ . '/../lib/Service/SsoAccountStateDetector.php';

function assertState(
	string $expected,
	string $actual,
	string $message,
): void {
	if ($expected === $actual) {
		return;
	}

	throw new RuntimeException(
		$message
			. ': expected '
			. $expected
			. ', got '
			. $actual,
	);
}

$detector = new SsoAccountStateDetector();

$newSsoToken = [
	'access_token' => 'redacted',
	'PrivateKey' => null,
	'Kdf' => 0,
	'KdfIterations' => 600000,
	'KdfMemory' => null,
	'KdfParallelism' => null,
	'AccountKeys' => null,
	'UserDecryptionOptions' => [
		'HasMasterPassword' => false,
		'MasterPasswordUnlock' => null,
		'Object' => 'userDecryptionOptions',
	],
];

$newSsoProfile = [
	'_status' => 1,
	'email' => 'new.user@example.test',
	'key' => '',
	'privateKey' => null,
	'accountKeys' => null,
	'object' => 'profile',
];

assertState(
	SsoAccountStateDetector::PROFILE_REQUIRED,
	$detector->fromToken($newSsoToken),
	'New SSO token requires authoritative profile confirmation',
);

assertState(
	SsoAccountStateDetector::UNINITIALIZED,
	$detector->fromTokenAndProfile(
		$newSsoToken,
		$newSsoProfile,
	),
	'New SSO account is recognized as uninitialized',
);

$newSsoTokenWithoutPasswordFlag = $newSsoToken;
unset(
	$newSsoTokenWithoutPasswordFlag['UserDecryptionOptions']
		['HasMasterPassword'],
);
$newSsoTokenWithoutPasswordFlag['AccountKeys'] = [
	'publicKeyEncryptionKeyPair' => [
		'wrappedPrivateKey' => null,
		'publicKey' => null,
	],
];

assertState(
	SsoAccountStateDetector::UNINITIALIZED,
	$detector->fromTokenAndProfile(
		$newSsoTokenWithoutPasswordFlag,
		$newSsoProfile,
	),
	'Missing HasMasterPassword falls back to explicit profile state',
);

$existingSsoToken = [
	'access_token' => 'redacted',
	'Key' => '2.encrypted-user-key',
	'PrivateKey' => '2.encrypted-private-key',
	'AccountKeys' => [
		'publicKeyEncryptionKeyPair' => [
			'wrappedPrivateKey' => '2.encrypted-private-key',
			'publicKey' => 'public-key',
		],
	],
	'UserDecryptionOptions' => [
		'HasMasterPassword' => true,
		'MasterPasswordUnlock' => [
			'Salt' => 'user@example.test',
			'MasterKeyWrappedUserKey'
				=> '2.encrypted-user-key',
		],
	],
];

assertState(
	SsoAccountStateDetector::INITIALIZED,
	$detector->fromToken($existingSsoToken),
	'Existing SSO account remains on the normal unlock path',
);

$existingSsoProfile = [
	'_status' => 0,
	'email' => 'user@example.test',
	'key' => '2.encrypted-user-key',
	'privateKey' => '2.encrypted-private-key',
	'accountKeys' => [
		'publicKeyEncryptionKeyPair' => [
			'wrappedPrivateKey' => '2.encrypted-private-key',
			'publicKey' => 'public-key',
		],
	],
];

assertState(
	SsoAccountStateDetector::INITIALIZED,
	$detector->fromTokenAndProfile(
		$existingSsoToken,
		$existingSsoProfile,
	),
	'Existing SSO account is confirmed by token and profile',
);

$conflictingPasswordFlag = $existingSsoToken;
$conflictingPasswordFlag['UserDecryptionOptions']
	['HasMasterPassword'] = false;

assertState(
	SsoAccountStateDetector::INCONSISTENT,
	$detector->fromToken($conflictingPasswordFlag),
	'Existing key material cannot be treated as a new account',
);

$passwordOnlyProfile = $newSsoProfile;
$passwordOnlyProfile['_status'] = 0;

assertState(
	SsoAccountStateDetector::INCONSISTENT,
	$detector->fromTokenAndProfile(
		$newSsoTokenWithoutPasswordFlag,
		$passwordOnlyProfile,
	),
	'An existing password state can never enter first-time setup',
);

$partiallyInitializedProfile = $newSsoProfile;
$partiallyInitializedProfile['privateKey']
	= '2.existing-private-key';

assertState(
	SsoAccountStateDetector::INCONSISTENT,
	$detector->fromTokenAndProfile(
		$newSsoToken,
		$partiallyInitializedProfile,
	),
	'Partial key material is rejected instead of reinitialized',
);

fwrite(
	STDOUT,
	"SSO account-state regression tests passed.\n",
);
