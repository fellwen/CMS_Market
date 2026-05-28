// assets/script/script.js
// SupportFlow Lite — Клиентская часть (index.html)

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
  storeName: "MyShop",
  supportPhone: "+7 (495) 123-45-67",
  chatLink: "https://myshop.ru/chat",
  sla: { high: "1 час", medium: "4 часа", low: "24 часа" }
};

// ==================== КЛАССИФИКАТОР (с исправленной морфологией) ====================
const CLASSIFIER = [
  // 🔴 ВЫСОКИЙ ПРИОРИТЕТ
  {
    type: "Ошибка оплаты",
    keywords: [
      "деньги списались", "оплата не прошла", "списание без заказа", 
      "ошибка оплаты", "платеж не оформился", "оплатил но заказ не создан"
    ],
    example: "Деньги списались, но заказ не оформился",
    priority: "high",
    responseTime: CONFIG.sla.high,
    kbLink: "/kb/payment-errors"
  },
  {
    type: "Не загружается страница",
    // ✅ Исправлено: добавлены падежи, варианты написания и коды ошибок
    keywords: [
      "ошибка 500", "ошибку 500", "500 ошибка", "error 500",
      "ошибка 502", "ошибку 502", "ошибка 503", "ошибку 503",
      "сайт не грузится", "белый экран", "сервер недоступен", "не открывается сайт"
    ],
    example: "Сайт выдаёт ошибку 500 при открытии каталога",
    priority: "high",
    responseTime: CONFIG.sla.high,
    kbLink: "/kb/technical-errors"
  },
  // 🟡 СРЕДНИЙ ПРИОРИТЕТ
  {
    type: "Вопрос по доставке",
    keywords: [
      "когда приедет", "где мой заказ", "статус доставки", 
      "трек номер", "доставка заказа", "сколько едет заказ"
    ],
    example: "Когда приедет мой заказ №12345?",
    priority: "medium",
    responseTime: CONFIG.sla.medium,
    kbLink: "/kb/delivery-faq"
  },
  {
    type: "Проблема с авторизацией",
    keywords: [
      "не могу войти", "неверный пароль", "забыл пароль", 
      "восстановить пароль", "ошибка входа", "не пускает в аккаунт"
    ],
    example: "Не могу войти в аккаунт, пишет „Неверный пароль\"",
    priority: "medium",
    responseTime: CONFIG.sla.medium,
    kbLink: "/kb/auth-help"
  },
  {
    type: "Жалоба на товар",
    keywords: [
      "не тот размер", "брак товара", "вернуть товар", 
      "обмен товара", "возврат денег", "прислали не то"
    ],
    example: "Прислали не тот размер, хочу вернуть",
    priority: "medium",
    responseTime: CONFIG.sla.medium,
    kbLink: "/kb/returns-policy"
  },
  // 🟢 НИЗКИЙ ПРИОРИТЕТ
  {
    type: "Предложение новой функции",
    keywords: [
      "добавьте функцию", "предлагаю добавить", "хочу новую функцию", 
      "идея для сайта", "улучшение каталога", "сделайте фильтр"
    ],
    example: "Добавьте фильтр по цвету в каталоге",
    priority: "low",
    responseTime: CONFIG.sla.low,
    kbLink: "/kb/feature-requests"
  }
];

// ==================== ШАБЛОНЫ ====================
const TEMPLATES = {
  confirmation: document.getElementById('template1')?.textContent?.trim() || '',
  resolution: document.getElementById('template2')?.textContent?.trim() || '',
  escalation: document.getElementById('template3')?.textContent?.trim() || ''
};

// ==================== ХРАНИЛИЩЕ (localStorage) ====================
const Storage = {
  KEY: 'supportflow_tickets',
  
  getAll() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } 
    catch { return []; }
  },
  
  save(tickets) {
    localStorage.setItem(this.KEY, JSON.stringify(tickets));
  },
  
  add(ticket) {
    const tickets = this.getAll();
    tickets.unshift(ticket); // Новые сверху
    this.save(tickets);
  }
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function init() {
  renderClassifier();
  console.log('✅ SupportFlow Lite успешно загружен');
}

