# Auto2FA

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Auto2FA is a Safari extension that automatically handles two-factor authentication (2FA) for your web accounts. It supports various authentication methods including OTP (One-Time Password), push notifications, and manual 2FA steps.

## Features

- 🔐 Automatic 2FA handling for supported websites
- 🔑 Secure credential storage using macOS Keychain
- 🔄 Support for multiple authentication methods:
  - OTP (TOTP) with auto-refresh
  - Push notifications
  - Manual 2FA steps with user guidance
- 🌐 Domain-based account mapping
- ⚡ Auto-submit forms (configurable)
- 🔍 Smart field detection for login forms
- 🛡️ Secure handling of sensitive data
- 📱 Native macOS app for configuration

## Installation

1. Download the latest release from the [Releases](https://github.com/yourusername/Auto2FA/releases) page
2. Install the macOS app
3. Open Safari Preferences
4. Enable the Auto2FA extension
5. Configure your accounts in the macOS app

## Supported Sites

Auto2FA is designed to work with any website that uses standard login forms. It includes special handling for:

- Microsoft accounts (Office 365, Azure, etc.)
- Google accounts
- GitHub
- And many more...

## Security

- Credentials are stored securely in the macOS Keychain
- Sensitive data is cleared from memory after use
- No data is sent to external servers
- All processing happens locally on your device

## Development

### Prerequisites

- macOS 12.0 or later
- Xcode 14.0 or later
- Safari 16.0 or later

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/Auto2FA.git
   cd Auto2FA
   ```

2. Open the project in Xcode:
   ```bash
   open Auto2FA.xcodeproj
   ```

3. Build and run the project

### Project Structure

```
Auto2FA/
├── Auto2FA/              # macOS App
│   ├── Views/            # SwiftUI Views
│   ├── Models/           # Data Models
│   └── Services/         # Business Logic
├── Auto2FAExtension/     # Safari Extension
│   ├── content.js        # Content Script
│   ├── background.js     # Background Script
│   └── popup/            # Extension Popup
└── Shared/               # Shared Resources
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [otpauth](https://github.com/yeojz/otpauth) for TOTP implementation
- [Safari App Extensions](https://developer.apple.com/documentation/safariservices/safari_app_extensions) documentation
- All contributors and users of Auto2FA

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/yourusername/Auto2FA/issues). 