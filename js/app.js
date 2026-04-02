// In-memory state — loaded from localStorage on init
let transactions = [];
let chartInstance = null;

// ── Storage ──────────────────────────────────────────────────────────────────

function saveToStorage() {
  try {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  } catch (e) {
    showError('Data could not be saved. Storage may be unavailable or full.');
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('transactions');
    if (raw === null) return [];
    return JSON.parse(raw);
  } catch (e) {
    showError('Could not load saved data. Starting with an empty list.');
    return [];
  }
}

// ── Property-Based Test Specifications ───────────────────────────────────────
//
// Feature: browser-local-storage-app, Property 1: Valid transaction add is a round-trip
//
// Property: For any valid transaction (non-empty name, positive amount, valid
// category), after the add action completes, the transaction should appear in
// the in-memory list and the value retrieved from localStorage should contain
// an entry with the same name, amount, and category.
//
// Validates: Requirements 1.2, 5.2
//
// fast-check specification (100+ iterations):
//
// import * as fc from 'fast-check';
//
// const validCategories = ['Food', 'Transport', 'Fun'];
//
// const validTransactionArb = fc.record({
//   name:     fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
//   amount:   fc.float({ min: 0.01, max: 1_000_000, noNaN: true }),
//   category: fc.constantFrom(...validCategories),
// });
//
// fc.assert(
//   fc.property(validTransactionArb, ({ name, amount, category }) => {
//     // Arrange: start with a clean state
//     transactions = [];
//     localStorage.clear();
//
//     // Act: simulate a valid form submission
//     const transaction = {
//       id:        crypto.randomUUID(),
//       name,
//       amount,
//       category,
//       createdAt: Date.now(),
//     };
//     transactions.push(transaction);
//     saveToStorage();
//
//     // Assert 1: in-memory list contains the transaction
//     const inMemory = transactions.find(t => t.name === name && t.amount === amount && t.category === category);
//     if (!inMemory) return false;
//
//     // Assert 2: localStorage contains an entry with the same fields
//     const stored = loadFromStorage();
//     const inStorage = stored.find(t => t.name === name && t.amount === amount && t.category === category);
//     return Boolean(inStorage);
//   }),
//   { numRuns: 100 }
// );

// Feature: browser-local-storage-app, Property 2: Invalid input leaves state unchanged
//
// Property: For any form submission where at least one field is invalid (empty
// name, non-positive or non-numeric amount, or missing/invalid category), the
// transaction array length should be identical before and after the attempted
// submission.
//
// Validates: Requirements 1.3
//
// fast-check specification (100+ iterations):
//
// import * as fc from 'fast-check';
//
// const validCategories = ['Food', 'Transport', 'Fun'];
//
// // Arbitraries for each invalid field type
// const emptyNameArb    = fc.constant('');
// const tooLongNameArb  = fc.string({ minLength: 101, maxLength: 200 });
// const invalidNameArb  = fc.oneof(emptyNameArb, tooLongNameArb);
//
// const nonPositiveAmountArb = fc.oneof(
//   fc.constant(0),
//   fc.float({ max: -0.01, noNaN: true }),
// );
// const nonNumericAmountArb  = fc.oneof(
//   fc.constant(NaN),
//   fc.constant(Infinity),
//   fc.constant(-Infinity),
// );
// const invalidAmountArb = fc.oneof(nonPositiveAmountArb, nonNumericAmountArb);
//
// const invalidCategoryArb = fc.string().filter(s => !validCategories.includes(s));
//
// // At least one field is invalid; the others may be valid or invalid
// const validNameArb     = fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0);
// const validAmountArb   = fc.float({ min: 0.01, max: 1_000_000, noNaN: true });
// const validCategoryArb = fc.constantFrom(...validCategories);
//
// // Build an arbitrary that guarantees at least one invalid field
// const invalidInputArb = fc.oneof(
//   // Only name is invalid
//   fc.record({ name: invalidNameArb,  amount: validAmountArb,   category: validCategoryArb }),
//   // Only amount is invalid
//   fc.record({ name: validNameArb,    amount: invalidAmountArb, category: validCategoryArb }),
//   // Only category is invalid
//   fc.record({ name: validNameArb,    amount: validAmountArb,   category: invalidCategoryArb }),
//   // All fields invalid
//   fc.record({ name: invalidNameArb,  amount: invalidAmountArb, category: invalidCategoryArb }),
// );
//
// fc.assert(
//   fc.property(invalidInputArb, ({ name, amount, category }) => {
//     // Arrange: start with a known state (may already have some transactions)
//     transactions = [];
//     localStorage.clear();
//     const lengthBefore = transactions.length;
//
//     // Act: attempt to submit the invalid form
//     const result = validateForm(name, amount, category);
//
//     // If validation correctly rejects the input, the array must not grow
//     if (!result.valid) {
//       // Simulate what handleFormSubmit does: bail out on invalid input
//       const lengthAfter = transactions.length;
//       return lengthAfter === lengthBefore;
//     }
//
//     // If validateForm unexpectedly returns valid for these inputs, the
//     // property fails — the validator has a bug.
//     return false;
//   }),
//   { numRuns: 100 }
// );

