# Changelog

All notable changes to Warden are documented in this file.

## 2.7.0 - 2026-09-02

Warden 2.7.0 makes frequent vault actions clearer and collection navigation
more predictable, especially in large organization vaults.

### Added

- Login rows and item details now provide dedicated quick-copy actions for
  passwords and, when available, current TOTP codes
- Favorites can be added or removed directly from each item row using a
  persistent star action
- Missing intermediate collection path segments are represented by
  navigation-only folders, so paths such as `IT/Applications/Sigma/Senso`
  remain visually complete even when Vaultwarden returns only the leaf
  collection

### Changed

- The global vault search is visually separated from the collection-name
  filter and now explains that it searches all vault entries
- Sorting is located in the item column where it affects the displayed result
  list
- Folder and collection sections use consistent expand and collapse behavior
- Selecting a parent collection also expands or collapses its subcollections
- Selecting an already visible item keeps the current scroll position instead
  of moving the row to the center of the list
- Copy, edit and delete actions retain a stable and consistent order across
  item rows

### Fixed

- Selected item and collection rows retain one continuous highlight across
  their complete width, including their action areas
- Pointer focus and copy-success feedback no longer leave stale gray button
  backgrounds after the pointer moves away
- Collection hierarchy levels no longer appear to be skipped when only a
  deeper slash-separated collection exists
- Expanding or collapsing navigation sections no longer leaves their labels
  looking selected

### Safety and quality

- Favorite updates preserve the current folder assignment, update the visible
  state immediately and roll back safely when the provider rejects the change
- Navigation-only collection nodes cannot be selected as storage targets,
  edited, deleted or used for drag-and-drop
- Added eight regression tests for quick-copy actions, virtual-list scrolling,
  generated collection hierarchy nodes and favorite updates
- All thirty-one regression tests passed
- Localization, PHP syntax, coding standards, static analysis, release
  preflight, ESLint and the production build passed
- The release candidate was functionally verified on a live Nextcloud
  instance

## 2.6.2 - 2026-09-01

Warden 2.6.2 streamlines SSO-only access and recovers cleanly when a complete
Nextcloud sign-out leaves a stale tab-scoped vault key in the browser.

### Changed

- Warden now starts the initial SSO flow automatically when SSO is enabled and
  classic login is disabled
- The initial SSO flow uses the current browser tab, avoiding popup blockers,
  while session renewal continues to use a separate window so open work stays
  available
- SSO callback results are processed after login settings are loaded so
  passkey vault unlock remains available after the redirect

### Fixed

- Returning after a complete Nextcloud or OIDC sign-out no longer opens the
  in-session renewal dialog for a stale browser unlock key
- An expired server session found during initial vault restoration now clears
  only the stale tab key and restarts the normal login flow
- Failed SSO callbacks remain on the login screen instead of immediately
  starting another redirect

### Safety and quality

- Automatic SSO is limited to SSO-only configurations and never replaces the
  explicit renewal flow used while an unlocked vault or unsaved changes are
  open
- Added two regression tests for automatic SSO selection and initial-session
  restoration
- All twenty-three regression tests passed
- Localization, PHP syntax, release preflight, ESLint and the production build
  passed
- The release candidate was installed and functionally verified on a live
  Nextcloud instance

## 2.6.1 - 2026-09-01

Warden 2.6.1 makes expired provider sessions visible and recoverable without
discarding the open vault or unsaved item changes.

### Added

- Central detection for expired Warden sessions across protected vault API
  requests
- A persistent session warning with an in-place sign-in action
- Session renewal for SSO and classic login while the existing vault remains
  open in the background
- Account verification that rejects a different vault identity returned during
  session renewal

### Fixed

- Saving an item after a provider session expired no longer appears to do
  nothing
- Unsaved item changes remain available while the user signs in again
- Failed vault reloads caused by session expiry no longer clear the locally
  unlocked vault state
- Login, two-factor and logout errors are excluded from the global expiry
  detector to prevent misleading renewal prompts

### Safety and quality

- Mutations are not retried automatically after renewed authentication, which
  prevents ambiguous requests from creating duplicate changes
- Added two regression tests for protected-request detection and renewed-account
  validation
- All twenty-one regression tests passed
- Localization, PHP syntax, release preflight, ESLint and the production build
  passed in continuous verification

## 2.6.0 - 2026-08-31

Warden 2.6.0 makes global vault search remain responsive with large vaults,
especially when short queries initially match hundreds or thousands of items.

### Changed

- Searchable item text is prepared once per vault update instead of being
  rebuilt for every item after each typed character
