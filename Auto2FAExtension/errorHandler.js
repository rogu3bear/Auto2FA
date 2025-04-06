// Error types and handling utilities for the Safari extension

// Error types that match the macOS app
const ErrorTypes = {
    AUTHENTICATION_FAILED: 'authentication_failed',
    ITEM_NOT_FOUND: 'item_not_found',
    NO_MAPPING_FOUND: 'no_mapping_found',
    MULTIPLE_MAPPINGS_FOUND: 'multiple_mappings_found',
    CONNECTION_LOST: 'connection_lost',
    UNHANDLED_ERROR: 'unhandled_error'
};

// Error messages for different scenarios
const ErrorMessages = {
    [ErrorTypes.AUTHENTICATION_FAILED]: 'Touch ID/Passcode authentication failed. Please try again.',
    [ErrorTypes.ITEM_NOT_FOUND]: 'No credentials found for this account. Please add them in the app.',
    [ErrorTypes.NO_MAPPING_FOUND]: 'No account mapping found for this domain. Please add a mapping in the app.',
    [ErrorTypes.MULTIPLE_MAPPINGS_FOUND]: 'Multiple accounts match this domain. Please select one manually.',
    [ErrorTypes.CONNECTION_LOST]: 'Connection to Auto2FA app lost. Please ensure the app is running.',
    [ErrorTypes.UNHANDLED_ERROR]: 'An unexpected error occurred. Please try again.'
};

// Update the extension icon to show error state
async function updateExtensionIcon(errorType) {
    const iconPath = errorType ? 'icons/icon-error.png' : 'icons/icon-48.png';
    try {
        await browser.action.setIcon({ path: iconPath });
    } catch (error) {
        console.error('Failed to update extension icon:', error);
    }
}

// Show error in popup
function showErrorInPopup(errorType, customMessage = null) {
    const message = customMessage || ErrorMessages[errorType] || ErrorMessages[ErrorTypes.UNHANDLED_ERROR];
    
    // Store error state for popup to display
    browser.storage.local.set({
        errorState: {
            type: errorType,
            message: message,
            timestamp: Date.now()
        }
    }).catch(error => {
        console.error('Failed to store error state:', error);
    });
    
    // Update icon to error state
    updateExtensionIcon(true);
    
    // Clear error state after 30 seconds
    setTimeout(() => {
        browser.storage.local.remove('errorState')
            .then(() => updateExtensionIcon(false))
            .catch(error => console.error('Failed to clear error state:', error));
    }, 30000);
}

// Parse error from native app response
function parseNativeError(errorString) {
    if (!errorString) return null;
    
    // Map common error strings to error types
    if (errorString.includes('authentication failed')) {
        return ErrorTypes.AUTHENTICATION_FAILED;
    }
    if (errorString.includes('No credentials found')) {
        return ErrorTypes.ITEM_NOT_FOUND;
    }
    if (errorString.includes('No account mapping found')) {
        return ErrorTypes.NO_MAPPING_FOUND;
    }
    if (errorString.includes('Multiple accounts match')) {
        return ErrorTypes.MULTIPLE_MAPPINGS_FOUND;
    }
    if (errorString.includes('Connection to Safari extension was lost')) {
        return ErrorTypes.CONNECTION_LOST;
    }
    
    return ErrorTypes.UNHANDLED_ERROR;
}

// Export utilities
export {
    ErrorTypes,
    ErrorMessages,
    updateExtensionIcon,
    showErrorInPopup,
    parseNativeError
}; 