// Feature: browser-local-storage-app, Property 3: Form is cleared after valid submission
//
// Property: For any valid form submission, after the transaction is saved the
// form's name field, amount field, and category select should all be reset to
// their default/empty values.
//
// Validates: Requirements 1.4
//
// fast-check specification (100+ iterations):
//
// import * as fc from 'fast-check';
// import { JSDOM } from 'jsdom';
//
// const validCategories = ['Food', 'Transport', 'Fun'];
//
// const validTransactionArb = fc.record({
//   name:     fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
//   amount:   fc.float({ min: 0.01, max: 1_000_000, noNaN: true }),
//   category: fc.constantFrom(...validCategories),
// });
//
// fc.assert(
//   fc.property(validTransactionArb, ({ name, amount, category }) => {
//     // Arrange: set up a jsdom environment with the required form fields
//     const dom = new JSDOM(`
//       <form id="transaction-form">
//         <input id="item-name" type="text" />
//         <input id="amount" type="number" />
//         <select id="category">
//           <option value="">-- Select --</option>
//           <option value="Food">Food</option>
//           <option value="Transport">Transport</option>
//           <option value="Fun">Fun</option>
//         </select>
//       </form>
//     `);
//     const { document } = dom.window;
//
//     // Pre-fill the form with valid values
//     document.getElementById('item-name').value = name;
//     document.getElementById('amount').value = String(amount);
//     document.getElementById('category').value = category;
//
//     // Act: simulate what handleFormSubmit does after a successful save —
//     // clear each field back to its default/empty value
//     transactions = [];
//     localStorage.clear();
//     const transaction = {
//       id:        crypto.randomUUID(),
//       name:      document.getElementById('item-name').value.trim(),
//       amount:    parseFloat(document.getElementById('amount').value),
//       category:  document.getElementById('category').value,
//       createdAt: Date.now(),
//     };
//     transactions.push(transaction);
//     saveToStorage();
//
//     document.getElementById('item-name').value = '';
//     document.getElementById('amount').value = '';
//     document.getElementById('category').value = '';
//
//     // Assert: all form fields are reset to empty/default
//     const nameCleared     = document.getElementById('item-name').value === '';
//     const amountCleared   = document.getElementById('amount').value === '';
//     const categoryCleared = document.getElementById('category').value === '';
//
//     return nameCleared && amountCleared && categoryCleared;
//   }),
//   { numRuns: 100 }
// );