- Vault item sorting is cached independently of the current search term
- Result lists render only the visible rows and a small overscan buffer instead
  of creating every matching row in the browser at once
- Virtualized rows retain the complete result indices used by range selection,
  bulk selection and drag-and-drop
- The active item remains centered when available, while result sets without an
  active item start at the top

### Fixed

- The first characters of a search no longer cause a noticeable pause when a
  large part of the vault matches
- Large result sets no longer create hundreds or thousands of item-row
  components simultaneously
- Shorter result sets no longer retain an invalid scroll offset from a previous
  larger list

### Quality

- Added three regression tests for search normalization, searchable metadata,
  secret-field exclusion and prepared-index reuse
- All nineteen regression tests passed
- Localization, PHP syntax, release preflight, ESLint and the production build
  passed
- The release candidate was installed and functionally verified with a large
  vault on a live Nextcloud instance

## 2.5.2 - 2026-08-20

Warden 2.5.2 makes the vault workspace adapt to the available Nextcloud app
width, keeps navigation and search reachable in compact layouts, and aligns
the administrator attachment limit with the enforced upload ceiling.

### Added

- Adaptive three-, two- and one-pane vault layouts based on the available app
  width instead of the complete browser viewport
- Compact navigation controls for moving between navigation, search results
  and item details without losing the current selection
- A mobile `Show results` action and Enter-key handling for opening filtered
  search results from the one-pane navigation view
- Four regression tests for proportional default column widths, persisted
  width fitting and minimum usable widths

### Changed

- Default navigation and item widths now follow the available workspace width
- Persisted user widths are reduced proportionally when necessary to preserve
  usable space for item details
- Column resize handles are hidden automatically in two- and one-pane layouts
- Both administrator attachment settings now enforce and describe the shared
  maximum of 50 MiB while retaining the 25 MiB default

### Fixed

- Narrow vault views no longer retain all three desktop panes and force a
  horizontal scrollbar
- Navigation and global search remain reachable while item details are open in
  the two-pane layout
- One-pane searches no longer update an invisible result list without offering
  a visible path to the matches
- Long item titles and subtitles retain the full row width improvements from
  Warden 2.4 while adapting to narrow layouts

### Validation

- All sixteen regression tests passed
- Localization, ESLint and the production build passed
- Version metadata and generated responsive CSS were verified
- The release candidate was installed and functionally verified on a live
  Nextcloud instance

## 2.4.1 - 2026-08-18

Version 2.4.1 updates transitive frontend and build dependencies with
available security fixes and corrects the public repository links.

### Security

- Updated DOMPurify from 3.4.12 to 3.4.13 to address the reported detached
  subtree XSS vulnerability
- Updated vulnerable transitive `brace-expansion`, `fast-uri` and `nanoid`
  versions to their patched releases
- Reduced the npm audit result from three high, one moderate and seven low
  findings to seven low findings; the remaining reports are inherited through
  the Nextcloud Vite polyfill toolchain and currently have no available fix

### Fixed

- The application issue link now points to the active GitHub repository
- The source-installation example now clones the active GitHub repository

### Validation

- All twelve regression tests passed with the updated dependency tree
- npm audit reports no critical, high or moderate vulnerabilities
- Composer audit reports no advisories or abandoned packages
- Localization, PHP 8.1–8.4 syntax, coding-standard, Psalm, release preflight,
  ESLint and the production build passed

## 2.4.0 - 2026-08-18

Version 2.4.0 improves item-row readability, makes ownership transfers
resilient to ambiguous provider responses and expands continuous verification
across every supported PHP version.

### Changed

- Hidden desktop item actions no longer reserve horizontal space; titles and
  subtitles can use the complete row width until actions are shown
- Item actions remain permanently reachable in the normal layout on touch and
  coarse-pointer devices
- Ownership transfers verify whether the source item still exists after an
  ambiguous deletion or network failure
- A confirmed missing source completes the transfer, an existing source rolls
  back the target, and an unverifiable result preserves the target to prevent
  data loss

### Fixed

- Long item titles and subtitles are no longer truncated early by invisible
  action controls
- A connection failure after a successful server-side source deletion can no
  longer cause the only remaining target item to be removed
- Rollback failures retain the original transfer error for accurate reporting

### Quality

- Added six ownership-transfer regression tests for success, attachment-copy
  failure, source-delete failure, confirmed deletion, unverifiable deletion
  and rollback failure
- Expanded PHP syntax verification to PHP 8.1, 8.2, 8.3 and 8.4
- Added independent PHP coding-standard and Psalm jobs
- Formatted the PHP codebase with the configured Nextcloud coding standard
- All twelve regression tests, localization, release preflight, ESLint,
  production build, PHP matrix, coding-standard and Psalm checks passed
