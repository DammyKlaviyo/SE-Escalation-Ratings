// Content script to inject Rate Ticket button into Zendesk pages

(function() {
  'use strict';
  
  // Track current URL to detect SPA navigation
  let currentUrl = window.location.href;

  // Non-blocking toast for success/error messages
  function showToast(message, type) {
    type = type || 'success';
    const existing = document.getElementById('se-rating-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'se-rating-toast';
    toast.className = 'se-rating-toast se-rating-toast--' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('se-rating-toast--visible'); });
    setTimeout(function() {
      toast.classList.remove('se-rating-toast--visible');
      setTimeout(function() { toast.remove(); }, 300);
    }, 3500);
  }

  // Function to check if we're on a ticket page
  function isTicketPage() {
    const url = window.location.href;
    // Match pattern: https://*.zendesk.com/agent/tickets/123456
    return /\/agent\/tickets\/\d+/.test(url);
  }
  
  // Function to remove all Rate Escalation button instances (containers and orphan buttons)
  function removeRateButton() {
    document.querySelectorAll('.se-rating-button-container').forEach(function(el) {
      el.remove();
    });
    document.querySelectorAll('#se-rating-button').forEach(function(el) {
      el.remove();
    });
  }
  
  // Get current ticket ID from URL
  function getCurrentTicketId() {
    const match = window.location.href.match(/\/tickets\/(\d+)/);
    return match ? match[1] : null;
  }

  // Mark ticket as rated in storage and update button state (button in this pane if scoped)
  function markTicketRated(ticketId, ticketScopeRoot) {
    if (!ticketId) return;
    chrome.storage.local.get(['ratedTicketIds'], function(result) {
      const ids = result.ratedTicketIds || [];
      if (ids.indexOf(ticketId) === -1) ids.push(ticketId);
      if (ids.length > 500) ids.splice(0, ids.length - 500);
      chrome.storage.local.set({ ratedTicketIds: ids });
    });
    var btn = null;
    if (ticketScopeRoot && ticketScopeRoot.nodeType === Node.ELEMENT_NODE) {
      btn = ticketScopeRoot.querySelector('#se-rating-button') || ticketScopeRoot.querySelector('.se-rating-button');
    }
    if (!btn) {
      btn = document.querySelector('.ticket .ticket-panes-grid-layout[data-is-active="true"] #se-rating-button');
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Already rated';
      btn.classList.add('se-rating-button-rated');
    }
  }

  // Function to create and inject the Rate Ticket button
  function injectRateButton() {
    // Only inject on ticket pages
    if (!isTicketPage()) {
      removeRateButton();
      return;
    }
    
    // Check if button already exists
    if (document.querySelector('.ticket .ticket-panes-grid-layout[data-is-active="true"] #se-rating-button')) {
      return;
    }

    const ticketId = getCurrentTicketId();

    // Create button element
    const button = document.createElement('button');
    button.id = 'se-rating-button';
    button.className = 'se-rating-button';
    button.textContent = 'Rate Escalation';
    button.type = 'button';

    // Scope modal to this ticket's container (sidebar + conversation). Prefer .ticket so omni-log is included when it's beside the sidebar.
    button.addEventListener('click', function() {
      const ticketPane =
        button.closest('.ticket') ||
        button.closest('.ticket-panes-grid-layout') ||
        button.closest('[data-test-id="ticket-pane"]');
      showRatingModal(ticketPane);
    });

    // Find the target element: #ticket_sidebar [data-test-id="ticket-fields-tags"]
    const targetElement = document.querySelector('.ticket .ticket-panes-grid-layout[data-is-active="true"] #ticket_sidebar [data-test-id="ticket-fields-tags"]');
    
    if (targetElement) {
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'se-rating-button-container';
      buttonContainer.appendChild(button);
      targetElement.parentNode.insertBefore(buttonContainer, targetElement.nextSibling);

      // Check "already rated" state
      if (chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.get(['ratedTicketIds'], function(result) {
          const ids = result.ratedTicketIds || [];
          if (ticketId && ids.indexOf(ticketId) !== -1) {
            button.disabled = true;
            button.textContent = 'Already rated';
            button.classList.add('se-rating-button-rated');
          }
        });
      }
    }
  }

  // Function to show the rating modal
  // ticketScopeRoot: DOM element for this ticket (pane). If omitted, uses full document (legacy).
  function showRatingModal(ticketScopeRoot) {
    const ticketScope = ticketScopeRoot && ticketScopeRoot.nodeType === Node.ELEMENT_NODE
      ? ticketScopeRoot
      : null;

    // Remove existing modal if present
    const existingModal = document.getElementById('se-rating-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'se-rating-modal';
    overlay.className = 'se-rating-overlay';

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'se-rating-modal';

    // Create modal header
    const header = document.createElement('div');
    header.className = 'se-rating-header';
    header.innerHTML = '<h2>Rate Escalation</h2><button class="se-rating-close">&times;</button>';

    // Create form
    const form = document.createElement('form');
    form.id = 'se-rating-form';

    // Rating options
    const ratingContainer = document.createElement('div');
    ratingContainer.className = 'se-rating-options';
    ratingContainer.innerHTML = `
      <label>Rating:</label>
      <div class="se-rating-buttons">
        <button type="button" class="se-rating-option" data-rating="bad">Bad</button>
        <button type="button" class="se-rating-option" data-rating="okay">Okay</button>
        <button type="button" class="se-rating-option" data-rating="good">Good</button>
      </div>
    `;

    // Escalator dropdown (only escalators from this ticket's conversation)
    const ticketInfo = extractTicketInfo(ticketScope);
    const escalatorContainer = document.createElement('div');
    escalatorContainer.className = 'se-rating-escalator';
    
    const escalatorLabel = document.createElement('label');
    escalatorLabel.setAttribute('for', 'se-rating-escalator');
    escalatorLabel.textContent = 'Escalator:';
    
    const escalatorSelect = document.createElement('select');
    escalatorSelect.id = 'se-rating-escalator';
    escalatorSelect.name = 'escalator';
    escalatorSelect.required = true;
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select Escalator --';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    escalatorSelect.appendChild(defaultOption);
    
    // Add escalator names from ticket info
    if (ticketInfo.escalatorNames && ticketInfo.escalatorNames.length > 0) {
      ticketInfo.escalatorNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        escalatorSelect.appendChild(option);
      });
    } else {
      // If no escalators found, add an option
      const noEscalatorOption = document.createElement('option');
      noEscalatorOption.value = 'Unknown';
      noEscalatorOption.textContent = 'Unknown';
      escalatorSelect.appendChild(noEscalatorOption);
    }
    
    escalatorContainer.appendChild(escalatorLabel);
    escalatorContainer.appendChild(escalatorSelect);

    // Comment textarea (label text updates when "Bad" is selected - required for Bad)
    const commentContainer = document.createElement('div');
    commentContainer.className = 'se-rating-comment';
    const commentLabel = document.createElement('label');
    commentLabel.id = 'se-rating-comment-label';
    commentLabel.setAttribute('for', 'se-rating-comment');
    commentLabel.textContent = 'Comment (optional):';
    const commentTextarea = document.createElement('textarea');
    commentTextarea.id = 'se-rating-comment';
    commentTextarea.name = 'comment';
    commentTextarea.rows = 4;
    commentTextarea.placeholder = 'Add your comment here...';
    commentContainer.appendChild(commentLabel);
    commentContainer.appendChild(commentTextarea);

    // Submit button
    const submitContainer = document.createElement('div');
    submitContainer.className = 'se-rating-submit';
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Submit Rating';
    submitButton.className = 'se-rating-submit-btn';
    submitContainer.appendChild(submitButton);

    // Assemble form
    form.appendChild(ratingContainer);
    form.appendChild(escalatorContainer);
    form.appendChild(commentContainer);
    form.appendChild(submitContainer);

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(form);
    overlay.appendChild(modal);

    // Add to page
    document.body.appendChild(overlay);

    // Handle rating selection and update comment label when "Bad" is selected (required)
    let selectedRating = null;
    const commentLabelEl = document.getElementById('se-rating-comment-label');
    const ratingButtons = modal.querySelectorAll('.se-rating-option');
    function updateCommentLabel() {
      if (commentLabelEl) {
        commentLabelEl.textContent = selectedRating === 'bad'
          ? 'Comment (required for Bad):'
          : 'Comment (optional):';
      }
    }
    ratingButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        ratingButtons.forEach(function(b) { b.classList.remove('selected'); });
        this.classList.add('selected');
        selectedRating = this.dataset.rating;
        updateCommentLabel();
      });
    });

    // Handle form submission
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      if (!selectedRating) {
        showToast('Please select a rating', 'error');
        return;
      }

      const selectedEscalator = document.getElementById('se-rating-escalator').value;
      if (!selectedEscalator) {
        showToast('Please select an escalator', 'error');
        return;
      }

      const comment = document.getElementById('se-rating-comment').value;
      if (selectedRating === 'bad' && !comment.trim()) {
        showToast('Please add a comment when rating as Bad', 'error');
        return;
      }

      submitRating(selectedRating, selectedEscalator, comment, ticketScope);
    });

    // Handle close button
    header.querySelector('.se-rating-close').addEventListener('click', function() {
      overlay.remove();
    });

    // Close on overlay click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  // Function to extract ticket information
  // scopeRoot: optional Element limiting queries to one ticket (multi-tab Zendesk). Defaults to document.
  function extractTicketInfo(scopeRoot) {
    const root = scopeRoot && scopeRoot.nodeType === Node.ELEMENT_NODE ? scopeRoot : document;
    const isScoped = root !== document;

    let url = window.location.href;
    let ticketId = url.match(/\/tickets\/(\d+)/)?.[1] || '';

    // When multiple tickets are open, URL may not match this pane — resolve from links inside the pane
    if (isScoped) {
      const ticketLink = root.querySelector('a[href*="/agent/tickets/"]');
      if (ticketLink) {
        const href = ticketLink.getAttribute('href') || '';
        const m = href.match(/\/tickets\/(\d+)/);
        if (m) {
          ticketId = m[1];
          if (href.indexOf('http') === 0) {
            url = href;
          } else {
            try {
              url = new URL(href, window.location.origin).href;
            } catch (e) {
              url = window.location.origin + (href.indexOf('/') === 0 ? '' : '/') + href;
            }
          }
        }
      }
    }

    // Try to extract SE name (Support Engineer) — scoped to this ticket
    let seName = 'Unknown';
    
    // First, try the specific selector: [data-test-id="assignee-field"] img
    const assigneeImg = root.querySelector('[data-test-id="assignee-field"] img');
    if (assigneeImg) {
      seName = assigneeImg.getAttribute('alt') || 'Unknown';
    } else {
      // Fallback to other selectors
      const seSelectors = [
        '[data-test-id="ticket-assignee"]',
        '.ticket-assignee',
        '.assignee-name',
        '[data-user-id]'
      ];
      
      for (const selector of seSelectors) {
        const element = root.querySelector(selector);
        if (element) {
          seName = element.textContent.trim() || element.getAttribute('title') || 'Unknown';
          break;
        }
      }
    }

    // Extract all possible escalator names from comment items within this ticket only
    // Only include names from items that have an img with alt="Avatar"
    const escalatorNames = new Set();
    const commentItems = root.querySelectorAll('[data-test-id="omni-log-comment-item"]');
    
    // Names to exclude from escalator options
    const excludedNames = [seName, 'Jira Zendesk Integration User', 'Linear', 'Success Systems','Klaviyo Support'];
    
    commentItems.forEach(item => {
      // Check if this comment item has an img with alt="Avatar"
      const avatarImg = item.querySelector('img[alt="Avatar"]') || item.querySelector('figure[data-test-id="omni-log-base-avatar"] [data-test-id="omni-log-avatar-badge-AgentBadge"]');
      if (avatarImg) {
        // Find the user link span within this item
        const userLinkSpan = item.querySelector('[data-test-id="omni-log-comment-user-link"] span');
        if (userLinkSpan) {
          const name = userLinkSpan.textContent.trim();
          if (name && !excludedNames.includes(name)) {
            // Only add if it's not in the excluded names list
            escalatorNames.add(name);
          }
        }
      }
    });

    // Convert Set to Array and sort
    const escalatorNamesArray = Array.from(escalatorNames).sort();

    // Product Area from sidebar dropdown (next sibling of matching label)
    const productArea = getSidebarDropdownValueByLabel(root, 'Product Area*');

    return {
      url,
      ticketId,
      seName,
      escalatorNames: escalatorNamesArray,
      productArea
    };
  }

  // Read Product Area (or label matching exactLabelText) from sidebar dropdown
  function getSidebarDropdownValueByLabel(root, exactLabelText) {
    if (!exactLabelText) return '';
    function findLabel(labels) {
      return Array.from(labels).find(function(node) {
        const t = node.textContent.trim();
        return t === exactLabelText || /^product\s*area/i.test(t);
      });
    }
    function readDropdownFromLabel(labelEl) {
      if (!labelEl) return '';
      var sibling = labelEl.nextElementSibling;
      if (sibling && sibling.matches && sibling.matches('[data-test-id="ticket-form-field-dropdown-button"]')) {
        return sibling.textContent.trim();
      }
      var fieldRow = labelEl.closest('[data-test-id="ticket-field"]') || labelEl.parentElement;
      if (fieldRow) {
        var btn = fieldRow.querySelector('[data-test-id="ticket-form-field-dropdown-button"]');
        if (btn) return btn.textContent.trim();
      }
      return '';
    }
    var candidates = [];
    if (root && root.nodeType === Node.ELEMENT_NODE) {
      candidates.push(root);
    } else {
      candidates.push(document);
    }
    var activePane = document.querySelector('.ticket-panes-grid-layout[data-is-active="true"]');
    if (activePane && candidates.indexOf(activePane) === -1) {
      candidates.push(activePane);
    }
    for (var r = 0; r < candidates.length; r++) {
      var labels = candidates[r].querySelectorAll('#ticket_sidebar label');
      var labelEl = findLabel(labels);
      var val = readDropdownFromLabel(labelEl);
      if (val) return val;
    }
    return '';
  }

  // Capitalize rating for Google Sheets (e.g. good → Good, okay → Okay)
  function capitalizeRating(rating) {
    if (!rating || typeof rating !== 'string') return rating;
    return rating.charAt(0).toUpperCase() + rating.slice(1).toLowerCase();
  }

  // Function to submit rating to Google Sheets
  async function submitRating(rating, escalatorName, comment, ticketScopeRoot) {
    const ticketInfo = extractTicketInfo(ticketScopeRoot);
    const submitButton = document.querySelector('.se-rating-submit-btn');
    
    // Disable submit button
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    const data = {
      ticketUrl: ticketInfo.url,
      seName: ticketInfo.seName,
      escalatorName: escalatorName,
      rating: capitalizeRating(rating),
      comment: comment || '',
      timestamp: new Date().toISOString(),
      productArea: ticketInfo.productArea || ''
    };

    try {
      // Check if extension context is still valid
      if (!chrome.runtime || !chrome.runtime.id) {
        throw new Error('Extension context invalidated. Please refresh this page and try again.');
      }

      // Get Google Apps Script URL from storage
      let result, scriptUrl;
      try {
        result = await chrome.storage.sync.get(['googleScriptUrl']);
        scriptUrl = result.googleScriptUrl;
      } catch (storageError) {
        // Handle "Extension context invalidated" error
        const errorMessage = storageError.message || String(storageError);
        if (errorMessage.includes('Extension context invalidated') || 
            errorMessage.includes('message port closed')) {
          throw new Error('Extension was reloaded. Please refresh this page and try again.');
        }
        throw storageError;
      }

      if (!scriptUrl) {
        throw new Error('Google Script URL not configured. Please set it in the extension options.');
      }

      // Google Apps Script web apps typically have CORS issues, so use no-cors mode
      // This prevents CORS errors but means we can't read the response
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      // With no-cors mode, we can't read the response, but the request was sent
      const modalEl = document.getElementById('se-rating-modal');
      if (modalEl) modalEl.remove();
      showToast('Rating submitted successfully!', 'success');
      markTicketRated(ticketInfo.ticketId, ticketScopeRoot);
      
    } catch (error) {
      console.error('Error submitting rating:', error);
      showToast('Error: ' + error.message, 'error');
      submitButton.disabled = false;
      submitButton.textContent = 'Submit Rating';
    }
  }

  // Function to handle URL changes (SPA navigation)
  function handleUrlChange() {
    const newUrl = window.location.href;
    if (newUrl !== currentUrl) {
      currentUrl = newUrl;
      
      if (isTicketPage()) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          injectRateButton();
        }, 300);
      } else {
        removeRateButton();
      }
    }
  }
  
  // Function to check and inject button (with retry logic for dynamic content)
  function checkAndInjectButton() {
    if (isTicketPage()) {
      const targetElement = document.querySelector('.ticket .ticket-panes-grid-layout[data-is-active="true"] #ticket_sidebar [data-test-id="ticket-fields-tags"]');
      if (targetElement && !document.querySelector('.ticket .ticket-panes-grid-layout[data-is-active="true"] #se-rating-button')) {
        injectRateButton();
      } else if (!targetElement) {
        // Retry if target element not found yet
        setTimeout(checkAndInjectButton, 500);
      }
    } else {
      removeRateButton();
    }
  }
  
  // Listen for popstate events (back/forward navigation)
  window.addEventListener('popstate', handleUrlChange);
  
  
  // Intercept pushState and replaceState to detect SPA navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function() {
    originalPushState.apply(history, arguments);
    setTimeout(handleUrlChange, 0);
  };
  
  history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    setTimeout(handleUrlChange, 0);
  }
  
  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndInjectButton);
  } else {
    checkAndInjectButton();
  }

  // Watch for DOM changes (for SPA navigation and dynamic content loading)
  const observer = new MutationObserver(function(mutations) {
    // Check if we're on a ticket page
    if (isTicketPage()) {
      const targetElement = document.querySelector('.ticket .ticket-panes-grid-layout[data-is-active="true"] #ticket_sidebar [data-test-id="ticket-fields-tags"]');
      const buttonExists = document.querySelector('.ticket .ticket-panes-grid-layout[data-is-active="true"] #se-rating-button');

      // If target element exists but button doesn't, inject it
      if (targetElement && !buttonExists) {
        injectRateButton();
      }
      // If target element was removed, remove button
      else if (!targetElement && buttonExists) {
        removeRateButton();
      }
    } else {
      // Not on ticket page, remove button if it exists
      if (document.querySelectorAll('#se-rating-button').length > 0) {
        // removeRateButton();
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: false
  });
})();

