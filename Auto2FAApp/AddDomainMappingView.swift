import SwiftUI

struct AddDomainMappingView: View {
    @State private var domain: String = ""
    @State private var errorMessage: String? = nil

    var body: some View {
        VStack {
            Text("Add Domain/Pattern Mapping")
                .font(.title2)

            TextField("Domain or Pattern (e.g., outlook.com, *.microsoft.com)", text: $domain)
                .disableAutocorrection(true)
                .textInputAutocapitalization(.never)
                .onChange(of: domain) { newValue in
                    // Basic validation feedback (can be improved)
                    if !newValue.isEmpty && !isValidDomainPattern(newValue) {
                        errorMessage = "Enter a valid domain or pattern (use * for wildcards)"
                    } else {
                        errorMessage = nil
                    }
                }

            // ... Picker code ...
        }
    }

    func isValidDomainPattern(_ pattern: String) -> Bool {
        // Basic check: allow letters, numbers, hyphens, dots, and asterisks.
        // More robust validation might be needed depending on complexity.
        // Avoid things like consecutive dots/asterisks, starting/ending with hyphen/asterisk etc.
        let allowedChars = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-*")
        if pattern.rangeOfCharacter(from: allowedChars.inverted) != nil {
            return false // Contains disallowed characters
        }
        // Basic structural checks (can be expanded)
        if pattern.contains("**") || pattern.contains("..") || pattern.first == "." || pattern.last == "." || pattern.first == "-" || pattern.last == "-" {
            return false
        }
        // Ensure wildcard is only used as *. (simplistic check)
        if pattern.contains("*") && !pattern.contains("*.") {
            // This is too simple, allows * alone. Refine if needed.
            // A better check might use regex on the pattern itself.
        }
        return !pattern.isEmpty
    }

    // ... saveMapping function ...
}

struct AddDomainMappingView_Previews: PreviewProvider {
    static var previews: some View {
        AddDomainMappingView()
    }
} 