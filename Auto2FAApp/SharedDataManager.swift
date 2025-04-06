import Foundation

class SharedDataManager {
    static let shared = SharedDataManager()
    private let defaults: UserDefaults

    // IMPORTANT: Use the SAME App Group ID enabled in Signing & Capabilities
    private let appGroupID = "group.com.auchdev.Auto2FA"
    private let domainMappingsKey = "domainMappings_v1" // Added version suffix for potential future migrations

    // Cache for compiled regex patterns to improve performance
    private var regexCache: [String: NSRegularExpression] = [:]

    private init() {
        guard let userDefaults = UserDefaults(suiteName: appGroupID) else {
            // This is a fatal error because the app/extension cannot function without shared defaults.
            // Ensure the App Group ID is correct and enabled for BOTH the app and extension targets.
            fatalError("Could not initialize UserDefaults with suite name: \(appGroupID). \n" +
                       "Verify the App Group identifier is correct and enabled in Signing & Capabilities for all targets.")
        }
        self.defaults = userDefaults
        print("SharedDataManager initialized with App Group: \(appGroupID)")
        // Pre-warm the regex cache on init?
        // loadAndCacheRegexPatterns()
    }

    /// Converts a wildcard pattern (using *) into a valid Regex string.
    /// Handles basic wildcards and escapes regex metacharacters.
    private func convertWildcardToRegex(pattern: String) -> String? {
        // 1. Escape existing regex metacharacters in the pattern
        let escapedPattern = NSRegularExpression.escapedPattern(for: pattern)
        
        // 2. Replace the wildcard '*' with '.*' (match zero or more characters)
        let regexString = escapedPattern.replacingOccurrences(of: "\\*", with: ".*") // Note: * needs double escaping
        
        // 3. Anchor the pattern to match the whole domain
        return "^" + regexString + "$"
    }

    /// Compiles and caches NSRegularExpression for a given pattern.
    private func regex(for pattern: String) -> NSRegularExpression? {
        if let cachedRegex = regexCache[pattern] {
            return cachedRegex
        }
        
        guard let regexString = convertWildcardToRegex(pattern: pattern) else {
            print("Error: Could not convert pattern '\(pattern)' to regex string.")
            return nil
        }
        
        do {
            // Case-insensitive matching is crucial for domains
            let regex = try NSRegularExpression(pattern: regexString, options: .caseInsensitive)
            regexCache[pattern] = regex // Store in cache
            return regex
        } catch {
            print("Error creating NSRegularExpression for pattern '\(pattern)' (Regex: '\(regexString)'): \(error)")
            return nil
        }
    }
    
    // Pre-load and cache regex patterns when mappings are loaded/saved (optional performance boost)
    // private func loadAndCacheRegexPatterns() {
    //     let mappings = loadDomainMappings()
    //     regexCache.removeAll()
    //     for mapping in mappings {
    //         _ = regex(for: mapping.domain) // Compile and cache
    //     }
    //     print("\(regexCache.count) regex patterns pre-cached.")
    // }

    /// Saves the complete list of domain mappings to shared UserDefaults.
    func saveDomainMappings(_ mappings: [DomainMapping]) {
        do {
            let encoder = JSONEncoder()
            // Optional: Use pretty printing for easier debugging if needed
            // encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(mappings)
            defaults.set(data, forKey: domainMappingsKey)
            print("Saved \(mappings.count) domain mappings to shared UserDefaults (Key: \(domainMappingsKey)).")
            // Clear and potentially rebuild the regex cache after saving
            regexCache.removeAll()
            // loadAndCacheRegexPatterns() // Optionally rebuild immediately
        } catch {
            // Log error, maybe notify user in a non-fatal way?
            print("Error saving domain mappings to shared UserDefaults: \(error.localizedDescription)")
        }
    }

    /// Loads the list of domain mappings from shared UserDefaults.
    func loadDomainMappings() -> [DomainMapping] {
        guard let data = defaults.data(forKey: domainMappingsKey) else {
            print("No domain mappings data found in shared UserDefaults (Key: \(domainMappingsKey)). Returning empty list.")
            return []
        }
        do {
            let mappings = try JSONDecoder().decode([DomainMapping].self, from: data)
            print("Loaded \(mappings.count) domain mappings from shared UserDefaults (Key: \(domainMappingsKey)).")
            return mappings
        } catch {
            print("Error loading/decoding domain mappings from shared UserDefaults (Key: \(domainMappingsKey)): \(error.localizedDescription)")
            // Data might be corrupted. Consider deleting it to prevent repeated errors.
            // defaults.removeObject(forKey: domainMappingsKey)
            // print("Removed potentially corrupted data for key \(domainMappingsKey).")
            return [] // Return empty list on error
        }
    }
    
    /// Retrieves all DomainMapping objects whose patterns match the given domain.
    /// Uses case-insensitive regex matching with wildcard support (*).
    func getMatchingAccountMappings(forDomain domain: String) -> [DomainMapping] {
        let mappings = loadDomainMappings() // Load current mappings
        let targetDomain = domain.lowercased() // Ensure target is lowercase
        var matchingMappings: [DomainMapping] = []

        print("Searching for mappings matching domain: '\(targetDomain)'")

        for mapping in mappings {
            guard let regex = regex(for: mapping.domain) else {
                print("Skipping invalid pattern: \(mapping.domain)")
                continue // Skip if regex couldn't be created
            }

            let range = NSRange(location: 0, length: targetDomain.utf16.count)
            if regex.firstMatch(in: targetDomain, options: [], range: range) != nil {
                print("  Match found: Pattern '\(mapping.domain)' -> Account '\(mapping.accountName)'")
                matchingMappings.append(mapping)
            }
        }
        
        print("Found \(matchingMappings.count) matching mappings for domain '\(targetDomain)'.")
        // TODO: Add sorting logic here if needed (e.g., more specific patterns first)
        // Example: Sort by length of pattern descending (longer patterns are often more specific)
        // matchingMappings.sort { $0.domain.count > $1.domain.count }
        
        return matchingMappings
    }

    /// Retrieves the Account ID associated with a given domain, if a mapping exists.
    /// Performs a case-insensitive lookup.
    func getAccountId(forDomain domain: String) -> UUID? {
        let matchingMappings = getMatchingAccountMappings(forDomain: domain)
        if matchingMappings.count == 1 {
            print("Exactly one match found for domain '\(domain)'. Returning ID: \(matchingMappings[0].accountId)")
            return matchingMappings[0].accountId
        } else {
            print("Found \(matchingMappings.count) matches for domain '\(domain)'. Cannot return single ID.")
            return nil // Return nil if zero or multiple matches
        }
    }
} 