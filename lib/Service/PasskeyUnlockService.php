<?php

namespace OCA\NcBitwarden\Service;

use OCP\IConfig;

final class PasskeyUnlockService {
	private const CONFIG_KEY = 'passkey_unlock_config';
	private const FORMAT_VERSION = 1;
	private const MAX_JSON_LENGTH = 8192;

	private const ALLOWED_TRANSPORTS = [
		'usb',
		'nfc',
		'ble',
		'smart-card',
		'hybrid',
		'internal',
	];

	public function __construct(
		private IConfig $config,
		private string $appName,
	) {
	}

	public function getConfig(string $userId): array {
		$raw = $this->config->getUserValue(
			$userId,
			$this->appName,
			self::CONFIG_KEY,
			'',
		);

		if ($raw === '') {
			return [
				'configured' => false,
			];
		}

		try {
			$decoded = json_decode(
				$raw,
				true,
				32,
				JSON_THROW_ON_ERROR,
			);

			if (!is_array($decoded)) {
				throw new \InvalidArgumentException(
					'Invalid passkey unlock configuration',
				);
			}

			$config = $this->sanitizeConfig(
				$decoded,
				false,
			);
		} catch (
			\JsonException
			|\InvalidArgumentException
		) {
			return [
				'configured' => false,
				'invalid' => true,
			];
		}

		return [
			'configured' => true,
			...$config,
		];
	}

	public function saveConfig(
		string $userId,
		array $config,
	): array {
		$sanitized = $this->sanitizeConfig(
			$config,
			true,
		);

		$encoded = json_encode(
			$sanitized,
			JSON_THROW_ON_ERROR
			| JSON_UNESCAPED_SLASHES,
		);

		if (strlen($encoded) > self::MAX_JSON_LENGTH) {
			throw new \InvalidArgumentException(
				'Passkey unlock configuration is too large',
			);
		}

		$this->config->setUserValue(
			$userId,
			$this->appName,
			self::CONFIG_KEY,
			$encoded,
		);

		return [
			'configured' => true,
			...$sanitized,
		];
	}

	public function deleteConfig(string $userId): void {
		$this->config->deleteUserValue(
			$userId,
			$this->appName,
			self::CONFIG_KEY,
		);
	}

	private function sanitizeConfig(
		array $config,
		bool $newConfiguration,
	): array {
		$version = (int)($config['version'] ?? 0);

		if ($version !== self::FORMAT_VERSION) {
			throw new \InvalidArgumentException(
				'Unsupported passkey unlock format',
			);
		}

		$credentialId = $this->validatedBase64Url(
			$config['credential_id'] ?? null,
			'credential_id',
			1,
			1024,
		);

		$prfInput = $this->validatedBase64Url(
			$config['prf_input'] ?? null,
			'prf_input',
			32,
			32,
		);

		$hkdfSalt = $this->validatedBase64Url(
			$config['hkdf_salt'] ?? null,
			'hkdf_salt',
			32,
			32,
		);

		$iv = $this->validatedBase64Url(
			$config['iv'] ?? null,
			'iv',
			12,
			12,
		);

		$wrappedKey = $this->validatedBase64Url(
			$config['wrapped_key'] ?? null,
			'wrapped_key',
			80,
			80,
		);

		$accountBinding = $this->validatedBase64Url(
			$config['account_binding'] ?? null,
			'account_binding',
			32,
			32,
		);

		$attachment = trim(
			(string)($config['authenticator_attachment'] ?? ''),
		);

		if (!in_array(
			$attachment,
			[
				'',
				'cross-platform',
				'platform',
			],
			true,
		)) {
			throw new \InvalidArgumentException(
				'Invalid authenticator attachment',
			);
		}

		$transports = $config['transports'] ?? [];

		if (!is_array($transports)) {
			throw new \InvalidArgumentException(
				'Invalid authenticator transports',
			);
		}

		$transports = array_values(
			array_unique(
				array_filter(
					array_map(
						static fn (mixed $transport): string
							=> trim((string)$transport),
						$transports,
					),
					static fn (string $transport): bool
						=> in_array(
							$transport,
							self::ALLOWED_TRANSPORTS,
							true,
						),
				),
			),
		);

		$createdAt = $newConfiguration
			? gmdate(DATE_ATOM)
			: trim((string)($config['created_at'] ?? ''));

		if (
			$createdAt === ''
			|| strtotime($createdAt) === false
		) {
			$createdAt = gmdate(DATE_ATOM);
		}

		return [
			'version' => self::FORMAT_VERSION,
			'credential_id' => $credentialId,
			'transports' => $transports,
			'authenticator_attachment' => $attachment,
			'prf_input' => $prfInput,
			'hkdf_salt' => $hkdfSalt,
			'iv' => $iv,
			'wrapped_key' => $wrappedKey,
			'account_binding' => $accountBinding,
			'created_at' => $createdAt,
		];
	}

	private function validatedBase64Url(
		mixed $value,
		string $field,
		int $minimumBytes,
		int $maximumBytes,
	): string {
		if (!is_string($value)) {
			throw new \InvalidArgumentException(
				"Invalid {$field}",
			);
		}

		$value = trim($value);

		if (
			$value === ''
			|| preg_match(
				'/^[A-Za-z0-9_-]+$/D',
				$value,
			) !== 1
		) {
			throw new \InvalidArgumentException(
				"Invalid {$field}",
			);
		}

		$paddingLength = (
			4 - strlen($value) % 4
		) % 4;

		$decoded = base64_decode(
			strtr(
				$value,
				'-_',
				'+/',
			) . str_repeat('=', $paddingLength),
			true,
		);

		if ($decoded === false) {
			throw new \InvalidArgumentException(
				"Invalid {$field}",
			);
		}

		$length = strlen($decoded);

		if (
			$length < $minimumBytes
			|| $length > $maximumBytes
		) {
			throw new \InvalidArgumentException(
				"Invalid {$field} length",
			);
		}

		return $value;
	}
}
