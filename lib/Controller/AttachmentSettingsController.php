<?php

declare(strict_types=1);

namespace OCA\NcBitwarden\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IConfig;
use OCP\IRequest;

/**
 */
final class AttachmentSettingsController extends Controller {
	private const CONFIG_KEY = 'attachment_max_mb';
	private const DEFAULT_MAX_MB = 25;
	private const MIN_MAX_MB = 1;
	private const MAX_MAX_MB = 50;

	public function __construct(
		string $appName,
		IRequest $request,
		private IConfig $config,
	) {
		parent::__construct($appName, $request);
	}

	#[NoAdminRequired]
	public function getSettings(): JSONResponse {
		$maxMb = $this->getConfiguredMaxMb();

		return new JSONResponse([
			'maxMb' => $maxMb,
			'maxBytes' => $maxMb * 1024 * 1024,
			'minMb' => self::MIN_MAX_MB,
			'maxAllowedMb' => self::MAX_MAX_MB,
		]);
	}

	/**
	 * Ohne NoAdminRequired bleibt diese Methode Administratoren
	 * vorbehalten.
	 */
	public function saveSettings(int $maxMb = 25): JSONResponse {
		$normalized = $this->normalizeMaxMb($maxMb);

		$this->config->setAppValue(
			'nc_bitwarden',
			self::CONFIG_KEY,
			(string)$normalized,
		);

		return new JSONResponse([
			'saved' => true,
			'maxMb' => $normalized,
			'maxBytes' => $normalized * 1024 * 1024,
		]);
	}

	private function getConfiguredMaxMb(): int {
		$value = (int)$this->config->getAppValue(
			'nc_bitwarden',
			self::CONFIG_KEY,
			(string)self::DEFAULT_MAX_MB,
		);

		return $this->normalizeMaxMb($value);
	}

	private function normalizeMaxMb(int $value): int {
		return max(
			self::MIN_MAX_MB,
			min(self::MAX_MAX_MB, $value),
		);
	}
}
