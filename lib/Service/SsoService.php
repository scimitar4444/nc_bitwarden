<?php

declare(strict_types=1);

namespace OCA\NcBitwarden\Service;

use OCP\Http\Client\IClientService;
use OCP\ISession;

final class SsoService {
	private const FLOW_STATE_KEY = 'warden_sso_state';
	private const FLOW_VERIFIER_KEY = 'warden_sso_verifier';
	private const FLOW_CREATED_KEY = 'warden_sso_created';
	private const FLOW_PROVIDER_KEY = 'warden_sso_provider_fingerprint';
	private const PENDING_CODE_KEY = 'warden_sso_code';
	private const RESULT_KEY = 'warden_sso_result';

	private const SESSION_TOKEN_KEY = 'bw_access_token';
	private const SESSION_REFRESH_KEY = 'bw_refresh_token';
	private const SESSION_EXPIRY_KEY = 'bw_token_expiry';
	private const SESSION_PROVIDER_KEY = 'bw_provider_fingerprint';

	private const STATE_PREFIX = 'warden_nc.';
	private const FLOW_TTL = 600;
	private const CLIENT_VERSION = '2026.7.0';

	private array $baseOptions = [
		'allow_redirects' => false,
		'timeout' => 20,
		'connect_timeout' => 10,
	];

	public function __construct(
		private IClientService $httpClientService,
		private ISession $session,
		private UserSettingsService $settingsService,
	) {
	}

	public function createAuthorizationUrl(string $userId): string {
		$settings = $this->getSelfHostedSettings($userId);
		$vaultBase = rtrim((string)$settings['custom_url'], '/');
		$providerFingerprint
			= $this->providerFingerprint($userId);

		$state = self::STATE_PREFIX . $this->base64Url(
			random_bytes(32),
		);

		$verifier = $this->base64Url(
			random_bytes(64),
		);

		$challenge = $this->base64Url(
			hash('sha256', $verifier, true),
		);

		$this->clearFlow();
		$this->session->remove(self::RESULT_KEY);

		$this->session->set(self::FLOW_STATE_KEY, $state);
		$this->session->set(self::FLOW_VERIFIER_KEY, $verifier);
		$this->session->set(self::FLOW_CREATED_KEY, time());
		$this->session->set(
			self::FLOW_PROVIDER_KEY,
			$providerFingerprint,
		);

		$query = http_build_query(
			[
				'client_id' => 'web',
				'redirect_uri' => $vaultBase . '/sso-connector.html',
				'response_type' => 'code',
				'scope' => 'api offline_access',
				'state' => $state,
				'code_challenge' => $challenge,
				'code_challenge_method' => 'S256',
			],
			'',
			'&',
			PHP_QUERY_RFC3986,
		);

		return $vaultBase . '/identity/connect/authorize?' . $query;
	}

	/**
	 * Verarbeitet den Rücksprung vom Vaultwarden-SSO-Connector.
	 *
	 * @return array{status: string, providers?: list<int>}
	 */
	public function complete(
		string $userId,
		string $code,
		string $state,
	): array {
		$verifier = $this->validateCallback(
			$userId,
			$code,
			$state,
		);

		/*
		 * Der Code und der PKCE-Verifier müssen erhalten bleiben,
		 * falls Vaultwarden anschließend einen zweiten Faktor verlangt.
		 */
		$this->session->set(self::PENDING_CODE_KEY, $code);

		/*
		 * Der Browser-Callback darf nur einmal verarbeitet werden.
		 * Verifier, Code und Erstellungszeit bleiben für TOTP erhalten.
		 */
		$this->session->remove(self::FLOW_STATE_KEY);

		$exchange = $this->exchangeToken(
			$userId,
			$code,
			$verifier,
			null,
		);

		if ($exchange['status'] === 'two_factor_required') {
			return [
				'status' => 'two_factor_required',
				'providers' => $exchange['providers'],
			];
		}

		$this->finishSuccessfulLogin($userId, $exchange['data']);

		return ['status' => 'complete'];
	}

	/**
	 * Schließt einen bereits begonnenen SSO-Vorgang mit TOTP ab.
	 *
	 * @return array{status: string}
	 */
	public function completeTwoFactor(
		string $userId,
		string $twoFactorToken,
	): array {
		$twoFactorToken = trim($twoFactorToken);

		if ($twoFactorToken === '') {
			throw new \RuntimeException(
				'Bitte den Authenticator-Code eingeben.',
			);
		}

		[$code, $verifier]
			= $this->getPendingFlow($userId);

		$exchange = $this->exchangeToken(
			$userId,
			$code,
			$verifier,
			$twoFactorToken,
		);

		if ($exchange['status'] === 'two_factor_required') {
			if (!in_array(0, $exchange['providers'], true)) {
				$this->clearFlow();

				throw new \RuntimeException(
					'Vaultwarden verlangt einen nicht unterstützten zweiten Faktor.',
				);
			}

			throw new \RuntimeException(
				'Der Authenticator-Code ist ungültig oder abgelaufen.',
			);
		}

		$this->finishSuccessfulLogin($userId, $exchange['data']);

		return ['status' => 'complete'];
	}

