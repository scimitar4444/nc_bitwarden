<?php

namespace OCA\NcBitwarden\Service;

use OCP\IConfig;
use OCP\IL10N;

final class UserSettingsService {
	private const SERVER_TYPE_KEY = 'server_type';
	private const CUSTOM_URL_KEY = 'custom_url';
	private const DEVICE_ID_KEY = 'device_identifier';
	private const USE_NEXTCLOUD_EMAIL_KEY = 'use_nextcloud_email';
	private const LOGIN_EMAIL_KEY = 'login_email';
	private const USER_PREFERENCES_KEY = 'user_preferences';

	private const DEFAULT_SERVER_TYPE_KEY = 'default_server_type';
	private const DEFAULT_CUSTOM_URL_KEY = 'default_custom_url';
	private const ALLOW_USER_OVERRIDE_KEY = 'allow_user_override';
	private const SSO_ENABLED_KEY = 'sso_enabled';
	private const CLASSIC_LOGIN_ALLOWED_KEY = 'classic_login_allowed';
	private const PASSKEY_UNLOCK_ENABLED_KEY = 'passkey_unlock_enabled';
	private const TAB_UNLOCK_MODE_KEY = 'tab_unlock_mode';
	private const TAB_UNLOCK_DEFAULT_KEY = 'tab_unlock_default';
	private const SSO_PASSWORD_MIN_LENGTH_KEY = 'sso_password_min_length';
	private const SSO_PASSWORD_REQUIRE_LOWER_KEY = 'sso_password_require_lower';
	private const SSO_PASSWORD_REQUIRE_UPPER_KEY = 'sso_password_require_upper';
	private const SSO_PASSWORD_REQUIRE_NUMBER_KEY = 'sso_password_require_number';
	private const SSO_PASSWORD_REQUIRE_SPECIAL_KEY = 'sso_password_require_special';
	private const ORGANIZATION_NOTICE_ENABLED_KEY = 'organization_notice_enabled';
	private const ORGANIZATION_NOTICE_TITLE_KEY = 'organization_notice_title';
	private const ORGANIZATION_NOTICE_MESSAGE_KEY = 'organization_notice_message';
	private const ORGANIZATION_NOTICE_SUPPORT_URL_KEY = 'organization_notice_support_url';
	private const ORGANIZATION_NOTICE_SUPPORT_LABEL_KEY = 'organization_notice_support_label';
	private const ORGANIZATION_NOTICE_SUPPORT_EMAIL_KEY = 'organization_notice_support_email';

	private const MIN_SSO_PASSWORD_LENGTH = 12;
	private const MAX_SSO_PASSWORD_LENGTH = 128;

	private const SERVER_TYPES = [
		'cloud_us',
		'cloud_eu',
		'selfhosted',
	];

	private const TAB_UNLOCK_MODES = [
		'forced_enabled',
		'forced_disabled',
		'user_choice',
	];

	public function __construct(
		private IConfig $config,
		private IL10N $l,
		private string $appName,
	) {
	}

