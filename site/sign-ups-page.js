import { apiFetch } from './fetch-utils.js';
var pageMessage = document.getElementById('pageMessage');
var eventsList = document.getElementById('eventsList');
var canViewAssignments = window.__CAN_VIEW_ASSIGNMENTS__ === true;
var currentMemberId = null;

// Polyfill for older iOS Safari browsers.
if (!Array.from) {
  Array.from = function(arrayLike) {
    return Array.prototype.slice.call(arrayLike);
  };
}

document.addEventListener('DOMContentLoaded', function() {
  loadNav().then(function() {
    currentMemberId = localStorage.getItem('memberId');
    return loadMemberAssignments();
  }).catch(function(error) {
    showMessage('Failed to load page. ' + error.message, true);
  });
});

function loadNav() {
  var navContainer = document.getElementById('site-nav-container');
  if (!navContainer) {
    return Promise.resolve();
  }

  return fetch('site-nav.html')
    .then(function(navResp) {
      if (!navResp.ok) {
        return '';
      }
      return navResp.text();
    })
    .then(function(navHtml) {
      if (!navHtml) {
        return;
      }
      navContainer.innerHTML = navHtml;
      var script = document.createElement('script');
      script.src = 'site-nav.js';
      document.body.appendChild(script);
    })
    .catch(function(error) {
      console.error('Error loading navigation:', error);
    });
}

