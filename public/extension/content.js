// Sutra Extension — content.js
// Content script: extract page metadata for richer capture

(function () {
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_PAGE_META') {
      const meta = extractPageMeta();
      sendResponse(meta);
    }
    return true;
  });

  function extractPageMeta() {
    const og = (name) =>
      document.querySelector(`meta[property="${name}"]`)?.content ||
      document.querySelector(`meta[name="${name}"]`)?.content || '';

    const title =
      og('og:title') || og('twitter:title') || document.title || '';

    const description =
      og('og:description') || og('description') || og('twitter:description') || '';

    const thumbnail =
      og('og:image') || og('twitter:image') || '';

    const author =
      og('author') || og('article:author') || '';

    // Reading time estimate
    const bodyText = document.body.innerText || '';
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
    const readTime = wordCount > 200 ? `${Math.ceil(wordCount / 200)} min read` : null;

    // Get selected text if any
    const selectedText = window.getSelection()?.toString()?.trim() || '';

    return {
      title: title.trim().slice(0, 300),
      description: description.trim().slice(0, 500),
      thumbnail: thumbnail || '',
      author: author || '',
      readTime: readTime || '',
      selectedText: selectedText.slice(0, 500),
    };
  }
})();