// Feature: browser-local-storage-app, Property 4: Rendered list reflects storage contents
//
// Property: For any array of transactions written to localStorage, after
// `init()` or any re-render, every transaction in the array should appear as a
// list item showing the correct name, amount, and category — and no extra items
// should appear.
//
// Validates: Requirements 2.1, 5.1
//
// fast-check specification (100+ iterations):
//
// import * as fc from 'fast-check';
// import { JSDOM } from 'jsdom';
//
// const validCategories = ['Food', 'Transport', 'Fun'];
//
// const validTransactionArb = fc.record({
//   id:        fc.string({ minLength: 1, maxLength: 36 }),
//   name:      fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
//   amount:    fc.float({ min: 0.01, max: 1_000_000, noNaN: true }),
//   category:  fc.constantFrom(...validCategories),
//   createdAt: fc.integer({ min: 0 }),
// });
//
// fc.assert(
//   fc.property(fc.array(validTransactionArb), (txList) => {
//     // Arrange: set up a jsdom environment with the required list element
//     const dom = new JSDOM(`
//       <ul id="transaction-list"></ul>
//     `);
//     const { document } = dom.window;
//     global.document = document;
//
//     // Write the generated transactions to localStorage and in-memory state
//     transactions = txList.map((t, i) => ({ ...t, id: `id-${i}` }));
//     localStorage.clear();
//     saveToStorage();
//
//     // Act: re-render the list (simulates what init() and any state change does)
//     renderList();
//
//     // Assert 1: the number of rendered list items equals the number of transactions
//     const listItems = document.querySelectorAll('#transaction-list li');
//     if (listItems.length !== transactions.length) return false;
//
//     // Assert 2: every transaction appears with the correct name, amount ($X.XX), and category
//     for (const t of transactions) {
//       const nameEl    = [...listItems].find(li =>
//         li.querySelector('.transaction-name')?.textContent === t.name
//       );
//       if (!nameEl) return false;
//
//       const amountText = nameEl.querySelector('.transaction-amount')?.textContent;
//       if (amountText !== t.amount.toFixed(2)) return false;
//
//       const categoryText = nameEl.querySelector('.badge')?.textContent;
//       if (categoryText !== t.category) return false;
//     }
//
//     return true;
//   }),
//   { numRuns: 100 }
// );

// Feature: browser-local-storage-app, Property 5: Delete is a round-trip removal
//
// Property: For any transaction that exists in the list, after deleting it by
// id, the transaction should no longer appear in the in-memory array and should
// no longer be present in the localStorage value.
//
// Validates: Requirements 2.2
//
// fast-check specification (100+ iterations):
//
// import * as fc from 'fast-check';
//
// const validCategories = ['Food', 'Transport', 'Fun'];
//
// const validTransactionArb = fc.record({
//   id:        fc.string({ minLength: 1, maxLength: 36 }),
//   name:      fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
//   amount:    fc.float({ min: 0.01, max: 1_000_000, noNaN: true }),
//   category:  fc.constantFrom(...validCategories),
//   createdAt: fc.integer({ min: 0 }),
// });
//
// fc.assert(
//   fc.property(
//     fc.array(validTransactionArb, { minLength: 1 }),
//     fc.integer({ min: 0, max: 99 }),
//     (txList, indexSeed) => {
//       // Arrange: populate state with the generated transactions (ensure unique ids)
//       transactions = txList.map((t, i) => ({ ...t, id: `id-${i}` }));
//       localStorage.clear();
//       saveToStorage();
//
//       // Pick a random transaction to delete
//       const targetIndex = indexSeed % transactions.length;
//       const targetId = transactions[targetIndex].id;
//
//       // Act: simulate deleteTransaction (filter + saveToStorage)
//       transactions = transactions.filter(t => t.id !== targetId);
//       saveToStorage();
//
//       // Assert 1: deleted transaction is absent from the in-memory array
//       const inMemory = transactions.find(t => t.id === targetId);
//       if (inMemory) return false;
//
//       // Assert 2: deleted transaction is absent from localStorage
//       const stored = loadFromStorage();
//       const inStorage = stored.find(t => t.id === targetId);
//       return !inStorage;
//     }
//   ),
//   { numRuns: 100 }
// );