	public function consumeResult(): ?array {
		$result = $this->session->get(self::RESULT_KEY);
		$this->session->remove(self::RESULT_KEY);

		return is_array($result) ? $result : null;
	}

	public function logout(): void {
		$this->session->remove(self::SESSION_TOKEN_KEY);
		$this->session->remove(self::SESSION_REFRESH_KEY);
		$this->session->remove(self::SESSION_EXPIRY_KEY);
		$this->session->remove(self::SESSION_PROVIDER_KEY);
		$this->session->remove(self::RESULT_KEY);
		$this->clearFlow();
	}

	private function validateCallback(
		string $userId,
		string $code,
		string $state,
	): string {
		$expectedState = (string)(
			$this->session->get(self::FLOW_STATE_KEY) ?? ''
		);

		$verifier = (string)(
			$this->session->get(self::FLOW_VERIFIER_KEY) ?? ''
		);

		$created = (int)(
			$this->session->get(self::FLOW_CREATED_KEY) ?? 0
		);

		$storedProvider = (string)(
			$this->session->get(
				self::FLOW_PROVIDER_KEY,
			) ?? ''
		);

		$currentProvider
			= $this->providerFingerprint($userId);

		if (
			$code === ''
			|| $state === ''
			|| $expectedState === ''
			|| $verifier === ''
			|| !str_starts_with($state, self::STATE_PREFIX)
			|| !hash_equals($expectedState, $state)
			|| $created <= 0
			|| time() - $created > self::FLOW_TTL
			|| $storedProvider === ''
			|| !hash_equals(
				$currentProvider,
				$storedProvider,
			)
		) {
			$this->clearFlow();

			throw new \RuntimeException(
				'Ungültiger oder abgelaufener SSO-Anmeldevorgang.',
			);
		}

		return $verifier;
	}

	/**
	 * @return array{0: string, 1: string}
	 */
	private function getPendingFlow(
		string $userId,
	): array {
		$code = (string)(
			$this->session->get(self::PENDING_CODE_KEY) ?? ''
		);

		$verifier = (string)(
			$this->session->get(self::FLOW_VERIFIER_KEY) ?? ''
		);

		$created = (int)(
			$this->session->get(self::FLOW_CREATED_KEY) ?? 0
		);

		$storedProvider = (string)(
			$this->session->get(
				self::FLOW_PROVIDER_KEY,
			) ?? ''
		);

		$currentProvider
			= $this->providerFingerprint($userId);

		if (
			$code === ''
			|| $verifier === ''
			|| $created <= 0
			|| time() - $created > self::FLOW_TTL
			|| $storedProvider === ''
			|| !hash_equals(
				$currentProvider,
				$storedProvider,
			)
		) {
			$this->clearFlow();

			throw new \RuntimeException(
				'Der SSO-Anmeldevorgang ist abgelaufen. Bitte erneut anmelden.',
			);
		}

		return [$code, $verifier];
	}

	/**
	 * @return array{
	 *     status: string,
	 *     providers?: list<int>,
	 *     data?: array
	 * }
	 */
	private function exchangeToken(
		string $userId,
		string $code,
		string $verifier,
		?string $twoFactorToken,
	): array {
		$settings = $this->getSelfHostedSettings($userId);
		$vaultBase = rtrim((string)$settings['custom_url'], '/');

		$formParams = [
			'grant_type' => 'authorization_code',
			'code' => $code,
			'code_verifier' => $verifier,
			'scope' => 'api offline_access',
			'client_id' => 'web',
			'deviceType' => 10,
			'deviceIdentifier' => (string)$settings['device_id'],
			'deviceName' => 'Nextcloud Warden',
		];

		if ($twoFactorToken !== null) {
			$formParams['twoFactorProvider'] = 0;
			$formParams['twoFactorToken'] = $twoFactorToken;
			$formParams['twoFactorRemember'] = '0';
		}

		$client = $this->httpClientService->newClient();

		try {
			$response = $client->post(
				$vaultBase . '/identity/connect/token',
				array_merge(
					$this->baseOptions,
					[
						'headers' => [
							'Bitwarden-Client-Version'
								=> self::CLIENT_VERSION,
						],
						'form_params' => $formParams,
					],
				),
			);
		} catch (\Exception $e) {
			$errorData = $this->decodeExceptionBody($e);
			$providers = $this->extractTwoFactorProviders(
				$errorData,
			);

			if ($providers !== []) {
				return [
					'status' => 'two_factor_required',
					'providers' => $providers,
				];
			}

			throw new \RuntimeException(
				$this->extractErrorMessage($e, $errorData),
				0,
				$e,
			);
		}

		$data = json_decode(
			$this->responseBodyToString($response->getBody()),
			true,
		);

		if (!is_array($data) || empty($data['access_token'])) {
			throw new \RuntimeException(
				is_array($data)
					? (
						$data['error_description']
						?? $data['error']
						?? 'SSO-Anmeldung fehlgeschlagen.'
					)
					: 'Ungültige Antwort von Vaultwarden.',
			);
		}

		return [
			'status' => 'complete',
			'data' => $data,
		];
	}

