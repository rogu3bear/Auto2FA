// popup.js

import { ErrorTypes, showErrorInPopup } from './errorHandler.js';

// DOM Elements
const statusIcon = document.getElementById('statusIcon');
const statusText = document.getElementById('statusText');
const errorContainer = document.getElementById('errorContainer');
const errorText = document.getElementById('errorText');
const mappingCount = document.getElementById('mappingCount');
const autoSubmitToggle = document.getElementById('autoSubmitToggle');
const selectAccountButton = document.getElementById('selectAccountButton');

// State
let isConnected = false;
let currentTab = null;

// Initialize popup
async function initialize() {
    try {
        // Get current tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        currentTab = tabs[0];
        
        // Load auto-submit setting
        const data = await browser.storage.sync.get('autoSubmitEnabled');
        autoSubmitToggle.checked = data.autoSubmitEnabled === true;
        
        // Check connection status
        await checkConnection();
        
        // Update mapping count
        await updateMappingCount();
        
    } catch (error) {
        console.error('Error initializing popup:', error);
        showError(ErrorTypes.UNHANDLED_ERROR, 'Failed to initialize popup');
    }
}

// Check connection to native app
async function checkConnection() {
    try {
        const response = await browser.runtime.sendMessage({ command: 'checkConnection' });
        isConnected = response.connected;
        updateConnectionStatus();
    } catch (error) {
        console.error('Error checking connection:', error);
        isConnected = false;
        updateConnectionStatus();
    }
}

// Update connection status UI
function updateConnectionStatus() {
    if (isConnected) {
        statusIcon.classList.remove('disconnected');
        statusIcon.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        statusIcon.classList.remove('connected');
        statusIcon.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
    }
}

// Update mapping count
async function updateMappingCount() {
    try {
        const response = await browser.runtime.sendMessage({ command: 'getMappingCount' });
        mappingCount.textContent = `${response.count} mappings`;
    } catch (error) {
        console.error('Error getting mapping count:', error);
        mappingCount.textContent = 'Error loading mappings';
    }
}

// Show error message
function showError(type, message) {
    errorText.textContent = message;
    errorContainer.classList.add('visible');
    
    // Auto-hide error after 5 seconds
    setTimeout(() => {
        errorContainer.classList.remove('visible');
    }, 5000);
}

// Event Listeners
autoSubmitToggle.addEventListener('change', async () => {
    try {
        await browser.storage.sync.set({ autoSubmitEnabled: autoSubmitToggle.checked });
    } catch (error) {
        console.error('Error saving auto-submit setting:', error);
        showError(ErrorTypes.UNHANDLED_ERROR, 'Failed to save setting');
    }
});

selectAccountButton.addEventListener('click', async () => {
    if (!currentTab) return;
    
    try {
        // Request account selection from background script
        await browser.runtime.sendMessage({
            command: 'showAccountSelector',
            tabId: currentTab.id,
            frameId: 0 // Main frame
        });
        
        // Close popup
        window.close();
    } catch (error) {
        console.error('Error showing account selector:', error);
        showError(ErrorTypes.UNHANDLED_ERROR, 'Failed to show account selector');
    }
});

// Start the popup
initialize(); 