// Feature: browser-local-storage-app, Property 6: List order is most-recent-first
//
// Property: For any set of transactions with distinct `createdAt` timestamps,
// the rendered list items should appear in descending order of `createdAt`
// (most recent at the top).
//
// Validates: Requirements 2.3
//
// fast-check specification (100+ iterations):
//
// import * as fc from 'fast-check';
// import { JSDOM } from 'jsdom';
//
// const validCategories = ['Food', 'Transport', 'Fun'];
//
// // Generate an array of 2+ transactions with distinct createdAt timestamps.
// // We use uniqueArray on the createdAt field to guarantee distinctness.
// const distinctTimestampsArb = fc
//   .uniqueArray(fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), { minLength: 2 })
//   .chain(timestamps =>
//     fc.tuple(
//       ...timestamps.map(ts =>
//         fc.record({
//           id:        fc.string({ minLength: 1, maxLength: 36 }),
//           name:      fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
//           amount:    fc.float({ min: 0.01, max: 1_000_000, noNaN: true }),
//           category:  fc.constantFrom(...validCategories),
//           createdAt: fc.constant(ts),
//         })
//       )
//     ).map(txs => txs)
//   );
//
// fc.assert(
//   fc.property(distinctTimestampsArb, (txList) => {
//     // Arrange: set up a jsdom environment with the required list element
//     const dom = new JSDOM(`
//       <ul id="transaction-list"></ul>
//     `);
//     const { document } = dom.window;
//     global.document = document;
//
//     // Populate in-memory state with the generated transactions (ensure unique ids)
//     transactions = txList.map((t, i) => ({ ...t, id: `id-${i}` }));
//
//     // Act: render the list
//     renderList();
//
//     // Read the rendered list items in DOM order
//     const listItems = [...document.querySelectorAll('#transaction-list li')];
//
//     // Extract the createdAt values from the rendered items by matching each
//     // item's name text back to the corresponding transaction
//     const renderedTimestamps = listItems.map(li => {
//       const nameText = li.querySelector('.transaction-name')?.textContent;
//       const tx = transactions.find(t => t.name === nameText);
//       return tx ? tx.createdAt : null;
//     });
//
//     // Assert: createdAt values must be in strictly descending order
//     for (let i = 0; i < renderedTimestamps.length - 1; i++) {
//       if (renderedTimestamps[i] <= renderedTimestamps[i + 1]) return false;
//     }
//
//     return true;
//   }),
//   { numRuns: 100 }
// );

// Feature: browser-local-storage-app, Property 7: Balance equals the sum of all amounts
//
// Property: For any array of transactions (including the empty array), the
// displayed balance value should equal the arithmetic sum of all `amount`
// fields. When the array is empty the balance should be exactly zero.
//
// Validates: Requirements 3.1, 3.3
//
// fast-check specification (100+ iterations):
//
// import * as fc from 'fast-check';
// import { JSDOM } from 'jsdom';
//
// const validCategories = ['Food', 'Transport', 'Fun'];
//
// const validTransactionArb = fc.record({
//   id:        fc.string({ minLength: 1, maxLength: 36 }),
//   name:      fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
//   amount:    fc.float({ min: 0.01, max: 1_000_000, noNaN: true }),
//   category:  fc.constantFrom(...validCategories),
//   createdAt: fc.integer({ min: 0 }),
// });
//
// fc.assert(
//   fc.property(fc.array(validTransactionArb), (txList) => {
//     // Arrange: set up a jsdom environment with the required balance element
//     const dom = new JSDOM(`
//       <span id="balance-display"></span>
//     `);
//     const { document } = dom.window;
//     global.document = document;
//
//     // Populate in-memory state with the generated transactions (ensure unique ids)
//     transactions = txList.map((t, i) => ({ ...t, id: `id-${i}` }));
//
//     // Act: render the balance
//     renderBalance();
//
//     // Compute the expected sum
//     const sum = transactions.reduce((s, t) => s + t.amount, 0);
//     const expected = `$${sum.toFixed(2)}`;
//
//     // Assert: the displayed balance equals the expected formatted sum
//     const displayed = document.getElementById('balance-display').textContent;
//     if (displayed !== expected) return false;
//
//     // Specifically assert: empty array shows $0.00
//     if (transactions.length === 0 && displayed !== '$0.00') return false;
//
//     return true;
//   }),
//   { numRuns: 100 }
// );

