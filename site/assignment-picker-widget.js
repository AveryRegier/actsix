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
  onChange,
  allowQuickAdd = false,
  quickAddLabel = 'Add new member',
  quickAddRoleLabel = '',
  quickAddRequiredGender = '',
  onQuickAdd
}) {
  if (!container) {
    return {
      getValue: () => (multi ? [] : null),
      getValues: () => []
    };
  }

  const optionList = Array.isArray(options) ? [...options] : [];
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

  const quickAddWrap = document.createElement('div');
  quickAddWrap.style.marginTop = '10px';

  const quickAddToggle = document.createElement('button');
  quickAddToggle.type = 'button';
  quickAddToggle.className = 'btn';
  quickAddToggle.textContent = quickAddLabel;

  const quickAddForm = document.createElement('div');
  quickAddForm.style.display = 'none';
  quickAddForm.style.marginTop = '8px';
  quickAddForm.style.padding = '8px';
  quickAddForm.style.border = '1px solid #e3ecef';
  quickAddForm.style.borderRadius = '6px';
  quickAddForm.style.background = '#f8fbfc';

  const quickAddHint = document.createElement('div');
  quickAddHint.style.fontSize = '0.85em';
  quickAddHint.style.color = '#426671';
  quickAddHint.style.marginBottom = '6px';
  const normalizedRequiredGender = String(quickAddRequiredGender || '').trim().toLowerCase();
  const hasRequiredGender = normalizedRequiredGender === 'male' || normalizedRequiredGender === 'female';
  quickAddHint.textContent = hasRequiredGender
    ? `New member will be tagged as ${quickAddRoleLabel || 'participant'} and gender will be ${normalizedRequiredGender}.`
    : (quickAddRoleLabel ? `New member will be tagged as ${quickAddRoleLabel}.` : 'Provide first and last name.');

  const quickAddName = document.createElement('input');
  quickAddName.type = 'text';
  quickAddName.className = 'input';
  quickAddName.placeholder = 'First Last';
  quickAddName.style.width = '100%';
  quickAddName.style.marginBottom = '8px';

  const quickAddGender = document.createElement('select');
  quickAddGender.className = 'input';
  quickAddGender.style.width = '100%';
  quickAddGender.style.marginBottom = '8px';
  quickAddGender.innerHTML = `
    <option value="">Select gender</option>
    <option value="male">Male</option>
    <option value="female">Female</option>
  `;
  quickAddGender.style.display = hasRequiredGender ? 'none' : 'block';

  const quickAddActions = document.createElement('div');
  quickAddActions.style.display = 'flex';
  quickAddActions.style.gap = '8px';
  quickAddActions.style.justifyContent = 'flex-end';

  const quickAddCancel = document.createElement('button');
  quickAddCancel.type = 'button';
  quickAddCancel.className = 'btn';
  quickAddCancel.textContent = 'Cancel';

  const quickAddSave = document.createElement('button');
  quickAddSave.type = 'button';
  quickAddSave.className = 'btn';
  quickAddSave.textContent = 'Add Member';

  quickAddActions.appendChild(quickAddCancel);
  quickAddActions.appendChild(quickAddSave);
  quickAddForm.appendChild(quickAddHint);
  quickAddForm.appendChild(quickAddName);
  quickAddForm.appendChild(quickAddGender);
  quickAddForm.appendChild(quickAddActions);
  quickAddWrap.appendChild(quickAddToggle);
  quickAddWrap.appendChild(quickAddForm);

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

  function upsertOption(option) {
    if (!option?._id) {
      return;
    }

    const index = optionList.findIndex(existing => existing._id === option._id);
    if (index >= 0) {
      optionList[index] = option;
    } else {
      optionList.push(option);
    }

    optionList.sort((a, b) => {
      const lastCompare = String(a.lastName || '').localeCompare(String(b.lastName || ''), undefined, { sensitivity: 'base' });
      if (lastCompare !== 0) {
        return lastCompare;
      }
      return String(a.firstName || '').localeCompare(String(b.firstName || ''), undefined, { sensitivity: 'base' });
    });
  }

  search.addEventListener('input', renderRows);

  root.appendChild(search);
  root.appendChild(selectedInfo);
  root.appendChild(list);
  if (allowQuickAdd && typeof onQuickAdd === 'function') {
    root.appendChild(quickAddWrap);
  }

  container.innerHTML = '';
  container.appendChild(root);

  updateSelectedLabel();
  renderRows();

  quickAddToggle.addEventListener('click', () => {
    const open = quickAddForm.style.display !== 'none';
    quickAddForm.style.display = open ? 'none' : 'block';
    if (!open) {
      quickAddName.focus();
    }
  });

  quickAddCancel.addEventListener('click', () => {
    quickAddForm.style.display = 'none';
    quickAddName.value = '';
    quickAddGender.value = '';
  });

  quickAddSave.addEventListener('click', async () => {
    if (!allowQuickAdd || typeof onQuickAdd !== 'function') {
      return;
    }

    const fullName = String(quickAddName.value || '').trim();
    if (!fullName) {
      return;
    }

    const selectedGender = hasRequiredGender ? normalizedRequiredGender : String(quickAddGender.value || '').trim().toLowerCase();
    if (!selectedGender) {
      return;
    }

    quickAddSave.disabled = true;
    quickAddSave.textContent = 'Adding...';
    try {
      const created = await onQuickAdd({ fullName, gender: selectedGender });
      if (created?._id) {
        upsertOption(created);
        if (!multi) {
          normalizedSelected.clear();
        }
        normalizedSelected.add(created._id);
        quickAddName.value = '';
        quickAddGender.value = '';
        quickAddForm.style.display = 'none';
        updateSelectedLabel();
        renderRows();
        if (typeof onChange === 'function') {
          onChange(getSelectedIds());
        }
      }
    } finally {
      quickAddSave.disabled = false;
      quickAddSave.textContent = 'Add Member';
    }
  });

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
    },
    addOption: (option) => {
      upsertOption(option);
      renderRows();
    }
  };
}