	public function getAdminSettings(): array {
		$serverType = $this->config->getAppValue(
			$this->appName,
			self::DEFAULT_SERVER_TYPE_KEY,
			'cloud_us',
		);

		if (!in_array($serverType, self::SERVER_TYPES, true)) {
			$serverType = 'cloud_us';
		}

		$tabUnlockMode = $this->config->getAppValue(
			$this->appName,
			self::TAB_UNLOCK_MODE_KEY,
			'user_choice',
		);

		if (!in_array($tabUnlockMode, self::TAB_UNLOCK_MODES, true)) {
			$tabUnlockMode = 'user_choice';
		}

		return [
			'server_type' => $serverType,
			'custom_url' => $this->config->getAppValue(
				$this->appName,
				self::DEFAULT_CUSTOM_URL_KEY,
				'',
			),
			'allow_user_override' => $this->config->getAppValue(
				$this->appName,
				self::ALLOW_USER_OVERRIDE_KEY,
				'1',
			) !== '0',
			'sso_enabled' => $this->config->getAppValue(
				$this->appName,
				self::SSO_ENABLED_KEY,
				'0',
			) !== '0',
			'classic_login_allowed' => $this->config->getAppValue(
				$this->appName,
				self::CLASSIC_LOGIN_ALLOWED_KEY,
				'1',
			) !== '0',
			'passkey_unlock_enabled' => $this->config->getAppValue(
				$this->appName,
				self::PASSKEY_UNLOCK_ENABLED_KEY,
				'0',
			) !== '0',
			'tab_unlock_mode' => $tabUnlockMode,
			'tab_unlock_default' => $this->config->getAppValue(
				$this->appName,
				self::TAB_UNLOCK_DEFAULT_KEY,
				'1',
			) !== '0',
			'sso_password_min_length' => $this->getSsoPasswordMinLength(),
			'sso_password_require_lower' => $this->config->getAppValue(
				$this->appName,
				self::SSO_PASSWORD_REQUIRE_LOWER_KEY,
				'0',
			) !== '0',
			'sso_password_require_upper' => $this->config->getAppValue(
				$this->appName,
				self::SSO_PASSWORD_REQUIRE_UPPER_KEY,
				'0',
			) !== '0',
			'sso_password_require_number' => $this->config->getAppValue(
				$this->appName,
				self::SSO_PASSWORD_REQUIRE_NUMBER_KEY,
				'0',
			) !== '0',
			'sso_password_require_special' => $this->config->getAppValue(
				$this->appName,
				self::SSO_PASSWORD_REQUIRE_SPECIAL_KEY,
				'0',
			) !== '0',
			'organization_notice_enabled' => $this->config->getAppValue(
				$this->appName,
				self::ORGANIZATION_NOTICE_ENABLED_KEY,
				'0',
			) !== '0',
			'organization_notice_title' => $this->config->getAppValue(
				$this->appName,
				self::ORGANIZATION_NOTICE_TITLE_KEY,
				'',
			),
			'organization_notice_message' => $this->config->getAppValue(
				$this->appName,
				self::ORGANIZATION_NOTICE_MESSAGE_KEY,
				'',
			),
			'organization_notice_support_url' => $this->config->getAppValue(
				$this->appName,
				self::ORGANIZATION_NOTICE_SUPPORT_URL_KEY,
				'',
			),
			'organization_notice_support_label' => $this->config->getAppValue(
				$this->appName,
				self::ORGANIZATION_NOTICE_SUPPORT_LABEL_KEY,
				'',
			),
			'organization_notice_support_email' => $this->config->getAppValue(
				$this->appName,
				self::ORGANIZATION_NOTICE_SUPPORT_EMAIL_KEY,
				'',
			),
		];
	}

	/**
	 * Warden-Richtlinie für die erstmalige Vergabe eines
	 * Master-Passworts nach erfolgreicher SSO-Anmeldung.
	 */
	public function getNewSsoPasswordPolicy(): array {
		$settings = $this->getAdminSettings();

		return [
			'min_length' => $settings['sso_password_min_length'],
			'require_lower' => $settings['sso_password_require_lower'],
			'require_upper' => $settings['sso_password_require_upper'],
			'require_number' => $settings['sso_password_require_number'],
			'require_special' => $settings['sso_password_require_special'],
		];
	}