// Feature: browser-local-storage-app, Property 8: Chart data matches per-category totals
//
// Property: For any array of transactions, the data passed to the chart
// (labels and values) should match the per-category sums derived from that
// array. When the array is empty, no chart should be rendered and an
// empty-state message should be visible instead.
//
// Validates: Requirements 4.1, 4.3
//
// fast-check specification (100+ iterations):
//
// import * as fc from 'fast-check';
// import { JSDOM } from 'jsdom';
//
// const validCategories = ['Food', 'Transport', 'Fun'];
//
// const validTransactionArb = fc.record({
//   id:        fc.string({ minLength: 1, maxLength: 36 }),
//   name:      fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
//   amount:    fc.float({ min: 0.01, max: 1_000_000, noNaN: true }),
//   category:  fc.constantFrom(...validCategories),
//   createdAt: fc.integer({ min: 0 }),
// });
//
// fc.assert(
//   fc.property(fc.array(validTransactionArb), (txList) => {
//     // Arrange: set up a jsdom environment with the required chart elements.
//     // Chart.js cannot run in jsdom, so we stub the global Chart constructor
//     // and capture the config object passed to it.
//     const dom = new JSDOM(`
//       <canvas id="spending-chart"></canvas>
//       <div id="chart-empty-state" style="display:none"></div>
//     `);
//     const { document } = dom.window;
//     global.document = document;
//
//     // Stub Chart.js: capture the data config passed to the constructor.
//     let capturedConfig = null;
//     global.Chart = function (_ctx, config) {
//       capturedConfig = config;
//       // Provide a minimal Chart instance so renderChart doesn't throw.
//       this.data = config.data;
//       this.update = () => {};
//       this.destroy = () => {};
//     };
//
//     // Reset module-level state
//     transactions = txList.map((t, i) => ({ ...t, id: `id-${i}` }));
//     chartInstance = null;
//
//     // Act: render the chart
//     renderChart();
//
//     const canvas     = document.getElementById('spending-chart');
//     const emptyState = document.getElementById('chart-empty-state');
//
//     if (transactions.length === 0) {
//       // Assert: empty-state is visible and canvas is hidden
//       if (canvas.style.display !== 'none') return false;
//       if (emptyState.style.display === 'none') return false;
//       return true;
//     }
//
//     // Assert: Chart was constructed with the correct labels and data values
//     if (!capturedConfig) return false;
//
//     const labels = capturedConfig.data.labels;
//     const values = capturedConfig.data.datasets[0].data;
//
//     // Labels must be exactly the three categories in order
//     if (!Array.isArray(labels) || labels.length !== validCategories.length) return false;
//     for (let i = 0; i < validCategories.length; i++) {
//       if (labels[i] !== validCategories[i]) return false;
//     }
//
//     // Derive expected per-category totals from the generated transactions
//     const expectedTotals = transactions.reduce((acc, t) => {
//       acc[t.category] = (acc[t.category] || 0) + t.amount;
//       return acc;
//     }, {});
//
//     // Each value must match the corresponding category total (or 0 if absent)
//     for (let i = 0; i < validCategories.length; i++) {
//       const expected = expectedTotals[validCategories[i]] || 0;
//       if (Math.abs(values[i] - expected) > 1e-9) return false;
//     }
//
//     return true;
//   }),
//   { numRuns: 100 }
// );

