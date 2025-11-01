// =======================
// CONTENT SCRIPT (ENHANCED)
// Handles text selection detection and result display
// With Auto-Copy and Toast Notifications
// =======================

console.log('🎨 TextGenius : Enhanced content script loaded on', window.location.hostname);

// ========================================
// CONFIGURATION
// ========================================
const CONFIG = {
  AUTO_COPY_ENABLED: true, // Set to false to disable auto-copy
  AUTO_COPY_DELAY: 500, // Delay before auto-copy in ms
  TOAST_DURATION: 3000, // How long toast notifications stay visible
  SCROLL_SHADOW_ENABLED: true // Enable/disable scroll shadows
};

// ========================================
// MESSAGE HANDLER
// ========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📬 Content script received message:', request.action);

  if (request.action === 'ping') {
    console.log('🏓 Ping received - responding');
    sendResponse({ status: 'ready' });
    return true;
  }

  if (request.action === 'showLoading') {
    showLoadingPanel(request.type, request.text);
    sendResponse({ status: 'loading shown' });
    return true;
  }
  
  if (request.action === 'showResult') {
    showResultPanel(
      request.type, 
      request.result, 
      request.originalText,
      request.correctedText,
      request.showDiff,
      request.isError
    );
    sendResponse({ status: 'result shown' });
    return true;
  }

  if (request.action === 'promptForLanguage') {
    showLanguageSelector(request.languages, request.originalText);
    sendResponse({ status: 'language prompt shown' });
    return true;
  }

  sendResponse({ received: true });
  return true;
});

// ========================================
// TOAST NOTIFICATION SYSTEM
// ========================================
function showToast(message, type = 'success', duration = CONFIG.TOAST_DURATION) {
  // Remove existing toasts
  const existingToast = document.querySelector('.aw-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `aw-toast aw-toast-${type}`;
  
  const icon = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  }[type] || '✨';

  toast.innerHTML = `
    <div class="aw-toast-icon">${icon}</div>
    <div class="aw-toast-message">${message}</div>
  `;

  document.body.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.classList.add('aw-toast-hiding');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);

  return toast;
}

// ========================================
// AUTO-COPY FUNCTIONALITY
// ========================================
function autoCopyText(text, actionType) {
  if (!CONFIG.AUTO_COPY_ENABLED) return;

  // Don't auto-copy for quiz or errors
  if (actionType === 'quiz' || !text) return;

  setTimeout(() => {
    navigator.clipboard.writeText(text).then(() => {
      console.log('📋 Auto-copied to clipboard');
      showToast('Automatically copied to clipboard!', 'success', 2000);
    }).catch(err => {
      console.warn('⚠️ Auto-copy failed:', err);
    });
  }, CONFIG.AUTO_COPY_DELAY);
}

// ========================================
// SCROLL SHADOW EFFECT
// ========================================
function initScrollShadow(element) {
  if (!CONFIG.SCROLL_SHADOW_ENABLED) return;

  const updateShadow = () => {
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    const scrollBottom = scrollHeight - clientHeight - scrollTop;

    // Add/remove classes based on scroll position
    if (scrollTop > 10) {
      element.classList.add('aw-has-scroll-top');
    } else {
      element.classList.remove('aw-has-scroll-top');
    }

    if (scrollBottom > 10) {
      element.classList.add('aw-has-scroll-bottom');
    } else {
      element.classList.remove('aw-has-scroll-bottom');
    }
  };

  element.addEventListener('scroll', updateShadow);
  // Initial check
  setTimeout(updateShadow, 100);
}

// Track current selected text
let currentSelection = '';

// Listen for text selection changes
document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText && selectedText.length > 0) {
    currentSelection = selectedText;
    console.log('📝 Text selected:', selectedText.substring(0, 50) + '...');
  }
});

