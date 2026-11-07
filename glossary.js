(() => {
  'use strict';
  const data = window.SERPENTS_GLOSSARY;
  const root = document.getElementById('glossary');
  if (!root || !Array.isArray(data)) return;
  const input = document.getElementById('glossary-search');
  const results = document.getElementById('glossary-results');
  const status = document.getElementById('glossary-status');
  const alphabet = document.getElementById('glossary-alphabet');
  const more = document.getElementById('glossary-more');
  const reset = document.getElementById('glossary-reset');
  const normalize = text => text.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[’'“”"]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const byId = new Map(data.map(entry => [entry.id, entry]));
  const byTerm = new Map(data.map(entry => [normalize(entry.term), entry]));
  const searchable = data.map(entry => ({entry, name: normalize(entry.term), text: normalize(entry.term + ' ' + entry.definition)}));
  const chapterStarts = [1, 10, 23, 34, 43, 54, 67, 78, 92, 105, 115, 130, 141, 151, 166];
  const batchSize = 60;
  let letter = 'All', limit = batchSize, selected = null, matches = data;
  const number = n => n.toLocaleString('en-US');

  function chapterFor(page) {
    if (page < 1 || page > 166) return null;
    const index = chapterStarts.findLastIndex(start => start <= page);
    return {id: index === 14 ? 'epilog' : 'ch' + (index + 1), label: index === 14 ? 'Epilog' : 'Chapter ' + (index + 1)};
  }
  function link(text, id, className) {
    const a = document.createElement('a');
    a.href = '#' + id;
    a.textContent = text;
    if (className) a.className = className;
    return a;
  }
  function definition(entry) {
    const p = document.createElement('p');
    const crossReference = entry.definition.match(/^See\s+(.+?)\.?$/i);
    const destination = crossReference && byTerm.get(normalize(crossReference[1]));
    if (destination && destination.id !== entry.id) {
      p.append('See ', link(crossReference[1].replace(/\.$/, ''), destination.id), '.');
      return p;
    }
    // Parenthetical page references retain their wording and open the corresponding guide chapter.
    const references = /\((\d{1,3}(?:\s*[-–]\s*\d{1,3})?(?:\s*,\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?)*)\)/g;
    let offset = 0;
    for (const match of entry.definition.matchAll(references)) {
      p.append(entry.definition.slice(offset, match.index), '(');
      for (const part of match[1].split(/(,\s*)/)) {
        const page = Number(part.match(/^\d+/)?.[0]);
        const end = Number(part.match(/[-–]\s*(\d+)$/)?.[1] || page);
        const chapter = chapterFor(page);
        if (chapter && end <= 166 && end >= page) {
          const a = link(part, chapter.id, 'glossary-page');
          a.title = 'Open ' + chapter.label + ' in the guide (reference: p. ' + part + ')';
          a.setAttribute('aria-label', 'Page ' + part + ': open ' + chapter.label + ' in the guide');
          p.append(a);
        } else p.append(part);
      }
      p.append(')');
      offset = match.index + match[0].length;
    }
    p.append(entry.definition.slice(offset));
    return p;
  }
  function card(entry) {
    const section = document.createElement('section');
    section.className = 'glossary-entry';
    section.id = entry.id;
    section.tabIndex = -1;
    const h3 = document.createElement('h3');
    h3.append(link(entry.term, entry.id));
    const tools = document.createElement('p');
    tools.className = 'glossary-entry-tools';
    const permalink = link('Link to this entry', entry.id);
    permalink.setAttribute('aria-label', 'Link to ' + entry.term);
    tools.append(permalink);
    section.append(h3, definition(entry), tools);
    return section;
  }
  function findMatches() {
    const query = normalize(input.value);
    if (!query) return data.filter(entry => letter === 'All' || entry.letter === letter);
    const tokens = query.split(' ');
    return searchable.filter(item => tokens.every(token => item.text.includes(token)))
      .map(item => ({...item, score: item.name === query ? 0 : item.name.startsWith(query) ? 1 : item.name.includes(query) ? 2 : 3}))
      .sort((a, b) => a.score - b.score)
      .map(item => item.entry);
  }
  function render(append = false) {
    matches = selected ? [byId.get(selected)] : findMatches();
    const start = append ? results.children.length : 0;
    if (!append) results.replaceChildren();
    const fragment = document.createDocumentFragment();
    matches.slice(start, limit).forEach(entry => fragment.append(card(entry)));
    if (!matches.length) {
      const p = document.createElement('p');
      p.className = 'glossary-empty';
      p.textContent = 'No entries found. Try a shorter name, another spelling, or a word from the description.';
      fragment.append(p);
    }
    results.append(fragment);
    const shown = Math.min(limit, matches.length);
    status.textContent = selected ? 'One entry · ' + number(data.length) + ' in the full glossary' :
      (matches.length ? 'Showing ' + number(shown) + ' of ' + number(matches.length) + ' entries' : 'No matching entries') +
      (input.value.trim() ? ' for “' + input.value.trim() + '”' : letter !== 'All' ? ' under ' + letter : '');
    more.hidden = shown >= matches.length;
    more.textContent = 'Show ' + Math.min(batchSize, matches.length - shown) + ' more entries';
    reset.hidden = !selected && letter === 'All' && !input.value;
    alphabet.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(!selected && !input.value && button.dataset.letter === letter)));
  }
  function resetLocation() {
    if (byId.has(decodeHash())) history.replaceState(null, '', '#glossary');
  }
  function decodeHash() {
    try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; }
  }
  function browseAll(focus = false) {
    input.value = ''; letter = 'All'; selected = null; limit = batchSize;
    resetLocation(); render();
    if (focus) input.focus({preventScroll: true});
  }
  ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].forEach(value => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = value; button.dataset.letter = value;
    button.setAttribute('aria-label', value === 'All' ? 'Browse all glossary entries' : 'Browse entries beginning with ' + value);
    button.disabled = value !== 'All' && !data.some(entry => entry.letter === value);
    button.addEventListener('click', () => {
      letter = value; input.value = ''; selected = null; limit = batchSize;
      resetLocation(); render();
    });
    alphabet.append(button);
  });
  input.addEventListener('input', () => {
    letter = 'All'; selected = null; limit = batchSize;
    resetLocation(); render();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); browseAll(true); }
  });
  document.getElementById('glossary-clear').addEventListener('click', () => browseAll(true));
  reset.addEventListener('click', () => browseAll(true));
  more.addEventListener('click', () => {
    const firstNewIndex = results.children.length;
    limit += batchSize; render(true);
    results.children[firstNewIndex]?.focus({preventScroll: true});
  });
  // The guide's existing router calls this before resolving a dynamic entry anchor.
  window.serpentGlossary = {
    has: id => byId.has(id),
    reveal(id) {
      if (!byId.has(id)) return;
      selected = id; input.value = ''; letter = 'All'; limit = batchSize; render();
    }
  };
  render();
})();
