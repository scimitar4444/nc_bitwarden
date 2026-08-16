<?php

namespace OCA\NcBitwarden\Controller;

use OCA\NcBitwarden\Service\SsoService;
use OCA\NcBitwarden\Service\VaultwardenProxyService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\BruteForceProtection;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\DataDownloadResponse;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IConfig;
use OCP\IRequest;
use Psr\Log\LoggerInterface;

final class VaultwardenApiController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private VaultwardenProxyService $proxyService,
		private SsoService $ssoService,
		private IConfig $config,
		private LoggerInterface $logger,
		private string $userId,
	) {
		parent::__construct($appName, $request);
	}

	#[NoAdminRequired]
	public function prelogin(): JSONResponse {
		try {
			return new JSONResponse(
				$this->proxyService->prelogin(
					$this->userId,
					(string)$this->request->getParam(
						'email',
						'',
					),
				),
			);
		} catch (\Exception $e) {
			$this->logger->warning(
				'nc_bitwarden: prelogin failed',
				[
					'userId' => $this->userId,
					'error' => $e->getMessage(),
				],
			);

			$status = (int)$e->getCode();

			if ($status < 400 || $status > 499) {
				$status = 502;
			}

			/** @psalm-suppress InvalidArgument */
			return new JSONResponse(
				['error' => $e->getMessage()],
				$status,
			);
		}
	}

	#[NoAdminRequired]
	#[BruteForceProtection(action: 'bw_login')]
	public function login(): JSONResponse {
		$twoFactorToken = trim(
			(string)$this->request->getParam(
				'twoFactorToken',
				'',
			),
		);

		try {
			$result = $this->proxyService->login(
				$this->userId,
				[
					'email' => (string)$this->request
						->getParam('email', ''),
					'passwordHash' => (string)$this->request
						->getParam('passwordHash', ''),
					'twoFactorProvider' => $this->request
						->getParam('twoFactorProvider'),
					'twoFactorToken' => $twoFactorToken,
					'twoFactorRemember' => (bool)$this->request
						->getParam(
							'twoFactorRemember',
							false,
						),
				],
			);

			$response = new JSONResponse($result);

			/*
			 * Die erste Antwort "2FA erforderlich" ist kein
			 * Fehlversuch. Wurde jedoch bereits ein TOTP übermittelt
			 * und erneut 2FA angefordert, war der Code ungültig.
			 */
			if (
				$twoFactorToken !== ''
				&& !empty($result['twoFactorRequired'])
			) {
				$response->throttle();
			}

			return $response;
		} catch (\Exception $e) {
			$this->logger->warning(
				'nc_bitwarden: login failed',
				[
					'userId' => $this->userId,
					'error' => $e->getMessage(),
				],
			);

			$status = (int)$e->getCode() === 403
				? 403
				: 401;

			$response = new JSONResponse(
				['error' => $e->getMessage()],
				$status,
			);

			if ($status === 401) {
				$response->throttle();
			}

			return $response;
		}
	}

	#[NoAdminRequired]
	public function setPassword(): JSONResponse {
		return $this->proxy(
			'POST',
			'/accounts/set-password',
			$this->getJsonBody(),
		);
	}

	#[NoAdminRequired]
	public function changePassword(): JSONResponse {
		return $this->proxy(
			'POST',
			'/accounts/password',
			$this->getJsonBody(),
		);
	}

	#[NoAdminRequired]
	public function refresh(): JSONResponse {
		try {
			$this->proxyService->refreshToken($this->userId);
			return new JSONResponse(['status' => 'ok']);
		} catch (\Exception $e) {
			$this->logger->warning('nc_bitwarden: token refresh failed', ['error' => $e->getMessage()]);
			return new JSONResponse(['error' => 'Sitzung abgelaufen – bitte erneut einloggen.'], 401);
		}
	}

	#[NoAdminRequired]
	public function logout(): JSONResponse {
		$this->proxyService->logout();
		$this->ssoService->logout();

		return new JSONResponse([
			'status' => 'ok',
		]);
	}

	#[NoAdminRequired]
	public function sync(): JSONResponse {
		return $this->proxy('GET', '/sync?excludeDomains=true');
	}

	#[NoAdminRequired]
	public function getCiphers(): JSONResponse {
		return $this->proxy('GET', '/ciphers');
	}

	#[NoAdminRequired]
	public function createCipher(): JSONResponse {
		return $this->proxy(
			'POST',
			'/ciphers',
			$this->getJsonBody()
		);
	}

	#[NoAdminRequired]
	public function createOrganizationCipher(): JSONResponse {
		return $this->proxy(
			'POST',
			'/ciphers/create',
			$this->getJsonBody()
		);
	}

	#[NoAdminRequired]
	public function shareCipher(string $id): JSONResponse {
		return $this->proxy(
			'POST',
			"/ciphers/$id/share",
			$this->getJsonBody()
		);
	}

	#[NoAdminRequired]
	public function updateCipherCollections(string $id): JSONResponse {
		return $this->proxy(
			'POST',
			"/ciphers/$id/collections",
			$this->getJsonBody()
		);
	}

	#[NoAdminRequired]
	public function updateCipher(string $id): JSONResponse {
		return $this->proxy(
			'PUT',
			"/ciphers/$id",
			$this->getJsonBody(true)
		);
	}

	#[NoAdminRequired]
	public function updateCipherPartial(string $id): JSONResponse {
		return $this->proxy(
			'POST',
			"/ciphers/$id/partial",
			$this->getJsonBody(),
		);
	}

	#[NoAdminRequired]
	public function trashCipher(string $id): JSONResponse {
		return $this->proxy(
			'PUT',
			"/ciphers/$id/delete",
		);
	}

	#[NoAdminRequired]
	public function restoreCipher(string $id): JSONResponse {
		return $this->proxy(
			'PUT',
			"/ciphers/$id/restore",
		);
	}

	#[NoAdminRequired]
	public function deleteCipher(string $id): JSONResponse {
		return $this->proxy(
			'DELETE',
			"/ciphers/$id",
		);
	}

	#[NoAdminRequired]
	public function createAttachment(string $id): JSONResponse {
		$id = rawurlencode($id);

		return $this->proxy(
			'POST',
			"/ciphers/$id/attachment/v2",
			$this->getJsonBody(),
		);
	}

	#[NoAdminRequired]
	public function uploadAttachment(
		string $id,
		string $attachmentId,
	): JSONResponse {
		$id = rawurlencode($id);
		$attachmentId = rawurlencode($attachmentId);
		$path = "/ciphers/$id/attachment/$attachmentId";

		try {
			$uploaded = $this->request->getUploadedFile('data');

			$attachmentMaxMb = (int)$this->config->getAppValue(
				'nc_bitwarden',
				'attachment_max_mb',
				'25',
			);

			$attachmentMaxMb = max(
				1,
				min(1024, $attachmentMaxMb),
			);

			$attachmentUploadSize
				= (int)($uploaded['size'] ?? 0);

			if (
				$attachmentUploadSize <= 0
				&& !empty($uploaded['tmp_name'])
				&& is_file((string)$uploaded['tmp_name'])
			) {
				$detectedSize = filesize(
					(string)$uploaded['tmp_name'],
				);

				$attachmentUploadSize
					= $detectedSize === false
						? 0
						: (int)$detectedSize;
			}

			/*
			 * Das Backend erhält bereits verschlüsselte Daten.
			 * Für IV, Padding und MAC wird 1 MiB technischer
			 * Spielraum erlaubt. Das Klartextlimit wird im Browser
			 * exakt geprüft.
			 */
			$attachmentUploadLimit
				= (($attachmentMaxMb + 1) * 1024 * 1024);

			if (
				$attachmentUploadSize
					> $attachmentUploadLimit
			) {
				return new JSONResponse(
					[
						'error'
							=> 'Der Anhang ist größer als '
							. $attachmentMaxMb
							. ' MiB.',
					],
					413,
				);
			}

			if (
				!is_array($uploaded)
				|| (int)($uploaded['error'] ?? UPLOAD_ERR_NO_FILE)
					!== UPLOAD_ERR_OK
				|| empty($uploaded['tmp_name'])
				|| !is_readable((string)$uploaded['tmp_name'])
			) {
				return new JSONResponse(
					['error' => 'Es wurde keine gültige Datei übertragen.'],
					400,
				);
			}

			$result = $this->proxyService->uploadAttachment(
				$this->userId,
				$id,
				$attachmentId,
				(string)$uploaded['tmp_name'],
				(string)($uploaded['name'] ?? 'data'),
			);

			return new JSONResponse($result);
		} catch (\Exception $e) {
			return $this->attachmentErrorResponse(
				$e,
				'POST',
				$path,
			);
		}
	}

	#[NoAdminRequired]
	public function downloadAttachment(
		string $id,
		string $attachmentId,
	): DataDownloadResponse|JSONResponse {
		$id = rawurlencode($id);
		$attachmentId = rawurlencode($attachmentId);
		$path = "/ciphers/$id/attachment/$attachmentId";

		try {
			$data = $this->proxyService->downloadAttachment(
				$this->userId,
				$id,
				$attachmentId,
			);

			return new DataDownloadResponse(
				$data,
				'attachment.bin',
				'application/octet-stream',
				200,
				[
					'Cache-Control' => 'no-store, private',
					'X-Content-Type-Options' => 'nosniff',
				],
			);
		} catch (\Exception $e) {
			return $this->attachmentErrorResponse(
				$e,
				'GET',
				$path,
			);
		}
	}

	#[NoAdminRequired]
	public function deleteAttachment(
		string $id,
		string $attachmentId,
	): JSONResponse {
		$id = rawurlencode($id);
		$attachmentId = rawurlencode($attachmentId);

		return $this->proxy(
			'DELETE',
			"/ciphers/$id/attachment/$attachmentId",
		);
	}

	#[NoAdminRequired]
	public function getFolders(): JSONResponse {
		return $this->proxy('GET', '/folders');
	}

	#[NoAdminRequired]
	public function createFolder(): JSONResponse {
		return $this->proxy('POST', '/folders', $this->getJsonBody());
	}

	#[NoAdminRequired]
	public function updateFolderPost(string $id): JSONResponse {
		return $this->proxy(
			'POST',
			"/folders/$id",
			$this->getJsonBody()
		);
	}

	#[NoAdminRequired]
	public function updateFolderPut(string $id): JSONResponse {
		return $this->proxy(
			'POST',
			"/folders/$id",
			$this->getJsonBody()
		);
	}

	#[NoAdminRequired]
	public function deleteFolderPost(string $id): JSONResponse {
		return $this->proxy('POST', "/folders/$id/delete");
	}

	#[NoAdminRequired]
	public function deleteFolderDelete(string $id): JSONResponse {
		return $this->proxy('POST', "/folders/$id/delete");
	}

	#[NoAdminRequired]
	public function getCollectionDetails(
		string $organizationId,
		string $collectionId,
	): JSONResponse {
		return $this->proxy(
			'GET',
			"/organizations/$organizationId/collections/$collectionId/details"
		);
	}

	#[NoAdminRequired]
	public function createCollection(string $organizationId): JSONResponse {
		return $this->proxy(
			'POST',
			"/organizations/$organizationId/collections",
			$this->getJsonBody()
		);
	}

	#[NoAdminRequired]
	public function updateCollectionPost(
		string $organizationId,
		string $collectionId,
	): JSONResponse {
		return $this->proxy(
			'POST',
			"/organizations/$organizationId/collections/$collectionId",
			$this->getJsonBody()
		);
	}

	#[NoAdminRequired]
	public function updateCollectionPut(
		string $organizationId,
		string $collectionId,
	): JSONResponse {
		return $this->proxy(
			'POST',
			"/organizations/$organizationId/collections/$collectionId",
			$this->getJsonBody()
		);
	}

	#[NoAdminRequired]
	public function deleteCollectionPost(
		string $organizationId,
		string $collectionId,
	): JSONResponse {
		return $this->proxy(
			'POST',
			"/organizations/$organizationId/collections/$collectionId/delete"
		);
	}

	#[NoAdminRequired]
	public function deleteCollectionDelete(
		string $organizationId,
		string $collectionId,
	): JSONResponse {
		return $this->proxy(
			'POST',
			"/organizations/$organizationId/collections/$collectionId/delete"
		);
	}

	private function attachmentErrorResponse(
		\Exception $exception,
		string $method,
		string $path,
	): JSONResponse {
		$status = (int)$exception->getCode();

		if ($status < 400 || $status > 599) {
			$status = 502;
		}

		$message = $status < 500
			? (
				$exception->getMessage()
				?: 'Anhangsanfrage fehlgeschlagen.'
			)
			: 'Anhangsanfrage fehlgeschlagen.';

		$this->logger->error(
			'nc_bitwarden: attachment proxy error',
			[
				'method' => $method,
				'path' => $path,
				'status' => $status,
				'error' => $exception->getMessage(),
			],
		);

		/** @psalm-suppress InvalidArgument */
		return new JSONResponse(
			['error' => $message],
			$status,
		);
	}

	private function getJsonBody(
		bool $preserveOrganizationId = false,
	): array {
		$params = $this->request->getParams();
		$this->request->throwDecodingExceptionIfAny();

		// URL-Parameter dürfen nicht an Vaultwarden weitergereicht werden.
		unset(
			$params['id'],
			$params['collectionId'],
		);

		// Bei Cipher-Updates ist organizationId ein reguläres Payload-Feld.
		if (!$preserveOrganizationId) {
			unset($params['organizationId']);
		}

		return $params;
	}

	private function proxy(string $method, string $path, array $body = []): JSONResponse {
		try {
			return new JSONResponse($this->proxyService->apiRequest($this->userId, $method, $path, $body));
		} catch (\Exception $e) {
			$status = (int)$e->getCode();

			if ($status < 400 || $status > 599) {
				$status = 502;
			}

			$message = $status < 500
				? ($e->getMessage() ?: 'Vault-Anfrage fehlgeschlagen.')
				: 'Vault-Anfrage fehlgeschlagen.';

			$this->logger->error(
				'nc_bitwarden: API proxy error',
				[
					'method' => $method,
					'path' => $path,
					'status' => $status,
					'error' => $e->getMessage(),
				],
			);

			// OCP beschränkt den Psalm-Typ auf bekannte Http::STATUS_*-Konstanten.
			// Der Status wurde unmittelbar zuvor auf den Bereich 400 bis 599 geprüft.
			/** @psalm-suppress InvalidArgument */
			return new JSONResponse(
				['error' => $message],
				$status,
			);
		}
	}
}
