const codeBlocks = document.querySelectorAll('pre:has(code)');

codeBlocks.forEach((pre) => {
  // Button icon
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '/copy.svg#empty');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('copy-svg');
  svg.appendChild(use);

  // Create button
  const btn = document.createElement('button');
  btn.appendChild(svg);
  btn.classList.add('copy-btn');
  btn.addEventListener('click', (e) => copyCode(e));

  // Wrap pre in a relative container so the button sits outside
  // the pre's overflow context and never gets clipped
  const wrapper = document.createElement('div');
  wrapper.classList.add('copy-wrapper');
  pre.parentNode.insertBefore(wrapper, pre);
  wrapper.appendChild(pre);
  wrapper.appendChild(btn);
});

/**
 * @param {MouseEvent} event
 */
function copyCode(event) {
  const pre = event.currentTarget.parentElement.querySelector('pre');
  const code = pre ? pre.querySelector('code') : null;
  if (!code) return;
  navigator.clipboard.writeText(code.innerText);
  const use = event.currentTarget.querySelector('use');
  if (!use) return;
  use.setAttribute('href', '/copy.svg#filled');
  setTimeout(() => use.setAttribute('href', '/copy.svg#empty'), 1500);
}
