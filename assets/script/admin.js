// ==================== ХРАНИЛИЩЕ (общее с index.html) ====================
const Storage = {
  KEY: 'supportflow_tickets',
  
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch {
      return [];
    }
  },
  
  save(tickets) {
    localStorage.setItem(this.KEY, JSON.stringify(tickets));
  },
  
  update(ticketId, updates) {
    const tickets = this.getAll();
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx !== -1) {
      tickets[idx] = { ...tickets[idx], ...updates, updatedAt: new Date().toISOString() };
      this.save(tickets);
      return tickets[idx];
    }
    return null;
  },
  
  delete(ticketId) {
    const tickets = this.getAll().filter(t => t.id !== ticketId);
    this.save(tickets);
  },
  
  clear() {
    localStorage.removeItem(this.KEY);
  }
};

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentTicket = null;
const PRIORITY_LABELS = { high: '🔴 Высокий', medium: '🟡 Средний', low: '🟢 Низкий' };
const STATUS_LABELS = { 
  open: '🟢 Открыт', 
  in_progress: '🟡 В работе', 
  resolved: '✅ Решён', 
  escalated: '🔁 Эскалирован' 
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function init() {
  renderStats();
  renderTickets();
  console.log('✅ Admin panel loaded');
}

// ==================== СТАТИСТИКА ====================
function renderStats() {
  const tickets = Storage.getAll();
  const stats = {
    total: tickets.length,
    high: tickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length,
    medium: tickets.filter(t => t.priority === 'medium' && t.status !== 'resolved').length,
    low: tickets.filter(t => t.priority === 'low' && t.status !== 'resolved').length
  };
  
  document.getElementById('adminStats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${stats.total}</div><div class="stat-label">Всего</div></div>
    <div class="stat-card high"><div class="stat-value">${stats.high}</div><div class="stat-label">🔴 Высокий</div></div>
    <div class="stat-card medium"><div class="stat-value">${stats.medium}</div><div class="stat-label">🟡 Средний</div></div>
    <div class="stat-card low"><div class="stat-value">${stats.low}</div><div class="stat-label">🟢 Низкий</div></div>
  `;
}

// ==================== ОТРИСОВКА ТАБЛИЦЫ ====================
function renderTickets() {
  const tbody = document.getElementById('ticketsBody');
  const emptyState = document.getElementById('emptyState');
  
  let tickets = Storage.getAll();
  
  // Фильтры
  const priority = document.getElementById('filterPriority')?.value || 'all';
  const status = document.getElementById('filterStatus')?.value || 'all';
  const search = document.getElementById('searchQuery')?.value.toLowerCase() || '';
  
  if (priority !== 'all') tickets = tickets.filter(t => t.priority === priority);
  if (status !== 'all') tickets = tickets.filter(t => t.status === status);
  if (search) {
    tickets = tickets.filter(t => 
      t.message?.toLowerCase().includes(search) ||
      t.userName?.toLowerCase().includes(search) ||
      t.id?.toLowerCase().includes(search)
    );
  }
  
  // Сортировка: новые сверху, затем по приоритету
  const order = { high: 1, medium: 2, low: 3 };
  tickets.sort((a, b) => {
    if (a.status === 'open' && b.status !== 'open') return -1;
    if (b.status === 'open' && a.status !== 'open') return 1;
    return order[a.priority] - order[b.priority];
  });
  
  // Пустое состояние
  if (tickets.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';
  
  // Рендер строк
  tbody.innerHTML = tickets.map(ticket => {
    const time = new Date(ticket.createdAt).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    
    return `
      <tr class="ticket-row">
        <td><strong>${ticket.id}</strong></td>
        <td>${ticket.userName}</td>
        <td>${ticket.type}</td>
        <td><span class="priority priority-${ticket.priority}">${PRIORITY_LABELS[ticket.priority]}</span></td>
        <td><span class="status-badge status-${ticket.status}">${STATUS_LABELS[ticket.status]}</span></td>
        <td><small>${time}</small></td>
        <td>
          <button class="action-btn view" onclick="openModal('${ticket.id}')">👁️</button>
          ${ticket.status !== 'resolved' ? `<button class="action-btn resolve" onclick="quickResolve('${ticket.id}')">✅</button>` : ''}
          ${ticket.priority !== 'high' && ticket.status !== 'escalated' ? `<button class="action-btn escalate" onclick="quickEscalate('${ticket.id}')">🔁</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

// ==================== БЫСТРЫЕ ДЕЙСТВИЯ ====================
function quickResolve(id) {
  if (!confirm('✅ Отметить как решённую?')) return;
  Storage.update(id, { status: 'resolved', resolvedAt: new Date().toISOString() });
  addHistory(id, 'resolved', 'Быстрое решение');
  renderTickets();
  renderStats();
}

function quickEscalate(id) {
  if (!confirm('🔁 Эскалировать старшему специалисту?')) return;
  Storage.update(id, { status: 'escalated', assignee: 'senior' });
  addHistory(id, 'escalated', 'Эскалация');
  renderTickets();
  renderStats();
}

// ==================== МОДАЛЬНОЕ ОКНО ====================
function openModal(ticketId) {
  const ticket = Storage.getAll().find(t => t.id === ticketId);
  if (!ticket) return;
  
  currentTicket = ticket;
  
  document.getElementById('modalTicketId').textContent = `🎫 ${ticket.id}`;
  
  const deadline = new Date(new Date(ticket.createdAt).getTime() + 
    (ticket.responseTime === '1 час' ? 3600000 : 
     ticket.responseTime === '4 часа' ? 14400000 : 86400000));
  
  document.getElementById('modalTicketBody').innerHTML = `
    <p><strong>Пользователь:</strong> ${ticket.userName}</p>
    <p><strong>Сообщение:</strong></p>
    <blockquote>${ticket.message}</blockquote>
    <p><strong>Тип:</strong> ${ticket.type} | <strong>Приоритет:</strong> ${PRIORITY_LABELS[ticket.priority]}</p>
    <p><strong>Срок:</strong> ${deadline.toLocaleString('ru-RU', {hour:'2-digit',minute:'2-digit'})}</p>
    <p><strong>Статус:</strong> ${STATUS_LABELS[ticket.status]}</p>
    ${ticket.history?.length ? `
      <details>
        <summary style="cursor:pointer">📜 История</summary>
        <div style="font-size:13px;color:#6b7280;margin-top:8px">
          ${ticket.history.map(h => `• ${new Date(h.timestamp).toLocaleTimeString()} — ${h.note}`).join('<br>')}
        </div>
      </details>
    ` : ''}
  `;
  
  document.getElementById('modalStatus').value = ticket.status;
  document.getElementById('modalNote').value = '';
  document.getElementById('ticketModal').classList.add('active');
}

function closeModal() {
  document.getElementById('ticketModal').classList.remove('active');
  currentTicket = null;
}

function saveTicketChanges() {
  if (!currentTicket) return;
  
  const status = document.getElementById('modalStatus').value;
  const note = document.getElementById('modalNote').value.trim();
  
  const updates = { status };
  if (status === 'resolved') updates.resolvedAt = new Date().toISOString();
  if (status === 'escalated') updates.assignee = 'senior';
  
  Storage.update(currentTicket.id, updates);
  if (note) addHistory(currentTicket.id, 'note', note);
  
  renderTickets();
  renderStats();
  alert('💾 Сохранено');
  closeModal();
}

function sendReply() {
  if (!currentTicket) return;
  
  const reply = `Здравствуйте, ${currentTicket.userName}!\n\nПроблема «${currentTicket.message.slice(0,40)}...» решена.\n\nПроверьте, пожалуйста. Если вопрос остался — ответьте на это сообщение.\n\nС уважением, поддержка.`;
  
  navigator.clipboard?.writeText(reply).then(() => {
    alert('📤 Ответ скопирован!');
    Storage.update(currentTicket.id, { status: 'resolved', resolvedAt: new Date().toISOString() });
    addHistory(currentTicket.id, 'replied', 'Отправлен ответ');
    renderTickets();
    renderStats();
    closeModal();
  });
}

function deleteTicket() {
  if (!currentTicket || !confirm('🗑️ Удалить эту заявку?')) return;
  
  Storage.delete(currentTicket.id);
  renderTickets();
  renderStats();
  closeModal();
  alert('🗑️ Удалено');
}

function addHistory(ticketId, action, note) {
  const tickets = Storage.getAll();
  const ticket = tickets.find(t => t.id === ticketId);
  if (ticket) {
    ticket.history = ticket.history || [];
    ticket.history.push({ action, timestamp: new Date().toISOString(), note });
    Storage.save(tickets);
  }
}

function clearAllTickets() {
  if (confirm('🗑️ Удалить ВСЕ заявки?')) {
    Storage.clear();
    renderTickets();
    renderStats();
    alert('✅ Очищено');
  }
}

// Закрытие модального окна по клику вне
document.addEventListener('click', (e) => {
  const modal = document.getElementById('ticketModal');
  if (e.target === modal) closeModal();
});

// Закрытие по Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ==================== ЗАПУСК ====================
document.addEventListener('DOMContentLoaded', init);