	public function saveAdminSettings(
		string $serverType,
		string $customUrl,
		bool $allowUserOverride,
		bool $ssoEnabled,
		bool $classicLoginAllowed,
		bool $passkeyUnlockEnabled,
		string $tabUnlockMode,
		bool $tabUnlockDefault,
		int $ssoPasswordMinLength,
		bool $ssoPasswordRequireLower,
		bool $ssoPasswordRequireUpper,
		bool $ssoPasswordRequireNumber,
		bool $ssoPasswordRequireSpecial,
	): void {
		$customUrl = $this->normalizeCustomUrl($customUrl);

		$this->validateProviderSettings(
			$serverType,
			$customUrl,
		);

		if ($ssoEnabled && $serverType !== 'selfhosted') {
			throw new \InvalidArgumentException(
				$this->l->t(
					'SSO login is only available for a self-hosted Vaultwarden server',
				),
			);
		}

		if (!$ssoEnabled && !$classicLoginAllowed) {
			throw new \InvalidArgumentException(
				$this->l->t(
					'At least one login method must be enabled',
				),
			);
		}

		$passkeyUnlockEnabled = (
			$passkeyUnlockEnabled
			&& $ssoEnabled
			&& $serverType === 'selfhosted'
		);

		if (!in_array($tabUnlockMode, self::TAB_UNLOCK_MODES, true)) {
			throw new \InvalidArgumentException(
				'Invalid value for tab_unlock_mode',
			);
		}

		if (
			$ssoPasswordMinLength < self::MIN_SSO_PASSWORD_LENGTH
			|| $ssoPasswordMinLength > self::MAX_SSO_PASSWORD_LENGTH
		) {
			throw new \InvalidArgumentException(
				$this->l->t(
					'The minimum length must be between 12 and 128 characters.',
				),
			);
		}

		$this->config->setAppValue(
			$this->appName,
			self::DEFAULT_SERVER_TYPE_KEY,
			$serverType,
		);
		$this->config->setAppValue(
			$this->appName,
			self::DEFAULT_CUSTOM_URL_KEY,
			$customUrl,
		);
		$allowUserOverride = $classicLoginAllowed && $allowUserOverride;

		$this->config->setAppValue(
			$this->appName,
			self::ALLOW_USER_OVERRIDE_KEY,
			$allowUserOverride ? '1' : '0',
		);
		$this->config->setAppValue(
			$this->appName,
			self::SSO_ENABLED_KEY,
			$ssoEnabled ? '1' : '0',
		);
		$this->config->setAppValue(
			$this->appName,
			self::CLASSIC_LOGIN_ALLOWED_KEY,
			$classicLoginAllowed ? '1' : '0',
		);
		$this->config->setAppValue(
			$this->appName,
			self::PASSKEY_UNLOCK_ENABLED_KEY,
			$passkeyUnlockEnabled ? '1' : '0',
		);
		$this->config->setAppValue(
			$this->appName,
			self::TAB_UNLOCK_MODE_KEY,
			$tabUnlockMode,
		);
		$this->config->setAppValue(
			$this->appName,
			self::TAB_UNLOCK_DEFAULT_KEY,
			$tabUnlockDefault ? '1' : '0',
		);
		$this->config->setAppValue(
			$this->appName,
			self::SSO_PASSWORD_MIN_LENGTH_KEY,
			(string)$ssoPasswordMinLength,
		);
		$this->config->setAppValue(
			$this->appName,
			self::SSO_PASSWORD_REQUIRE_LOWER_KEY,
			$ssoPasswordRequireLower ? '1' : '0',
		);
		$this->config->setAppValue(
			$this->appName,
			self::SSO_PASSWORD_REQUIRE_UPPER_KEY,
			$ssoPasswordRequireUpper ? '1' : '0',
		);
		$this->config->setAppValue(
			$this->appName,
			self::SSO_PASSWORD_REQUIRE_NUMBER_KEY,
			$ssoPasswordRequireNumber ? '1' : '0',
		);
		$this->config->setAppValue(
			$this->appName,
			self::SSO_PASSWORD_REQUIRE_SPECIAL_KEY,
			$ssoPasswordRequireSpecial ? '1' : '0',
		);
	}

	public function getOrganizationNoticeSettings(): array {
		$settings = $this->getAdminSettings();

		return [
			'enabled' => $settings['organization_notice_enabled'],
			'title' => $settings['organization_notice_title'],
			'message' => $settings['organization_notice_message'],
			'support_url' => $settings['organization_notice_support_url'],
			'support_label' => $settings['organization_notice_support_label'],
			'support_email' => $settings['organization_notice_support_email'],
		];
	}