// ========================================
// LOADING PANEL
// ========================================
function showLoadingPanel(actionType, text) {
  console.log('⏳ Showing loading panel for:', actionType);
  
  removeExistingPanels();

  const panel = createPanel('textgenius-panel-loading');
  panel.innerHTML = `
    <div class="aw-panel-header">
      <div class="aw-panel-title">
        <span class="aw-spinner"></span>
        <span>Processing...</span>
      </div>
    </div>
    <div class="aw-panel-content">
      <div class="aw-loading-text">
        ${getLoadingMessage(actionType)}
      </div>
      <div class="aw-original-preview">
        "${escapeHtml(text.substring(0, 100))}${text.length > 100 ? '...' : ''}"
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  positionPanel(panel);
}

// ========================================
// RESULT PANEL
// ========================================
function showResultPanel(actionType, result, originalText, correctedText, showDiff, isError) {
  console.log('✅ Showing result panel for:', actionType, { showDiff, isError });
  removeExistingPanels();

  const panel = createPanel('textgenius-panel-result');
  
  let contentHtml;
  let textForActions = result;
  let showActionButtons = true;
  let showOriginalDropdown = true;

  if (isError) {
    contentHtml = `<div class="aw-error-text">${formatResult(result)}</div>`;
    showActionButtons = false;
    showToast('An error occurred', 'error');
  } else if (actionType === 'grammar') {
    contentHtml = `<div class="aw-result-text">${formatResult(result)}</div>`; 
    
    if (showDiff) {
      contentHtml += `
        <div class="aw-diff-view">
          <div class="aw-diff-header">Original</div>
          <div class="aw-diff-content aw-diff-original">${formatResult(originalText)}</div>
          <div class="aw-diff-header">Corrected</div>
          <div class="aw-diff-content aw-diff-corrected">${formatResult(correctedText)}</div>
        </div>
      `;
      textForActions = correctedText;
      showOriginalDropdown = false;
      
      // Auto-copy corrected text
      autoCopyText(correctedText, actionType);
    } else {
      showActionButtons = false;
    }
  } else {
    contentHtml = `<div class="aw-result-text">${formatResult(result)}</div>`;
    textForActions = result;
    
    // Auto-copy result for non-quiz actions
    autoCopyText(result, actionType);
  }
  
  panel.innerHTML = `
    <div class="aw-panel-header">
      <div class="aw-panel-title">
        ${getActionIcon(actionType)} ${getActionTitle(actionType)}
      </div>
      <button class="aw-close-btn" id="aw-close" aria-label="Close panel">✕</button>
    </div>
    
    <div class="aw-panel-content" role="region" aria-live="polite">
      ${contentHtml}
    </div>
    
    ${showActionButtons ? `
    <div class="aw-panel-actions">
      <button class="aw-btn aw-btn-primary" id="aw-copy" aria-label="Copy to clipboard">
        📋 Copy
      </button>
    </div>` : ''}
    
    ${(showOriginalDropdown && originalText) ? `
    <details class="aw-original-section">
      <summary>📄 Show original text</summary>
      <div class="aw-original-text">
        ${formatResult(originalText)}
      </div>
    </details>` : ''}
  `;

  document.body.appendChild(panel);
  positionPanel(panel);
  
  // Initialize scroll shadow effect
  const panelContent = panel.querySelector('.aw-panel-content');
  if (panelContent) {
    initScrollShadow(panelContent);
  }
  
  attachEventListeners(panel, textForActions, originalText);
}

// ========================================
// LANGUAGE SELECTOR
// ========================================
function showLanguageSelector(languages, originalText) {
  removeExistingPanels();

  const panel = createPanel('textgenius-panel-language-selector');
  
  const languageButtonsHTML = languages.map((lang, index) => 
    `<button class="aw-btn aw-lang-btn" data-lang="${lang}" aria-label="Translate to ${getLangName(lang)}">${getLangName(lang)}</button>`
  ).join('');

  panel.innerHTML = `
    <div class="aw-panel-header">
      <div class="aw-panel-title">
        🌍 Choose a Language
      </div>
      <button class="aw-close-btn" id="aw-close" aria-label="Close panel">✕</button>
    </div>
    <div class="aw-panel-content">
      <p class="aw-lang-prompt-text">Translate to:</p>
      <div class="aw-lang-buttons">
        ${languageButtonsHTML}
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  positionPanel(panel);

  panel.querySelectorAll('.aw-lang-btn').forEach(button => {
    button.addEventListener('click', () => {
      const targetLang = button.getAttribute('data-lang');
      console.log(`User chose to translate to: ${targetLang}`);
      
      showToast(`Translating to ${getLangName(targetLang)}...`, 'info', 2000);
      showLoadingPanel('translate', originalText);
      
      chrome.runtime.sendMessage({
        action: 'doTranslate',
        text: originalText,
        targetLanguage: targetLang
      });
    });
  });

  panel.querySelector('#aw-close').addEventListener('click', () => {
    panel.remove();
  });
}