	/**
	 * @return list<int>
	 */
	private function extractTwoFactorProviders(array $data): array {
		$customResponse = $data['CustomResponse']
			?? $data['customResponse']
			?? [];

		$providers = $data['TwoFactorProviders']
			?? $data['twoFactorProviders']
			?? $customResponse['TwoFactorProviders']
			?? $customResponse['twoFactorProviders']
			?? [];

		if (!is_array($providers)) {
			return [];
		}

		return array_values(
			array_unique(
				array_map('intval', $providers),
			),
		);
	}

	private function finishSuccessfulLogin(
		string $userId,
		array $data,
	): void {
		try {
			$result = $this->buildUnlockResult(
				$userId,
				$data,
			);
		} catch (\Exception $e) {
			$this->clearFlow();

			throw $e;
		}

		$this->storeTokens($userId, $data);
		$this->session->set(self::RESULT_KEY, $result);
		$this->clearFlow();
	}

	private function getSelfHostedSettings(string $userId): array {
		$settings = $this->settingsService->getSettings($userId);

		$this->settingsService->assertProviderAccessAllowed(
			$userId,
		);

		if (empty($settings['sso_enabled'])) {
			throw new \RuntimeException(
				'SSO wurde vom Administrator nicht aktiviert.',
			);
		}

		if (
			($settings['server_type'] ?? '') !== 'selfhosted'
			|| empty($settings['custom_url'])
		) {
			throw new \RuntimeException(
				'SSO steht nur für einen selbst gehosteten Vaultwarden-Server zur Verfügung.',
			);
		}

		return $settings;
	}

	private function buildUnlockResult(
		string $userId,
		array $data,
	): array {
		$decryptionOptions = $data['UserDecryptionOptions']
			?? $data['userDecryptionOptions']
			?? [];

		$hasMasterPassword = $decryptionOptions['HasMasterPassword']
			?? $decryptionOptions['hasMasterPassword']
			?? null;

		if ($hasMasterPassword === false) {
			$email = $this->loadAccountEmail(
				$userId,
				(string)($data['access_token'] ?? ''),
			);

			return [
				'email' => $email,
				'requiresMasterPasswordSetup' => true,
				'masterPasswordPolicy'
					=> $this->settingsService
						->getNewSsoPasswordPolicy(),
				'loginData' => [
					'Kdf' => $data['Kdf']
						?? $data['kdf']
						?? 0,
					'KdfIterations'
						=> $data['KdfIterations']
							?? $data['kdfIterations']
							?? 600000,
					'KdfMemory' => $data['KdfMemory']
						?? $data['kdfMemory']
						?? null,
					'KdfParallelism'
						=> $data['KdfParallelism']
							?? $data['kdfParallelism']
							?? null,
				],
			];
		}

		$masterPasswordUnlock
			= $decryptionOptions['MasterPasswordUnlock']
			?? $decryptionOptions['masterPasswordUnlock']
			?? [];

		$unlockKdf = $masterPasswordUnlock['Kdf']
			?? $masterPasswordUnlock['kdf']
			?? [];

		$email = (string)(
			$masterPasswordUnlock['Salt']
			?? $masterPasswordUnlock['salt']
			?? ''
		);

		$key = (string)(
			$data['Key']
			?? $data['key']
			?? $masterPasswordUnlock['MasterKeyWrappedUserKey']
			?? $masterPasswordUnlock['masterKeyWrappedUserKey']
			?? $masterPasswordUnlock['MasterKeyEncryptedUserKey']
			?? $masterPasswordUnlock['masterKeyEncryptedUserKey']
			?? ''
		);

		if ($email === '' || $key === '') {
			throw new \RuntimeException(
				'Vaultwarden hat keine Daten zum Entsperren des Tresors zurückgegeben.',
			);
		}

		return [
			'email' => $email,
			'requiresMasterPasswordSetup' => false,
			'loginData' => [
				'Key' => $key,
				'Kdf' => $data['Kdf']
					?? $data['kdf']
					?? $unlockKdf['KdfType']
					?? $unlockKdf['kdfType']
					?? 0,
				'KdfIterations' => $data['KdfIterations']
					?? $data['kdfIterations']
					?? $unlockKdf['Iterations']
					?? $unlockKdf['iterations']
					?? 600000,
				'KdfMemory' => $data['KdfMemory']
					?? $data['kdfMemory']
					?? $unlockKdf['Memory']
					?? $unlockKdf['memory']
					?? 64,
				'KdfParallelism' => $data['KdfParallelism']
					?? $data['kdfParallelism']
					?? $unlockKdf['Parallelism']
					?? $unlockKdf['parallelism']
					?? 4,
			],
		];
	}

