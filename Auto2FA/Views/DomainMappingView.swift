import SwiftUI

struct DomainMappingView: View {
    @StateObject private var viewModel = DomainMappingViewModel()
    @State private var showingAddSheet = false
    @State private var editingMapping: DomainMapping?
    
    var body: some View {
        VStack {
            List {
                ForEach(viewModel.mappings) { mapping in
                    DomainMappingRow(mapping: mapping)
                        .contextMenu {
                            Button("Edit") {
                                editingMapping = mapping
                            }
                            Button("Delete", role: .destructive) {
                                viewModel.deleteMapping(mapping)
                            }
                        }
                }
            }
            .listStyle(.inset)
            
            HStack {
                Button("Add Mapping") {
                    showingAddSheet = true
                }
                .buttonStyle(.borderedProminent)
                
                Spacer()
                
                Text("\(viewModel.mappings.count) mappings")
                    .foregroundColor(.secondary)
            }
            .padding()
        }
        .frame(minWidth: 500, minHeight: 300)
        .sheet(isPresented: $showingAddSheet) {
            DomainMappingFormView(mapping: nil) { mapping in
                viewModel.addMapping(mapping)
            }
        }
        .sheet(item: $editingMapping) { mapping in
            DomainMappingFormView(mapping: mapping) { updatedMapping in
                viewModel.updateMapping(updatedMapping)
            }
        }
        .onAppear {
            viewModel.loadMappings()
        }
    }
}

struct DomainMappingRow: View {
    let mapping: DomainMapping
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(mapping.domain)
                    .font(.headline)
                Text(mapping.accountName)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct DomainMappingFormView: View {
    let mapping: DomainMapping?
    let onSave: (DomainMapping) -> Void
    
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = DomainMappingFormViewModel()
    @State private var domain = ""
    @State private var selectedAccountId: String?
    
    var body: some View {
        NavigationView {
            Form {
                Section("Domain Pattern") {
                    TextField("e.g., *.example.com", text: $domain)
                        .textFieldStyle(.roundedBorder)
                }
                
                Section("Account") {
                    Picker("Select Account", selection: $selectedAccountId) {
                        ForEach(viewModel.accounts) { account in
                            Text(account.name)
                                .tag(Optional(account.id))
                        }
                    }
                }
            }
            .formStyle(.grouped)
            .padding()
            .frame(minWidth: 400, minHeight: 200)
            .navigationTitle(mapping == nil ? "Add Mapping" : "Edit Mapping")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if let accountId = selectedAccountId,
                           let account = viewModel.accounts.first(where: { $0.id == accountId }) {
                            let newMapping = DomainMapping(
                                id: mapping?.id ?? UUID().uuidString,
                                domain: domain,
                                accountId: accountId,
                                accountName: account.name
                            )
                            onSave(newMapping)
                            dismiss()
                        }
                    }
                    .disabled(domain.isEmpty || selectedAccountId == nil)
                }
            }
        }
        .onAppear {
            if let mapping = mapping {
                domain = mapping.domain
                selectedAccountId = mapping.accountId
            }
            viewModel.loadAccounts()
        }
    }
}

// View Models
class DomainMappingViewModel: ObservableObject {
    @Published var mappings: [DomainMapping] = []
    private let dataManager = SharedDataManager.shared
    
    func loadMappings() {
        mappings = dataManager.getAllMappings()
    }
    
    func addMapping(_ mapping: DomainMapping) {
        dataManager.addMapping(mapping)
        loadMappings()
    }
    
    func updateMapping(_ mapping: DomainMapping) {
        dataManager.updateMapping(mapping)
        loadMappings()
    }
    
    func deleteMapping(_ mapping: DomainMapping) {
        dataManager.deleteMapping(mapping)
        loadMappings()
    }
}

class DomainMappingFormViewModel: ObservableObject {
    @Published var accounts: [Account] = []
    private let dataManager = SharedDataManager.shared
    
    func loadAccounts() {
        accounts = dataManager.getAllAccounts()
    }
}

// Models
struct DomainMapping: Identifiable {
    let id: String
    let domain: String
    let accountId: String
    let accountName: String
}

struct Account: Identifiable {
    let id: String
    let name: String
}

#Preview {
    DomainMappingView()
} 