console.log("Auto2FA Content Script Loaded");

import { ErrorTypes, showErrorInPopup } from './errorHandler.js';

// Constants
const SUBMISSION_DELAY = 500; // ms
const OTP_REFRESH_INTERVAL = 30000; // 30 seconds
const MAX_RETRIES = 1;
const RETRY_DELAY = 1000; // 1 second

// Microsoft-specific selectors with fallbacks
const MICROSOFT_SELECTORS = {
    username: [
        '#i0116',
        'input[name="loginfmt"]',
        'input[type="email"]',
        'input[autocomplete="username"]',
        'input[id*="user"]',
        'input[id*="email"]'
    ],
    password: [
        '#i0118',
        'input[name="passwd"]',
        'input[type="password"]',
        'input[autocomplete="current-password"]',
        'input[id*="pass"]'
    ],
    otp: [
        '#i0119',
        'input[name="otc"]',
        'input[type="tel"]',
        'input[name="otp"]',
        'input[type="text"]',
        'input[autocomplete="one-time-code"]',
        'input[id*="otp"]',
        'input[id*="code"]',
        'input[id*="2fa"]'
    ],
    submit: [
        '#idSIButton9',
        'input[type="submit"]',
        'button[type="submit"]',
        'button:contains("Sign in")',
        'button:contains("Next")',
        'button:contains("Continue")'
    ]
};

// Common selectors for other sites
const COMMON_SELECTORS = {
    username: [
        'input[type="email"]',
        'input[name="username"]',
        'input[id*="user"]',
        'input[id*="email"]',
        'input[autocomplete="username"]'
    ],
    password: [
        'input[type="password"]',
        'input[name="password"]',
        'input[id*="pass"]',
        'input[autocomplete="current-password"]'
    ],
    otp: [
        'input[type="tel"]',
        'input[name="otp"]',
        'input[id*="otp"]',
        'input[id*="code"]',
        'input[id*="2fa"]',
        'input[type="text"]',
        'input[autocomplete="one-time-code"]'
    ],
    submit: [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Sign in")',
        'button:contains("Login")',
        'button:contains("Continue")',
        'button:contains("Next")'
    ]
};

// State
let isProcessingLogin = false;
let currentAccountMapping = null;
let otpRefreshInterval = null;
let retryCount = 0;
let sensitiveData = null; // Store sensitive data temporarily

// Helper function to find element by multiple selectors
function findElement(selectors, context = document) {
    for (const selector of selectors) {
        const element = context.querySelector(selector);
        if (element) {
            console.log(`Found element with selector: ${selector}`);
            return element;
        }
    }
    console.log(`No element found for selectors: ${selectors.join(', ')}`);
    return null;
}

// Helper function to fill input field
function fillInput(input, value) {
    if (!input) return false;
    
    try {
        // Create and dispatch input event
        const inputEvent = new Event('input', { bubbles: true });
        input.value = value;
        input.dispatchEvent(inputEvent);
        
        // Create and dispatch change event
        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);
        
        console.log(`Successfully filled input: ${input.id || input.name || 'unnamed'}`);
        return true;
    } catch (error) {
        console.error('Error filling input:', error);
        return false;
    }
}

// Helper function to click element
function clickElement(element) {
    if (!element) return false;
    
    try {
        // Create and dispatch mouse events
        const mouseDown = new MouseEvent('mousedown', { bubbles: true });
        const mouseUp = new MouseEvent('mouseup', { bubbles: true });
        const click = new MouseEvent('click', { bubbles: true });
        
        element.dispatchEvent(mouseDown);
        element.dispatchEvent(mouseUp);
        element.dispatchEvent(click);
        
        console.log(`Successfully clicked element: ${element.id || element.name || 'unnamed'}`);
        return true;
    } catch (error) {
        console.error('Error clicking element:', error);
        return false;
    }
}

// Helper function to generate OTP code
function generateOTP(secret) {
    if (!secret) {
        console.error('No OTP secret provided');
        showErrorInPopup(ErrorTypes.AUTHENTICATION_FAILED, 'OTP secret is missing');
        return null;
    }
    
    try {
        const code = otpauth.totp({
            secret: secret,
            algorithm: 'SHA1',
            digits: 6,
            period: 30
        });
        console.log('Generated OTP code successfully');
        return code;
    } catch (error) {
        console.error('Error generating OTP:', error);
        showErrorInPopup(ErrorTypes.AUTHENTICATION_FAILED, 'Failed to generate OTP code');
        return null;
    }
}

// Helper function to fill OTP field
function fillOTPField(secret) {
    const code = generateOTP(secret);
    if (!code) return false;
    
    // Try Microsoft-specific OTP field first
    let otpField = findElement(MICROSOFT_SELECTORS.otp);
    if (!otpField) {
        // Try common OTP field selectors
        otpField = findElement(COMMON_SELECTORS.otp);
    }
    
    if (!otpField) {
        console.log('No OTP field found, attempting to find by position');
        // Try to find OTP field by position (usually after password field)
        const passwordField = findElement([...MICROSOFT_SELECTORS.password, ...COMMON_SELECTORS.password]);
        if (passwordField) {
            const nextInput = passwordField.parentElement.querySelector('input:not([type="password"])');
            if (nextInput) {
                otpField = nextInput;
                console.log('Found OTP field by position');
            }
        }
    }
    
    if (otpField) {
        const success = fillInput(otpField, code);
        if (success) {
            console.log('Successfully filled OTP field');
            return true;
        }
    }
    
    console.error('Failed to fill OTP field');
    return false;
}

