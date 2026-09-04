# Warden

> Native Bitwarden and Vaultwarden integration for Nextcloud

![Version](https://img.shields.io/badge/Version-2.7.1-blue)
![Nextcloud](https://img.shields.io/badge/Nextcloud-31--34-0082C9?logo=nextcloud&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-8.1+-777BB4?logo=php&logoColor=white)
![License](https://img.shields.io/badge/License-AGPL--3.0-green)

Warden provides access to Bitwarden and Vaultwarden vaults directly inside
Nextcloud.

It supports classic master-password authentication, Vaultwarden TOTP login,
OIDC single sign-on, administrator-controlled WebAuthn-PRF passkey vault
unlock, personal and organization vaults, encrypted attachments, collections,
folders, passkey-aware login entries, SSH keys, password generation, bulk
operations and trash management.

Vault cryptography is performed in the browser. The master password and
decrypted vault contents are not sent to Nextcloud.

Warden is an independent integration and is not an official Bitwarden client.

## What's new in 2.7.1

Warden 2.7.1 reliably recognizes newly provisioned Vaultwarden SSO accounts
and directs them to the required first-time master-password setup.

- Account state is verified using both the SSO token and the authenticated
  Vaultwarden profile
- New users create their master password and cryptographic account keys before
  the vault opens
- Existing and contradictory account states never enter the initialization
  endpoint

For the complete list of changes, see `CHANGELOG.md`.

## Supported providers

Warden can connect to:

- Bitwarden Cloud US at `bitwarden.com`
- Bitwarden Cloud EU at `bitwarden.eu`
- Self-hosted Vaultwarden instances
- Compatible self-hosted Bitwarden instances

Self-hosted servers must provide a valid HTTPS endpoint using a DNS hostname
that is reachable from the Nextcloud server. Literal IP addresses and
hostnames ending in `.local`, `.internal`, `.lan`, `.corp` or `.home` are
rejected.

## Features

### Authentication

- Classic email and master-password login
- Vaultwarden TOTP two-step login
- OIDC single sign-on for self-hosted Vaultwarden servers
- Optional SSO-only operation
- First-login master-password setup for SSO accounts when required
- Administrator-controlled passkey vault unlock after SSO
- WebAuthn-PRF hardware security-key enrollment
- Security-key replacement and removal
- Master-password fallback and recovery
- Tab-scoped vault unlock
- Provider configuration by administrators
- Optional per-user provider overrides

### Vault items

Warden supports the following Bitwarden item types:

- Login
- Secure note
- Card
- Identity
- SSH key

Login entries support:

- Username and password
- Direct password and current TOTP quick-copy actions
- Multiple URLs
- TOTP secrets and live codes
- Password history
- Display, preservation and removal of stored passkey credential metadata
- Custom text, hidden, boolean and linked fields

SSH keys can be displayed, edited and generated in the browser.

### Personal and organization vaults

- Personal vault items
- Personal folders
- Organization vaults
- Organization collections
- Collection creation, editing and deletion
- Organization-key decryption using RSA-OAEP
- Moving personal entries into organization collections
- Client-side re-encryption during ownership transfers
- Preservation of attachments, passkeys and custom fields during transfers

### Attachments

- Encrypted attachment upload for providers using the direct upload flow
- Encrypted attachment download
- Attachment deletion
- Configurable server-side attachment size limit, capped at 50 MiB while
  transfers require full buffering
- Client-side attachment encryption and decryption

### Navigation and management

- Three-column Nextcloud interface
- Resizable navigation and item columns with saved per-user widths
- Personal and organization navigation
- Folder and collection counters
- Global full-text search independent of the selected category, folder or
  collection
- Search scopes for personal items, organization items or both vault areas
- Search across names, usernames, URLs, notes, non-hidden custom fields,
  identity metadata, SSH public metadata and attachment names
- Favorites with a directly accessible item-row toggle
- TOTP category
- SSH-key category
- Trash view
- Restore from trash
- Permanent deletion
- Drag-and-drop
- Multiple selection
- Bulk folder and collection operations
- Bulk transfer from personal vaults to organizations
- Inline note editing
- Manual vault refresh while preserving navigation, filters and selection

Search deliberately excludes passwords, TOTP secrets, SSH private keys and
hidden custom-field values.

### Password tools

- Browser-side password generator
- Browser-side passphrase generator
- Configurable length and character groups
- German and English passphrase word lists
- Basic password strength indication
- Password age indication with fallback estimation for legacy entries
- Reused-password detection
- HTTP URL warning
- Storage of the five most recently replaced passwords

### Preferences

Administrators can configure:

- Default provider
- Self-hosted provider URL
- Whether users may override the provider
- Login and SSO behavior
- Browser-tab unlock policy
- Whether passkey-based vault unlock is available
- Maximum attachment size
- Organization notices and support information

Users can configure, where permitted:

- Provider selection
- Initial navigation category
- Navigation expansion behavior
- Default target vault and collection
- Default item type
- Password-generator defaults
- Passphrase-generator defaults
- Whether Warden stays unlocked in the current browser tab, when permitted

## Security model

Warden separates browser-side cryptography from the Nextcloud API proxy.

```text
Browser                         Nextcloud                     Provider
   │                                │                            │
   │  Authentication request        │                            │
   ├───────────────────────────────▶│───────────────────────────▶│
   │                                │                            │
   │                                │◀──── Encrypted data ─────-─│
   │◀──── Encrypted vault data ─────│                            │
   │                                │                            │
   │  Key derivation, verification, encryption and decryption    │
   │  take place in the browser.                                 │
   │                                │                            │
   │  Plaintext vault contents remain in the browser.            │
```

The implementation includes:

- PBKDF2 and Argon2id key derivation
- HKDF key expansion
- AES-CBC encryption and decryption
- HMAC-SHA256 authentication
- RSA-OAEP organization-key decryption
- Client-side cipher re-encryption
- Client-side attachment encryption and decryption
- WebAuthn PRF and HKDF-SHA256 key derivation for passkey unlock
- AES-256-GCM wrapping of the Vaultwarden user key
- Provider access tokens stored in the server-side PHP session

The master password itself is not sent to the Nextcloud server. Classic login
uses values derived from the master password as required by the Bitwarden
protocol.

### Browser memory

JavaScript strings and cryptographic values cannot be guaranteed to be
securely erased from browser memory. This limitation applies to browser-based
password managers in general.

When tab-scoped unlock is enabled, Warden stores the decrypted user encryption
and MAC keys as Base64 values in the browser tab's `sessionStorage`. This
survives page reloads in the same tab but is removed when Warden logs out or
the tab session ends. Scripts running in the same Nextcloud origin could access
that storage, so the security of the complete Nextcloud origin is relevant.

Tab-scoped unlock does not store a local copy of vault items and is not an
offline cache. Warden does not currently offer persistent local vault storage.

### Clipboard behavior

Warden copies values only after a direct user action.

Warden does not offer automatic delayed clearing of the system clipboard.
Browser clipboard APIs commonly require a focused document and a direct user
action. A background timer therefore cannot guarantee that copied data will be
removed, which would make such a security option unreliable and misleading.

Users should treat copied passwords, TOTP codes and private keys as sensitive
clipboard data.

### No offline cache

Warden does not maintain a persistent offline copy of the decrypted vault.
There is currently no user option to store vault contents locally for offline
access.

A future local or offline cache would require a separate security design,
encryption at rest, explicit user opt-in, an administrator policy and a
reliable way to remove all locally stored vault data.

## Authentication modes

### Classic login

Classic login requires the account email address and master password.

When TOTP is enabled on a Vaultwarden account, Warden requests the current
authenticator code after the password has been verified.

Other interactive two-step methods, such as WebAuthn or hardware security
keys, are not currently handled by Warden's classic login form.

### OIDC single sign-on

For self-hosted Vaultwarden servers configured with OIDC SSO, Warden can
start and complete the provider login directly from Nextcloud. Warden does not
currently implement SSO for Bitwarden Cloud or generic self-hosted Bitwarden
servers.

SSO authenticates the user but does not bypass vault encryption. A master
password is required to initialize the encrypted vault and remains available
as the recovery method. When an administrator enables passkey unlock and a
compatible WebAuthn-PRF security key has been enrolled, Warden can use that
security key to unlock the vault following successful SSO.

When the server reports that an SSO account does not yet have a master
password, Warden can guide the user through the initial setup.

An administrator may configure SSO-only operation to prevent use of the
classic login form inside Warden. In this mode Warden starts the initial SSO
flow automatically. This does not disable classic authentication on the
Vaultwarden server itself or in other Bitwarden-compatible clients.

#### Vaultwarden reverse-proxy callback bridge

When Warden uses Vaultwarden OIDC single sign-on, Vaultwarden redirects web
clients through its own `/sso-connector.html` endpoint.

The Vaultwarden reverse proxy must forward callback requests whose `state`
starts with `warden_nc.` to the Warden callback in Nextcloud. Other
Vaultwarden and Bitwarden client requests must continue to use the original
Vaultwarden connector.

Example for Nginx:

```nginx
location = /sso-connector.html {
    if ($arg_state ~ "^warden_nc\.") {
        return 302 "https://cloud.example.com/index.php/apps/nc_bitwarden/sso/callback?code=$arg_code&state=$arg_state";
    }

    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Passkey vault unlock

Passkey vault unlock is currently available after Vaultwarden OIDC SSO and is
disabled by default. An administrator must enable it in the Warden
administration settings before users can test, enroll or use a security key.

The browser and security key must support WebAuthn PRF and user verification,
normally through a FIDO2 PIN and physical touch.

During enrollment, Warden wraps the decrypted 64-byte Vaultwarden user key
with an AES-256-GCM key derived locally from the WebAuthn PRF result using
HKDF-SHA256. The PRF result, plaintext user key and master password are not
stored by the Nextcloud server.

The server stores the credential identifier, random derivation metadata,
account binding and encrypted user key. Disabling the administrator policy
prevents enrollment and unlock but preserves the encrypted configuration.
Re-enabling the policy restores access to the existing configuration.

Classic login still requires the master password because Vaultwarden does not
currently provide Warden with a native passkey-only classic authentication
flow.

### Native passkey login

Native passkey-based login to Warden is distinct from passkey-based vault
unlock and is not currently available.

Warden can implement a native passkey login cleanly only when a future
Vaultwarden version provides a compatible and stable passkey authentication
flow for third-party clients. Until then, Vaultwarden OIDC SSO authenticates
the user and Warden's WebAuthn-PRF integration unlocks the encrypted vault.

## Requirements

| Component | Requirement |
|---|---|
| Nextcloud | 31, 32, 33 or 34 |
| PHP | 8.1 or newer |
| Browser | Current browser with Web Crypto; WebAuthn PRF is required for passkey vault unlock |
| HTTPS | Required for production operation |
| Node.js | Required only when building from source |
| npm | Required only when building from source |

## Installation

### Install a release package

Extract the application into the Nextcloud application directory:

```bash
cd /var/www/html/custom_apps
tar -xzf nc_bitwarden-2.7.1.tar.gz
chown -R www-data:www-data nc_bitwarden
```

Enable the application:

```bash
sudo -u www-data php /var/www/html/occ app:enable nc_bitwarden
```

### Install from source

```bash
cd /var/www/html/custom_apps

git clone \
  https://github.com/scimitar4444/nc_bitwarden.git

cd nc_bitwarden

npm ci
npm run build

sudo -u www-data php /var/www/html/occ app:enable nc_bitwarden
```

The generated `js/` and `css/` directories are required for operation.

## Upgrade

Replace the application files with the new version and rebuild the frontend
when installing from source:

```bash
cd /var/www/html/custom_apps/nc_bitwarden

npm ci
npm run build
```

Then run the Nextcloud upgrade process:

```bash
sudo -u www-data php /var/www/html/occ upgrade
```

Nextcloud stores the installed application version separately. Running
`occ upgrade` is therefore required after changing the version in
`appinfo/info.xml`.

## Configuration

### Administrator settings

Open:

```text
Nextcloud
└── Administration settings
    └── Warden
```

Select one of the supported providers:

- Bitwarden Cloud US
- Bitwarden Cloud EU
- Self-hosted Vaultwarden or Bitwarden

For a self-hosted provider, enter only the base URL:

```text
https://vault.example.com
```

Do not add `/api`, `/identity` or another API path.

The administrator can enforce this provider for all users or allow individual
provider overrides.

### Personal settings

When provider overrides are permitted, users can select their own provider
under:

```text
Nextcloud
└── Personal settings
    └── Warden server
```

Additional vault and generator preferences are available from the settings
dialog inside Warden.

## Self-hosted server restrictions

Warden accepts only HTTPS base URLs with a hostname. Literal IP addresses and
common private hostname suffixes are rejected. Server-side provider requests
do not follow HTTP redirects.

Administrator-defined inherited provider endpoints may use trusted internal
DNS. User-selected self-hosted providers must resolve only to public,
non-reserved addresses.

The Nextcloud setting `allow_local_remote_servers` does not override Warden's
own provider validation. A self-hosted provider should use a valid DNS hostname
and a certificate trusted by the operating system and PHP environment used by
Nextcloud.

Attachment download URLs returned by a provider must use HTTPS and must not
redirect. The configured provider hostname and HTTPS port are permitted. A
different endpoint, such as an external object-storage service, must resolve
only to public, non-reserved addresses.

### Private certificate authorities

The CA that signed the provider certificate must be trusted by the operating
system and PHP environment used by Nextcloud.

Do not disable TLS certificate verification.
## Nextcloud AIO

Use the installable release archive instead of copying a development checkout
or `node_modules` into the Nextcloud container.

Example:

```bash
docker cp \
  nc_bitwarden-2.7.1.tar.gz \
  nextcloud-aio-nextcloud:/tmp/

docker exec \
  --user root \
  nextcloud-aio-nextcloud \
  sh -c '
    cd /var/www/html/custom_apps &&
    rm -rf nc_bitwarden &&
    tar -xzf /tmp/nc_bitwarden-2.7.1.tar.gz &&
    chown -R www-data:www-data nc_bitwarden
  '

docker exec \
  --user www-data \
  nextcloud-aio-nextcloud \
  php /var/www/html/occ app:enable nc_bitwarden

docker exec \
  --user www-data \
  nextcloud-aio-nextcloud \
  php /var/www/html/occ upgrade
```

Container names may differ between installations.
## Development

Install dependencies:

```bash
npm ci
```

Start the watch build:

```bash
npm run dev
```

Run ESLint:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

### Main directories

```text
appinfo/       Nextcloud metadata and routes
lib/           PHP controllers, services and settings
src/           Vue components and browser-side services
templates/     Nextcloud PHP templates
l10n/          Application translations
js/            Generated JavaScript
css/           Generated stylesheets
```

Do not edit generated files in `js/` or `css/` directly.

## Current limitations

Warden does not currently provide:

- Browser autofill
- Bitwarden Send
- Persistent offline vault access or a user-selectable local vault cache
- WebAuthn or hardware-key handling in the classic two-step login form
- Native passkey-based login to Warden, which depends on compatible support in
  a future Vaultwarden version
- Guaranteed delayed clearing of the operating-system clipboard, because
  browser clipboard restrictions make it unreliable
- Attachment uploads requiring an external or indirect upload flow
- Private IP addresses and common private hostname suffixes for self-hosted providers

Stored passkey credentials in vault entries, native passkey login and
WebAuthn-PRF vault unlock are three separate features. Passkey-based vault
unlock following Vaultwarden OIDC SSO is supported by Warden.

## Release checks

Before publishing a release:

```bash
npm run lint
npm run build

find appinfo lib \
  -type f \
  -name '*.php' \
  -print0 \
  | xargs -0 -n1 php -l
```

The application version must match in:

- `appinfo/info.xml`
- `package.json`
- `package-lock.json`

## License

Warden is licensed under the
[GNU Affero General Public License v3.0](LICENSE).

## Credits

Warden is maintained by **Christian Thiele**.

The original Nextcloud application was created by **Philipp Tannich** and was
subsequently extended and modernized by Christian Thiele.

Related projects:

- [Bitwarden](https://bitwarden.com)
- [Vaultwarden](https://github.com/dani-garcia/vaultwarden)
- [Nextcloud](https://nextcloud.com)
- [@noble/hashes](https://github.com/paulmillr/noble-hashes)