	public function saveOrganizationNoticeSettings(
		bool $enabled,
		string $title,
		string $message,
		string $supportUrl,
		string $supportLabel,
		string $supportEmail,
	): void {
		$title = trim($title);
		$message = trim($message);
		$supportUrl = trim($supportUrl);
		$supportLabel = trim($supportLabel);
		$supportEmail = trim($supportEmail);

		$this->validateTextLength($title, 160, 'Organization notice title');
		$this->validateTextLength($message, 2000, 'Organization notice message');
		$this->validateTextLength($supportLabel, 120, 'Organization notice support label');

		if ($supportUrl !== '') {
			if (filter_var($supportUrl, FILTER_VALIDATE_URL) === false) {
				throw new \InvalidArgumentException(
					$this->l->t('Enter a valid support URL'),
				);
			}

			$scheme = strtolower((string)parse_url($supportUrl, PHP_URL_SCHEME));
			if (!in_array($scheme, ['http', 'https'], true)) {
				throw new \InvalidArgumentException(
					$this->l->t('Only HTTP or HTTPS support URLs are allowed'),
				);
			}
		}

		if (
			$supportEmail !== ''
			&& filter_var($supportEmail, FILTER_VALIDATE_EMAIL) === false
		) {
			throw new \InvalidArgumentException(
				$this->l->t('Enter a valid support email address'),
			);
		}

		$values = [
			self::ORGANIZATION_NOTICE_ENABLED_KEY => $enabled ? '1' : '0',
			self::ORGANIZATION_NOTICE_TITLE_KEY => $title,
			self::ORGANIZATION_NOTICE_MESSAGE_KEY => $message,
			self::ORGANIZATION_NOTICE_SUPPORT_URL_KEY => $supportUrl,
			self::ORGANIZATION_NOTICE_SUPPORT_LABEL_KEY => $supportLabel,
			self::ORGANIZATION_NOTICE_SUPPORT_EMAIL_KEY => $supportEmail,
		];

		foreach ($values as $key => $value) {
			$this->config->setAppValue($this->appName, $key, $value);
		}
	}

	private function validateTextLength(
		string $value,
		int $maximum,
		string $field,
	): void {
		if (mb_strlen($value) > $maximum) {
			throw new \InvalidArgumentException(
				$this->l->t(
					'{field} may contain at most {maximum} characters.',
					[
						'field' => $field,
						'maximum' => $maximum,
					],
				),
			);
		}
	}

	private function getSsoPasswordMinLength(): int {
		$value = (int)$this->config->getAppValue(
			$this->appName,
			self::SSO_PASSWORD_MIN_LENGTH_KEY,
			(string)self::MIN_SSO_PASSWORD_LENGTH,
		);

		return max(
			self::MIN_SSO_PASSWORD_LENGTH,
			min(self::MAX_SSO_PASSWORD_LENGTH, $value),
		);
	}

	public function getSettings(string $userId): array {
		$provider = $this->resolveProviderSettings($userId);
		$adminSettings = $this->getAdminSettings();

		$effectiveSso = (
			$adminSettings['sso_enabled']
			&& $provider['server_type'] === 'selfhosted'
		);

		return [
			'server_type' => $provider['server_type'],
			'custom_url' => $provider['custom_url'],
			'use_nextcloud_email' => $this->config->getUserValue(
				$userId,
				$this->appName,
				self::USE_NEXTCLOUD_EMAIL_KEY,
				'1',
			) !== '0',
			'login_email' => $this->config->getUserValue(
				$userId,
				$this->appName,
				self::LOGIN_EMAIL_KEY,
				'',
			),
			'device_id' => $this->getOrCreateDeviceId($userId),
			'can_edit' => $provider['can_edit'],
			'inherited' => $provider['inherited'],
			'sso_enabled' => $effectiveSso,
			'classic_login_allowed' => (
				!$effectiveSso
				|| $adminSettings['classic_login_allowed']
			),
			'passkey_unlock_enabled' => (
				$effectiveSso
				&& $adminSettings['passkey_unlock_enabled']
			),
			'tab_unlock_mode' => $adminSettings['tab_unlock_mode'],
			'tab_unlock_default' => $adminSettings['tab_unlock_default'],
			'organization_notice' => $this->getOrganizationNoticeSettings(),
			'master_password_policy' => $this->getNewSsoPasswordPolicy(),
			'preferences' => $this->getUserPreferences($userId),
		];
	}

