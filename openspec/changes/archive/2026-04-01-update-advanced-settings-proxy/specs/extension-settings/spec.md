## ADDED Requirements
### Requirement: Centralized Advanced Settings
The extension SHALL use the advanced settings page as the single entry to manage GitHub, auto-sync, and proxy configuration.

#### Scenario: User updates sync configuration from advanced settings
- **WHEN** the user opens the advanced settings page
- **THEN** the page MUST display editable fields for GitHub owner/repo/branch/auth/token, auto-sync interval settings, and proxy server/port
- **AND** saving the form MUST persist these values into runtime config

#### Scenario: Popup focuses on execution actions
- **WHEN** the user opens the popup page
- **THEN** the popup MUST provide session collection and sync execution actions
- **AND** the popup MUST not require editing GitHub or auto-sync settings directly

### Requirement: Proxy Application for Runtime Network Access
The extension SHALL support applying a configurable proxy for runtime network requests.

#### Scenario: Enable proxy with valid server and port
- **WHEN** proxy server and proxy port are both configured and saved
- **THEN** background runtime MUST apply fixed proxy settings via browser proxy API
- **AND** subsequent runtime sync traffic MUST use the configured proxy route

#### Scenario: Disable proxy
- **WHEN** proxy server and proxy port are cleared
- **THEN** background runtime MUST clear previously applied proxy settings

### Requirement: Extension Branding Name
The extension SHALL expose the product name as `AI2Git` in extension metadata and user-facing title.

#### Scenario: Display extension name
- **WHEN** the extension is loaded in browser
- **THEN** extension metadata name and default action title MUST be `AI2Git`