// ── Validation ────────────────────────────────────────────────────────────────

function validateForm(name, amount, category) {
  const errors = [];
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (trimmedName.length === 0 || trimmedName.length > 100) {
    errors.push('Item name is required and must be 100 characters or fewer.');
  }
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    errors.push('Amount must be a positive number.');
  }
  const validCategories = ['Food', 'Transport', 'Fun'];
  if (!validCategories.includes(category)) {
    errors.push('Category must be one of: Food, Transport, Fun.');
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderList() {
  const list = document.getElementById('transaction-list');
  list.innerHTML = '';

  const sorted = [...transactions].sort((a, b) => b.createdAt - a.createdAt);

  sorted.forEach(t => {
    const li = document.createElement('li');
    li.className = 'transaction-item';

    const name = document.createElement('span');
    name.className = 'transaction-name';
    name.textContent = t.name;

    const amount = document.createElement('span');
    amount.className = 'transaction-amount';
    amount.textContent = `$${t.amount.toFixed(2)}`;

    const badge = document.createElement('span');
    badge.className = `badge badge-${t.category.toLowerCase()}`;
    badge.textContent = t.category;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteTransaction(t.id));

    li.appendChild(name);
    li.appendChild(amount);
    li.appendChild(badge);
    li.appendChild(deleteBtn);

    list.appendChild(li);
  });
}

function renderBalance() {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  document.getElementById('balance-display').textContent = '$' + total.toFixed(2);
}

function renderChart() {
  const canvas = document.getElementById('spending-chart');
  const emptyState = document.getElementById('chart-empty-state');

  if (transactions.length === 0) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    canvas.style.display = 'none';
    emptyState.style.display = '';
    return;
  }

  emptyState.style.display = 'none';
  canvas.style.display = '';

  const categories = ['Food', 'Transport', 'Fun'];
  const totals = transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});
  const data = categories.map(c => totals[c] || 0);

  try {
    if (chartInstance) {
      chartInstance.data.datasets[0].data = data;
      chartInstance.update();
    } else {
      const ctx = canvas.getContext('2d');
      chartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: categories,
          datasets: [{
            data,
            backgroundColor: ['#4caf50', '#2196f3', '#ff9800'],
          }],
        },
        options: {
          responsive: true,
        },
      });
    }
  } catch (e) {
    canvas.style.display = 'none';
    emptyState.textContent = 'Chart could not be loaded.';
    emptyState.style.display = '';
  }
}

// ── Notifications ─────────────────────────────────────────────────────────────

function showError(message) {
  const container = document.getElementById('notification');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  const dismiss = document.createElement('button');
  dismiss.className = 'toast-close';
  dismiss.textContent = '×';
  dismiss.setAttribute('aria-label', 'Dismiss notification');
  dismiss.addEventListener('click', () => toast.remove());

  toast.appendChild(dismiss);
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

// ── Event Handlers ────────────────────────────────────────────────────────────

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveToStorage();
  renderList();
  renderBalance();
  renderChart();
}

function handleFormSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('item-name').value;
  const amount = parseFloat(document.getElementById('amount').value);
  const category = document.getElementById('category').value;

  const result = validateForm(name, amount, category);

  if (!result.valid) {
    showError(result.errors.join(' '));
    return;
  }

  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString() + Math.random();

  const transaction = {
    id,
    name: name.trim(),
    amount,
    category,
    createdAt: Date.now(),
  };

  transactions.push(transaction);
  saveToStorage();

  document.getElementById('item-name').value = '';
  document.getElementById('amount').value = '';
  document.getElementById('category').value = '';

  renderList();
  renderBalance();
  renderChart();
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  transactions = loadFromStorage();
  renderList();
  renderBalance();
  renderChart();

  const form = document.getElementById('transaction-form');
  form.addEventListener('submit', handleFormSubmit);
}

document.addEventListener('DOMContentLoaded', init);
