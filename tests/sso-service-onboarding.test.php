<?php

declare(strict_types=1);

namespace OCP\Http\Client {
	interface IClientService {
	}
}

namespace OCP {
	interface ISession {
	}
}

namespace OCA\NcBitwarden\Service {
	final class UserSettingsService {
		public function getSettings(string $userId): array {
			return [
				'sso_enabled' => true,
				'server_type' => 'selfhosted',
				'custom_url' => 'https://vault.example.test',
			];
		}

		public function assertProviderAccessAllowed(
			string $userId,
		): void {
		}

		public function getNewSsoPasswordPolicy(): array {
			return [
				'min_length' => 14,
				'require_lower' => true,
				'require_upper' => true,
				'require_number' => true,
				'require_special' => true,
			];
		}

		public function getApiUrls(string $userId): array {
			return [
				'identity' => 'https://vault.example.test/identity',
				'api' => 'https://vault.example.test/api',
			];
		}
	}
}

namespace {
	use OCA\NcBitwarden\Service\SsoService;
	use OCA\NcBitwarden\Service\UserSettingsService;
	use OCP\Http\Client\IClientService;
	use OCP\ISession;

	require_once __DIR__
		. '/../lib/Service/SsoAccountStateDetector.php';
	require_once __DIR__ . '/../lib/Service/SsoService.php';

	final class TestResponse {
		public function __construct(
			private string $body,
		) {
		}

		public function getBody(): string {
			return $this->body;
		}
	}

	final class TestHttpClient {
		public int $profileRequests = 0;

		public function get(string $url, array $options): TestResponse {
			$this->profileRequests++;

			if (
				$url
					!== 'https://vault.example.test/api/accounts/profile'
			) {
				throw new RuntimeException('Unexpected profile URL');
			}

			if (
				($options['headers']['Authorization'] ?? '')
					!== 'Bearer redacted-access-token'
			) {
				throw new RuntimeException(
					'Access token was not forwarded',
				);
			}

			return new TestResponse(json_encode([
				'_status' => 1,
				'email' => 'new.user@example.test',
				'key' => '',
				'privateKey' => null,
				'accountKeys' => null,
			], JSON_THROW_ON_ERROR));
		}
	}

	final class TestClientService implements IClientService {
		public function __construct(
			public TestHttpClient $client,
		) {
		}

		public function newClient(): TestHttpClient {
			return $this->client;
		}
	}

	final class TestSession implements ISession {
	}

	function assertSameValue(
		mixed $expected,
		mixed $actual,
		string $message,
	): void {
		if ($expected === $actual) {
			return;
		}

		throw new RuntimeException($message);
	}

	$httpClient = new TestHttpClient();
	$service = new SsoService(
		new TestClientService($httpClient),
		new TestSession(),
		new UserSettingsService(),
	);

	$method = new ReflectionMethod(
		SsoService::class,
		'buildUnlockResult',
	);
	$method->setAccessible(true);

	/*
	 * The string value reproduces a provider response that the old strict
	 * `=== false` check did not recognize. No decision is made from it;
	 * the authoritative profile state confirms the new account.
	 */
	$result = $method->invoke(
		$service,
		'nextcloud-user',
		[
			'access_token' => 'redacted-access-token',
			'PrivateKey' => null,
			'AccountKeys' => null,
			'Kdf' => 0,
			'KdfIterations' => 600000,
			'UserDecryptionOptions' => [
				'HasMasterPassword' => 'false',
				'MasterPasswordUnlock' => null,
			],
		],
	);

	assertSameValue(
		true,
		$result['requiresMasterPasswordSetup'] ?? null,
		'New SSO user was not sent to first-time setup',
	);
	assertSameValue(
		'new.user@example.test',
		$result['email'] ?? null,
		'New SSO profile email was not retained',
	);
	assertSameValue(
		14,
		$result['masterPasswordPolicy']['min_length'] ?? null,
		'Administrator password policy was not included',
	);
	assertSameValue(
		600000,
		$result['loginData']['KdfIterations'] ?? null,
		'Vaultwarden KDF parameters were not included',
	);
	assertSameValue(
		1,
		$httpClient->profileRequests,
		'The authoritative account profile was not checked exactly once',
	);

	fwrite(
		STDOUT,
		"SSO service onboarding regression test passed.\n",
	);
}