- The functional release candidate was installed and verified on a live
  Nextcloud instance

## 2.3.0 - 2026-08-17

Version 2.3.0 improves vault navigation, global search, reliability and
performance, with additional safeguards against partial or inconsistent data
updates.

### Added

- Resizable navigation and item columns with per-user browser persistence
- Keyboard-accessible column resize controls
- Context-aware item creation that preselects the active personal folder or
  writable organization collection
- Global vault search that is independent of the selected category, folder or
  collection
- Search scopes for personal items, organization items or both vault areas
- Regression tests for encryption, attachment integrity, partial decryption
  failures, organization keys, KDF validation and bounded concurrency
- GitHub Actions verification for tests, localization, PHP metadata, ESLint,
  release preflight and production builds

### Changed

- Imported AES and HMAC keys are reused while decrypting a vault
- Cipher decryption is limited to 16 concurrent items to reduce browser load
- Attachment uploads are capped at 50 MiB while transfers still require full
  browser and server buffering; the default remains 25 MiB
- KDF parameters are now used exactly when supported instead of being silently
  changed
- Temporary settings-loading failures can be retried without reloading the
  complete Nextcloud page

### Fixed

- Entries with partially unreadable encrypted fields remain visible but are
  read-only, preventing unreadable values from being saved as empty
- Organization entries fail safely when their organization key is unavailable
- Invalid or unexpected provider JSON is reported as an upstream error instead
  of being treated as an empty successful response
- Existing token state is cleared before a new login token set is stored
- User and administrator settings are fully validated before any values are
  written
- Search results no longer remain restricted to the currently selected folder,
  collection or category

### Validation

- Complete `npm run verify` workflow passed after the functional changes
- All six Node regression tests passed
- PHP syntax, route metadata, localization, ESLint and production build passed
- The release-candidate branch was installed successfully on a live Nextcloud
  instance

## 2.2.2 - 2026-07-28

Version 2.2.2 fixes the Nextcloud application bootstrap and release
packaging after the 2.2.1 security release.

### Fixed

- Removed the empty `AppInfo/Application.php` bootstrap class
- Moved the application identifier to `AppInfo/AppConstants.php`
- Updated page and settings classes to use `AppConstants::APP_ID`
- Prevented duplicate class declaration during Nextcloud CLI startup
- Restored successful loading of Warden through Nextcloud CLI and web routes
- Corrected runtime permissions for application metadata and PHP classes

### Quality

- Updated the release preflight for the bootstrap-free architecture
- The preflight rejects a reintroduced `Application.php`
- The preflight rejects stale `Application::APP_ID` references
- Release archives use readable runtime permissions
- PHP syntax, localization, ESLint and production builds were verified
- Nextcloud app upgrade from 2.2.1 to 2.2.2 was verified

## 2.2.1 - 2026-07-28

Version 2.2.1 hardens authentication and session handling and adds a
manual vault refresh action.

### Added

- Manual vault refresh next to the standard and advanced view switch
- Refresh preserves the selected item, navigation, search, filters and sorting
- Loading indicator and refresh protection during editing and transfers

### Security

- SSO-only mode is enforced server-side for classic prelogin and login
- Access and refresh tokens are bound to the configured provider
- Pending OIDC flows are bound to their originating provider
- Provider mismatches invalidate the complete Warden session
- SSO authorization starts through a CSRF-protected POST request
- Failed login and two-factor attempts activate brute-force throttling
- OAuth tokens are removed from browser login responses
- Rotated refresh tokens are retained
- Failed token refresh attempts clear the Warden session
- Logout clears tokens, expiry data, provider binding and pending SSO state
- Restricted-password permissions also protect TOTP seeds

### Fixed

- TOTP values are hidden when password-view permission is unavailable
- Protected TOTP values remain unchanged while editing other fields
- The security tab shows the correct empty state for protected values
- The functional bounded attachment-download implementation remains active
- Vault changes can be loaded without refreshing the entire Nextcloud page

### Validation

- SSO-only and logout behavior tested through Nextcloud services
- Provider and SSO-flow mismatch behavior tested
- OIDC login tested successfully after the security changes
- Attachment download tested successfully after the final rollback
- Manual vault refresh tested successfully in production
- PHP syntax, ESLint, localization and production builds passed
- Public assets and blocked development paths verified

## 2.2.0 - 2026-07-27

Version 2.2.0 focuses on safer item editing, permission-aware actions,
conflict handling and reliable localization. Features already introduced in
2.0.0 and 2.1.0 remain unchanged in the release history.