// Helper function to find and click submit button
function findAndClickSubmitButton() {
    // Try Microsoft-specific submit button first
    let submitButton = findElement(MICROSOFT_SELECTORS.submit);
    if (!submitButton) {
        // Try common submit button selectors
        submitButton = findElement(COMMON_SELECTORS.submit);
    }
    
    if (submitButton) {
        const success = clickElement(submitButton);
        if (success) {
            console.log('Successfully clicked submit button');
            return true;
        }
    }
    
    console.error('Failed to find or click submit button');
    return false;
}

// Helper function to show manual 2FA notification
function showManual2FANotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #007AFF;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    const icon = document.createElement('span');
    icon.innerHTML = '🔐';
    icon.style.fontSize = '16px';
    
    const message = document.createElement('span');
    message.textContent = 'Please complete the 2FA step manually';
    
    const dismissButton = document.createElement('button');
    dismissButton.textContent = '×';
    dismissButton.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0 4px;
        margin-left: 8px;
    `;
    
    notification.appendChild(icon);
    notification.appendChild(message);
    notification.appendChild(dismissButton);
    
    dismissButton.addEventListener('click', () => {
        notification.remove();
    });
    
    document.body.appendChild(notification);
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        notification.remove();
    }, 10000);
}

// Helper function to clear sensitive data
function clearSensitiveData() {
    if (sensitiveData) {
        sensitiveData = null;
        console.log('Cleared sensitive data from memory');
    }
}

// Main login flow handler
async function handleLogin(accountMapping) {
    if (isProcessingLogin) {
        console.log('Login already in progress, skipping');
        return;
    }
    
    isProcessingLogin = true;
    currentAccountMapping = accountMapping;
    
    try {
        console.log('Starting login process for account:', accountMapping.username);
        
        // Store sensitive data temporarily
        sensitiveData = {
            username: accountMapping.username,
            password: accountMapping.password,
            otpSecret: accountMapping.otpSecret
        };
        
        // Find username field (try Microsoft-specific first, then common)
        let usernameField = findElement(MICROSOFT_SELECTORS.username);
        if (!usernameField) {
            usernameField = findElement(COMMON_SELECTORS.username);
        }
        
        if (!usernameField) {
            throw new Error('Username field not found');
        }
        
        // Find password field (try Microsoft-specific first, then common)
        let passwordField = findElement(MICROSOFT_SELECTORS.password);
        if (!passwordField) {
            passwordField = findElement(COMMON_SELECTORS.password);
        }
        
        if (!passwordField) {
            throw new Error('Password field not found');
        }
        
        // Fill username and password
        console.log('Filling credentials...');
        if (!fillInput(usernameField, sensitiveData.username) || 
            !fillInput(passwordField, sensitiveData.password)) {
            throw new Error('Failed to fill credentials');
        }
        
        // Submit initial form
        console.log('Submitting initial form...');
        if (!findAndClickSubmitButton()) {
            throw new Error('Failed to submit initial form');
        }
        
        // Wait for form submission
        await new Promise(resolve => setTimeout(resolve, SUBMISSION_DELAY));
        
        // Handle 2FA based on method
        if (accountMapping.authMethod === 'otp') {
            console.log('Handling OTP authentication...');
            if (!sensitiveData.otpSecret) {
                throw new Error('OTP secret is missing');
            }
            
            if (!fillOTPField(sensitiveData.otpSecret)) {
                throw new Error('Failed to fill OTP field');
            }
            
            // Start OTP refresh interval
            if (otpRefreshInterval) {
                clearInterval(otpRefreshInterval);
            }
            otpRefreshInterval = setInterval(() => {
                fillOTPField(sensitiveData.otpSecret);
            }, OTP_REFRESH_INTERVAL);
            
            // Submit OTP form if auto-submit is enabled
            const data = await browser.storage.sync.get('autoSubmitEnabled');
            if (data.autoSubmitEnabled) {
                console.log('Auto-submit enabled, submitting OTP form...');
                if (!findAndClickSubmitButton()) {
                    throw new Error('Failed to submit OTP form');
                }
            }
        } else {
            console.log('Showing manual 2FA notification...');
            showManual2FANotification();
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showErrorInPopup(ErrorTypes.AUTHENTICATION_FAILED, error.message);
        
        // Retry on XPC connection timeout
        if (error.message.includes('XPC') && retryCount < MAX_RETRIES) {
            console.log(`Retrying login after ${RETRY_DELAY}ms...`);
            retryCount++;
            setTimeout(() => {
                isProcessingLogin = false;
                handleLogin(accountMapping);
            }, RETRY_DELAY);
            return;
        }
    } finally {
        if (retryCount >= MAX_RETRIES) {
            isProcessingLogin = false;
            retryCount = 0;
            clearSensitiveData(); // Clear sensitive data after use
        }
    }
}

// Initialize content script
async function initialize() {
    try {
        console.log('Initializing content script...');
        
        // Get current domain
        const domain = window.location.hostname;
        console.log('Current domain:', domain);
        
        // Request account mapping from background script
        const response = await browser.runtime.sendMessage({
            command: 'getAccountMapping',
            domain: domain
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        if (response.mapping) {
            console.log('Found account mapping:', response.mapping.username);
            await handleLogin(response.mapping);
        } else {
            console.log('No account mapping found for domain:', domain);
        }
        
    } catch (error) {
        console.error('Initialization error:', error);
        showErrorInPopup(ErrorTypes.UNHANDLED_ERROR, error.message);
    } finally {
        clearSensitiveData(); // Ensure sensitive data is cleared
    }
}

// Start the content script
initialize(); 