	public function isPasskeyUnlockEnabled(
		string $userId,
	): bool {
		$provider = $this->resolveProviderSettings($userId);
		$adminSettings = $this->getAdminSettings();

		return (
			$provider['server_type'] === 'selfhosted'
			&& $adminSettings['sso_enabled']
			&& $adminSettings['passkey_unlock_enabled']
		);
	}

	public function saveSettings(
		string $userId,
		string $serverType,
		string $customUrl,
		bool $useNextcloudEmail,
		string $loginEmail,
	): void {
		$adminSettings = $this->getAdminSettings();

		/*
		 * Die persönliche Serverauswahl darf nur verändert werden,
		 * wenn der Administrator dies erlaubt.
		 *
		 * Die persönliche Anmelde-E-Mail bleibt davon unabhängig
		 * immer bearbeitbar.
		 */
		if ($adminSettings['allow_user_override']) {
			$customUrl = $this->normalizeCustomUrl($customUrl);

			$this->validateProviderSettings(
				$serverType,
				$customUrl,
			);

			$this->config->setUserValue(
				$userId,
				$this->appName,
				self::SERVER_TYPE_KEY,
				$serverType,
			);
			$this->config->setUserValue(
				$userId,
				$this->appName,
				self::CUSTOM_URL_KEY,
				$customUrl,
			);
		}

		$loginEmail = trim($loginEmail);

		if (
			$loginEmail !== ''
			&& filter_var(
				$loginEmail,
				FILTER_VALIDATE_EMAIL,
			) === false
		) {
			throw new \InvalidArgumentException(
				$this->l->t(
					'Enter a valid email address',
				),
			);
		}

		if (!$useNextcloudEmail && $loginEmail === '') {
			throw new \InvalidArgumentException(
				$this->l->t(
					'Enter a valid email address',
				),
			);
		}

		$this->config->setUserValue(
			$userId,
			$this->appName,
			self::USE_NEXTCLOUD_EMAIL_KEY,
			$useNextcloudEmail ? '1' : '0',
		);

		$this->config->setUserValue(
			$userId,
			$this->appName,
			self::LOGIN_EMAIL_KEY,
			$loginEmail,
		);
	}

	public function getUserPreferences(string $userId): array {
		$raw = $this->config->getUserValue(
			$userId,
			$this->appName,
			self::USER_PREFERENCES_KEY,
			'',
		);

		if ($raw === '') {
			return $this->sanitizeUserPreferences([]);
		}

		try {
			$decoded = json_decode(
				$raw,
				true,
				512,
				JSON_THROW_ON_ERROR,
			);
		} catch (\JsonException) {
			$decoded = [];
		}

		return $this->sanitizeUserPreferences(
			is_array($decoded) ? $decoded : [],
		);
	}

	public function saveUserPreferences(
		string $userId,
		array $preferences,
	): array {
		$sanitized = $this->sanitizeUserPreferences(
			$preferences,
		);

		$this->config->setUserValue(
			$userId,
			$this->appName,
			self::USER_PREFERENCES_KEY,
			json_encode(
				$sanitized,
				JSON_THROW_ON_ERROR
				| JSON_UNESCAPED_SLASHES,
			),
		);

		return $sanitized;
	}

