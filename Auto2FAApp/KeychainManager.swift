import Foundation
import Security
import LocalAuthentication

// NOTE: Ensure this App Group ID is enabled in Signing & Capabilities
let APP_GROUP_ID = "group.com.auchdev.Auto2FA"
let KEYCHAIN_SERVICE_NAME = "com.auchdev.Auto2FA.Credentials" // Unique service name for this app's credentials

enum KeychainError: Error, LocalizedError {
    case duplicateItem(OSStatus)
    case itemNotFound(OSStatus)
    case interactionNotAllowed(OSStatus)
    case invalidData
    case authFailed(Error?)
    case accessControlError(Error)
    case unexpectedStatus(OSStatus)

    var errorDescription: String? {
        switch self {
        case .duplicateItem(let status): return "Keychain item already exists (OSStatus: \(status))"
        case .itemNotFound(let status): return "Keychain item not found (OSStatus: \(status))"
        case .interactionNotAllowed(let status): return "Keychain interaction not allowed (OSStatus: \(status))"
        case .invalidData: return "Invalid data format found in or provided for keychain."
        case .authFailed(let underlyingError): return "Authentication failed: \(underlyingError?.localizedDescription ?? "User cancelled or policy not met")"
        case .accessControlError(let error): return "Failed to create access control: \(error.localizedDescription)"
        case .unexpectedStatus(let status):
            let message = SecCopyErrorMessageString(status, nil)
            return "Unexpected Keychain error (OSStatus: \(status)) - \(message as String? ?? "Unknown Error")"
        }
    }
}

// Structure to hold all data stored in a single Keychain item
struct KeychainCredentials: Codable {
    let username: String
    let password: String // This is the sensitive data
    let authMethodRawValue: String
    let methodDetails: String? // e.g., OTP Secret (also sensitive)
}

class KeychainManager {

    static let shared = KeychainManager()
    private let context = LAContext() // Reusable LAContext for authentication prompts

    private init() {}

    // --- Core Keychain Operations ---

