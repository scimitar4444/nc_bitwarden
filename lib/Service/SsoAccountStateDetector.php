<?php

declare(strict_types=1);

namespace OCA\NcBitwarden\Service;

/**
 * Classifies the cryptographic state returned by Vaultwarden after SSO.
 *
 * A new SSO account may only enter the destructive set-password path when
 * Vaultwarden confirms both that no master password exists and that no user
 * or account key material has been created yet. Conflicting or incomplete
 * responses are rejected instead of being guessed.
 */
final class SsoAccountStateDetector {
	public const INITIALIZED = 'initialized';
	public const UNINITIALIZED = 'uninitialized';
	public const PROFILE_REQUIRED = 'profile_required';
	public const INCONSISTENT = 'inconsistent';

	public function fromToken(array $token): string {
		[$hasMasterPasswordPresent, $hasMasterPassword]
			= $this->read(
				$this->decryptionOptions($token),
				['HasMasterPassword', 'hasMasterPassword'],
			);

		$hasMasterPassword = $hasMasterPasswordPresent
			&& is_bool($hasMasterPassword)
				? $hasMasterPassword
				: null;

		$material = $this->tokenKeyMaterial($token);

		if ($hasMasterPassword === false) {
			return $material['any']
				? self::INCONSISTENT
				: self::PROFILE_REQUIRED;
		}

		if ($hasMasterPassword === true) {
			return $material['complete']
				? self::INITIALIZED
				: self::INCONSISTENT;
		}

		if ($material['complete']) {
			return self::INITIALIZED;
		}

		return $material['any']
			? self::INCONSISTENT
			: self::PROFILE_REQUIRED;
	}

	public function fromTokenAndProfile(
		array $token,
		array $profile,
	): string {
		$tokenState = $this->fromToken($token);

		[$statusPresent, $status] = $this->read(
			$profile,
			['_status', '_Status'],
		);

		$profileFieldsPresent
			= $this->hasAnyKey(
				$profile,
				['key', 'Key'],
			)
			&& $this->hasAnyKey(
				$profile,
				['privateKey', 'PrivateKey'],
			)
			&& $this->hasAnyKey(
				$profile,
				['accountKeys', 'AccountKeys'],
			);

		if (!$statusPresent || !is_int($status) || !$profileFieldsPresent) {
			return self::INCONSISTENT;
		}

		$profileMaterial = $this->profileKeyMaterial($profile);

		/*
		 * Vaultwarden's profile status 1 (Invited) is derived directly from
		 * an empty password_hash. The three explicit empty key fields mirror
		 * the same uninitialized User record and the set-password guard.
		 */
		if (
			$status === 1
			&& !$profileMaterial['any']
			&& $tokenState === self::PROFILE_REQUIRED
		) {
			return self::UNINITIALIZED;
		}

		if (
			$status === 0
			&& $profileMaterial['complete']
			&& $tokenState === self::INITIALIZED
		) {
			return self::INITIALIZED;
		}

		return self::INCONSISTENT;
	}

	/**
	 * @return array{any: bool, complete: bool}
	 */
	private function tokenKeyMaterial(array $token): array {
		$options = $this->decryptionOptions($token);
		$unlock = $this->arrayValue(
			$options,
			['MasterPasswordUnlock', 'masterPasswordUnlock'],
		);

		$userKey = $this->firstNonEmptyString(
			$token,
			['Key', 'key'],
		) ?? $this->firstNonEmptyString(
			$unlock,
			[
				'MasterKeyWrappedUserKey',
				'masterKeyWrappedUserKey',
				'MasterKeyEncryptedUserKey',
				'masterKeyEncryptedUserKey',
			],
		);

		$salt = $this->firstNonEmptyString(
			$unlock,
			['Salt', 'salt'],
		);

		$privateKey = $this->firstNonEmptyString(
			$token,
			['PrivateKey', 'privateKey'],
		) ?? $this->accountPrivateKey($token);

		$publicKey = $this->accountPublicKey($token);

		return [
			'any' => $userKey !== null
				|| $salt !== null
				|| $privateKey !== null
				|| $publicKey !== null,
			'complete' => $userKey !== null
				&& $salt !== null
				&& $privateKey !== null,
		];
	}

	/**
	 * @return array{any: bool, complete: bool}
	 */
	private function profileKeyMaterial(array $profile): array {
		$userKey = $this->firstNonEmptyString(
			$profile,
			['key', 'Key'],
		);

		$privateKey = $this->firstNonEmptyString(
			$profile,
			['privateKey', 'PrivateKey'],
		) ?? $this->accountPrivateKey($profile);

		$publicKey = $this->accountPublicKey($profile);

		return [
			'any' => $userKey !== null
				|| $privateKey !== null
				|| $publicKey !== null,
			'complete' => $userKey !== null
				&& $privateKey !== null
				&& $publicKey !== null,
		];
	}

	private function decryptionOptions(array $token): array {
		return $this->arrayValue(
			$token,
			['UserDecryptionOptions', 'userDecryptionOptions'],
		);
	}

	private function accountPrivateKey(array $data): ?string {
		$accountKeys = $this->arrayValue(
			$data,
			['AccountKeys', 'accountKeys'],
		);

		$keyPair = $this->arrayValue(
			$accountKeys,
			[
				'PublicKeyEncryptionKeyPair',
				'publicKeyEncryptionKeyPair',
			],
		);

		return $this->firstNonEmptyString(
			$keyPair,
			[
				'WrappedPrivateKey',
				'wrappedPrivateKey',
				'EncryptedPrivateKey',
				'encryptedPrivateKey',
			],
		);
	}

	private function accountPublicKey(array $data): ?string {
		$accountKeys = $this->arrayValue(
			$data,
			['AccountKeys', 'accountKeys'],
		);

		$keyPair = $this->arrayValue(
			$accountKeys,
			[
				'PublicKeyEncryptionKeyPair',
				'publicKeyEncryptionKeyPair',
			],
		);

		return $this->firstNonEmptyString(
			$keyPair,
			['PublicKey', 'publicKey'],
		);
	}

	private function arrayValue(array $data, array $keys): array {
		[, $value] = $this->read($data, $keys);

		return is_array($value) ? $value : [];
	}

	private function firstNonEmptyString(
		array $data,
		array $keys,
	): ?string {
		[, $value] = $this->read($data, $keys);

		if (!is_string($value)) {
			return null;
		}

		$value = trim($value);

		return $value === '' ? null : $value;
	}

	private function hasAnyKey(array $data, array $keys): bool {
		foreach ($keys as $key) {
			if (array_key_exists($key, $data)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * @return array{0: bool, 1: mixed}
	 */
	private function read(array $data, array $keys): array {
		foreach ($keys as $key) {
			if (array_key_exists($key, $data)) {
				return [true, $data[$key]];
			}
		}

		return [false, null];
	}
}