	private function sanitizeUserPreferences(
		array $preferences,
	): array {
		$defaults = [
			'start_category' => 'all',
			'interface_mode' => 'advanced',
			'navigation_start_mode' => 'last_used',
			'default_target_mode' => 'personal',
			'default_organization_id' => '',
			'default_collection_id' => '',
			'default_item_type' => '1',
			'last_item_type' => 1,
			'last_organization_id' => '',
			'last_collection_id' => '',
			'generator_mode' => 'password',
			'password_length' => 24,
			'password_use_lowercase' => true,
			'password_use_uppercase' => true,
			'password_use_digits' => true,
			'password_use_symbols' => true,
			'password_exclude_ambiguous' => true,
			'passphrase_language' => 'de',
			'passphrase_word_count' => 5,
			'passphrase_separator' => 'hyphen',
			'passphrase_capitalization' => 'first',
			'passphrase_include_number' => true,
			'passphrase_include_symbol' => false,
		];

		$value = array_merge($defaults, $preferences);

		$startCategory = $this->allowedString(
			$value['start_category'],
			[
				'all',
				'favorites',
				'logins',
				'totp',
				'ssh-keys',
				'notes',
				'cards',
				'identities',
			],
			$defaults['start_category'],
		);

		$interfaceMode = $this->allowedString(
			$value['interface_mode'],
			[
				'standard',
				'advanced',
			],
			$defaults['interface_mode'],
		);

		$navigationStartMode = $this->allowedString(
			$value['navigation_start_mode'],
			[
				'last_used',
				'collapsed',
				'personal_expanded',
				'collections_expanded',
				'expanded',
			],
			$defaults['navigation_start_mode'],
		);

		$defaultTargetMode = $this->allowedString(
			$value['default_target_mode'],
			[
				'personal',
				'last_used',
				'fixed',
			],
			$defaults['default_target_mode'],
		);

		$defaultItemType = $this->allowedString(
			$value['default_item_type'],
			[
				'1',
				'2',
				'3',
				'4',
				'5',
				'last_used',
			],
			$defaults['default_item_type'],
		);

		$generatorMode = $this->allowedString(
			$value['generator_mode'],
			['password', 'passphrase'],
			$defaults['generator_mode'],
		);

		$passphraseLanguage = $this->allowedString(
			$value['passphrase_language'],
			['de', 'en'],
			$defaults['passphrase_language'],
		);

		$passphraseSeparator = $this->allowedString(
			$value['passphrase_separator'],
			['hyphen', 'space', 'dot', 'underscore'],
			$defaults['passphrase_separator'],
		);

		$passphraseCapitalization = $this->allowedString(
			$value['passphrase_capitalization'],
			['lower', 'first', 'all'],
			$defaults['passphrase_capitalization'],
		);

		return [
			'start_category' => $startCategory,
			'interface_mode' => $interfaceMode,
			'navigation_start_mode' => $navigationStartMode,
			'default_target_mode' => $defaultTargetMode,
			'default_organization_id' => $this->shortString(
				$value['default_organization_id'],
			),
			'default_collection_id' => $this->shortString(
				$value['default_collection_id'],
			),
			'default_item_type' => $defaultItemType,
			'last_item_type' => max(
				1,
				min(5, (int)$value['last_item_type']),
			),
			'last_organization_id' => $this->shortString(
				$value['last_organization_id'],
			),
			'last_collection_id' => $this->shortString(
				$value['last_collection_id'],
			),
			'generator_mode' => $generatorMode,
			'password_length' => max(
				8,
				min(128, (int)$value['password_length']),
			),
			'password_use_lowercase' => $this->boolValue(
				$value['password_use_lowercase'],
				$defaults['password_use_lowercase'],
			),
			'password_use_uppercase' => $this->boolValue(
				$value['password_use_uppercase'],
				$defaults['password_use_uppercase'],
			),
			'password_use_digits' => $this->boolValue(
				$value['password_use_digits'],
				$defaults['password_use_digits'],
			),
			'password_use_symbols' => $this->boolValue(
				$value['password_use_symbols'],
				$defaults['password_use_symbols'],
			),
			'password_exclude_ambiguous' => $this->boolValue(
				$value['password_exclude_ambiguous'],
				$defaults['password_exclude_ambiguous'],
			),
			'passphrase_language' => $passphraseLanguage,
			'passphrase_word_count' => max(
				4,
				min(8, (int)$value['passphrase_word_count']),
			),
			'passphrase_separator' => $passphraseSeparator,
			'passphrase_capitalization' => $passphraseCapitalization,
			'passphrase_include_number' => $this->boolValue(
				$value['passphrase_include_number'],
				$defaults['passphrase_include_number'],
			),
			'passphrase_include_symbol' => $this->boolValue(
				$value['passphrase_include_symbol'],
				$defaults['passphrase_include_symbol'],
			),
		];
	}

