<?php

namespace OCA\NcBitwarden\Controller;

use OCA\NcBitwarden\Service\UserSettingsService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;

final class SettingsController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private UserSettingsService $settingsService,
		private string $userId,
	) {
		parent::__construct($appName, $request);
	}

	#[NoAdminRequired]
	public function getSettings(): JSONResponse {
		return new JSONResponse(
			$this->settingsService->getSettings(
				$this->userId,
			),
		);
	}

	#[NoAdminRequired]
	public function getPreferences(): JSONResponse {
		return new JSONResponse(
			$this->settingsService->getUserPreferences(
				$this->userId,
			),
		);
	}

	#[NoAdminRequired]
	public function savePreferences(): JSONResponse {
		try {
			$preferences = $this->request->getParam(
				'preferences',
				[],
			);

			if (!is_array($preferences)) {
				throw new \InvalidArgumentException(
					'Invalid preferences payload',
				);
			}

			return new JSONResponse(
				$this->settingsService->saveUserPreferences(
					$this->userId,
					$preferences,
				),
			);
		} catch (
			\InvalidArgumentException
			|\JsonException $e
		) {
			return new JSONResponse(
				['error' => $e->getMessage()],
				400,
			);
		}
	}

	#[NoAdminRequired]
	public function saveSettings(): JSONResponse {
		try {
			$useNextcloudEmail = filter_var(
				$this->request->getParam(
					'use_nextcloud_email',
					true,
				),
				FILTER_VALIDATE_BOOLEAN,
				FILTER_NULL_ON_FAILURE,
			);

			if ($useNextcloudEmail === null) {
				throw new \InvalidArgumentException(
					'Invalid value for use_nextcloud_email',
				);
			}

			$this->settingsService->saveSettings(
				$this->userId,
				(string)$this->request->getParam(
					'server_type',
					'cloud_us',
				),
				(string)$this->request->getParam(
					'custom_url',
					'',
				),
				$useNextcloudEmail,
				(string)$this->request->getParam(
					'login_email',
					'',
				),
			);

			return new JSONResponse([
				'status' => 'ok',
			]);
		} catch (\InvalidArgumentException $e) {
			return new JSONResponse(
				['error' => $e->getMessage()],
				400,
			);
		}
	}
}
