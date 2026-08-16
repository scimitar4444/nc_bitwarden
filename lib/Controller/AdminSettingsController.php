<?php

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
			$allowUserOverride = filter_var(
				$this->request->getParam(
					'allow_user_override',
					true,
				),
				FILTER_VALIDATE_BOOLEAN,
				FILTER_NULL_ON_FAILURE,
			);

			if ($allowUserOverride === null) {
				throw new \InvalidArgumentException(
					'Invalid value for allow_user_override',
				);
			}

			$ssoEnabled = filter_var(
				$this->request->getParam(
					'sso_enabled',
					false,
				),
				FILTER_VALIDATE_BOOLEAN,
				FILTER_NULL_ON_FAILURE,
			);

			if ($ssoEnabled === null) {
				throw new \InvalidArgumentException(
					'Invalid value for sso_enabled',
				);
			}

			$classicLoginAllowed = filter_var(
				$this->request->getParam(
					'classic_login_allowed',
					true,
				),
				FILTER_VALIDATE_BOOLEAN,
				FILTER_NULL_ON_FAILURE,
			);

			if ($classicLoginAllowed === null) {
				throw new \InvalidArgumentException(
					'Invalid value for classic_login_allowed',
				);
			}

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

			$organizationNoticeEnabled = $this->booleanParam(
				'organization_notice_enabled',
				false,
			);
			$organizationNoticeTitle = (string)$this->request->getParam(
				'organization_notice_title',
				'',
			);
			$organizationNoticeMessage = (string)$this->request->getParam(
				'organization_notice_message',
				'',
			);
			$organizationNoticeSupportUrl = (string)$this->request->getParam(
				'organization_notice_support_url',
				'',
			);
			$organizationNoticeSupportLabel = (string)$this->request->getParam(
				'organization_notice_support_label',
				'',
			);
			$organizationNoticeSupportEmail = (string)$this->request->getParam(
				'organization_notice_support_email',
				'',
			);

			$this->settingsService->validateOrganizationNoticeSettings(
				$organizationNoticeTitle,
				$organizationNoticeMessage,
				$organizationNoticeSupportUrl,
				$organizationNoticeSupportLabel,
				$organizationNoticeSupportEmail,
			);

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

			$this->settingsService->saveOrganizationNoticeSettings(
				$organizationNoticeEnabled,
				$organizationNoticeTitle,
				$organizationNoticeMessage,
				$organizationNoticeSupportUrl,
				$organizationNoticeSupportLabel,
				$organizationNoticeSupportEmail,
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