### Added

- Standard and advanced interface modes for item details and editing
- Warning and direct switch when advanced data is hidden in standard mode
- Duplication of vault items
- Warning before closing an item with unsaved changes
- Saving forms with `Ctrl+Enter`
- Specific feedback when an item was changed in another client
- Strict localization audit for missing, empty or invalid translations

### Changed

- Item editing preserves hidden and type-specific data, including multiple
  URLs, custom and linked fields, attachments, passkey metadata, password
  history, reprompt settings and SSH-key data
- Item-type changes preserve existing data and reject unsafe conversions
- Organization and collection selection is restricted to valid writable
  targets
- Known read-only, deletion and restricted-password permission flags are
  honored consistently by the interface and save paths
- Inline note editing, attachment feedback and SSH-key error handling were
  improved
- German terminology and visible interface translations were completed and
  standardized

### Fixed

- Saving an item in standard mode no longer discards hidden advanced data
- Read-only entries can no longer be saved through alternate form paths
- Invalid organization and collection assignments are rejected before saving
- Stale item revisions now produce a clear concurrent-edit conflict message
- German translation catalogs safely escape quotes and other special
  characters
- Translation catalogs are generated atomically from the canonical PHP file
- Missing translations, broken placeholders and dynamic translation keys now
  fail the localization check

### Quality

- Added reproducible generation of `de.js` and `de.json` from `de.php`
- Added automated synchronization, syntax and placeholder checks for the
  German translation catalogs
- ESLint, localization checks and the production build are part of the
  verification process

## 2.1.0 - 2026-07-26

Version 2.1.0 adds administrator-controlled passkey-based vault unlock after
Vaultwarden OIDC single sign-on.

### Added

- WebAuthn-PRF capability test for compatible browsers and security keys
- Security-key enrollment from an unlocked Warden vault
- Passkey-based vault unlock following successful OIDC SSO
- Replacement and removal of the configured security key
- Administrator policy for enabling passkey-based vault unlock
- Master-password fallback and recovery path

### Security

- Passkey unlock is disabled by default
- Enrollment and unlock are permitted only when enabled by an administrator
- The WebAuthn PRF result remains exclusively in the browser
- The 64-byte Vaultwarden user key is wrapped using AES-256-GCM
- The wrapping key is derived using WebAuthn PRF and HKDF-SHA256
- Credential and account metadata are authenticated as AES-GCM additional data
- The configuration is bound to the selected provider and normalized account
  email address
- Nextcloud stores only the encrypted user key, credential identifier and
  public wrapping metadata
- Existing encrypted configurations remain stored while the administrator
  disables the feature

### Current scope

- Passkey unlock is available after Vaultwarden OIDC SSO
- Classic login remains dependent on the master password
- One passkey-unlock credential is supported per Nextcloud user
- Replacing the security key invalidates the previous configuration
- The master password remains the fallback and recovery method

### Validation

- WebAuthn PRF was tested successfully with a physical security key
- Security-key enrollment was tested from an unlocked vault
- Logout, OIDC SSO and passkey-based unlock were tested successfully
- Personal vault, organization vault and collection decryption were verified
- Administrator enable and disable behavior requires final regression testing
- ESLint, production build and PHP syntax checks passed

## 2.0.2 - 2026-07-25

Version 2.0.2 hardens provider network access and refreshes the JavaScript
dependency tree following the final security review.

### Security

- Disabled redirects for server-side provider API requests
- Disabled redirects for SSO token and profile requests
- User-selected self-hosted providers must resolve only to public,
  non-reserved addresses
- Administrator-defined inherited providers may continue to use trusted
  internal DNS
- Provider URLs containing credentials, query parameters or fragments are
  rejected
- Refreshed vulnerable transitive JavaScript dependencies
- Added separate security gates for production and development dependencies

### Validation

- npm registry signatures checked
- Production dependency audit checked
- Complete dependency tree audit checked
- ESLint and production build checked
- PHP syntax and application metadata checked

## 2.0.1 - 2026-07-25

Version 2.0.1 corrects functional, security and documentation issues found
during the post-release review of 2.0.0.

### Fixed

- Login items now support creating, editing, preserving and deleting multiple
  URLs without discarding all URLs after the first one
- URL match detection settings are preserved and can be edited
- URL match detection is hidden behind an advanced control by default
- Search now covers common decrypted item metadata instead of only item names
- Removed the obsolete server-side `clipboard_timeout` user preference
- Replaced visible hard-coded German labels in the item form and search scope
  with translatable strings
- Corrected the AIO installation instructions so development dependencies are
  not copied into the Nextcloud container

