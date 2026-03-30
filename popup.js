// Popup script for extension configuration and rating history

var HISTORY_LIMIT = 5;

document.addEventListener('DOMContentLoaded', function() {
  const scriptUrlInput = document.getElementById('script-url');
  const saveBtn = document.getElementById('save-btn');
  const statusDiv = document.getElementById('status');
  const ratingHistoryEl = document.getElementById('rating-history');
  const historyRefreshBtn = document.getElementById('history-refresh');
  const viewAllRatingsLink = document.getElementById('view-all-ratings');

  function updateViewAllRatingsLink(spreadsheetUrl) {
    if (!viewAllRatingsLink) return;
    var ok = spreadsheetUrl && typeof spreadsheetUrl === 'string' &&
      spreadsheetUrl.indexOf('https://docs.google.com/spreadsheets/') === 0;
    if (ok) {
      viewAllRatingsLink.href = spreadsheetUrl;
      viewAllRatingsLink.removeAttribute('hidden');
    } else {
      viewAllRatingsLink.removeAttribute('href');
      viewAllRatingsLink.setAttribute('hidden', '');
    }
  }

  // Load saved URL and fetch history
  chrome.storage.sync.get(['googleScriptUrl'], function(result) {
    if (result.googleScriptUrl) {
      scriptUrlInput.value = result.googleScriptUrl;
      loadRatingHistory(result.googleScriptUrl);
    } else {
      updateViewAllRatingsLink('');
      showHistoryMessage('Configure the script URL above to see rating history.', 'history-empty');
    }
  });

  historyRefreshBtn.addEventListener('click', function() {
    var url = scriptUrlInput.value.trim();
    if (url) loadRatingHistory(url);
    else {
      updateViewAllRatingsLink('');
      showHistoryMessage('Configure the script URL above to see rating history.', 'history-empty');
    }
  });

  function loadRatingHistory(scriptUrl) {
    if (!scriptUrl || !scriptUrl.startsWith('https://script.google.com/')) {
      updateViewAllRatingsLink('');
      showHistoryMessage('Configure the script URL above to see rating history.', 'history-empty');
      return;
    }
    showHistoryMessage('Loading…', 'history-loading');
    var urlWithLimit = scriptUrl.indexOf('?') >= 0
      ? scriptUrl + '&limit=' + HISTORY_LIMIT
      : scriptUrl + '?limit=' + HISTORY_LIMIT;
    fetch(urlWithLimit, { method: 'GET' })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        updateViewAllRatingsLink(data.spreadsheetUrl);
        if (data.success && data.history && data.history.length > 0) {
          renderHistory(data.history);
        } else if (data.success) {
          showHistoryMessage('No ratings yet.', 'history-empty');
        } else {
          showHistoryMessage('Could not load history: ' + (data.error || 'Unknown error'), 'history-error');
        }
      })
      .catch(function(err) {
        updateViewAllRatingsLink('');
        showHistoryMessage('Could not load history: ' + (err.message || 'Unknown error'), 'history-error');
      });
  }

  function showHistoryMessage(text, className) {
    ratingHistoryEl.innerHTML = '<div class="' + className + '">' + text + '</div>';
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    try {
      var d = new Date(isoString);
      return isNaN(d.getTime()) ? isoString : d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoString;
    }
  }

  function renderHistory(history) {
    var filtered = history.filter(function(item) {
      return (item.rating && item.rating.trim()) || (item.timestamp && item.timestamp.trim()) || (item.ticketUrl && item.ticketUrl.trim());
    });
    var html = filtered.map(function(item) {
      var ratingClass = 'rating-' + (item.rating ? item.rating.toLowerCase() : '');
      var comment = item.comment ? (' — ' + escapeHtml(item.comment).substring(0, 60) + (item.comment.length > 60 ? '…' : '')) : '';
      var safeUrl = item.ticketUrl && (item.ticketUrl.indexOf('http://') === 0 || item.ticketUrl.indexOf('https://') === 0) ? item.ticketUrl : '';
      return (
        '<div class="history-item ' + ratingClass + '">' +
          '<div class="history-item__meta">' + formatDate(item.timestamp) + ' · ' + escapeHtml(item.seName) + ' → ' + escapeHtml(item.escalatorName) + ' · ' + escapeHtml(item.rating) + '</div>' +
          (safeUrl ? '<a class="history-item__link" href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener">Ticket</a>' : '') +
          (comment ? '<div class="history-item__meta">' + comment + '</div>' : '') +
        '</div>'
      );
    }).join('');
    ratingHistoryEl.innerHTML = html;
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Save configuration
  saveBtn.addEventListener('click', function() {
    const scriptUrl = scriptUrlInput.value.trim();
    
    if (!scriptUrl) {
      showStatus('Please enter a Google Apps Script URL', 'error');
      return;
    }

    if (!scriptUrl.startsWith('https://script.google.com/')) {
      showStatus('Please enter a valid Google Apps Script URL', 'error');
      return;
    }

    chrome.storage.sync.set({ googleScriptUrl: scriptUrl }, function() {
      showStatus('Configuration saved successfully!', 'success');
      loadRatingHistory(scriptUrl);
    });
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    setTimeout(function() {
      statusDiv.className = 'status';
    }, 3000);
  }
});