function getLangName(code) {
  const names = { 
    'es': 'Spanish', 
    'de': 'German', 
    'fr': 'French', 
    'it': 'Italian', 
    'ja': 'Japanese',
    'zh': 'Chinese',
    'ko': 'Korean',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic'
  };
  return names[code] || code.toUpperCase();
}

// ========================================
// PANEL CREATION & POSITIONING
// ========================================
function createPanel(className) {
  const panel = document.createElement('div');
  panel.id = 'textgenius-panel';
  panel.className = `textgenius-panel ${className}`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  return panel;
}

function positionPanel(panel) {
  const selection = window.getSelection();
  
  if (selection.rangeCount > 0 && selection.getRangeAt(0).getClientRects().length > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;
    
    setTimeout(() => {
      if (!document.body.contains(panel)) return;
      const panelRect = panel.getBoundingClientRect();
      
      if (left + panelRect.width > window.innerWidth - 20) {
        left = window.innerWidth - panelRect.width - 20;
      }
      
      if (left < 10) {
        left = 10;
      }
      
      if (top + panelRect.height > window.innerHeight + window.scrollY - 20) {
        top = rect.top + window.scrollY - panelRect.height - 10;
      }
      
      if (top < window.scrollY + 10) {
        top = window.scrollY + 10;
      }

      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
    }, 10);
    
    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
  } else {
    panel.style.top = (window.scrollY + 100) + 'px';
    panel.style.left = '50%';
    panel.style.transform = 'translateX(-50%)';
  }
}

// ========================================
// EVENT LISTENERS
// ========================================
function attachEventListeners(panel, result, originalText) {
  // Close button
  const closeBtn = panel.querySelector('#aw-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('🗑️ Closing panel');
      panel.classList.add('aw-panel-closing');
      setTimeout(() => panel.remove(), 200);
    });
  }

  // Copy button
  const copyBtn = panel.querySelector('#aw-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(result).then(() => {
        console.log('📋 Text copied to clipboard');
        copyBtn.textContent = '✅ Copied!';
        copyBtn.classList.add('aw-btn-success');
        showToast('Copied to clipboard!', 'success', 2000);
        
        setTimeout(() => {
          if(panel.contains(copyBtn)) {
            copyBtn.textContent = '📋 Copy';
            copyBtn.classList.remove('aw-btn-success');
          }
        }, 2000);
      }).catch(err => {
        console.error('❌ Failed to copy:', err);
        copyBtn.textContent = '❌ Failed';
        showToast('Failed to copy', 'error');
      });
    });
  }

  // Replace button
  const replaceBtn = panel.querySelector('#aw-replace');
  if (replaceBtn) {
    replaceBtn.addEventListener('click', () => {
      console.log('🔄 Attempting to replace text');
      const replaced = replaceSelectedText(result);
      
      if (replaced) {
        replaceBtn.textContent = '✅ Replaced!';
        replaceBtn.classList.add('aw-btn-success');
        showToast('Text replaced successfully!', 'success');
        setTimeout(() => panel.remove(), 1500);
      } else {
        replaceBtn.textContent = '❌ Failed';
        replaceBtn.classList.add('aw-btn-error');
        showToast('Could not replace text. Click inside an editable field first.', 'warning', 4000);
        setTimeout(() => {
          if(panel.contains(replaceBtn)) {
            replaceBtn.textContent = '🔄 Replace';
            replaceBtn.classList.remove('aw-btn-error');
          }
        }, 3000);
      }
    });
  }
}

