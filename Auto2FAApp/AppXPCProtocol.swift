import Foundation

// Define the protocol for the XPC service hosted by the main app.
// This protocol MUST be @objc for XPC compatibility.
@objc(AppXPCProtocol) protocol AppXPCProtocol {

    // Method for the Safari extension to request credentials for a specific account ID.
    // The main app (XPC Service) will handle authentication (Touch ID/Passcode) before providing the data.
    // Sends back: username, password, authMethodRawValue, methodDetails, errorString?
    // Use optional String for error message transmission over XPC.
    func getCredentials(forAccountID accountID: UUID, completionHandler: @escaping (String?, String?, String?, String?, String?) -> Void)

    // Method for the Safari extension to request ALL current domain mappings.
    // Returns Data? (encoded [DomainMapping]) and errorString?
    func getAllMappings(completionHandler: @escaping (Data?, String?) -> Void)
}

// Define keys for XPC service configuration (used in Info.plist and potentially elsewhere)
enum XPCServiceKeys {
    // This name MUST match the value set for NSXPCListenerServiceName in Info.plist
    static let serviceName = "com.auchdev.Auto2FA.XPCHelper"
    // Placeholder for the expected Bundle ID of the Safari Extension client
    // IMPORTANT: Replace this with the actual Bundle ID of your Safari Extension target
    static let allowedClientBundleID = "com.auchdev.Auto2FA.Extension"
} 