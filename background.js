// =======================
// BACKGROUND SERVICE WORKER
// =======================

console.log('🚀 TextGenius: Background service worker loaded');
const SUPPORTED_TRANSLATION_TARGETS = ['es', 'de', 'fr', 'it', 'ja']; // Spanish, German, French, Italian, Japanese
let creating; // A promise to prevent multiple creation attempts

// Function to create and manage the offscreen document
async function setupOffscreenDocument(path) {
    // Check if we have an existing document.
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // If a creation is in progress, wait for it to finish.
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['DOM_PARSER'], // Justification for the document
            justification: 'Required for AI text processing APIs',
        });
        await creating;
        creating = null;
    }
}

async function sendToOffscreen(data) {
    await setupOffscreenDocument('offscreen.html');
    const response = await chrome.runtime.sendMessage({
        target: 'offscreen',
        data: data
    });

    if (response && !response.success) {
        throw new Error(response.error || 'An unknown error occurred in the offscreen document.');
    }
    return response.result;
}


// Create context menus when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ TextGenius installed - Creating context menus');
  
  // Main parent menu
  chrome.contextMenus.create({
    id: 'textgenius-main',
    title: '✨ TextGenius ',
    contexts: ['selection']
  });

  // === READING FEATURES ===
  
  // 1. Summarize
  chrome.contextMenus.create({
    id: 'summarize',
    parentId: 'textgenius-main',
    title: '📝 Summarize This',
    contexts: ['selection']
  });

  // 2. Explain Like I'm 5
  chrome.contextMenus.create({
    id: 'eli5',
    parentId: 'textgenius-main',
    title: '🔍 Explain Like I\'m 5',
    contexts: ['selection']
  });

  // === WRITING FEATURES ===
  
  // 3. Rewrite - Parent
  chrome.contextMenus.create({
    id: 'rewrite-parent',
    parentId: 'textgenius-main',
    title: '✍️ Rewrite',
    contexts: ['selection']
  });

  // Rewrite submenu items
  chrome.contextMenus.create({
    id: 'rewrite-simpler',
    parentId: 'rewrite-parent',
    title: '📖 Make Simpler',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'rewrite-formal',
    parentId: 'rewrite-parent',
    title: '👔 Make Formal',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'rewrite-casual',
    parentId: 'rewrite-parent',
    title: '😊 Make Casual',
    contexts: ['selection']
  });


  // === LEARNING FEATURES ===
  
  // 4. Generate Quiz
  chrome.contextMenus.create({
    id: 'quiz',
    parentId: 'textgenius-main',
    title: '🎯 Generate Quiz',
    contexts: ['selection']
  });

  // === TRANSLATION ===
  
  // 5. Translate
  chrome.contextMenus.create({
    id: 'translate',
    parentId: 'textgenius-main',
    title: '🌍 Translate',
    contexts: ['selection']
  });

  // === SEPARATOR ===
  chrome.contextMenus.create({
    id: 'separator',
    parentId: 'textgenius-main',
    type: 'separator',
    contexts: ['selection']
  });

  // === QUICK ACCESS ===
  
  // 7. Open Side Panel
  chrome.contextMenus.create({
    id: 'open-panel',
    parentId: 'textgenius-main',
    title: '⚡ Open textgenius Panel',
    contexts: ['selection']
  });

  console.log('✅ Context menus created successfully');
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('🖱️ Context menu clicked:', info.menuItemId);
  
  const selectedText = info.selectionText;
  const menuId = info.menuItemId;

  // We only handle AI actions here. 'open-panel' is handled separately.
  if (['summarize', 'eli5', 'rewrite-simpler', 'rewrite-formal', 'rewrite-casual', 'grammar', 'quiz', 'translate'].includes(menuId)) {
    handleAction(tab.id, menuId, selectedText);
  } else if (menuId === 'open-panel') {
    chrome.sidePanel.open({ tabId: tab.id });
  } else {
    console.log('⚠️ Unknown menu item:', menuId);
  }
});

// ========================================
// SCRIPT & MESSAGE HELPERS
// ========================================

