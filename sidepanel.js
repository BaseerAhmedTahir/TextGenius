// =======================
// SIDE PANEL SCRIPT - PHASE 3
// Advanced features and settings
// =======================

console.log('🎨 TextGenius: Side panel loaded');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ Side panel initializing...');
  
  // Load and display usage stats
  await loadUsageStats();
  
  // Setup event listeners
  setupPageSummarizer();
  setupSettings();
  setupAIStatusChecker();
  setupHelpActions();
  
  // Auto-refresh stats every 5 seconds
  setInterval(loadUsageStats, 5000);
  
  console.log('✅ Side panel ready');
});

// Load and display usage statistics
async function loadUsageStats() {
  const stats = await chrome.storage.local.get(['usageStats']);
  const data = stats.usageStats || { totalUses: 0, timeSaved: 0, byFeature: {} };
  
  // Update total stats
  document.getElementById('total-uses').textContent = data.totalUses;
  document.getElementById('time-saved').textContent = data.timeSaved;
  
  // Update per-feature counts
  const featureMap = {
    'summarize': 'count-summarize',
    'eli5': 'count-eli5',
    'rewrite-simpler': 'count-rewrite',
    'rewrite-formal': 'count-rewrite',
    'rewrite-casual': 'count-rewrite',
    'grammar': 'count-grammar',
    'quiz': 'count-quiz',
    'translate': 'count-translate'
  };
  
  // Calculate combined rewrite count
  const rewriteCount = (data.byFeature['rewrite-simpler'] || 0) +
                       (data.byFeature['rewrite-formal'] || 0) +
                       (data.byFeature['rewrite-casual'] || 0);
  
  document.getElementById('count-summarize').textContent = data.byFeature['summarize'] || 0;
  document.getElementById('count-eli5').textContent = data.byFeature['eli5'] || 0;
  document.getElementById('count-rewrite').textContent = rewriteCount;
  document.getElementById('count-grammar').textContent = data.byFeature['grammar'] || 0;
  document.getElementById('count-quiz').textContent = data.byFeature['quiz'] || 0;
  document.getElementById('count-translate').textContent = data.byFeature['translate'] || 0;
}

// Setup page summarizer
function setupPageSummarizer() {
  const btn = document.getElementById('summarize-page');
  const resultBox = document.getElementById('page-summary');
  
  btn.addEventListener('click', async () => {
    console.log('🖱️ Summarize page clicked');
    
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon spinner">⏳</span> Processing...';
    resultBox.textContent = 'Extracting page content...';
    resultBox.style.display = 'block';
    resultBox.className = 'result-box result-loading';
    
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Extract page text
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          const article = document.querySelector('article') || 
                         document.querySelector('main') || 
                         document.body;
          return article.innerText.slice(0, 4000);
        }
      });
      
      const pageText = result.result;
      console.log('📄 Page text extracted:', pageText.length, 'characters');
      
      resultBox.textContent = 'Generating AI summary...';
      
      // Send to offscreen for AI processing
      chrome.runtime.sendMessage({
        action: 'processAI',
        type: 'summarize',
        text: pageText
      }, (response) => {
        if (!response || !response.success) {
          throw new Error(response?.error || 'Failed to generate summary');
        }
        
        console.log('✅ Summary received');
        
        resultBox.innerHTML = formatResult(response.result);
        resultBox.className = 'result-box result-success';
        
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">📝</span> Summarize This Page';
      });
      
    } catch (error) {
      console.error('❌ Error:', error);
      resultBox.textContent = `❌ Error: ${error.message}`;
      resultBox.className = 'result-box result-error';
      
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">📝</span> Summarize This Page';
    }
  });
}

// Format result text
function formatResult(text) {
  return text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^• /gm, '&bull; ');
}

// Setup settings handlers
function setupSettings() {
  // Translation language
  const langSelect = document.getElementById('translation-lang');
  
  langSelect.addEventListener('change', (e) => {
    chrome.storage.sync.set({ translationLang: e.target.value });
    showToast('✅ Language preference saved!');
  });
  
  chrome.storage.sync.get(['translationLang'], (result) => {
    if (result.translationLang) {
      langSelect.value = result.translationLang;
    }
  });
  
  // Dyslexia font
  const dyslexiaFont = document.getElementById('dyslexia-font');
  
  dyslexiaFont.addEventListener('change', async (e) => {
    chrome.storage.sync.set({ dyslexiaFont: e.target.checked });
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: (enabled) => {
        if (enabled) {
          document.body.style.fontFamily = 'Arial, sans-serif';
          document.body.style.letterSpacing = '0.05em';
          document.body.style.lineHeight = '1.8';
        } else {
          document.body.style.fontFamily = '';
          document.body.style.letterSpacing = '';
          document.body.style.lineHeight = '';
        }
      },
      args: [e.target.checked]
    });
    
    showToast(e.target.checked ? '✅ Dyslexia font enabled' : '✅ Default font restored');
  });
  
  chrome.storage.sync.get(['dyslexiaFont'], (result) => {
    dyslexiaFont.checked = result.dyslexiaFont || false;
  });
  
  // Auto-copy
  const autoCopy = document.getElementById('auto-copy');
  
  autoCopy.addEventListener('change', (e) => {
    chrome.storage.sync.set({ autoCopy: e.target.checked });
    showToast(e.target.checked ? '✅ Auto-copy enabled' : '✅ Auto-copy disabled');
  });
  
  chrome.storage.sync.get(['autoCopy'], (result) => {
    autoCopy.checked = result.autoCopy || false;
  });
  
  // Notifications
  const showNotifications = document.getElementById('show-notifications');
  
  showNotifications.addEventListener('change', (e) => {
    chrome.storage.sync.set({ showNotifications: e.target.checked });
    showToast(e.target.checked ? '🔔 Notifications enabled' : '🔕 Notifications disabled');
  });
  
  chrome.storage.sync.get(['showNotifications'], (result) => {
    showNotifications.checked = result.showNotifications !== false; // Default true
  });
}