    private func createAccessControl() throws -> SecAccessControl {
        var error: Unmanaged<CFError>?
        // kSecAccessControlUserPresence requires Touch ID/Passcode for EACH access.
        // kSecAttrAccessibleWhenUnlockedThisDeviceOnly ensures the item is only accessible
        // when the device is unlocked and cannot be migrated to another device backup.
        guard let accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .userPresence, // Require biometric/passcode authentication for access
            &error
        ) else {
            throw KeychainError.accessControlError(error!.takeRetainedValue() as Error)
        }
        return accessControl
    }

    private func baseQuery(accountId: UUID) -> [String: Any] {
        // Base dictionary for keychain operations targeting a specific account
        return [
            kSecClass as String: kSecClassGenericPassword, // Store as generic password item
            kSecAttrService as String: KEYCHAIN_SERVICE_NAME, // Distinguish our app's items
            kSecAttrAccount as String: accountId.uuidString, // Use account UUID as the unique key
            // Use kSecAttrAccessGroup for sharing keychain items via an App Group
             kSecAttrAccessGroup as String: APP_GROUP_ID
        ]
    }

    // --- Public API ---

    /// Saves or updates credentials in the Keychain for a given account.
    /// Requires user authentication (Touch ID/Passcode) if item access control demands it.
    func saveCredentials(account: Account, password: String, methodDetails: String?) throws {
        guard !password.isEmpty else {
            print("Password cannot be empty.")
            throw KeychainError.invalidData // Prevent saving empty passwords
        }

        let accessControl = try createAccessControl()
        let accountId = account.id

        // Encode all necessary credential parts into a single Data object
        let credentialsData: Data
        do {
            let credentials = KeychainCredentials(
                username: account.username, // Store username alongside for potential future use/consistency
                password: password,
                authMethodRawValue: account.authMethod.rawValue,
                methodDetails: methodDetails
            )
            credentialsData = try JSONEncoder().encode(credentials)
        } catch {
             print("Failed to encode credentials: \(error)")
            throw KeychainError.invalidData
        }

        // Prepare the query to add/update the item
        var query = baseQuery(accountId: accountId)
        query[kSecValueData as String] = credentialsData
        query[kSecAttrAccessControl as String] = accessControl
        query[kSecAttrSynchronizable as String] = kCFBooleanFalse // Explicitly disable iCloud Keychain sync for this item

        // Try to update existing item first. This ensures access control is applied correctly.
        let updateStatus = SecItemUpdate(query as CFDictionary, [kSecValueData as String: credentialsData] as CFDictionary)

        if updateStatus == errSecSuccess {
            print("Credentials updated successfully in Keychain for \(accountId.uuidString)")
        } else if updateStatus == errSecItemNotFound {
            // Item doesn't exist, so add it.
            print("Item not found for update, adding new item for \(accountId.uuidString).")
            let addStatus = SecItemAdd(query as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                 print("Failed to add new keychain item for \(accountId.uuidString): Status \(addStatus)")
                throw KeychainError.unexpectedStatus(addStatus)
            }
            print("Credentials added successfully to Keychain for \(accountId.uuidString)")
        } else {
            // Another error occurred during update
            print("Failed to update keychain item for \(accountId.uuidString): Status \(updateStatus)")
            throw KeychainError.unexpectedStatus(updateStatus)
        }
    }

    /// Retrieves credentials from the Keychain for a given account ID.
    /// This operation WILL trigger a user authentication prompt (Touch ID/Passcode).
    func getCredentials(accountId: UUID) throws -> KeychainCredentials {
        var query = baseQuery(accountId: accountId)
        query[kSecMatchLimit as String] = kSecMatchLimitOne // Expect only one item
        query[kSecReturnData as String] = kCFBooleanTrue    // Request the data back

        // Provide context for the authentication prompt
        context.localizedReason = "Accessing credentials for Auto2FA"
        query[kSecUseAuthenticationContext as String] = context // Trigger auth using this context
        // query[kSecUseOperationPrompt as String] = "Unlock to autofill credentials" // Optional: Customize prompt further

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        switch status {
        case errSecSuccess:
            guard let data = item as? Data else {
                print("Keychain returned success but data was invalid for \(accountId.uuidString)")
                throw KeychainError.invalidData
            }
            do {
                let credentials = try JSONDecoder().decode(KeychainCredentials.self, from: data)
                print("Credentials retrieved successfully from Keychain for \(accountId.uuidString)")
                return credentials
            } catch {
                 print("Failed to decode credentials from Keychain for \(accountId.uuidString): \(error)")
                throw KeychainError.invalidData
            }
        case errSecItemNotFound:
            print("Credentials not found in Keychain for \(accountId.uuidString)")
            throw KeychainError.itemNotFound(status)
        case errSecUserCanceled, errSecAuthFailed:
             print("Authentication failed or cancelled by user for \(accountId.uuidString)")
            throw KeychainError.authFailed(nil) // Use the specific error status if needed
         case errSecInteractionNotAllowed:
             print("Keychain interaction not allowed (e.g., device locked, background access denied) for \(accountId.uuidString)")
             throw KeychainError.interactionNotAllowed(status)
        default:
            print("Unexpected keychain error during retrieval for \(accountId.uuidString): Status \(status)")
            throw KeychainError.unexpectedStatus(status)
        }
    }

    /// Deletes credentials from the Keychain for a given account ID.
    func deleteCredentials(accountId: UUID) throws {
        let query = baseQuery(accountId: accountId)
        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
             print("Failed to delete keychain item for \(accountId.uuidString): Status \(status)")
            throw KeychainError.unexpectedStatus(status)
        }
         print("Keychain credentials deleted (or did not exist) for \(accountId.uuidString)")
    }

    /// Checks if credentials exist in the Keychain for a given account ID WITHOUT triggering authentication.
    /// Useful for UI indicators (e.g., showing a green checkmark if data is present).
     func credentialsExist(accountId: UUID) -> Bool {
         var query = baseQuery(accountId: accountId)
         query[kSecMatchLimit as String] = kSecMatchLimitOne
         query[kSecReturnAttributes as String] = kCFBooleanTrue // We only need to know if it exists, not the data
         // IMPORTANT: Do NOT include kSecUseAuthenticationContext here to avoid auth prompt

         var item: CFTypeRef?
         let status = SecItemCopyMatching(query as CFDictionary, &item)

         // errSecSuccess means an item matching the query was found.
         return status == errSecSuccess
     }
} 