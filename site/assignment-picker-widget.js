function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildOptionLabel(option) {
  const firstName = String(option?.firstName || '').trim();
  const lastName = String(option?.lastName || '').trim();
  const email = String(option?.email || '').trim();
  const roleSuffix = Array.isArray(option?.tags) && option.tags.length > 0
    ? ` (${option.tags.join(', ')})`
    : '';

  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim() + roleSuffix;
  }

  return email || String(option?._id || 'Unknown');
}

export function createAssignmentPicker({
  container,
  options,
  selectedValues = [],
  multi = true,
  searchPlaceholder = 'Type to filter names...',
  onChange
}) {
  if (!container) {
    return {
      getValue: () => (multi ? [] : null),
      getValues: () => []
    };
  }

  const optionList = Array.isArray(options) ? options : [];
  const normalizedSelected = new Set((Array.isArray(selectedValues) ? selectedValues : [selectedValues]).filter(Boolean));
  const radioGroupName = `assignment-picker-${Math.random().toString(36).slice(2)}`;

  const root = document.createElement('div');
  root.style.border = '1px solid #c9d8de';
  root.style.borderRadius = '8px';
  root.style.padding = '8px';
  root.style.background = '#fff';

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = searchPlaceholder;
  search.className = 'input';
  search.style.marginBottom = '8px';
  search.style.width = '100%';

  const selectedInfo = document.createElement('div');
  selectedInfo.style.fontSize = '0.85em';
  selectedInfo.style.color = '#426671';
  selectedInfo.style.marginBottom = '8px';

  const list = document.createElement('div');
  list.style.maxHeight = '180px';
  list.style.overflowY = 'auto';
  list.style.border = '1px solid #e3ecef';
  list.style.borderRadius = '6px';
  list.style.padding = '6px';

  function getSelectedIds() {
    return Array.from(normalizedSelected);
  }

  function updateSelectedLabel() {
    const count = normalizedSelected.size;
    if (multi) {
      selectedInfo.textContent = count > 0 ? `${count} selected` : 'No one selected';
      return;
    }

    selectedInfo.textContent = count > 0 ? 'Selected' : 'Unassigned';
  }

  function renderRows() {
    const term = String(search.value || '').trim().toLowerCase();
    const filtered = optionList.filter(option => {
      if (!term) {
        return true;
      }
      const label = buildOptionLabel(option).toLowerCase();
      return label.includes(term);
    });

    list.innerHTML = '';
    if (filtered.length === 0) {
      const none = document.createElement('div');
      none.textContent = 'No matches';
      none.style.color = '#5d7077';
      none.style.padding = '4px';
      list.appendChild(none);
      return;
    }

    for (const option of filtered) {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.alignItems = 'center';
      row.style.padding = '4px';
      row.style.cursor = 'pointer';

      const input = document.createElement('input');
      input.type = multi ? 'checkbox' : 'radio';
      input.name = multi ? '' : radioGroupName;
      input.value = option._id;
      input.checked = normalizedSelected.has(option._id);

      input.addEventListener('change', () => {
        if (multi) {
          if (input.checked) {
            normalizedSelected.add(option._id);
          } else {
            normalizedSelected.delete(option._id);
          }
        } else {
          normalizedSelected.clear();
          if (input.checked) {
            normalizedSelected.add(option._id);
          }
        }

        updateSelectedLabel();
        if (typeof onChange === 'function') {
          onChange(getSelectedIds());
        }

        if (!multi) {
          renderRows();
        }
      });

      const text = document.createElement('span');
      text.innerHTML = escapeHtml(buildOptionLabel(option));

      row.appendChild(input);
      row.appendChild(text);
      list.appendChild(row);
    }
  }

  search.addEventListener('input', renderRows);

  root.appendChild(search);
  root.appendChild(selectedInfo);
  root.appendChild(list);

  container.innerHTML = '';
  container.appendChild(root);

  updateSelectedLabel();
  renderRows();

  return {
    getValues: getSelectedIds,
    getValue: () => {
      const values = getSelectedIds();
      return values[0] || null;
    },
    setValues: (ids) => {
      normalizedSelected.clear();
      const source = Array.isArray(ids) ? ids : [ids];
      source.filter(Boolean).forEach(id => normalizedSelected.add(id));
      updateSelectedLabel();
      renderRows();
    }
  };
}
