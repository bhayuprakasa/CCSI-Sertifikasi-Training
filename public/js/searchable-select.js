/**
 * SearchableSelect
 * Converts <select data-searchable> elements into searchable dropdowns.
 * - Works with dynamically populated options (MutationObserver).
 * - Intercepts .value and .disabled property assignments so external JS stays in sync.
 * - Fires native "change" event on the hidden <select> so onchange handlers still work.
 *
 * Usage:
 *   1. Add data-searchable attribute to <select> elements.
 *   2. Call SearchableSelect.initAll() after DOM ready (or after dynamic content loads).
 *   3. To init a single element: SearchableSelect.init(el) or SearchableSelect.init('#myId').
 */
(function () {
  // --- CSS injected once ---
  const STYLE = `
.ss-wrapper{position:relative;display:block}
.ss-trigger{
  display:flex;align-items:center;justify-content:space-between;
  padding:7px 10px;border:1px solid var(--border,#dde3ec);border-radius:7px;
  font-size:.83rem;font-family:inherit;color:var(--text,#1e293b);
  background:var(--surface,#fff);cursor:pointer;user-select:none;
  min-height:33px;transition:border-color .15s;gap:6px;
}
.ss-trigger:hover,.ss-trigger.ss-open{border-color:var(--navy-lt,#2a5298)}
.ss-trigger.ss-disabled{
  background:#f8fafd;color:var(--text3,#94a3b8);
  cursor:not-allowed;pointer-events:none;opacity:.7;
}
.ss-trigger-text{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-trigger-arrow{font-size:.6rem;color:var(--text3,#94a3b8);flex-shrink:0;transition:transform .15s}
.ss-trigger.ss-open .ss-trigger-arrow{transform:rotate(180deg)}
.ss-dropdown{
  position:absolute;top:calc(100% + 3px);left:0;right:0;min-width:180px;
  background:var(--surface,#fff);border:1px solid var(--border,#dde3ec);
  border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.13);
  z-index:9999;display:none;overflow:hidden;
}
.ss-dropdown.ss-open{display:block}
.ss-search-wrap{padding:7px 8px;border-bottom:1px solid var(--border,#dde3ec)}
.ss-search{
  width:100%;padding:5px 9px;border:1px solid var(--border,#dde3ec);
  border-radius:5px;font-size:.8rem;font-family:inherit;
  color:var(--text,#1e293b);outline:none;box-sizing:border-box;
}
.ss-search:focus{border-color:var(--navy-lt,#2a5298)}
.ss-list{max-height:220px;overflow-y:auto}
.ss-opt{
  padding:7px 10px;font-size:.83rem;cursor:pointer;
  border-bottom:1px solid #f0f3f6;color:var(--text,#1e293b);
  transition:background .1s;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;
}
.ss-opt:last-child{border-bottom:none}
.ss-opt:hover{background:#f8fafd}
.ss-opt.ss-sel{background:#e8eef7;color:var(--navy,#1a3c6e);font-weight:600}
.ss-opt[data-val=""]{color:var(--text3,#94a3b8);font-style:italic}
.ss-opt.ss-hide{display:none}
.ss-nores{
  padding:10px;text-align:center;font-size:.78rem;
  color:var(--text3,#94a3b8);font-style:italic;
}`;

  if (!document.getElementById('ss-style')) {
    const s = document.createElement('style');
    s.id = 'ss-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  // Shared value descriptor from prototype — used to intercept .value setter
  const valueDesc   = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const disabledDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'disabled');

  class SS {
    constructor(el) {
      this.el = el;
      this._obs = null;
      this._build();
      this._interceptProps();
      this._observe();
    }

    _build() {
      const el = this.el;
      el.style.display = 'none'; // hide native select; keep in DOM for value + event

      // Wrapper replaces the select's visual slot
      const wrap = document.createElement('div');
      wrap.className = 'ss-wrapper';
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el); // move select inside wrapper
      this._wrap = wrap;

      // Trigger (the clickable "button" that shows current value)
      const trigger = document.createElement('div');
      trigger.className = 'ss-trigger' + (el.disabled ? ' ss-disabled' : '');
      trigger.tabIndex = el.disabled ? -1 : 0;
      trigger.setAttribute('role', 'combobox');
      trigger.setAttribute('aria-haspopup', 'listbox');
      const trigText = document.createElement('span');
      trigText.className = 'ss-trigger-text';
      const arrow = document.createElement('span');
      arrow.className = 'ss-trigger-arrow';
      arrow.textContent = '▾';
      trigger.appendChild(trigText);
      trigger.appendChild(arrow);
      wrap.insertBefore(trigger, el);
      this._trigger = trigger;
      this._trigText = trigText;

      // Dropdown panel
      const drop = document.createElement('div');
      drop.className = 'ss-dropdown';
      const sw = document.createElement('div');
      sw.className = 'ss-search-wrap';
      const search = document.createElement('input');
      search.type = 'text';
      search.className = 'ss-search';
      search.placeholder = 'Cari...';
      search.setAttribute('autocomplete', 'off');
      sw.appendChild(search);
      const list = document.createElement('div');
      list.className = 'ss-list';
      list.setAttribute('role', 'listbox');
      drop.appendChild(sw);
      drop.appendChild(list);
      wrap.appendChild(drop);
      this._drop = drop;
      this._search = search;
      this._list = list;

      // --- Event wiring ---
      trigger.addEventListener('click', () => this._toggle());
      trigger.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._toggle(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); this._open(); }
        if (e.key === 'Escape') this._close();
      });
      search.addEventListener('input', () => this._filter(search.value));
      search.addEventListener('keydown', e => {
        if (e.key === 'Escape') this._close();
        if (e.key === 'Enter') {
          // Select first visible option
          const first = this._list.querySelector('.ss-opt:not(.ss-hide)');
          if (first) first.click();
        }
      });
      // Close when clicking outside this component
      document.addEventListener('click', e => {
        if (!wrap.contains(e.target)) this._close();
      }, true);

      this._sync();
    }

    // Intercept .value and .disabled assignments so external JS (prReset, etc.) keeps UI in sync
    _interceptProps() {
      const self = this;
      const el = this.el;

      Object.defineProperty(el, 'value', {
        get() { return valueDesc.get.call(el); },
        set(v) {
          valueDesc.set.call(el, v);
          self._syncUI(); // only update trigger text + selected highlight
        },
        configurable: true
      });

      Object.defineProperty(el, 'disabled', {
        get() { return disabledDesc.get.call(el); },
        set(v) {
          disabledDesc.set.call(el, v);
          self._syncDisabled();
        },
        configurable: true
      });
    }

    // MutationObserver: rebuilds option list when children (options) or attributes change
    _observe() {
      this._obs = new MutationObserver(muts => {
        // Proses SEMUA mutation dulu sebelum bertindak.
        // Jangan break lebih awal: saat disabled dan innerHTML diubah berdekatan,
        // browser membatch keduanya — break pada handler 'attributes' akan memotong
        // loop sebelum 'childList' diproses sehingga _sync() tidak pernah dipanggil.
        let needSync = false;
        let needDisabledSync = false;
        for (const m of muts) {
          if (m.type === 'childList') needSync = true;
          else if (m.type === 'attributes' && m.attributeName === 'disabled') needDisabledSync = true;
        }
        if (needDisabledSync) this._syncDisabled();
        if (needSync) this._sync();
      });
      this._obs.observe(this.el, {
        childList: true, subtree: true,
        attributes: true, attributeFilter: ['disabled']
      });
    }

    // Rebuild entire option list from <select> options
    _sync() {
      const el = this.el;
      const list = this._list;
      const curVal = valueDesc.get.call(el);
      list.innerHTML = '';
      let selectedText = '';

      el.querySelectorAll('option').forEach(opt => {
        const item = document.createElement('div');
        item.className = 'ss-opt' + (opt.value === curVal ? ' ss-sel' : '');
        item.dataset.val = opt.value;
        item.textContent = opt.textContent.trim();
        item.title = item.textContent;
        item.addEventListener('click', () => this._choose(opt.value, item.textContent));
        list.appendChild(item);
        if (opt.value === curVal) selectedText = item.textContent;
      });

      this._updateTriggerText(curVal, selectedText, el);
      this._syncDisabled();
    }

    // Update trigger text without rebuilding list
    _syncUI() {
      const el = this.el;
      const curVal = valueDesc.get.call(el);
      let selectedText = '';
      this._list.querySelectorAll('.ss-opt').forEach(item => {
        const isSel = item.dataset.val === curVal;
        item.classList.toggle('ss-sel', isSel);
        if (isSel) selectedText = item.textContent;
      });
      this._updateTriggerText(curVal, selectedText, el);
    }

    _updateTriggerText(val, text, el) {
      const placeholder = el.options[0]?.textContent?.trim() || '-- Pilih --';
      this._trigText.textContent = (val && text) ? text : placeholder;
      this._trigText.style.color = (val && text) ? '' : 'var(--text3,#94a3b8)';
    }

    _syncDisabled() {
      const dis = this.el.disabled;
      this._trigger.classList.toggle('ss-disabled', dis);
      this._trigger.tabIndex = dis ? -1 : 0;
      if (dis) this._close();
    }

    // Filter visible options by search query
    _filter(q) {
      const query = q.toLowerCase().trim();
      let visible = 0;
      this._list.querySelectorAll('.ss-opt').forEach(item => {
        const match = !query || item.textContent.toLowerCase().includes(query);
        item.classList.toggle('ss-hide', !match);
        if (match) visible++;
      });
      let noRes = this._list.querySelector('.ss-nores');
      if (!visible) {
        if (!noRes) {
          noRes = document.createElement('div');
          noRes.className = 'ss-nores';
          noRes.textContent = 'Tidak ada hasil';
          this._list.appendChild(noRes);
        }
      } else {
        noRes?.remove();
      }
    }

    // User picks an option
    _choose(value, text) {
      valueDesc.set.call(this.el, value);
      this._updateTriggerText(value, text, this.el);
      this._list.querySelectorAll('.ss-opt').forEach(item => {
        item.classList.toggle('ss-sel', item.dataset.val === value);
      });
      // Fire native change event so onchange="..." handlers still work
      this.el.dispatchEvent(new Event('change', { bubbles: true }));
      this._close();
    }

    _toggle() {
      if (this.el.disabled) return;
      this._drop.classList.contains('ss-open') ? this._close() : this._open();
    }

    _open() {
      if (this.el.disabled) return;
      // Close any other open SS dropdowns first
      document.querySelectorAll('.ss-dropdown.ss-open').forEach(d => {
        if (d !== this._drop) d.classList.remove('ss-open');
      });
      document.querySelectorAll('.ss-trigger.ss-open').forEach(t => {
        if (t !== this._trigger) t.classList.remove('ss-open');
      });
      this._drop.classList.add('ss-open');
      this._trigger.classList.add('ss-open');
      this._search.value = '';
      this._filter(''); // reset filter
      // Scroll selected item into view
      const sel = this._list.querySelector('.ss-sel');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
      setTimeout(() => this._search.focus(), 50);
    }

    _close() {
      this._drop.classList.remove('ss-open');
      this._trigger.classList.remove('ss-open');
    }
  }

  /**
   * Init a single select element.
   * @param {HTMLSelectElement|string} selectorOrEl - element or CSS selector
   */
  function init(selectorOrEl) {
    const el = typeof selectorOrEl === 'string'
      ? document.querySelector(selectorOrEl)
      : selectorOrEl;
    if (el && !el._ss) el._ss = new SS(el);
    return el?._ss;
  }

  /**
   * Init all selects with data-searchable attribute inside scope.
   * @param {Document|Element} scope - defaults to document
   */
  function initAll(scope = document) {
    scope.querySelectorAll('select[data-searchable]').forEach(el => {
      if (!el._ss) el._ss = new SS(el);
    });
  }

  window.SearchableSelect = { init, initAll, SS };
})();
