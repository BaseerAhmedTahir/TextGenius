// =======================
// OFFSCREEN DOCUMENT SCRIPT
// Runs the AI APIs in a valid window context
// =======================

console.log('🚀 Offscreen document loaded.');

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.target !== 'offscreen' || !request.data) {
        return;
    }
    console.log('📨 Offscreen received job:', request.data.action);
    handleOffscreenAction(request.data)
        .then(result => sendResponse({ success: true, result }))
        .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Keep the message channel open for async response
});


async function handleOffscreenAction(data) {
    const { action, text, mode, sourceLanguage, targetLanguage  } = data;
    switch (action) {
        case 'summarize':
            return processSummarize(text);
        case 'rewrite':
            return processRewrite(text, mode);
        case 'eli5':
            return processELI5(text);
        case 'quiz':
            return processQuiz(text);
        case 'translate':
            return processTranslate(text, sourceLanguage, targetLanguage); // Pass both
        default:
            throw new Error('Unknown offscreen action');
    }
}


// ========================================
// AI PROCESSING FUNCTIONS
// ========================================

// 1. SUMMARIZER API
async function processSummarize(text) {
  let summarizer;
  try {
    summarizer = await Summarizer.create();
    const summary = await summarizer.summarize(text);
    return `📝 **Summary**\n\n${summary}`;
  } finally {
    if (summarizer) summarizer.destroy();
  }
}

// 2. REWRITER API
// The NEW, robust processRewrite function in offscreen.js
async function processRewrite(text, mode) {
  console.log(`✍️ [Offscreen] Processing Rewrite (${mode} mode)...`);
  let rewriter;
  try {
    // STEP 1: Check availability first.
    const availability = await Rewriter.availability();
    console.log(`[Offscreen] Rewriter availability is: ${availability}`);

    if (availability === 'unavailable') {
      throw new Error('The Rewriter API is not supported on this device.');
    }

    if (availability !== 'available') {
      console.log('[Offscreen] Rewriter model may need to be downloaded. Proceeding with creation...');
      // This is where the user gesture error comes from, but our error handling in background.js will catch it.
    }

    // STEP 2: Create the rewriter. This will trigger the download if needed.
    rewriter = await Rewriter.create();

    // STEP 3: Perform the rewrite
    const rewriteOptions = {
      'simpler': { length: 'shorter' },
      'formal': { tone: 'formal' },
      'casual': { tone: 'casual' }
    };
    const options = rewriteOptions[mode] || {};
    const rewritten = await rewriter.rewrite(text, options);

    const titles = {
      'simpler': '📖 **Simplified Version**',
      'formal': '👔 **Formal Version**',
      'casual': '😊 **Casual Version**'
    };
    return `${titles[mode]}\n\n${rewritten}`;

  } catch (error) {
    console.error('[Offscreen] Rewriter process failed:', error);
    throw error; // Re-throw so background.js can catch it
  } finally {
    if (rewriter) {
      rewriter.destroy();
      console.log('[Offscreen] Rewriter instance destroyed.');
    }
  }
}

// 3. ELI5 - EXPLAIN LIKE I'M 5 (Uses Prompt API)
async function processELI5(text) {
  console.log('🔍 [Offscreen] Processing ELI5...');
  let session;
  try {
    session = await LanguageModel.create({
      // The system prompt is a great way to set the AI's personality
      systemPrompt: 'You are a friendly teacher explaining things to a 5-year-old. Use simple words and short sentences.'
    });
    const explanation = await session.prompt(`Explain this in very simple terms:\n\n${text}`);
    return `🔍 **Simple Explanation**\n\n${explanation}`;
  } finally {
    if (session) session.destroy();
  }
}


// 4. QUIZ GENERATOR (Uses Prompt API)
async function processQuiz(text) {
  console.log('🎯 [Offscreen] Processing Quiz...');
  let session;
  try {
    session = await LanguageModel.create({
      systemPrompt: 'You are an educator who creates multiple-choice quizzes. Create 3-4 questions based on the text. Each question should have 4 options. Mark the correct answer with a ✓. Format using Markdown.'
    });
    const quiz = await session.prompt(`Generate a multiple-choice quiz based on this text:\n\n${text}`);
    return `🎯 **Quiz Time!**\n\n${quiz}`;
  } finally {
    if (session) session.destroy();
  }
}

// In offscreen.js, inside processTranslate
// In offscreen.js, replace the old processTranslate function

async function processTranslate(text, sourceLanguage, targetLanguage) {
  console.log(`🌍 [Offscreen] Starting translation from ${sourceLanguage} to ${targetLanguage}...`);
  let translator;
  try {
    // STEP 1: Check if this language pair is even possible.
    const availability = await Translator.availability({ sourceLanguage, targetLanguage });
    console.log(`[Offscreen] Availability for ${sourceLanguage}->${targetLanguage} is: ${availability}`);

    // If it's 'unavailable', we fail immediately with a clear message.
    if (availability === 'unavailable') {
      throw new Error(`The on-device model does not support translating from ${sourceLanguage} to ${targetLanguage}.`);
    }

    // If it's not immediately available, we inform the user and proceed.
    // The .create() call will handle the download.
    if (availability !== 'available') {
      console.log(`[Offscreen] Translation model for ${targetLanguage} needs to be downloaded. This might take a moment...`);
    }

    // STEP 2: Create the translator. This will trigger the download if needed.
    // We can even add the progress monitor here.
    translator = await Translator.create({
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      monitor(m) {
        m.addEventListener("downloadprogress", e => {
          // This is advanced, but you could send progress messages back to the UI from here.
          console.log(`[Offscreen] Download progress: ${Math.round(e.loaded * 100)}%`);
        });
      }
    });

    // STEP 3: If creation was successful, translate the text.
    console.log('[Offscreen] Translator created successfully. Translating text...');
    const translatedText = await translator.translate(text);
    return `🌍 **Translated to ${targetLanguage.toUpperCase()}**\n\n${translatedText}`;

  } catch (error) {
    // Re-throw the error so the background script can catch it and display it.
    console.error('[Offscreen] Translation process failed:', error);
    throw error;
  } finally {
    if (translator) {
      translator.destroy();
      console.log('[Offscreen] Translator instance destroyed.');
    }
  }
}