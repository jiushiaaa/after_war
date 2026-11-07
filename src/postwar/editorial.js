/* MPL-2.0 — Presentation only. Never rewrites state, exports or replay records. */
var CivilEditorial = {
  prepare() {
    if (this.entries) return;
    const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    this.exact = new Map();
    this.cache = new Map();
    this.entries = CivilEditorialText.map(entry => {
      const {source, text} = entry;
      if (source.length === 1) this.exact.set(source[0], text[0]);
      const anchor = source.reduce((a, b) => a.length > b.length ? a : b, '');
      const pattern = (source[0] ? '' : '^') + source.map(escape).join('([\\s\\S]*?)') + (source.at(-1) ? '' : '$');
      return {source, text, anchor, weight:source.join('').length, pattern:new RegExp(pattern, 'g')};
    }).sort((a, b) => b.weight - a.weight);
  },
  format(value) {
    if (typeof value !== 'string' || !value) return value;
    this.prepare();
    if (this.exact.has(value)) return this.exact.get(value);
    if (this.cache.has(value)) return this.cache.get(value);
    const matches = [];
    for (const entry of this.entries) {
      if (!value.includes(entry.anchor) || (entry.source.length === 1 && entry.weight < 8)) continue;
      entry.pattern.lastIndex = 0;
      let match;
      while ((match = entry.pattern.exec(value))) {
        if (!match[0].length) break;
        const start = match.index, end = start + match[0].length;
        if (matches.some(m => start < m.end && end > m.start)) continue;
        const text = entry.text.map((part, i) => part + (i < entry.text.length - 1 ? match[i + 1] : '')).join('');
        matches.push({start, end, text});
      }
    }
    let output = value;
    for (const m of matches.sort((a, b) => b.start - a.start)) output = output.slice(0, m.start) + m.text + output.slice(m.end);
    // Bound memory during long-running games; never feed rewritten text back into the matcher.
    if (this.cache.size >= 512) this.cache.clear();
    this.cache.set(value, output);
    return output;
  },
  install() {
    if (typeof $ === 'undefined' || !$.fn?.text || $.fn.text.civilEditorial) return;
    const original = $.fn.text, format = value => this.format(value);
    const text = function(value) {
      if (!arguments.length || typeof value !== 'string') return original.apply(this, arguments);
      return this.each(function() {
        // Native save payloads, editable fields and literal/code blocks are never translated.
        const literal = this.closest?.('textarea,input,pre,code,script,style,[contenteditable="true"]');
        original.call($(this), literal ? value : format(value));
      });
    };
    text.civilEditorial = true;
    $.fn.text = text;
    const attr = $.fn.attr, readable = key => key === 'title' || key === 'aria-label';
    if (attr) $.fn.attr = function(name, value) {
      if (typeof name === 'string' && readable(name) && typeof value === 'string') return attr.call(this, name, format(value));
      if (name && typeof name === 'object') {
        const values = {...name};
        for (const key of Object.keys(values)) if (readable(key) && typeof values[key] === 'string') values[key] = format(values[key]);
        return attr.call(this, values);
      }
      return attr.apply(this, arguments);
    };
  }
};