	private function allowedString(
		mixed $value,
		array $allowed,
		string $fallback,
	): string {
		$value = (string)$value;

		return in_array($value, $allowed, true)
			? $value
			: $fallback;
	}

	private function shortString(mixed $value): string {
		return substr(trim((string)$value), 0, 200);
	}

	private function boolValue(
		mixed $value,
		bool $fallback,
	): bool {
		if (is_bool($value)) {
			return $value;
		}

		$parsed = filter_var(
			$value,
			FILTER_VALIDATE_BOOLEAN,
			FILTER_NULL_ON_FAILURE,
		);

		return $parsed ?? $fallback;
	}

	public function getApiUrls(string $userId): array {
		$settings = $this->resolveProviderSettings($userId);
		$this->assertResolvedProviderAccessAllowed($settings);

		$type = $settings['server_type'];
		$customUrl = $settings['custom_url'];

		return match ($type) {
			'cloud_us' => [
				'api' => 'https://api.bitwarden.com',
				'identity' => 'https://identity.bitwarden.com',
			],
			'cloud_eu' => [
				'api' => 'https://api.bitwarden.eu',
				'identity' => 'https://identity.bitwarden.eu',
			],
			'selfhosted' => [
				'api' => $customUrl . '/api',
				'identity' => $customUrl . '/identity',
			],
			default => throw new \RuntimeException(
				$this->l->t('Unknown server type'),
			),
		};
	}

	public function assertProviderAccessAllowed(
		string $userId,
	): void {
		$this->assertResolvedProviderAccessAllowed(
			$this->resolveProviderSettings($userId),
		);
	}

	private function assertResolvedProviderAccessAllowed(
		array $provider,
	): void {
		if (
			($provider['server_type'] ?? '') !== 'selfhosted'
			|| !empty($provider['inherited'])
		) {
			return;
		}

		$url = (string)($provider['custom_url'] ?? '');
		$host = parse_url($url, PHP_URL_HOST);

		if (!is_string($host) || $host === '') {
			throw new \RuntimeException(
				'The selected provider hostname is invalid.',
			);
		}

		$host = strtolower(
			rtrim($host, '.'),
		);

		$addresses = $this->resolveHostAddresses(
			$host,
		);

		if ($addresses === []) {
			throw new \RuntimeException(
				'The selected provider hostname could not be resolved.',
			);
		}

		foreach ($addresses as $address) {
			if (
				filter_var(
					$address,
					FILTER_VALIDATE_IP,
					FILTER_FLAG_NO_PRIV_RANGE
						| FILTER_FLAG_NO_RES_RANGE,
				) === false
			) {
				throw new \RuntimeException(
					'User-selected providers must not resolve to private or reserved addresses.',
				);
			}
		}
	}

	private function resolveHostAddresses(
		string $host,
	): array {
		$addresses = [];

		$records = @dns_get_record(
			$host,
			DNS_A | DNS_AAAA,
		);

		if (is_array($records)) {
			foreach ($records as $record) {
				$address = $record['ip']
					?? $record['ipv6']
					?? null;

				if (is_string($address)) {
					$addresses[] = $address;
				}
			}
		}

		if ($addresses === []) {
			$ipv4Addresses = @gethostbynamel(
				$host,
			);

			if (is_array($ipv4Addresses)) {
				$addresses = $ipv4Addresses;
			}
		}

		return array_values(
			array_unique($addresses),
		);
	}