// Setup AI status checker
function setupAIStatusChecker() {
  const checkBtn = document.getElementById('check-ai-status');
  const statusBadge = document.getElementById('ai-status');
  
  checkBtn.addEventListener('click', async () => {
    statusBadge.textContent = '⏳ Checking...';
    statusBadge.className = 'status-badge';
    
    // Send message to offscreen to check AI availability
    chrome.runtime.sendMessage({
      action: 'processAI',
      type: 'summarize',
      text: 'Test'
    }, (response) => {
      if (response && response.success) {
        statusBadge.textContent = '✅ All Ready';
        statusBadge.className = 'status-badge status-active';
        showToast('✅ All AI models are ready!');
      } else {
        statusBadge.textContent = '⚠️ Not Ready';
        statusBadge.className = 'status-badge status-warning';
        showToast('⚠️ AI models need setup. Check flags!');
      }
    });
  });
  
  // Auto-check on load
  setTimeout(() => checkBtn.click(), 1000);
}

// Setup help actions
function setupHelpActions() {
  // Reset stats
  document.getElementById('reset-stats').addEventListener('click', (e) => {
    e.preventDefault();
    
    if (confirm('Are you sure you want to reset all statistics?')) {
      chrome.storage.local.set({
        usageStats: {
          totalUses: 0,
          timeSaved: 0,
          byFeature: {}
        }
      });
      
      loadUsageStats();
      showToast('🔄 Statistics reset!');
    }
  });
  
  // Export data
  document.getElementById('export-data').addEventListener('click', async (e) => {
    e.preventDefault();
    
    const stats = await chrome.storage.local.get(['usageStats']);
    const settings = await chrome.storage.sync.get(null);
    
    const exportData = {
      stats: stats.usageStats,
      settings: settings,
      exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `textgenius-pro-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    showToast('💾 Data exported!');
  });
}

// In sidepanel.js

document.addEventListener('DOMContentLoaded', async () => {
  // ...
  setupPageSummarizer();
  setupPageTranslator(); // <-- Call the new function here
  setupSettings();
  // ...
});

// ... (keep your existing setupPageSummarizer function) ...


// ADD THIS ENTIRE NEW FUNCTION
function setupPageTranslator() {
  const btn = document.getElementById('translate-page');
  const resultBox = document.getElementById('page-translation');
  const langSelect = document.getElementById('translation-lang');

  btn.addEventListener('click', async () => {
    console.log('🖱️ Translate page clicked');
    
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon spinner">⏳</span> Translating...';
    resultBox.textContent = 'Extracting page content...';
    resultBox.style.display = 'block';
    resultBox.className = 'result-box result-loading';
    
    try {
      // Get the target language from the settings dropdown
      const targetLanguage = langSelect.value;
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // We will inject a script to get the text of the *entire page body*
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => document.body.innerText
      });
      
      const pageText = result.result;
      console.log('📄 Page text extracted for translation:', pageText.length, 'characters');
      
      resultBox.textContent = `Translating to ${targetLanguage.toUpperCase()}...`;
      
      // Use our new generic 'processAI' message
      chrome.runtime.sendMessage({
        action: 'processAI',
        type: 'translatePage', // A new type for this action
        text: pageText,
        targetLanguage: targetLanguage
        // We could also detect source language here, but we'll let the background script handle it
      }, (response) => {
        if (!response || !response.success) {
          throw new Error(response?.error || 'Failed to translate page');
        }
        
        console.log('✅ Translation received');
        
        // For translation, we want to replace the whole page content
        // This is a powerful and potentially disruptive action, so we use it carefully.
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: (translatedText) => {
            document.body.innerHTML = `<div style="padding: 20px; font-family: sans-serif; line-height: 1.6;">${translatedText.replace(/\n/g, '<br>')}</div>`;
          },
          args: [response.result]
        });
        
        // Show a success message in the side panel
        resultBox.innerHTML = `✅ Page translated to ${targetLanguage.toUpperCase()}!`;
        resultBox.className = 'result-box result-success';

        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">🌍</span> Translate This Page';
      });
      
    } catch (error) {
      console.error('❌ Error:', error);
      resultBox.textContent = `❌ Error: ${error.message}`;
      resultBox.className = 'result-box result-error';
      
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">🌍</span> Translate This Page';
    }
  });
}


// Show toast notification
function showToast(message) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('toast-show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

console.log('✅ Side panel script ready');