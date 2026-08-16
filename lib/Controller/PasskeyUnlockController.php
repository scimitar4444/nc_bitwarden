<?php

namespace OCA\NcBitwarden\Controller;

use OCA\NcBitwarden\Service\PasskeyUnlockService;
use OCA\NcBitwarden\Service\UserSettingsService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IL10N;
use OCP\IRequest;

final class PasskeyUnlockController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private PasskeyUnlockService $passkeyUnlockService,
		private UserSettingsService $settingsService,
		private IL10N $l,
		private string $userId,
	) {
		parent::__construct($appName, $request);
	}

	#[NoAdminRequired]
	public function getConfig(): JSONResponse {
		if (!$this->settingsService->isPasskeyUnlockEnabled(
			$this->userId,
		)) {
			return new JSONResponse([
				'enabled' => false,
				'configured' => false,
			]);
		}

		return new JSONResponse(
			array_merge(
				[
					'enabled' => true,
				],
				$this->passkeyUnlockService->getConfig(
					$this->userId,
				),
			),
		);
	}

	#[NoAdminRequired]
	public function saveConfig(): JSONResponse {
		if (!$this->settingsService->isPasskeyUnlockEnabled(
			$this->userId,
		)) {
			return $this->disabledResponse();
		}

		try {
			$config = $this->request->getParam(
				'config',
				[],
			);

			if (!is_array($config)) {
				throw new \InvalidArgumentException(
					'Invalid passkey unlock payload',
				);
			}

			return new JSONResponse(
				array_merge(
					[
						'enabled' => true,
					],
					$this->passkeyUnlockService->saveConfig(
						$this->userId,
						$config,
					),
				),
			);
		} catch (
			\InvalidArgumentException
			|\JsonException $exception
		) {
			return new JSONResponse(
				[
					'error' => $exception->getMessage(),
				],
				400,
			);
		}
	}

	#[NoAdminRequired]
	public function deleteConfig(): JSONResponse {
		if (!$this->settingsService->isPasskeyUnlockEnabled(
			$this->userId,
		)) {
			return $this->disabledResponse();
		}

		$this->passkeyUnlockService->deleteConfig(
			$this->userId,
		);

		return new JSONResponse([
			'status' => 'ok',
		]);
	}

	private function disabledResponse(): JSONResponse {
		return new JSONResponse(
			[
				'error' => $this->l->t(
					'Passkey vault unlock is disabled by the administrator.',
				),
			],
			403,
		);
	}
}
