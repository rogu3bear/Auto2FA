import SwiftUI

struct ContentView: View {
    @StateObject private var appState = AppState()

    var body: some View {
        VStack {
            Section("Domain Mappings") {
                ForEach(appState.domainMappings) { mapping in
                    HStack {
                        Text(mapping.domain)
                            .font(.system(.body, design: .monospaced))
                        Spacer()
                        Image(systemName: "arrow.right")
                        Text(mapping.accountName)
                            .foregroundColor(.secondary)
                    }
                }
                .onDelete(perform: deleteMappings)
            }
        }
    }

    private func deleteMappings(at offsets: IndexSet) {
        appState.deleteMappings(at: offsets)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
} 