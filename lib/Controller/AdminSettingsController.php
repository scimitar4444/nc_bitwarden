<?php

declare(strict_types=1);

namespace OCA\NcBitwarden\Controller;

use OCA\NcBitwarden\Service\UserSettingsService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;

final class AdminSettingsController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private UserSettingsService $settingsService,
	) {
		parent::__construct($appName, $request);
	}

	public function getSettings(): JSONResponse {
		return new JSONResponse(
			$this->settingsService->getAdminSettings(),
		);
	}

	public function saveSettings(): JSONResponse {
		try {
			$allowUserOverride = $this->booleanParam(
				'allow_user_override',
				true,
			);
			$ssoEnabled = $this->booleanParam(
				'sso_enabled',
				false,
			);
			$classicLoginAllowed = $this->booleanParam(
				'classic_login_allowed',
				true,
			);
			$passkeyUnlockEnabled = $this->booleanParam(
				'passkey_unlock_enabled',
				false,
			);
			$tabUnlockMode = (string)$this->request->getParam(
				'tab_unlock_mode',
				'user_choice',
			);
			$tabUnlockDefault = $this->booleanParam(
				'tab_unlock_default',
				true,
			);

			$ssoPasswordMinLength = filter_var(
				$this->request->getParam(
					'sso_password_min_length',
					12,
				),
				FILTER_VALIDATE_INT,
			);

			if ($ssoPasswordMinLength === false) {
				throw new \InvalidArgumentException(
					'Invalid value for sso_password_min_length',
				);
			}

			$ssoPasswordRequireLower = $this->booleanParam(
				'sso_password_require_lower',
				false,
			);
			$ssoPasswordRequireUpper = $this->booleanParam(
				'sso_password_require_upper',
				false,
			);
			$ssoPasswordRequireNumber = $this->booleanParam(
				'sso_password_require_number',
				false,
			);
			$ssoPasswordRequireSpecial = $this->booleanParam(
				'sso_password_require_special',
				false,
			);

			$organizationNotice =
				$this->settingsService
					->validateOrganizationNoticeSettings(
						$this->booleanParam(
							'organization_notice_enabled',
							false,
						),
						(string)$this->request->getParam(
							'organization_notice_title',
							'',
						),
						(string)$this->request->getParam(
							'organization_notice_message',
							'',
						),
						(string)$this->request->getParam(
							'organization_notice_support_url',
							'',
						),
						(string)$this->request->getParam(
							'organization_notice_support_label',
							'',
						),
						(string)$this->request->getParam(
							'organization_notice_support_email',
							'',
						),
					);

			/*
			 * Every field, including the separately stored notice, has
			 * now been validated. Only now do we persist the request.
			 */
			$this->settingsService->saveAdminSettings(
				(string)$this->request->getParam(
					'server_type',
					'cloud_us',
				),
				(string)$this->request->getParam(
					'custom_url',
					'',
				),
				$allowUserOverride,
				$ssoEnabled,
				$classicLoginAllowed,
				$passkeyUnlockEnabled,
				$tabUnlockMode,
				$tabUnlockDefault,
				$ssoPasswordMinLength,
				$ssoPasswordRequireLower,
				$ssoPasswordRequireUpper,
				$ssoPasswordRequireNumber,
				$ssoPasswordRequireSpecial,
			);

			$this->settingsService
				->saveOrganizationNoticeSettings(
					$organizationNotice['enabled'],
					$organizationNotice['title'],
					$organizationNotice['message'],
					$organizationNotice['support_url'],
					$organizationNotice['support_label'],
					$organizationNotice['support_email'],
				);

			return new JSONResponse([
				'status' => 'ok',
			]);
		} catch (\InvalidArgumentException $exception) {
			return new JSONResponse(
				['error' => $exception->getMessage()],
				400,
			);
		}
	}

	private function booleanParam(
		string $name,
		bool $default,
	): bool {
		$value = filter_var(
			$this->request->getParam($name, $default),
			FILTER_VALIDATE_BOOLEAN,
			FILTER_NULL_ON_FAILURE,
		);

		if ($value === null) {
			throw new \InvalidArgumentException(
				'Invalid value for ' . $name,
			);
		}

		return $value;
	}
}