	private function loadAccountEmail(
		string $userId,
		string $accessToken,
	): string {
		if ($accessToken === '') {
			throw new \RuntimeException(
				'Vaultwarden hat kein Zugriffstoken zurückgegeben.',
			);
		}

		$settings = $this->getSelfHostedSettings($userId);
		$vaultBase = rtrim((string)$settings['custom_url'], '/');
		$client = $this->httpClientService->newClient();

		try {
			$response = $client->get(
				$vaultBase . '/api/accounts/profile',
				array_merge(
					$this->baseOptions,
					[
						'headers' => [
							'Authorization'
								=> 'Bearer ' . $accessToken,
							'Bitwarden-Client-Version'
								=> self::CLIENT_VERSION,
						],
					],
				),
			);
		} catch (\Exception $e) {
			throw new \RuntimeException(
				'Die E-Mail-Adresse des neuen Vaultwarden-Kontos konnte nicht geladen werden.',
				0,
				$e,
			);
		}

		$profile = json_decode(
			$this->responseBodyToString($response->getBody()),
			true,
		);

		$email = is_array($profile)
			? trim((string)($profile['email'] ?? $profile['Email'] ?? ''))
			: '';

		if ($email === '') {
			throw new \RuntimeException(
				'Vaultwarden hat keine E-Mail-Adresse für das neue Konto zurückgegeben.',
			);
		}

		return strtolower($email);
	}

	private function storeTokens(
		string $userId,
		array $data,
	): void {
		$this->session->set(
			self::SESSION_TOKEN_KEY,
			(string)$data['access_token'],
		);

		$this->session->set(
			self::SESSION_EXPIRY_KEY,
			time() + (int)($data['expires_in'] ?? 3600),
		);

		if (!empty($data['refresh_token'])) {
			$this->session->set(
				self::SESSION_REFRESH_KEY,
				(string)$data['refresh_token'],
			);
		}

		$this->session->set(
			self::SESSION_PROVIDER_KEY,
			$this->providerFingerprint($userId),
		);
	}

	private function clearFlow(): void {
		$this->session->remove(self::FLOW_STATE_KEY);
		$this->session->remove(self::FLOW_VERIFIER_KEY);
		$this->session->remove(self::FLOW_CREATED_KEY);
		$this->session->remove(self::FLOW_PROVIDER_KEY);
		$this->session->remove(self::PENDING_CODE_KEY);
	}

	private function providerFingerprint(
		string $userId,
	): string {
		$urls = $this->settingsService->getApiUrls(
			$userId,
		);

		$identity = rtrim(
			(string)($urls['identity'] ?? ''),
			'/',
		);

		$api = rtrim(
			(string)($urls['api'] ?? ''),
			'/',
		);

		if ($identity === '' || $api === '') {
			throw new \RuntimeException(
				'Die Provider-Adressen sind ungültig.',
			);
		}

		return hash(
			'sha256',
			$identity . "\n" . $api,
		);
	}

	private function base64Url(string $value): string {
		return rtrim(
			strtr(base64_encode($value), '+/', '-_'),
			'=',
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	private function decodeExceptionBody(\Exception $e): array {
		if (
			!method_exists($e, 'getResponse')
			|| ($response = $e->getResponse()) === null
		) {
			return [];
		}

		$data = json_decode(
			$this->responseBodyToString($response->getBody()),
			true,
		);

		return is_array($data) ? $data : [];
	}

	/**
	 * @param mixed $body
	 */
	private function responseBodyToString(mixed $body): string {
		if (is_resource($body)) {
			$contents = stream_get_contents($body);

			return $contents === false ? '' : $contents;
		}

		if (is_string($body)) {
			return $body;
		}

		if (
			is_object($body)
			&& method_exists($body, '__toString')
		) {
			return (string)$body;
		}

		return '';
	}

	private function extractErrorMessage(
		\Exception $e,
		array $data = [],
	): string {
		return (string)(
			$data['error_description']
			?? $data['message']
			?? $data['error']
			?? $e->getMessage()
		);
	}
}