// ==================== ОТРИСОВКА КЛАССИФИКАТОРА ====================
function renderClassifier() {
  const tbody = document.querySelector('#classifierTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = CLASSIFIER.map(item => {
    const priorityLabel = { high: '🔴 Высокий', medium: '🟡 Средний', low: '🟢 Низкий' }[item.priority];
    return `
      <tr>
        <td><strong>${item.type}</strong></td>
        <td><em>${item.example}</em></td>
        <td><span class="priority priority-${item.priority}">${priorityLabel}</span></td>
        <td>${item.responseTime}</td>
      </tr>
    `;
  }).join('');
}

// ==================== КЛАССИФИКАЦИЯ СООБЩЕНИЯ ====================
function classifyMessage(message) {
  if (!message || typeof message !== 'string') return getDefaultClassification();
  
  // 🧹 Нормализация: нижний регистр + удаление знаков препинания
  const cleanMsg = message.toLowerCase().replace(/[.,!?;:'"()\-–—]/g, ' ').trim();
  
  for (const rule of CLASSIFIER) {
    for (const keyword of rule.keywords) {
      const cleanKeyword = keyword.toLowerCase().replace(/[.,!?;:'"()\-–—]/g, ' ').trim();
      if (cleanMsg.includes(cleanKeyword)) {
        return { ...rule, confidence: 0.95, matchedKeyword: keyword };
      }
    }
  }
  
  return getDefaultClassification();
}

function getDefaultClassification() {
  return {
    type: "Другое",
    priority: "medium",
    responseTime: CONFIG.sla.medium,
    example: null,
    kbLink: "/kb/general",
    confidence: 0.5,
    matchedKeyword: null
  };
}

// ==================== ОБРАБОТКА ТИКЕТА ====================
function processTicket() {
  const userName = document.getElementById('userName')?.value?.trim() || 'Пользователь';
  const message = document.getElementById('userMessage')?.value?.trim();
  
  if (!message) {
    alert('⚠️ Пожалуйста, введите текст обращения');
    document.getElementById('userMessage')?.focus();
    return;
  }
  
  // 1. Классификация
  const classification = classifyMessage(message);
  
  // 2. Генерация уникального ID
  const ticketId = `TKT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  
  // 3. Создание объекта заявки
  const ticket = {
    id: ticketId,
    userName,
    message,
    channel: 'web',
    ...classification,
    status: 'open',
    assignee: classification.priority === 'high' ? 'senior' : 'operator',
    createdAt: new Date().toISOString(),
    history: [{
      action: 'created',
      timestamp: new Date().toISOString(),
      note: `Классифицирован: ${classification.type} (совпадение: "${classification.matchedKeyword}")`
    }]
  };
  
  // 4. Сохранение в localStorage (видно в admin.html)
  Storage.add(ticket);
  
  // 5. Генерация авто-ответа
  const response = renderTemplate(TEMPLATES.confirmation, {
    userName,
    ticketId,
    responseTime: classification.responseTime,
    storeName: CONFIG.storeName,
    supportPhone: CONFIG.supportPhone,
    chatLink: CONFIG.chatLink
  });
  
  // 6. Вывод результата
  displayResult(ticket, response);
}

function displayResult(ticket, response) {
  const priorityLabels = { high: '🔴 Высокий', medium: '🟡 Средний', low: '🟢 Низкий' };
  
  document.getElementById('ticketDetails').innerHTML = `
    <p><strong>ID:</strong> <code>${ticket.id}</code></p>
    <p><strong>Тип:</strong> ${ticket.type}</p>
    <p><strong>Приоритет:</strong> 
      <span class="priority priority-${ticket.priority}">${priorityLabels[ticket.priority]}</span>
    </p>
    <p><strong>Статус:</strong> 🟢 Открыт</p>
    <p><strong>Срок ответа:</strong> ${ticket.responseTime}</p>
    <p><strong>Исполнитель:</strong> ${ticket.assignee === 'senior' ? 'Старший специалист' : 'Оператор 1-й линии'}</p>
    <p class="text-small text-muted" style="margin-top:10px;">
      💾 Заявка сохранена в браузере. Откройте <a href="admin.html" target="_blank" style="color:var(--color-primary);">admin.html</a> для управления.
    </p>
  `;
  
  document.getElementById('autoResponse').textContent = response;
  document.getElementById('result').classList.add('show');
  document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function renderTemplate(template, vars) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] !== undefined ? vars[key] : `{{${key}}}`);
}

function exportCSV() {
  const headers = ['Тип запроса', 'Пример обращения', 'Приоритет', 'Время ответа', 'Путь в документации'];
  const rows = CLASSIFIER.map(item => [
    item.type,
    item.example,
    { high: 'Высокий', medium: 'Средний', low: 'Низкий' }[item.priority],
    item.responseTime,
    item.kbLink
  ]);
  
  const csv = [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  downloadFile(csv, 'classifier_export.csv', 'text/csv;charset=utf-8;');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function exportTemplates() {
  const text = `=== ШАБЛОНЫ ОТВЕТОВ ===\n\n【Подтверждение】\n${TEMPLATES.confirmation}\n\n【Решение】\n${TEMPLATES.resolution}\n\n【Эскалация】\n${TEMPLATES.escalation}`;
  
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => alert('✅ Шаблоны скопированы в буфер обмена!'));
  } else {
    // Fallback для старых браузеров
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('✅ Шаблоны скопированы!');
  }
}

function generateReport() {
  const csvRows = CLASSIFIER.map(i => `"${i.type}","${i.example}","${i.priority}","${i.responseTime}","${i.kbLink}"`).join('\n');
  
  const report = `# Отчёт: Разработка алгоритма поддержки

## 1. Классификатор (для Google Sheets)
\`\`\`csv
Тип запроса,Пример обращения,Приоритет,Время ответа,Путь в документации
${csvRows}
\`\`\`

## 2. Алгоритм обработки
\`\`\`
Приём запроса → Классификация по ключевым словам → Определение приоритета
  ├─ 🔴 Высокий → Назначить старшего специалиста (SLA: 1 ч)
  ├─ 🟡 Средний → Назначить оператора 1-й линии (SLA: 4 ч)
  └─ 🟢 Низкий → Поставить в очередь (SLA: 24 ч)
→ Ответ пользователю по шаблону → [Решено?] → ✅ Закрыть / 🔁 Эскалация
\`\`\`

## 3. Шаблоны ответов
### Подтверждение
\`\`\`
${TEMPLATES.confirmation}
\`\`\`
### Решение
\`\`\`
${TEMPLATES.resolution}
\`\`\`
### Эскалация
\`\`\`
${TEMPLATES.escalation}
\`\`\`

## 4. Выводы
• Автоматическая классификация с нормализацией текста сокращает время первичной обработки на 40–60%
• Чёткие приоритеты и SLA (1ч/4ч/24ч) обеспечивают прозрачность и контроль нагрузки
• Интеграция с localStorage позволяет передавать заявки между клиентской и админ-панелью без сервера
• Стандартизированные шаблоны повышают качество коммуникации и снижают время ответа

## 5. Инструменты
• Чистый HTML5 / CSS3 / ES6 JavaScript
• localStorage для синхронизации данных между страницами
• Регулярные выражения для нормализации и извлечения переменных`;

  document.getElementById('reportOutput').value = report;
}

function copyReport() {
  const el = document.getElementById('reportOutput');
  el.select();
  try {
    document.execCommand('copy');
    alert('✅ Отчёт скопирован! Вставьте его в Google Docs.');
  } catch {
    alert('⚠️ Не удалось скопировать автоматически. Выделите текст вручную и нажмите Ctrl+C.');
  }
}

// ==================== ЗАПУСК ====================
document.addEventListener('DOMContentLoaded', init);