// ========================================
// REPLACE TEXT FUNCTIONALITY
// ========================================
function replaceSelectedText(newText) {
  const activeElement = document.activeElement;
  
  if (activeElement && 
      (activeElement.tagName === 'TEXTAREA' || 
       activeElement.tagName === 'INPUT' ||
       activeElement.isContentEditable)) {
    
    if (activeElement.isContentEditable) {
      const selection = window.getSelection();
      if (selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
        return true;
      }
    } 
    else if (typeof activeElement.selectionStart === 'number') {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const text = activeElement.value;
      
      activeElement.value = text.substring(0, start) + newText + text.substring(end);
      activeElement.selectionStart = activeElement.selectionEnd = start + newText.length;
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      activeElement.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  
  return false;
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
function removeExistingPanels() {
  const existingPanels = document.querySelectorAll('.textgenius-panel');
  existingPanels.forEach(panel => panel.remove());
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatResult(text) {
  if (!text || typeof text !== 'string') return '';
  
  const tempDiv = document.createElement('div');
  tempDiv.textContent = text;
  let safeText = tempDiv.innerHTML;

  return safeText
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/✓/g, '<strong class="aw-correct-answer">✓</strong>');
}

function getLoadingMessage(actionType) {
  const messages = {
    'summarize': 'Extracting key points...',
    'eli5': 'Simplifying explanation...',
    'rewrite-simpler': 'Making text simpler...',
    'rewrite-formal': 'Formalizing text...',
    'rewrite-casual': 'Making text casual...',
    'grammar': 'Checking grammar...',
    'quiz': 'Generating quiz questions...',
    'translate': 'Translating text...'
  };
  
  return messages[actionType] || 'Processing...';
}

function getActionIcon(actionType) {
  const icons = {
    'summarize': '📝',
    'eli5': '🔍',
    'rewrite-simpler': '📖',
    'rewrite-formal': '👔',
    'rewrite-casual': '😊',
    'grammar': '✅',
    'quiz': '🎯',
    'translate': '🌍'
  };
  
  return icons[actionType] || '✨';
}

function getActionTitle(actionType) {
  const titles = {
    'summarize': 'Summary',
    'eli5': 'Simple Explanation',
    'rewrite-simpler': 'Simplified Text',
    'rewrite-formal': 'Formal Version',
    'rewrite-casual': 'Casual Version',
    'grammar': 'Grammar Check',
    'quiz': 'Quiz Questions',
    'translate': 'Translation'
  };
  
  return titles[actionType] || 'Result';
}

// ========================================
// EVENT LISTENERS FOR PANEL CLOSING
// ========================================
document.addEventListener('click', (e) => {
  const panel = document.getElementById('textgenius-panel');
  if (panel && e.target !== panel && !panel.contains(e.target)) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (range.collapsed) {
        console.log('🗑️ Closing panel (clicked outside)');
        panel.remove();
      }
    } else {
      console.log('🗑️ Closing panel (clicked outside)');
      panel.remove();
    }
  }
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const panel = document.getElementById('textgenius-panel');
    if (panel) {
      console.log('🗑️ Closing panel (Escape key)');
      panel.remove();
    }
  }
});

console.log('✅ Enhanced content script initialized and ready');
console.log(`⚙️ Auto-copy: ${CONFIG.AUTO_COPY_ENABLED ? 'Enabled' : 'Disabled'}`);
console.log(`⚙️ Scroll shadow: ${CONFIG.SCROLL_SHADOW_ENABLED ? 'Enabled' : 'Disabled'}`);