### Security

- Attachment download URLs must use HTTPS
- External attachment download hosts are resolved and rejected when they
  point to private or reserved addresses
- Literal IP addresses, embedded credentials and private hostname suffixes are
  rejected for attachment downloads
- Redirects are disabled for server-side attachment file downloads
- Search intentionally excludes passwords, TOTP secrets, SSH private keys and
  hidden custom-field values
- Documented the tab-scoped storage of decrypted user keys in
  `sessionStorage`

### Changed

- Clarified that Warden SSO currently targets self-hosted Vaultwarden
- Clarified the scope of SSO-only mode
- Clarified attachment direct-upload limitations
- Clarified self-hosted server URL restrictions
- Clarified that passkey support covers display, preservation and removal of
  stored credential metadata
- Clarified that password strength is a basic indicator and password age can
  be estimated for legacy entries

## 2.0.0 - 2026-07-25

Version 2.0.0 is a major expansion of the original Nextcloud integration.

### Added

- OIDC single sign-on for compatible Bitwarden and Vaultwarden servers
- Optional SSO-only login mode
- Initial master-password setup for eligible SSO accounts
- Tab-scoped vault unlock and session restoration
- Vaultwarden TOTP two-step login
- Personal and organization vault navigation
- Complete organization-key decryption using RSA-OAEP
- Organization collection creation, editing, deletion and search
- Personal folder creation, editing and deletion
- Transfer of personal items into organization collections
- Client-side re-encryption during ownership transfers
- Drag-and-drop operations for folders and collections
- Multiple selection and bulk actions
- Encrypted attachment upload, download and deletion
- Configurable maximum attachment size
- Passkey-aware login item display and preservation
- SSH-key item support
- Browser-side SSH-key generation
- Standalone password and passphrase generator
- German and English passphrase generation
- Live TOTP display with current and next code
- Favorites, TOTP, SSH-key and trash categories
- Trash, restore and permanent deletion
- Inline note editing
- Password strength and password age indicators
- Reused-password detection
- Warning for unencrypted HTTP login URLs
- Password history with the five most recently replaced passwords
- Administrator provider defaults and provider enforcement
- Per-user provider, navigation and generator preferences
- Organization notices and configurable support contact
- Three-column responsive Nextcloud interface
- Detail, security and attachment tabs
- German localization

### Changed

- Reworked the complete vault navigation and search interface
- Reworked item detail and item editing views
- Reworked organization and collection handling
- Reworked provider-specific Bitwarden and Vaultwarden terminology
- Improved large-vault navigation and selection behavior
- Improved collection filtering after item changes
- Improved validation and error handling for provider API responses
- Updated compatibility to Nextcloud 31 through 34
- Updated the application version to 2.0.0

### Security

- Vault encryption and decryption remain browser-side
- Master passwords are not transmitted to the Nextcloud server
- Organization keys are decrypted in the browser
- Attachments are encrypted and decrypted in the browser
- Personal-to-organization transfers re-encrypt cipher data before upload
- Access tokens are retained in the server-side PHP session
- New clipboard values are never overwritten by Warden after copying

### Removed

- Removed delayed automatic clipboard clearing

  Browsers block delayed clipboard access when the Warden document is no
  longer focused. The setting could therefore not provide reliable security
  and has been removed.

### Fixed

- Organization cipher updates retain the organization ID
- Collection assignments remain consistent after saving
- Selected entries remain visible after filter changes
- Provider API error statuses are forwarded correctly
- Vaultwarden client version headers are sent correctly
- Empty encrypted values no longer interrupt complete vault loading
- Individual malformed fields no longer prevent other item fields from loading
- Organization ciphers consistently use the organization key
- TOTP login prompts are displayed correctly
- Search clearing and organization selection behave consistently
- Moving entries preserves attachments, passkeys and custom fields
- Old generated CSS and JavaScript chunks are no longer retained in releases
- Frontend source now passes the configured ESLint rules

## 1.1.0

### Added

- Organization collection navigation, search and management
- Personal folder management
- Secure browser-side password generator
- Standalone password generator dialog
- Live TOTP display with current and next code
- Automatic TOTP refresh and countdown
- Dedicated TOTP category
- Copy support for current and next TOTP codes
- Improved card-based entry detail view
- URL opening in a new browser tab
- Tab-scoped vault unlock
- Vaultwarden two-factor login support

### Fixed

- Organization cipher updates retain the organization ID
- Vaultwarden API error statuses are forwarded correctly
- Collection filtering resets consistently after saving
- Selected entries remain visible after filter changes
- Bitwarden client version header is sent to Vaultwarden