function showMessage(message, isError) {
  if (!pageMessage) {
    return;
  }
  pageMessage.style.display = 'block';
  pageMessage.className = 'api-status ' + (isError ? 'disconnected' : 'connected');
  pageMessage.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateHeading(dateValue) {
  if (!dateValue) {
    return 'Unknown Date';
  }

  var parsed = new Date(dateValue + 'T12:00:00');
  if (isNaN(parsed.getTime())) {
    return dateValue;
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatEventActivityTitle(event) {
  var title = String((event && event.title) || '').trim();
  var serviceDate = String((event && event.serviceDate) || '').trim();
  var serviceTime = String((event && event.serviceTime) || '').trim();
  var prefix = serviceDate && serviceTime ? (serviceDate + ' ' + serviceTime + ' ') : '';

  if (prefix && title.indexOf(prefix) === 0) {
    return title.slice(prefix.length).trim();
  }

  if (title) {
    return title;
  }

  var eventType = String((event && event.eventType) || 'Event');
  var parts = eventType.split('-');
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) {
      continue;
    }
    parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
  }
  return parts.join(' ');
}

function getStatusColors(status) {
  var color = (status && status.color) || 'red';
  var backgroundByColor = {
    red: '#fde7e7',
    yellow: '#fff5d6',
    green: '#e2f5e7'
  };
  var textByColor = {
    red: '#9f1c1c',
    yellow: '#8a6500',
    green: '#136f2d'
  };

  return {
    background: backgroundByColor[color] || backgroundByColor.red,
    text: textByColor[color] || textByColor.red
  };
}

function renderFilledBadge(status, filledCount, totalPositions) {
  var colors = getStatusColors(status);
  return '<span class="status-badge" style="background:' + colors.background + '; color:' + colors.text + ';">Filled: ' + filledCount + '/' + totalPositions + '</span>';
}

function getSignupForMember(eventDetails) {
  var signups = Array.isArray(eventDetails && eventDetails.signups) ? eventDetails.signups : [];
  for (var i = 0; i < signups.length; i++) {
    if (signups[i] && signups[i].memberId === currentMemberId) {
      return signups[i];
    }
  }
  return null;
}

function buildAssignmentText(signup) {
  if (!signup) {
    return 'Not responded';
  }
  if (!signup.isAvailable) {
    return 'Marked unavailable';
  }
  if (signup.assignedPositionId) {
    return 'Assigned to ' + signup.assignedPositionId;
  }
  return 'Available';
}

function getMemberStatusColors(signup) {
  if (!signup) {
    return {
      background: '#fff5d6',
      text: '#8a6500'
    };
  }

  if (signup.isAvailable === false) {
    return {
      background: '#fde7e7',
      text: '#9f1c1c'
    };
  }

  return {
    background: '#e2f5e7',
    text: '#136f2d'
  };
}

function loadExistingEvents() {
  return apiFetch('/api/events')
    .then(function(response) {
      if (!response.ok) {
        eventsList.innerHTML = '<div style="color:#b30000;">Could not load scheduled events.</div>';
        return null;
      }
      return response.json();
    })
    .then(function(body) {
      if (!body) {
        return;
      }

      var events = body.events || [];
      if (!events.length) {
        eventsList.innerHTML = '<div style="color:#666;">No upcoming events scheduled yet.</div>';
        return;
      }

      var detailPromises = events.map(function(event) {
        return apiFetch('/api/events/' + encodeURIComponent(event._id))
          .then(function(detailResponse) {
            if (!detailResponse.ok) {
              return { event: event, signups: [] };
            }
            return detailResponse.json();
          })
          .catch(function() {
            return { event: event, signups: [] };
          });
      });

      return Promise.all(detailPromises).then(function(eventDetails) {
        renderEvents(eventDetails);
      });
    });
}

function loadMemberAssignments() {
  return apiFetch('/api/member/assignments')
    .then(function(data) {
      var rows = Array.isArray(data)
        ? data
        : (Array.isArray(data && data.assignments) ? data.assignments : []);

      if (!rows.length) {
        eventsList.innerHTML = '<div style="color:#666;">No upcoming events scheduled yet.</div>';
        return;
      }

      var eventDetails = rows.map(function(context) {
        return {
          event: context.event,
          signups: context.signup ? [context.signup] : []
        };
      });

      renderEvents(eventDetails);
    })
    .catch(function(error) {
      showMessage('Failed to load your assignments. ' + error.message, true);
    });
}

function renderEvents(eventDetails) {
  var byDate = {};
  for (var i = 0; i < eventDetails.length; i++) {
    var detail = eventDetails[i];
    var event = detail.event || detail;
    var dateKey = String((event && event.serviceDate) || '').trim() || 'unknown-date';
    if (!byDate[dateKey]) {
      byDate[dateKey] = [];
    }
    byDate[dateKey].push(detail);
  }

  var sortedDateKeys = Object.keys(byDate).sort();
  var groupedMarkupParts = [];

  for (var d = 0; d < sortedDateKeys.length; d++) {
    var dateKey = sortedDateKeys[d];
    var groupedEvents = byDate[dateKey] || [];
    groupedEvents.sort(function(a, b) {
      var eventA = a.event || a;
      var eventB = b.event || b;
      return String(eventA.serviceTime || '').localeCompare(String(eventB.serviceTime || ''));
    });

    var cardMarkupParts = [];
    for (var e = 0; e < groupedEvents.length; e++) {
      var groupedDetail = groupedEvents[e];
      var groupedEvent = groupedDetail.event || groupedDetail;
      var signup = getSignupForMember(groupedDetail);
      var filledCount = (groupedEvent.status && groupedEvent.status.filledCount) || 0;
      var totalPositions = (groupedEvent.status && groupedEvent.status.totalPositions) || groupedEvent.neededCount || 0;
      var availableActive = signup && signup.isAvailable;
      var unavailableActive = signup && signup.isAvailable === false;
      var availabilityActions = '';

      if (!availableActive) {
        availabilityActions += '<button type="button" class="btn signup-action-btn" data-event-id="' + escapeHtml(groupedEvent._id) + '" data-available="true">Available</button>';
      }
      if (!unavailableActive) {
        availabilityActions += '<button type="button" class="btn signup-action-btn" data-event-id="' + escapeHtml(groupedEvent._id) + '" data-available="false">Unavailable</button>';
      }

      var activityTitle = formatEventActivityTitle(groupedEvent);
      var memberStatus = getMemberStatusColors(signup);
      cardMarkupParts.push(
        '<div class="signups-event-card" style="border:1px solid #ddd; border-radius:10px; padding:14px; background:#fff;">' +
          '<div class="signups-event-header" style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">' +
            '<div>' +
              '<div class="signups-event-title" style="font-weight:600; font-size:1.05em;">' + escapeHtml(groupedEvent.serviceTime || '') + ' - ' + escapeHtml(activityTitle) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="signups-event-badges" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">' +
            renderFilledBadge(groupedEvent.status, filledCount, totalPositions) +
            '<span class="status-badge" style="background:' + memberStatus.background + '; color:' + memberStatus.text + ';">Your status: ' + escapeHtml(buildAssignmentText(signup)) + '</span>' +
          '</div>' +
          '<div class="signups-event-actions" style="display:flex; gap:12px; flex-wrap:wrap; margin-top:14px;">' +
            availabilityActions +
          '</div>' +
        '</div>'
      );
    }

    var dateAssignmentsLink = '';
    if (canViewAssignments && dateKey !== 'unknown-date') {
      dateAssignmentsLink = '<a href="/event-assignments.html?serviceDate=' + encodeURIComponent(dateKey) + '" class="btn signups-date-assignments" style="text-decoration:none; display:inline-flex; align-items:center;">Assignments</a>';
    }

    groupedMarkupParts.push(
      '<section class="signups-date-group" style="border:1px solid #d7dce3; border-radius:12px; padding:14px; background:#f7f9fc;">' +
        '<div class="signups-date-header" style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px;">' +
          '<h3 class="signups-date-title" style="margin:0;">' + escapeHtml(formatDateHeading(dateKey === 'unknown-date' ? '' : dateKey)) + '</h3>' +
          dateAssignmentsLink +
        '</div>' +
        '<div class="signups-date-cards" style="display:grid; gap:12px;">' +
          cardMarkupParts.join('') +
        '</div>' +
      '</section>'
    );
  }

  eventsList.innerHTML = groupedMarkupParts.join('');

  var buttons = document.querySelectorAll('.signup-action-btn');
  for (var b = 0; b < buttons.length; b++) {
    buttons[b].addEventListener('click', function() {
      var eventId = this.getAttribute('data-event-id');
      var isAvailable = this.getAttribute('data-available') === 'true';
      updateAvailability(eventId, isAvailable);
    });
  }
}

function updateAvailability(eventId, isAvailable) {
  return apiFetch('/api/events/' + encodeURIComponent(eventId) + '/signup', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isAvailable: isAvailable })
  })
    .then(function() {
      showMessage('Availability updated.', false);
      return loadMemberAssignments();
    })
    .catch(function(error) {
      showMessage(error.message || 'Failed to update availability.', true);
    });
}
