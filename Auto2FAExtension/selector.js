document.addEventListener('DOMContentLoaded', async () => {
    const accountList = document.getElementById('accountList');
    const messageDiv = document.getElementById('message');

    // Get tabId and frameId from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tabId = parseInt(urlParams.get('tabId'));
    const frameId = parseInt(urlParams.get('frameId'));

    if (isNaN(tabId) || isNaN(frameId)) {
        messageDiv.textContent = 'Error: Missing required parameters.';
        console.error('Selector: Missing tabId or frameId in URL');
        return;
    }

    console.log(`Selector: Initialized for tab ${tabId}, frame ${frameId}`);

    // Retrieve the candidate accounts stored by the background script
    const storageKey = `selectorCandidates_${tabId}_${frameId}`;
    try {
        const data = await browser.storage.local.get(storageKey);
        const candidates = data[storageKey];

        if (candidates && candidates.length > 0) {
            messageDiv.textContent = ''; // Clear loading message
            candidates.forEach(account => {
                const listItem = document.createElement('li');
                const button = document.createElement('button');
                // Display account name (and optionally username if available)
                button.textContent = account.name;
                button.dataset.accountId = account.id; // Store account ID on the button

                button.addEventListener('click', () => {
                    console.log(`Selector: Account ${account.id} (${account.name}) clicked.`);
                    // Send selected account ID back to the background script
                    browser.runtime.sendMessage({
                        command: 'accountSelected',
                        selectedAccountId: account.id,
                        tabId: tabId,
                        frameId: frameId
                    }).then(() => {
                        console.log("Selector: message sent to background");
                        // Close the selector window after selection
                        window.close();
                    }).catch(error => {
                        console.error("Selector: Error sending message to background:", error);
                        messageDiv.textContent = 'Error communicating with extension.';
                    });
                });

                listItem.appendChild(button);
                accountList.appendChild(listItem);
            });
        } else {
            messageDiv.textContent = 'No accounts available for selection or error loading candidates.';
            console.warn('Selector: No candidate accounts found in storage key:', storageKey);
        }

        // Clean up the temporary storage
        // Do this slightly later to ensure the message has definitely been sent
        setTimeout(() => {
            browser.storage.local.remove(storageKey).then(() => {
                console.log("Selector: Cleaned up storage key:", storageKey);
            }).catch(err => {
                console.error("Selector: Error cleaning up storage key (storageKey):", err);
            });
        }, 500);

    } catch (error) {
        console.error('Selector: Error retrieving candidates from storage:', error);
        messageDiv.textContent = 'Error loading account list.';
    }
}); 