// Inject content script programmatically
async function injectContentScript(tabId) {
  try {
    console.log('📥 Injecting content script into tab:', tabId);
    
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    
    console.log('✅ Content script injected successfully');
    await new Promise(resolve => setTimeout(resolve, 200)); // Wait for script to initialize
    return true;
  } catch (error) {
    console.error('❌ Failed to inject content script:', error);
    throw error;
  }
}
// Add this listener to background.js
chrome.commands.onCommand.addListener(async (command) => {
  console.log(`⌨️ Command received: ${command}`);
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // First, get the selected text by injecting a small script
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: () => window.getSelection().toString(),
  });

  const selectedText = result.result;
  if (!selectedText) {
    console.log('⚠️ No text selected for command.');
    return; // Do nothing if no text is selected
  }

  // Map command to an action type
  const commandMap = {
    'summarize-command': 'summarize',
    'rewrite-command': 'rewrite-simpler', // Default rewrite to simpler
    'grammar-command': 'grammar'
  };

  const action = commandMap[command];
  if (action) {
    // We already have a function for this!
    handleAction(tab.id, action, selectedText);
  }
});

// Check if content script is loaded
async function isContentScriptLoaded(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return response && response.status === 'ready';
  } catch (error) {
    console.log('⚠️ Content script not loaded:', error.message);
    return false;
  }
}

// Send message with retry logic
async function sendMessageToTab(tabId, message, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      console.log(`✅ Message sent successfully (attempt ${i + 1}):`, message.action);
      return response;
    } catch (error) {
      console.log(`⚠️ Message failed (attempt ${i + 1}):`, error.message);
      if (i === retries - 1) throw error; // Last attempt failed
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }
}

// Helper function for AI error messages
function getAIErrorHelp(error) {
  const message = (error.message || '').toLowerCase();
  
  if (message.includes('not available') || message.includes('is not defined')) {
    return `🔧 **How to fix:**
    
1. Make sure you're using Chrome Canary or Dev (version 127+)
2. Enable these flags at chrome://flags/:
   • #optimization-guide-on-device-model → Enabled BypassPerfRequirement
   • #prompt-api-for-gemini-nano → Enabled
3. Restart Chrome
4. Wait 5-10 minutes for the model to download

📖 More info: https://developer.chrome.com/docs/ai/built-in`;
  }
  
  if (message.includes('downloading') || message.includes('after-download')) {
    return `⏳ **Model is downloading**

The AI model is being downloaded to your device. This is a one-time process.

Please wait 5-10 minutes and try again.

You can check download status at: chrome://components/ (look for "Optimization Guide On Device Model")`;
  }
  
  return 'Please check the Chrome DevTools console for more details.';
}






// ========================================
// MAIN ACTION HANDLER (MODIFIED)
// ========================================