	private function resolveProviderSettings(string $userId): array {
		$adminSettings = $this->getAdminSettings();
		$canEdit = $adminSettings['allow_user_override'];

		if (!$canEdit) {
			return [
				'server_type' => $adminSettings['server_type'],
				'custom_url' => $adminSettings['custom_url'],
				'can_edit' => false,
				'inherited' => true,
			];
		}

		$userServerType = $this->config->getUserValue(
			$userId,
			$this->appName,
			self::SERVER_TYPE_KEY,
			'',
		);

		if (!in_array($userServerType, self::SERVER_TYPES, true)) {
			return [
				'server_type' => $adminSettings['server_type'],
				'custom_url' => $adminSettings['custom_url'],
				'can_edit' => true,
				'inherited' => true,
			];
		}

		return [
			'server_type' => $userServerType,
			'custom_url' => $this->config->getUserValue(
				$userId,
				$this->appName,
				self::CUSTOM_URL_KEY,
				'',
			),
			'can_edit' => true,
			'inherited' => false,
		];
	}

	private function normalizeCustomUrl(string $customUrl): string {
		return rtrim(trim($customUrl), '/');
	}

	private function validateProviderSettings(
		string $serverType,
		string $customUrl,
	): void {
		if (!in_array($serverType, self::SERVER_TYPES, true)) {
			throw new \InvalidArgumentException(
				$this->l->t('Invalid server type'),
			);
		}

		if ($serverType !== 'selfhosted') {
			return;
		}

		$this->validateSelfhostedUrl($customUrl);
	}

	private function validateSelfhostedUrl(string $url): void {
		if (!filter_var($url, FILTER_VALIDATE_URL)) {
			throw new \InvalidArgumentException(
				$this->l->t('Invalid URL'),
			);
		}

		$parsed = parse_url($url);

		if (
			$parsed === false
			|| !isset($parsed['scheme'], $parsed['host'])
		) {
			throw new \InvalidArgumentException(
				$this->l->t('URL could not be parsed'),
			);
		}

		if (strtolower($parsed['scheme']) !== 'https') {
			throw new \InvalidArgumentException(
				$this->l->t('Only HTTPS URLs are allowed'),
			);
		}

		if (
			isset($parsed['user'])
			|| isset($parsed['pass'])
			|| isset($parsed['query'])
			|| isset($parsed['fragment'])
		) {
			throw new \InvalidArgumentException(
				$this->l->t(
					'Provider URLs must not contain credentials, query parameters or fragments',
				),
			);
		}

		$host = strtolower(
			rtrim((string)$parsed['host'], '.'),
		);

		if (filter_var($host, FILTER_VALIDATE_IP)) {
			throw new \InvalidArgumentException(
				$this->l->t(
					'IP addresses are not allowed; use a hostname',
				),
			);
		}

		foreach (
			[
				'localhost',
				'.local',
				'.internal',
				'.lan',
				'.corp',
				'.home',
			] as $pattern
		) {
			if (
				$host === ltrim($pattern, '.')
				|| str_ends_with($host, $pattern)
			) {
				throw new \InvalidArgumentException(
					$this->l->t(
						'Internal hostnames are not allowed: {host}',
						['host' => $host],
					),
				);
			}
		}
	}

	private function getOrCreateDeviceId(string $userId): string {
		$id = $this->config->getUserValue(
			$userId,
			$this->appName,
			self::DEVICE_ID_KEY,
			'',
		);

		if ($id === '') {
			$id = $this->generateUuidV4();

			$this->config->setUserValue(
				$userId,
				$this->appName,
				self::DEVICE_ID_KEY,
				$id,
			);
		}

		return $id;
	}

	private function generateUuidV4(): string {
		$bytes = random_bytes(16);
		$bytes[6] = chr(ord($bytes[6]) & 0x0f | 0x40);
		$bytes[8] = chr(ord($bytes[8]) & 0x3f | 0x80);
		$hex = bin2hex($bytes);

		return sprintf(
			'%s-%s-%s-%s-%s',
			substr($hex, 0, 8),
			substr($hex, 8, 4),
			substr($hex, 12, 4),
			substr($hex, 16, 4),
			substr($hex, 20, 12),
		);
	}
}
