import Foundation
import Combine
import SwiftUI // Required for ObservableObject

// Represents the authentication method type
enum AuthenticationMethod: String, Codable, CaseIterable, Identifiable {
    case otp = "OTP"
    // Future: case sms = "SMS"
    // Future: case authenticatorApp = "Authenticator App"

    var id: String { self.rawValue }

    var requiresDetails: Bool {
        switch self {
        case .otp:
            return true // OTP needs a secret key
        // Add cases for future methods that require specific details
        default:
            return false
        }
    }

    var detailPrompt: String {
        switch self {
        case .otp:
            return "OTP Secret Key"
        // Add prompts for future methods
        default:
            return ""
        }
    }
}

// Represents a single user account (non-sensitive parts primarily for UI/lists)
struct Account: Identifiable, Codable, Hashable {
    var id = UUID() // Unique identifier for the account within the app AND keychain
    var accountName: String // User-defined name (e.g., "Personal", "Work Azure")
    var username: String
    var authMethod: AuthenticationMethod = .otp

    // IMPORTANT: Password and methodDetails are NOT stored here.
    // They are only held temporarily in editing views and stored securely in Keychain.
    // We use the `id` to link this struct to the keychain entry.
}

// Represents the mapping between a website domain and an account ID
struct DomainMapping: Identifiable, Codable, Hashable {
    var id = UUID()
    var domain: String // e.g., "outlook.com", "login.microsoftonline.com"
    var accountId: UUID // The ID of the associated Account
    var accountName: String // Store name for easier display in UI (denormalized)
}

// Observable Object to manage app state (accounts and mappings)
class AppState: ObservableObject {
    @Published var accounts: [Account] = []
    @Published var domainMappings: [DomainMapping] = []
    @Published var requiresAuthentication = false // To trigger Touch ID overlay

    // Key for UserDefaults persistence of non-sensitive account data
    private let accountsPersistenceKey = "AppAccountsList"

    init() {
        // Load data on initialization
        self.accounts = loadAccountsFromPersistence()
        self.domainMappings = SharedDataManager.shared.loadDomainMappings()
    }

    // --- Account Persistence (Non-Sensitive Data) ---

    func addAccount(_ account: Account) {
        accounts.append(account)
        saveAccountsToPersistence()
    }

    func deleteAccount(id: UUID) {
        // Find index first to ensure correct removal
        if let index = accounts.firstIndex(where: { $0.id == id }) {
            accounts.remove(at: index)
            saveAccountsToPersistence()
            // Also remove associated domain mappings
            domainMappings.removeAll { $0.accountId == id }
            SharedDataManager.shared.saveDomainMappings(domainMappings) // Save updated mappings
             // Attempt to delete keychain data (handle potential errors in caller or here)
             Task { // Run keychain delete asynchronously
                 do {
                     try KeychainManager.shared.deleteCredentials(accountId: id)
                     print("Keychain data deleted for account \(id)")
                 } catch {
                     print("Error deleting keychain item during account deletion for \(id): \(error)")
                     // Optionally notify user or log more formally
                 }
             }
        } else {
             print("Warning: Attempted to delete non-existent account with ID \(id)")
        }
    }
    
    func deleteAccounts(at offsets: IndexSet) {
        let idsToDelete = offsets.map { accounts[$0].id }
        for id in idsToDelete {
            deleteAccount(id: id) // Use the single delete method which handles keychain/mappings
        }
        // No need to save here, deleteAccount(id:) already saves
    }

    private func saveAccountsToPersistence() {
        do {
            let data = try JSONEncoder().encode(accounts)
            UserDefaults.standard.set(data, forKey: accountsPersistenceKey)
            print("Saved \(accounts.count) accounts (non-sensitive) to UserDefaults.")
        } catch {
            print("Error saving accounts to UserDefaults: \(error)")
        }
    }

    private func loadAccountsFromPersistence() -> [Account] {
        guard let data = UserDefaults.standard.data(forKey: accountsPersistenceKey) else {
            print("No accounts found in UserDefaults.")
            return []
        }
        do {
            let loadedAccounts = try JSONDecoder().decode([Account].self, from: data)
            print("Loaded \(loadedAccounts.count) accounts (non-sensitive) from UserDefaults.")
            return loadedAccounts
        } catch {
            print("Error loading accounts from UserDefaults: \(error)")
            // Handle corrupted data, maybe delete it?
            // UserDefaults.standard.removeObject(forKey: accountsPersistenceKey)
            return []
        }
    }

    // --- Domain Mapping Persistence (Handled by SharedDataManager) ---
    // Convenience methods to keep AppState as the single source of truth

    func addMapping(_ mapping: DomainMapping) {
        // Prevent duplicate domain mappings (optional, based on requirements)
         if domainMappings.contains(where: { $0.domain.lowercased() == mapping.domain.lowercased() }) {
             print("Attempted to add duplicate domain mapping for \(mapping.domain). Ignoring.")
             // Optionally throw an error or notify user
             return
         }
        domainMappings.append(mapping)
        SharedDataManager.shared.saveDomainMappings(domainMappings)
    }

    func deleteMapping(id: UUID) {
        domainMappings.removeAll { $0.id == id }
        SharedDataManager.shared.saveDomainMappings(domainMappings)
    }
    
    func deleteMappings(at offsets: IndexSet) {
        domainMappings.remove(atOffsets: offsets)
        SharedDataManager.shared.saveDomainMappings(domainMappings)
    }
} 