async function handleAction(tabId, menuId, text) {
  console.log(`🔄 Handling action: ${menuId} for tab: ${tabId}`);
  
  try {
    const isLoaded = await isContentScriptLoaded(tabId);
    if (!isLoaded) {
      await injectContentScript(tabId);
    }
    
    await sendMessageToTab(tabId, { action: 'showLoading', type: menuId, text: text });
    
    let result;
    try {
      // --- THIS IS THE SPECIAL GRAMMAR HANDLING ---
      if (menuId === 'grammar') {
        const grammarResult = await sendToOffscreen({ action: 'grammar', text: text });
        
        await sendMessageToTab(tabId, {
          action: 'showResult',
          type: menuId,
          result: grammarResult.message,
          originalText: grammarResult.original,
          correctedText: grammarResult.corrected,
          showDiff: grammarResult.hasChanges,
          isError: false
        });
        return; // Exit early, we've sent the message
      }
      // --- END OF SPECIAL GRAMMAR HANDLING ---

      let offscreenAction, offscreenMode, offscreenData;
      
      // Map menuId to the data for the offscreen document
      switch(menuId) {
        case 'summarize':
        case 'eli5':
        case 'quiz':
          offscreenAction = menuId;
          break;

        // --- THIS IS THE CHANGE ---
        // Find and modify this case in background.js -> handleAction
case 'translate':
  // Don't do any AI work here. Just tell the content script to ask the user.
  await sendMessageToTab(tabId, {
    action: 'promptForLanguage',
    languages: SUPPORTED_TRANSLATION_TARGETS,
    originalText: text
  });
  return; // Exit, because we are waiting for the user to respond.

        case 'rewrite-simpler':
          offscreenAction = 'rewrite';
          offscreenMode = 'simpler';
          break;
        case 'rewrite-formal':
          offscreenAction = 'rewrite';
          offscreenMode = 'formal';
          break;
        case 'rewrite-casual':
          offscreenAction = 'rewrite';
          offscreenMode = 'casual';
          break;
        default:
          throw new Error('Unknown action for AI processing');
      }

      // Call the offscreen document and wait for the result
      // We use a conditional to handle the different data structures
      if (menuId === 'translate') {
        result = await sendToOffscreen(offscreenData);
      } else {
        // This is your existing logic for other commands
        result = await sendToOffscreen({ action: offscreenAction, mode: offscreenMode, text: text });
      }
      
      await sendMessageToTab(tabId, { action: 'showResult', type: menuId, result: result, originalText: text });
      console.log('✅ Result displayed successfully');
      
    } catch (aiError) {
      console.error('❌ AI Processing error:', aiError);
      await sendMessageToTab(tabId, {
        action: 'showResult',
        type: menuId,
        result: `⚠️ **AI Error:** ${aiError.message}\n\n${getAIErrorHelp(aiError)}`,
        originalText: text,
        isError: true
      });
    }
    
  } catch (error) {
    console.error('❌ Error handling action:', error);
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'TextGenius Error',
        message: 'Could not process text. Please reload the page and try again.'
    });
  }
}

// ========================================
// OTHER LISTENERS
// ========================================

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener((tab) => {
  console.log('🖱️ Extension icon clicked - Opening side panel');
  chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for messages from content script or side panel
// Find this listener in background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ... (keep your existing 'processText' case) ...

// In background.js, inside the chrome.runtime.onMessage.addListener

// ADD THIS NEW BLOCK
if (request.action === 'processAI') {
    console.log('⚡️ Received processAI request from side panel:', request.type);
    
    // This part is async, so we'll handle the response inside
    (async () => {
        try {
            let result;
            // The side panel wants to do a full-page translation
            if (request.type === 'translatePage') {
                const sourceLanguage = request.sourceLanguage || 'en'; // Detect or default
                result = await sendToOffscreen({
                    action: 'translate',
                    text: request.text,
                    sourceLanguage: sourceLanguage,
                    targetLanguage: request.targetLanguage
                });
            } else {
                // For summarize, eli5, etc.
                result = await sendToOffscreen({
                    action: request.type, // 'summarize', 'eli5', etc.
                    text: request.text,
                });
            }
            sendResponse({ success: true, result: result });
        } catch (error) {
            console.error('❌ Error processing AI in background:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    
    return true; // Keep the message channel open for the async response
}




  // ADD THIS NEW CASE
  if (request.action === 'doTranslate') {
    // This is triggered after the user selects a language
    const { text, targetLanguage } = request;
    const tabId = sender.tab.id;
    
    // We can even add auto source detection here!
    chrome.i18n.detectLanguage(text, async (result) => {
      const sourceLanguage = result.languages[0]?.language || 'en'; // Default to 'en' if undetectable
      console.log(`Detected source: ${sourceLanguage}, User chose target: ${targetLanguage}`);

      try {
        // Call the offscreen document with all the info
        const translatedResult = await sendToOffscreen({ 
            action: 'translate', 
            text: text, 
            sourceLanguage: sourceLanguage, // Pass the detected source
            targetLanguage: targetLanguage  // Pass the user's choice
        });
        
        await sendMessageToTab(tabId, { 
            action: 'showResult', 
            type: 'translate', 
            result: translatedResult, 
            originalText: text 
        });

      } catch (aiError) {
        // Handle AI errors
        await sendMessageToTab(tabId, {
          action: 'showResult',
          type: 'translate',
          result: `⚠️ **AI Error:** ${aiError.message}\n\n${getAIErrorHelp(aiError)}`,
          originalText: text,
          isError: true
        });
      }
    });
    
    sendResponse({ status: 'translation processing started' });
    return true; // Important for async operations
  }
});

console.log('✅ Background script fully initialized');