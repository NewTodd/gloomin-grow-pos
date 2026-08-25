const DEFAULT_EMPLOYEES = [
  { name: "Todd", pin: "1111" },
  { name: "Kevin", pin: "2222" },
  { name: "Jennifer", pin: "3333" }
];

const DEFAULT_OWNER_PASSWORD = "9999";
const DEFAULT_MANAGER_PASSWORD = "8888";
const DEFAULT_SALON_SETTINGS = {
  salonName: "Zen Nail In Lexington TN",
  receiptName: "ZEN NAIL",
  addressLine1: "596 West Church Street",
  addressLine2: "Lexington, TN 38351",
  phone: "(731) 999-9999",
  stationName: "Station: 1",
  paymentProvider: "Square",
  cardFeePercent: 3,
  receiptFooter: "Thank you. Come back again soon."
};

const STORAGE_KEYS = {
  employees: "gloominGrow.employees",
  services: "gloominGrow.services",
  ownerPassword: "gloominGrow.ownerPassword",
  managerPassword: "gloominGrow.managerPassword",
  salonSettings: "gloominGrow.salonSettings",
  clockedInEmployees: "gloominGrow.clockedInEmployees",
  closedTickets: "gloominGrow.closedTickets",
  heldTickets: "gloominGrow.heldTickets",
  appointments: "gloominGrow.appointments",
  dailyCloseReports: "gloominGrow.dailyCloseReports",
  lastAutoCloseDate: "gloominGrow.lastAutoCloseDate",
  giftCards: "gloominGrow.giftCards",
  auditLog: "gloominGrow.auditLog"
};

function loadSavedData(key, fallback) {
  try {
    const savedValue = localStorage.getItem(key);
    return savedValue ? JSON.parse(savedValue) : fallback;
  } catch (error) {
    console.warn("Could not load saved POS data", error);
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function saveAppState() {
  saveData(STORAGE_KEYS.employees, employees);
  saveData(STORAGE_KEYS.services, services);
  saveData(STORAGE_KEYS.ownerPassword, ownerPassword);
  saveData(STORAGE_KEYS.managerPassword, managerPassword);
  saveData(STORAGE_KEYS.salonSettings, salonSettings);
  saveData(STORAGE_KEYS.clockedInEmployees, clockedInEmployees);
  saveData(STORAGE_KEYS.closedTickets, closedTickets);
  saveData(STORAGE_KEYS.heldTickets, heldTickets);
  saveData(STORAGE_KEYS.appointments, appointments);
  saveData(STORAGE_KEYS.dailyCloseReports, dailyCloseReports);
  saveData(STORAGE_KEYS.lastAutoCloseDate, lastAutoCloseDate);
  saveData(STORAGE_KEYS.giftCards, giftCards);
  saveData(STORAGE_KEYS.auditLog, auditLog);
}

function addAuditLog(action, details = {}) {
  const now = new Date();
  const entry = {
    id: `audit-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    date: now.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
    time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    iso: now.toISOString(),
    station: salonSettings.stationName || "Station: 1",
    actor: details.actor || selectedEmployee?.name || currentAccessRole || "System",
    details
  };

  auditLog.unshift(entry);

  if (auditLog.length > 5000) {
    auditLog = auditLog.slice(0, 5000);
  }

  saveData(STORAGE_KEYS.auditLog, auditLog);
  return entry;
}

function getAuditDetailText(entry) {
  const details = entry.details || {};
  const parts = [];

  if (details.employee) parts.push(`Employee: ${details.employee}`);
  if (details.ticketNumber) parts.push(`Ticket #${details.ticketNumber}`);
  if (typeof details.total === "number") parts.push(`Total: ${formatMoney(details.total)}`);
  if (details.paymentMethod) parts.push(`Payment: ${details.paymentMethod}`);
  if (details.giftCardCode) parts.push(`Gift card: ${details.giftCardCode}`);
  if (typeof details.amount === "number") parts.push(`Amount: ${formatMoney(details.amount)}`);
  if (details.fileName) parts.push(`File: ${details.fileName}`);
  if (details.note) parts.push(details.note);

  return parts.join(" | ") || "Recorded";
}

function ensureAuditLogModal() {
  if (document.getElementById("auditLogModal")) return;

  const modal = document.createElement("div");
  modal.id = "auditLogModal";
  modal.className = "audit-log-modal";
  modal.innerHTML = `
    <div class="audit-log-box">
      <div class="audit-log-head">
        <div>
          <span>Owner Records</span>
          <strong>Audit Log</strong>
        </div>
        <button onclick="closeAuditLogModal()">x</button>
      </div>
      <div class="audit-log-actions">
        <button onclick="downloadAuditLog()">Export Audit Log</button>
        <button onclick="downloadPosBackup()">Backup All Records</button>
      </div>
      <div id="auditLogList" class="audit-log-list"></div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openAuditLog() {
  ensureAuditLogModal();
  renderAuditLog();
  document.getElementById("auditLogModal").style.display = "flex";
}

function closeAuditLogModal() {
  const modal = document.getElementById("auditLogModal");
  if (modal) modal.style.display = "none";
}

function renderAuditLog() {
  const list = document.getElementById("auditLogList");
  if (!list) return;

  if (!auditLog.length) {
    list.innerHTML = `<div class="audit-log-empty">No audit records yet.</div>`;
    return;
  }

  list.innerHTML = auditLog.slice(0, 250).map(entry => `
    <div class="audit-log-row">
      <div>
        <strong>${escapeHtml(entry.action)}</strong>
        <span>${escapeHtml(getAuditDetailText(entry))}</span>
      </div>
      <div>
        <strong>${escapeHtml(entry.actor || "System")}</strong>
        <span>${escapeHtml(entry.date)} ${escapeHtml(entry.time)}</span>
      </div>
    </div>
  `).join("");
}

function downloadAuditLog() {
  const today = new Date().toISOString().slice(0, 10);
  const exportData = {
    app: "GloominGrowPOS",
    type: "audit-log",
    version: 1,
    exportedAt: new Date().toISOString(),
    salon: salonSettings,
    auditLog
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `gloomin-grow-audit-log-${today}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  addAuditLog("Audit Log Exported", { actor: "Owner", note: "Owner exported audit log." });
}

const DEFAULT_SERVICES = {
  "Manicure": [
    { name: "Regular Manicure", price: 25 },
    { name: "Gel Manicure", price: 40 },
    { name: "French Gel Manicure", price: 50 },
    { name: "On Hand Gel Polish Only", price: 35 },
    { name: "On Hand Reg Polish Only", price: 15 }
  ],
  "Pedicure": [
    { name: "Spa Pedicure", price: 42 },
    { name: "Gel Add On", price: 15 },
    { name: "Deluxe Pedicure", price: 55 }
  ],
  "Nail Enhancement": [
    { name: "Acrylic Full Set", price: 55 },
    { name: "Acrylic Fill", price: 45 },
    { name: "Dip Powder", price: 45 },
    { name: "Ombre Full Set", price: 65 }
  ],
  "Additionally": [
    { name: "Trim and Shape No Polish", price: 10 },
    { name: "Paraffin Wax", price: 10 },
    { name: "Remove Gel w/o Gel Polish Back On", price: 10 },
    { name: "Soak Off Nail Enhancement", price: 20 },
    { name: "Different Shape", price: 5 }
  ],
  "GiftCard": [
    { name: "Gift Card $25", price: 25 },
    { name: "Gift Card $50", price: 50 },
    { name: "Gift Card $100", price: 100 }
  ]
};

let employees = loadSavedData(STORAGE_KEYS.employees, DEFAULT_EMPLOYEES);
let services = loadSavedData(STORAGE_KEYS.services, DEFAULT_SERVICES);
let ownerPassword = loadSavedData(STORAGE_KEYS.ownerPassword, DEFAULT_OWNER_PASSWORD);
let managerPassword = loadSavedData(STORAGE_KEYS.managerPassword, DEFAULT_MANAGER_PASSWORD);
let salonSettings = {
  ...DEFAULT_SALON_SETTINGS,
  ...loadSavedData(STORAGE_KEYS.salonSettings, {})
};
let clockedInEmployees = loadSavedData(STORAGE_KEYS.clockedInEmployees, []);
let currentPinAction = "";
let enteredPin = "";
let pendingOwnerTab = "dashboard";
let currentAccessRole = "employee";

let selectedEmployee = null;
let currentTicket = [];
let currentMainView = "service";
let selectedCombineHeldIndexes = [];
let customServiceCategory = "";
let customServicePriceDigits = "";

let closedTickets = loadSavedData(STORAGE_KEYS.closedTickets, []);
let heldTickets = loadSavedData(STORAGE_KEYS.heldTickets, []);

let appointments = loadSavedData(STORAGE_KEYS.appointments, []);
let editingAppointmentIndex = null;
let selectedAppointmentDate = getTodayInputString();
let dailyCloseReports = loadSavedData(STORAGE_KEYS.dailyCloseReports, []);
let lastAutoCloseDate = loadSavedData(STORAGE_KEYS.lastAutoCloseDate, "");
let giftCards = loadSavedData(STORAGE_KEYS.giftCards, []);
let auditLog = loadSavedData(STORAGE_KEYS.auditLog, []);
let selectedGiftCardCode = "";

let currentLanguage = "en";

const translations = {
  en: {
    functions: "Functions",
    staff: "Staff",
    appointment: "Appointment",
    owner: "Owner",
    home: "Home",
    queueService: "QUEUE SERVICE",
    service: "SERVICE",
    closedTicket: "CLOSED TICKET",
    staffStatus: "STAFF STATUS",
    noTicketFound: "No Ticket Found",
    dailyTasks: "Daily Tasks",
    clockIn: "Clock In",
    clockOut: "Clock Out",
    ticketPayment: "Ticket Payment",
    customers: "Customers",
    refund: "Refund",
    cashDrawer: "Cash Drawer",
    closeOut: "Close Out",
    settings: "Settings",
    close: "Close",
    password: "PASSWORD",
    clear: "Clear",
    delete: "Del",
    confirm: "CONFIRM",
    turn: "Turn",
    status: "Status",
    available: "Available",
    activeStaff: "Active Staff",
    tickets: "Tickets",
    voids: "Voids",
    active: "Active",
    off: "Off",
    clockedIn: "Clocked in",
    notClockedIn: "Not clocked in",
    currentTicket: "Current Ticket",
    total: "Total",
    pay: "Pay",
    cancel: "Cancel",
    void: "Void",
    hold: "Hold",
    combine: "Combine",
    allTechnicians: "All Technicians",
    allPayments: "All Payments",
    search: "Search...",
    ticketDate: "Ticket# / Date",
    technician: "Technician",
    payment: "Payment",
    time: "Time",
    today: "Today",
    day: "Day",
    week: "Week",
    month: "Month",
    selectDate: "Select Date",
    anyTechnician: "Any Technician",
    addAppointment: "Add Appointment",
    editAppointment: "Edit Appointment",
    customerName: "Customer Name",
    phoneNumber: "Phone Number",
    save: "Save",
    textReminder: "Send text reminder",
    sendReminderNow: "Send Reminder"
  },
  km: {
    functions: "áž˜áž»ážáž„áž¶ážš",
    staff: "áž”áž»áž‚áŸ’áž‚áž›áž·áž€",
    appointment: "áž€áž¶ážšážŽáž¶ážáŸ‹áž‡áž½áž”",
    owner: "áž˜áŸ’áž…áž¶ážŸáŸ‹",
    home: "áž‘áŸ†áž–áŸážšážŠáž¾áž˜",
    queueService: "áž‡áž½ážšážŸáŸážœáž¶áž€áž˜áŸ’áž˜",
    service: "ážŸáŸážœáž¶áž€áž˜áŸ’áž˜",
    closedTicket: "ážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážšáž”áž·áž‘",
    staffStatus: "ážŸáŸ’ážáž¶áž“áž—áž¶áž–áž”áž»áž‚áŸ’áž‚áž›áž·áž€",
    noTicketFound: "ážšáž€áž˜áž·áž“ážƒáž¾áž‰ážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážš",
    dailyTasks: "áž€áž¶ážšáž„áž¶ážšáž”áŸ’ážšáž…áž¶áŸ†ážáŸ’áž„áŸƒ",
    clockIn: "áž…áž¼áž›áž’áŸ’ážœáž¾áž€áž¶ážš",
    clockOut: "áž…áŸáž‰áž–áž¸áž’áŸ’ážœáž¾áž€áž¶ážš",
    ticketPayment: "áž”áž„áŸ‹áž”áŸ’ážšáž¶áž€áŸ‹ážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážš",
    customers: "áž¢ážáž·ážáž·áž‡áž“",
    refund: "ážŸáž„áž”áŸ’ážšáž¶áž€áŸ‹",
    cashDrawer: "ážážáž”áŸ’ážšáž¶áž€áŸ‹",
    closeOut: "áž”áž·áž‘ážœáŸáž“",
    settings: "áž€áž¶ážšáž€áŸ†ážŽážáŸ‹",
    close: "áž”áž·áž‘",
    password: "áž›áŸážážŸáž˜áŸ’áž„áž¶ážáŸ‹",
    clear: "áž›áž»áž”",
    delete: "áž›áž»áž”",
    confirm: "áž”áž‰áŸ’áž‡áž¶áž€áŸ‹",
    turn: "ážœáŸáž“",
    status: "ážŸáŸ’ážáž¶áž“áž—áž¶áž–",
    available: "áž‘áŸ†áž“áŸážš",
    activeStaff: "áž”áž»áž‚áŸ’áž‚áž›áž·áž€áž€áŸ†áž–áž»áž„áž’áŸ’ážœáž¾áž€áž¶ážš",
    tickets: "ážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážš",
    voids: "áž”áž¶áž“áž›áž»áž”áž…áŸ„áž›",
    active: "áž€áŸ†áž–áž»áž„áž’áŸ’ážœáž¾áž€áž¶ážš",
    off: "ážˆáž”áŸ‹",
    clockedIn: "áž”áž¶áž“áž…áž¼áž›áž˜áŸ‰áŸ„áž„",
    notClockedIn: "áž˜áž·áž“áž‘áž¶áž“áŸ‹áž…áž¼áž›áž˜áŸ‰áŸ„áž„",
    currentTicket: "ážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážšáž”áž…áŸ’áž…áž»áž”áŸ’áž”áž“áŸ’áž“",
    total: "ážŸážšáž»áž”",
    pay: "áž”áž„áŸ‹áž”áŸ’ážšáž¶áž€áŸ‹",
    cancel: "áž”áŸ„áŸ‡áž”áž„áŸ‹",
    void: "áž›áž»áž”áž…áŸ„áž›",
    hold: "ážšáž€áŸ’ážŸáž¶áž‘áž»áž€",
    combine: "áž”áž‰áŸ’áž…áž¼áž›áž‚áŸ’áž“áž¶",
    allTechnicians: "áž¢áŸ’áž“áž€áž”áž…áŸ’áž…áŸáž€áž‘áŸážŸáž‘áž¶áŸ†áž„áž¢ážŸáŸ‹",
    allPayments: "áž€áž¶ážšáž”áž„áŸ‹áž”áŸ’ážšáž¶áž€áŸ‹áž‘áž¶áŸ†áž„áž¢ážŸáŸ‹",
    search: "ážŸáŸ’ážœáŸ‚áž„ážšáž€...",
    ticketDate: "áž›áŸážážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážš / ážáŸ’áž„áŸƒ",
    technician: "áž¢áŸ’áž“áž€áž”áž…áŸ’áž…áŸáž€áž‘áŸážŸ",
    payment: "áž€áž¶ážšáž”áž„áŸ‹áž”áŸ’ážšáž¶áž€áŸ‹",
    time: "áž˜áŸ‰áŸ„áž„",
    today: "ážáŸ’áž„áŸƒáž“áŸáŸ‡",
    day: "ážáŸ’áž„áŸƒ",
    week: "ážŸáž”áŸ’ážŠáž¶áž áŸ",
    month: "ážáŸ‚",
    selectDate: "áž‡áŸ’ážšáž¾ážŸážšáž¾ážŸážáŸ’áž„áŸƒ",
    anyTechnician: "áž¢áŸ’áž“áž€áž”áž…áŸ’áž…áŸáž€áž‘áŸážŸážŽáž¶áž€áŸáž”áž¶áž“",
    addAppointment: "áž”áž“áŸ’ážáŸ‚áž˜áž€áž¶ážšážŽáž¶ážáŸ‹áž‡áž½áž”",
    editAppointment: "áž€áŸ‚áž€áž¶ážšážŽáž¶ážáŸ‹áž‡áž½áž”",
    customerName: "ážˆáŸ’áž˜áŸ„áŸ‡áž¢ážáž·ážáž·áž‡áž“",
    phoneNumber: "áž›áŸážáž‘áž¼ážšážŸáŸáž–áŸ’áž‘",
    save: "ážšáž€áŸ’ážŸáž¶áž‘áž»áž€",
    textReminder: "áž•áŸ’áž‰áž¾ážŸáž¶ážšážšáŸ†áž›áž¹áž€",
    sendReminderNow: "áž•áŸ’áž‰áž¾ážŸáž¶ážšážšáŸ†áž›áž¹áž€áž¥áž¡áž¼ážœ"
  }
};

const serviceTranslations = {
  km: {
    "Manicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€ážŠáŸƒ",
    "Regular Manicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€ážŠáŸƒáž’áž˜áŸ’áž˜ážáž¶",
    "Gel Manicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€ážŠáŸƒáž‡áŸ‚áž›",
    "French Gel Manicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€ážŠáŸƒáž‡áŸ‚áž›áž”áž¶ážšáž¶áŸ†áž„",
    "On Hand Gel Polish Only": "áž›áž¶áž”áž‡áŸ‚áž›áž›áž¾ážŠáŸƒ",
    "On Hand Reg Polish Only": "áž›áž¶áž”áž–ážŽáŸŒáž’áž˜áŸ’áž˜ážáž¶áž›áž¾ážŠáŸƒ",
    "Pedicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€áž‡áž¾áž„",
    "Spa Pedicure": "ážŸáŸ’áž”áŸ‰áž¶áž€áŸ’ážšáž…áž€áž‡áž¾áž„",
    "Gel Add On": "áž”áž“áŸ’ážáŸ‚áž˜áž‡áŸ‚áž›",
    "Deluxe Pedicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€áž‡áž¾áž„ Deluxe",
    "Nail Enhancement": "áž”áž“áŸ’ážáŸ‚áž˜áž€áŸ’ážšáž…áž€",
    "Acrylic Full Set": "Acrylic ážˆáž»ážáž–áŸáž‰",
    "Acrylic Fill": "áž”áŸ†áž–áŸáž‰ Acrylic",
    "Dip Powder": "áž˜áŸ’ážŸáŸ… Dip",
    "Ombre Full Set": "Ombre ážˆáž»ážáž–áŸáž‰",
    "Additionally": "áž”áž“áŸ’ážáŸ‚áž˜",
    "Trim and Shape No Polish": "áž€áž¶ážáŸ‹áž“áž·áž„ážáž˜áŸ’ážšáž„áŸ‹ážšáž¶áž„ áž˜áž·áž“áž›áž¶áž”áž–ážŽáŸŒ",
    "Paraffin Wax": "Paraffin Wax",
    "Remove Gel w/o Gel Polish Back On": "ážŠáž€áž‡áŸ‚áž› áž˜áž·áž“áž›áž¶áž”áž‡áŸ‚áž›ážœáž·áž‰",
    "Soak Off Nail Enhancement": "ážŠáž€áž€áŸ’ážšáž…áž€áž”áž“áŸ’ážáŸ‚áž˜",
    "Different Shape": "ážšáž¶áž„áž•áŸ’ážŸáŸáž„",
    "GiftCard": "áž€áž¶ážáž¢áŸ†ážŽáŸ„áž™",
    "Gift Card $25": "áž€áž¶ážáž¢áŸ†ážŽáŸ„áž™ $25",
    "Gift Card $50": "áž€áž¶ážáž¢áŸ†ážŽáŸ„áž™ $50",
    "Gift Card $100": "áž€áž¶ážáž¢áŸ†ážŽáŸ„áž™ $100",
    "Gel Pedicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€áž‡áž¾áž„áž‡áŸ‚áž›",
    "Manicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€ážŠáŸƒ",
    "Design": "ážšáž…áž“áž¶áž˜áŸ‰áž¼áž"
  }
};


Object.assign(translations.km, {
  functions: "áž˜áž»ážáž„áž¶ážš",
  staff: "áž”áž»áž‚áŸ’áž‚áž›áž·áž€",
  appointment: "áž€áž¶ážšážŽáž¶ážáŸ‹áž‡áž½áž”",
  owner: "áž˜áŸ’áž…áž¶ážŸáŸ‹",
  home: "áž‘áŸ†áž–áŸážšážŠáž¾áž˜",
  queueService: "áž‡áž½ážšážŸáŸážœáž¶áž€áž˜áŸ’áž˜",
  service: "ážŸáŸážœáž¶áž€áž˜áŸ’áž˜",
  closedTicket: "ážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážšáž”áž·áž‘",
  staffStatus: "ážŸáŸ’ážáž¶áž“áž—áž¶áž–áž”áž»áž‚áŸ’áž‚áž›áž·áž€",
  noTicketFound: "ážšáž€áž˜áž·áž“ážƒáž¾áž‰ážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážš",
  dailyTasks: "áž€áž¶ážšáž„áž¶ážšáž”áŸ’ážšáž…áž¶áŸ†ážáŸ’áž„áŸƒ",
  clockIn: "áž…áž¼áž›áž’áŸ’ážœáž¾áž€áž¶ážš",
  clockOut: "áž…áŸáž‰áž–áž¸áž’áŸ’ážœáž¾áž€áž¶ážš",
  ticketPayment: "áž”áž„áŸ‹áž”áŸ’ážšáž¶áž€áŸ‹ážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážš",
  customers: "áž¢ážáž·ážáž·áž‡áž“",
  refund: "ážŸáž„áž”áŸ’ážšáž¶áž€áŸ‹",
  cashDrawer: "ážážáž”áŸ’ážšáž¶áž€áŸ‹",
  closeOut: "áž”áž·áž‘ážœáŸáž“",
  settings: "áž€áž¶ážšáž€áŸ†ážŽážáŸ‹",
  close: "áž”áž·áž‘",
  password: "áž›áŸážážŸáž˜áŸ’áž„áž¶ážáŸ‹",
  clear: "áž›áž»áž”",
  delete: "áž›áž»áž”",
  confirm: "áž”áž‰áŸ’áž‡áž¶áž€áŸ‹",
  turn: "ážœáŸáž“",
  status: "ážŸáŸ’ážáž¶áž“áž—áž¶áž–",
  available: "áž‘áŸ†áž“áŸážš",
  activeStaff: "áž”áž»áž‚áŸ’áž‚áž›áž·áž€áž€áŸ†áž–áž»áž„áž’áŸ’ážœáž¾áž€áž¶ážš",
  tickets: "ážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážš",
  voids: "áž”áž¶áž“áž›áž»áž”áž…áŸ„áž›",
  active: "áž€áŸ†áž–áž»áž„áž’áŸ’ážœáž¾áž€áž¶ážš",
  off: "ážˆáž”áŸ‹",
  clockedIn: "áž”áž¶áž“áž…áž¼áž›áž˜áŸ‰áŸ„áž„",
  notClockedIn: "áž˜áž·áž“áž‘áž¶áž“áŸ‹áž…áž¼áž›áž˜áŸ‰áŸ„áž„",
  currentTicket: "ážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážšáž”áž…áŸ’áž…áž»áž”áŸ’áž”áž“áŸ’áž“",
  total: "ážŸážšáž»áž”",
  pay: "áž”áž„áŸ‹áž”áŸ’ážšáž¶áž€áŸ‹",
  cancel: "áž”áŸ„áŸ‡áž”áž„áŸ‹",
  void: "áž›áž»áž”áž…áŸ„áž›",
  hold: "ážšáž€áŸ’ážŸáž¶áž‘áž»áž€",
  combine: "áž”áž‰áŸ’áž…áž¼áž›áž‚áŸ’áž“áž¶",
  allTechnicians: "áž¢áŸ’áž“áž€áž”áž…áŸ’áž…áŸáž€áž‘áŸážŸáž‘áž¶áŸ†áž„áž¢ážŸáŸ‹",
  allPayments: "áž€áž¶ážšáž”áž„áŸ‹áž”áŸ’ážšáž¶áž€áŸ‹áž‘áž¶áŸ†áž„áž¢ážŸáŸ‹",
  search: "ážŸáŸ’ážœáŸ‚áž„ážšáž€...",
  ticketDate: "áž›áŸážážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážš / ážáŸ’áž„áŸƒ",
  technician: "áž¢áŸ’áž“áž€áž”áž…áŸ’áž…áŸáž€áž‘áŸážŸ",
  payment: "áž€áž¶ážšáž”áž„áŸ‹áž”áŸ’ážšáž¶áž€áŸ‹",
  time: "áž˜áŸ‰áŸ„áž„",
  today: "ážáŸ’áž„áŸƒáž“áŸáŸ‡",
  day: "ážáŸ’áž„áŸƒ",
  week: "ážŸáž”áŸ’ážáž¶áž áŸ",
  month: "ážáŸ‚",
  selectDate: "áž‡áŸ’ážšáž¾ážŸážšáž¾ážŸážáŸ’áž„áŸƒ",
  anyTechnician: "áž¢áŸ’áž“áž€áž”áž…áŸ’áž…áŸáž€áž‘áŸážŸážŽáž¶áž€áŸáž”áž¶áž“",
  addAppointment: "áž”áž“áŸ’ážáŸ‚áž˜áž€áž¶ážšážŽáž¶ážáŸ‹áž‡áž½áž”",
  editAppointment: "áž€áŸ‚áž€áž¶ážšážŽáž¶ážáŸ‹áž‡áž½áž”",
  customerName: "ážˆáŸ’áž˜áŸ„áŸ‡áž¢ážáž·ážáž·áž‡áž“",
  phoneNumber: "áž›áŸážáž‘áž¼ážšážŸáŸáž–áŸ’áž‘",
  save: "ážšáž€áŸ’ážŸáž¶áž‘áž»áž€",
  textReminder: "áž•áŸ’áž‰áž¾ážŸáž¶ážšážšáŸ†áž›áž¹áž€",
  sendReminderNow: "áž•áŸ’áž‰áž¾ážŸáž¶ážšážšáŸ†áž›áž¹áž€áž¥áž¡áž¼ážœ"
});

Object.assign(serviceTranslations.km, {
  "Manicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€ážŠáŸƒ",
  "Regular Manicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€ážŠáŸƒáž’áž˜áŸ’áž˜ážáž¶",
  "Gel Manicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€ážŠáŸƒáž‡áŸ‚áž›",
  "French Gel Manicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€ážŠáŸƒáž‡áŸ‚áž›áž”áž¶ážšáž¶áŸ†áž„",
  "On Hand Gel Polish Only": "áž›áž¶áž”áž‡áŸ‚áž›áž›áž¾ážŠáŸƒ",
  "On Hand Reg Polish Only": "áž›áž¶áž”áž–ážŽáŸŒáž’áž˜áŸ’áž˜ážáž¶áž›áž¾ážŠáŸƒ",
  "Pedicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€áž‡áž¾áž„",
  "Spa Pedicure": "ážŸáŸ’áž”áŸ‰áž¶áž€áŸ’ážšáž…áž€áž‡áž¾áž„",
  "Gel Add On": "áž”áž“áŸ’ážáŸ‚áž˜áž‡áŸ‚áž›",
  "Deluxe Pedicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€áž‡áž¾áž„ Deluxe",
  "Nail Enhancement": "áž”áž“áŸ’ážáŸ‚áž˜áž€áŸ’ážšáž…áž€",
  "Acrylic Full Set": "Acrylic ážˆáž»ážáž–áŸáž‰",
  "Acrylic Fill": "áž”áŸ†áž–áŸáž‰ Acrylic",
  "Dip Powder": "áž˜áŸ’ážŸáŸ… Dip",
  "Ombre Full Set": "Ombre ážˆáž»ážáž–áŸáž‰",
  "Additionally": "áž”áž“áŸ’ážáŸ‚áž˜",
  "Trim and Shape No Polish": "áž€áž¶ážáŸ‹áž“áž·áž„ážáž˜áŸ’ážšáž„áŸ‹ážšáž¶áž„ áž˜áž·áž“áž›áž¶áž”áž–ážŽáŸŒ",
  "Paraffin Wax": "Paraffin Wax",
  "Remove Gel w/o Gel Polish Back On": "ážŠáž€áž‡áŸ‚áž› áž˜áž·áž“áž›áž¶áž”áž‡áŸ‚áž›ážœáž·áž‰",
  "Soak Off Nail Enhancement": "ážŠáž€áž€áŸ’ážšáž…áž€áž”áž“áŸ’ážáŸ‚áž˜",
  "Different Shape": "ážšáž¶áž„áž•áŸ’ážŸáŸáž„",
  "GiftCard": "áž€áž¶ážáž¢áŸ†ážŽáŸ„áž™",
  "Gift Card $25": "áž€áž¶ážáž¢áŸ†ážŽáŸ„áž™ $25",
  "Gift Card $50": "áž€áž¶ážáž¢áŸ†ážŽáŸ„áž™ $50",
  "Gift Card $100": "áž€áž¶ážáž¢áŸ†ážŽáŸ„áž™ $100",
  "Gift Card Custom": "áž€áž¶ážáž¢áŸ†ážŽáŸ„áž™ážáž˜áŸ’áž›áŸƒáž•áŸ’áž‘áž¶áž›áŸ‹ážáŸ’áž›áž½áž“",
  "Custom Gift Card": "áž€áž¶ážáž¢áŸ†ážŽáŸ„áž™áž•áŸ’áž‘áž¶áž›áŸ‹ážáŸ’áž›áž½áž“",
  "Gel Pedicure": "áž’áŸ’ážœáž¾áž€áŸ’ážšáž…áž€áž‡áž¾áž„áž‡áŸ‚áž›",
  "Design": "ážšáž…áž“áž¶áž˜áŸ‰áž¼áž"
});
function getMojibakeByte(code) {
  const specialBytes = {
    0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
    0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
    0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
    0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
    0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f
  };

  if (specialBytes[code] !== undefined) return specialBytes[code];
  if (code <= 0xff) return code;
  return null;
}

function repairKhmerText(value) {
  if (typeof value !== "string") {
    return value;
  }

  const probablyBrokenKhmer = value.includes("Ã¡Å¾") ||
    Array.from(value).some(char => char.charCodeAt(0) === 0x017e);

  if (!probablyBrokenKhmer) {
    return value;
  }

  try {
    const bytes = [];
    for (const char of value) {
      const repairedByte = getMojibakeByte(char.charCodeAt(0));
      if (repairedByte === null) {
        return value;
      }
      bytes.push(repairedByte);
    }

    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  } catch (error) {
    return value;
  }
}

function repairKhmerDictionary(dictionary) {
  Object.keys(dictionary).forEach(key => {
    dictionary[key] = repairKhmerText(dictionary[key]);
  });
}

repairKhmerDictionary(translations.km);
repairKhmerDictionary(serviceTranslations.km);

function text(key) {
  return repairKhmerText(translations[currentLanguage][key] || translations.en[key] || key);
}

function serviceText(name) {
  return currentLanguage === "km" ? repairKhmerText(serviceTranslations.km[name] || name) : name;
}

function updateClock() {
  const now = new Date();

  document.getElementById("liveTime").textContent = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  document.getElementById("liveDate").textContent = now.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
}

updateClock();
setInterval(updateClock, 1000);
checkAutoCloseOut();
setInterval(checkAutoCloseOut, 60000);
document.addEventListener("keydown", function (event) {
  const ownerPasswordModal = document.getElementById("ownerPasswordModal");

  if (!ownerPasswordModal || ownerPasswordModal.style.display !== "flex") return;

  if (event.key === "Enter") {
    submitOwnerPassword();
  }

  if (event.key === "Escape") {
    closeOwnerPasswordModal();
  }
});

function openFunctions() {
  document.getElementById("functionModal").style.display = "flex";
}

function closeFunctions() {
  document.getElementById("functionModal").style.display = "none";
}

function openPinModal(action) {
  currentPinAction = action;
  enteredPin = "";
  updatePinDisplay();
  document.getElementById("pinModal").style.display = "flex";
}

function closePinModal() {
  document.getElementById("pinModal").style.display = "none";
  enteredPin = "";
  updatePinDisplay();
}

function addPinNumber(number) {
  if (enteredPin.length < 4) {
    enteredPin += number;
    updatePinDisplay();
  }
}

function deletePin() {
  enteredPin = enteredPin.slice(0, -1);
  updatePinDisplay();
}

function clearPin() {
  enteredPin = "";
  updatePinDisplay();
}

function updatePinDisplay() {
  const dots = document.querySelectorAll("#pinDisplay span");

  dots.forEach((dot, index) => {
    if (index < enteredPin.length) {
      dot.classList.add("filled");
    } else {
      dot.classList.remove("filled");
    }
  });

  document.getElementById("confirmPinBtn").disabled = enteredPin.length !== 4;
}

function submitPin() {
  const employee = employees.find(emp => emp.pin === enteredPin);

  if (!employee) {
    showPinError("INVALID PASSWORD");
    return;
  }

  if (currentPinAction === "clockIn") {
    clockInWithPin(enteredPin);
    return;
  }

  if (currentPinAction === "clockOut") {
    clockOutWithPin(enteredPin);
    return;
  }
}

function showPinError(message) {
  const pinBox = document.querySelector(".pin-box");

  pinBox.classList.add("pin-error");

  setTimeout(() => {
    pinBox.classList.remove("pin-error");
  }, 500);

  navigator.vibrate?.(200);
  alert(message);
  clearPin();
}

function clockInWithPin(pin) {
  const employee = employees.find(emp => emp.pin === pin);

  if (!employee) {
    showPinError("INVALID PASSWORD");
    return;
  }

  const alreadyClockedIn = clockedInEmployees.find(emp => emp.pin === pin);

  if (alreadyClockedIn) {
    alert(employee.name + " is already clocked in");
    closePinModal();
    return;
  }

  const now = new Date();

  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const newEmployee = {
    name: employee.name,
    pin: employee.pin,
    clockInTime: time,
    clockInISO: now.toISOString(),
    turn: 0
  };

  clockedInEmployees.push(newEmployee);
  addAuditLog("Clock In", {
    actor: employee.name,
    employee: employee.name,
    note: `${employee.name} clocked in at ${time}.`
  });

  saveAppState();
  displayQueue();
  renderEmployeeDashboard();
  closePinModal();
  closeFunctions();

  alert(employee.name + " clocked in at " + time);
}

function clockOutWithPin(pin) {
  const employeeIndex = clockedInEmployees.findIndex(emp => emp.pin === pin);

  if (employeeIndex === -1) {
    alert("Employee is not clocked in");
    clearPin();
    return;
  }

  const employee = clockedInEmployees[employeeIndex];
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });

  printEmployeeDailyReport(employee);

  clockedInEmployees.splice(employeeIndex, 1);
  addAuditLog("Clock Out", {
    actor: employee.name,
    employee: employee.name,
    note: `${employee.name} clocked out at ${time}.`
  });

  saveAppState();
  displayQueue();
  renderEmployeeDashboard();
  closePinModal();
  closeFunctions();

  alert(employee.name + " clocked out at " + time);
}
function printEmployeeDailyReport(employee) {
  const today = new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });

  const employeeTickets = closedTickets.filter(ticket =>
    ticket.employee === employee.name && ticket.date === today
  );

  const paidTickets = employeeTickets.filter(ticket => !ticket.voided);
  const voidedTickets = employeeTickets.filter(ticket => ticket.voided);

  const totalSales = paidTickets.reduce((sum, ticket) => sum + ticket.total, 0);
  const cashSales = paidTickets
    .filter(ticket => ticket.paymentMethod === "Cash")
    .reduce((sum, ticket) => sum + ticket.total, 0);

  const cardSales = paidTickets
    .filter(ticket => ticket.paymentMethod === "Card")
    .reduce((sum, ticket) => sum + ticket.total, 0);

  const receiptWindow = window.open("", "_blank");

  receiptWindow.document.write(`
    <html>
      <head>
        <title>Employee Daily Report</title>
        <style>
          body {
  font-family: Arial, sans-serif;

  width: 320px;

  margin: 0 auto;

  padding: 20px;

  display: flex;
  justify-content: center;
}

.receipt-container {
  width: 100%;
}

          h2, p {
            text-align: center;
          }

          .salon-header {
            text-align: center;
            margin-bottom: 22px;
          }

          .salon-header h2 {
            margin: 0 0 14px;
            font-size: 28px;
            line-height: 1.15;
          }

          .salon-header p {
            margin: 8px 0;
            font-size: 19px;
            font-weight: bold;
            line-height: 1.25;
          }

          .report-title {
            margin-top: 24px;
            font-size: 20px;
            font-weight: normal;
          }

          .line {
            border-top: 1px dashed #999;
            margin: 12px 0;
          }

          .row {
            display: flex;
            justify-content: space-between;
            margin: 6px 0;
          }

          .total {
            font-size: 20px;
            font-weight: bold;
          }

          .void {
            color: red;
            text-decoration: line-through;
          }
        </style>
      </head>

      <body>

  <div class="receipt-container">
        <div class="salon-header">
          <h2>${escapeHtml(salonSettings.salonName)}</h2>
          <p>${getSalonAddressHtml()}</p>
          <p>${escapeHtml(salonSettings.phone)}</p>
        </div>
        <p class="report-title">Employee Daily Report</p>
        <p>${today}</p>

        <div class="line"></div>

        <div class="row">
          <span>Employee:</span>
          <strong>${employee.name}</strong>
        </div>

        <div class="row">
          <span>Clock In:</span>
          <span>${employee.clockInTime}</span>
        </div>

        <div class="row">
          <span>Tickets:</span>
          <span>${paidTickets.length}</span>
        </div>

        <div class="row">
          <span>Voided:</span>
          <span>${voidedTickets.length}</span>
        </div>

        <div class="line"></div>

        <div class="row">
          <span>Cash Sales:</span>
          <span>$${cashSales.toFixed(2)}</span>
        </div>

        <div class="row">
          <span>Card Sales:</span>
          <span>$${cardSales.toFixed(2)}</span>
        </div>

        <div class="row">
          <span>Total Sales:</span>
          <strong>$${totalSales.toFixed(2)}</strong>
        </div>

        <p>Employee Signature: __________</p>
</div>
        <script>
          window.print();
        <\/script>
      </body>
    </html>
  `);

  receiptWindow.document.close();
}

function getTodayString() {
  return new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
}

function getTodayInputString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateString(date) {
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
}

function getInputDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatInputDateForTickets(inputDate) {
  const [year, month, day] = inputDate.split("-");

  return `${month}/${day}/${year}`;
}

function getYesterdayDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);

  return date;
}

function calculateEmployeeMetrics(employeeName) {
  const today = getTodayString();
  const employeeTickets = closedTickets.filter(ticket =>
    ticket.employee === employeeName && ticket.date === today
  );
  const paidTickets = employeeTickets.filter(ticket => !ticket.voided);
  const voidedTickets = employeeTickets.filter(ticket => ticket.voided);
  const totalSales = paidTickets.reduce((sum, ticket) => sum + ticket.total, 0);
  const cashSales = paidTickets
    .filter(ticket => ticket.paymentMethod === "Cash")
    .reduce((sum, ticket) => sum + ticket.total, 0);
  const cardSales = paidTickets
    .filter(ticket => ticket.paymentMethod === "Card")
    .reduce((sum, ticket) => sum + ticket.total, 0);
  return {
    tickets: paidTickets.length,
    voids: voidedTickets.length,
    totalSales,
    cashSales,
    cardSales
  };
}

function getEmployeeCloseTotals(employeeName, reportDate) {
  const employeeTickets = closedTickets.filter(ticket =>
    ticket.employee === employeeName && ticket.date === reportDate
  );
  const paidTickets = employeeTickets.filter(ticket => !ticket.voided);
  const voidedTickets = employeeTickets.filter(ticket => ticket.voided);
  const cashSales = paidTickets
    .filter(ticket => ticket.paymentMethod === "Cash")
    .reduce((sum, ticket) => sum + ticket.total, 0);
  const cardSales = paidTickets
    .filter(ticket => ticket.paymentMethod === "Card")
    .reduce((sum, ticket) => sum + ticket.total, 0);

  return {
    tickets: paidTickets.length,
    voids: voidedTickets.length,
    cashSales,
    cardSales,
    totalSales: cashSales + cardSales
  };
}

function buildDailyCloseReport(reportDate, employeesToClose) {
  const employeeReports = employeesToClose.map(employee => ({
    name: employee.name,
    clockInTime: employee.clockInTime,
    clockInISO: employee.clockInISO,
    clockOutTime: new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit"
    }),
    turn: Number(employee.turn || 0),
    ...getEmployeeCloseTotals(employee.name, reportDate)
  }));

  return {
    date: reportDate,
    closedAt: new Date().toISOString(),
    employees: employeeReports,
    totals: {
      cashSales: employeeReports.reduce((sum, employee) => sum + employee.cashSales, 0),
      cardSales: employeeReports.reduce((sum, employee) => sum + employee.cardSales, 0),
      totalSales: employeeReports.reduce((sum, employee) => sum + employee.totalSales, 0),
      tickets: employeeReports.reduce((sum, employee) => sum + employee.tickets, 0),
      voids: employeeReports.reduce((sum, employee) => sum + employee.voids, 0)
    }
  };
}

function shouldCloseEmployeeForDate(employee, reportInputDate) {
  if (!employee.clockInISO) return true;

  return employee.clockInISO.slice(0, 10) <= reportInputDate;
}

function closeOutBusinessDay(reportDate, reportInputDate, isAutomatic) {
  const employeesToClose = clockedInEmployees.filter(employee =>
    shouldCloseEmployeeForDate(employee, reportInputDate)
  );

  if (employeesToClose.length === 0) return false;

  const existingReportIndex = dailyCloseReports.findIndex(report => report.date === reportDate);
  const report = buildDailyCloseReport(reportDate, employeesToClose);

  if (existingReportIndex === -1) {
    dailyCloseReports.push(report);
  } else {
    dailyCloseReports[existingReportIndex] = report;
  }

  clockedInEmployees = clockedInEmployees.filter(employee =>
    !shouldCloseEmployeeForDate(employee, reportInputDate)
  );
  selectedEmployee = null;
  currentTicket = [];
  lastAutoCloseDate = reportInputDate;

  saveAppState();
  displayQueue();
  renderEmployeeDashboard();

  if (isAutomatic) {
    alert("Daily close out completed for " + reportDate + ". All previous-day employees were clocked out.");
  }

  return true;
}

function checkAutoCloseOut() {
  const yesterday = getYesterdayDate();
  const reportDate = formatDateString(yesterday);
  const reportInputDate = getInputDateString(yesterday);

  if (lastAutoCloseDate === reportInputDate) return;

  closeOutBusinessDay(reportDate, reportInputDate, true);
}

function formatMoney(amount) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

function getCardFeePercentDefault() {
  const percent = Number(salonSettings.cardFeePercent);
  return Number.isFinite(percent) && percent >= 0 ? percent : DEFAULT_SALON_SETTINGS.cardFeePercent;
}

function getSalonAddressHtml() {
  return [salonSettings.addressLine1, salonSettings.addressLine2]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");
}

function applySalonSettings() {
  const salonInfo = document.querySelector(".salon-info");

  if (salonInfo) {
    salonInfo.innerHTML = `
      <p>${escapeHtml(salonSettings.salonName)}</p>
      <p>${escapeHtml(salonSettings.addressLine1)} ${escapeHtml(salonSettings.addressLine2)}</p>
      <p>${escapeHtml(salonSettings.phone)}</p>
      <p>${escapeHtml(salonSettings.paymentProvider)} Account | ${escapeHtml(salonSettings.stationName)}</p>
    `;
  }
}

function calculateTurnCredit(total) {
  return total >= 35 ? 1 : 0.5;
}

function formatTurn(turn) {
  const normalizedTurn = Number(turn || 0);

  return Number.isInteger(normalizedTurn)
    ? normalizedTurn.toFixed(0)
    : normalizedTurn.toFixed(1);
}

function hasPendingHalfTurn(employee) {
  return Number(employee.turn || 0) % 1 !== 0;
}

function rotateEmployeeTurn(employee, turnCredit) {
  const employeeIndex = clockedInEmployees.findIndex(active => active.pin === employee.pin);

  if (employeeIndex === -1) return;

  const [updatedEmployee] = clockedInEmployees.splice(employeeIndex, 1);
  const shouldStayNext = turnCredit < 1 && hasPendingHalfTurn(updatedEmployee);

  if (shouldStayNext) {
    clockedInEmployees.unshift(updatedEmployee);
  } else {
    clockedInEmployees.push(updatedEmployee);
  }

  selectedEmployee = updatedEmployee;
}

function displayQueue() {
  const queueList = document.getElementById("queueList");
  queueList.innerHTML = "";

  clockedInEmployees.forEach((employee, index) => {
    const firstLetter = employee.name.charAt(0);
    const heldTicket = getHeldTicketForEmployee(employee);

    const card = document.createElement("div");
    card.className = "staff-card";

    card.onclick = function () {
      selectEmployee(employee);
    };

    card.innerHTML = `
      <div class="avatar">${firstLetter}</div>
      <div class="staff-card-info">
        <div class="row">
          <span>#${index + 1}</span>
          <span>${employee.name}</span>
          ${index === 0 ? "<span class=\"next-turn-pill\">Next</span>" : ""}
          ${heldTicket ? `<span class="held-ticket-pill">Held ${heldTicket.services.length}</span>` : ""}
          <span>${employee.clockInTime}</span>
        </div>
        <div class="row">
          <span>${text("turn")}: ${formatTurn(employee.turn)}</span>
          <span>${text("status")}: ${text("available")}</span>
        </div>
      </div>
    `;

    queueList.appendChild(card);
  });
}

function renderEmployeeDashboard() {
  const dashboard = document.getElementById("employeeDashboard");
  if (!dashboard) return;

  const todayMetrics = employees.map(employee => ({
    ...employee,
    isClockedIn: clockedInEmployees.some(active => active.name === employee.name),
    shift: clockedInEmployees.find(active => active.name === employee.name),
    metrics: calculateEmployeeMetrics(employee.name)
  }));

  const dailyTickets = todayMetrics.reduce((sum, employee) => sum + employee.metrics.tickets, 0);
  const dailyVoids = todayMetrics.reduce((sum, employee) => sum + employee.metrics.voids, 0);
  const activeStaff = todayMetrics.filter(employee => employee.isClockedIn).length;

  dashboard.innerHTML = `
    <div class="dashboard-summary">
      <div>
        <span>${text("activeStaff")}</span>
        <strong>${activeStaff}</strong>
      </div>
      <div>
        <span>${text("tickets")}</span>
        <strong>${dailyTickets}</strong>
      </div>
      <div>
        <span>${text("voids")}</span>
        <strong>${dailyVoids}</strong>
      </div>
    </div>

    <div class="employee-status-list">
      ${todayMetrics.map(employee => `
        <div class="employee-status-card ${employee.isClockedIn ? "active" : ""}">
          <div class="employee-status-top">
            <div>
              <strong>${employee.name}</strong>
              <span>${employee.isClockedIn ? text("clockedIn") + " " + employee.shift.clockInTime : text("notClockedIn")}</span>
            </div>
            <span class="status-pill">${employee.isClockedIn ? text("active") : text("off")}</span>
          </div>

          <div class="status-grid">
            <div>
              <span>${text("tickets")}</span>
              <strong>${employee.metrics.tickets}</strong>
            </div>
            <div>
              <span>${text("voids")}</span>
              <strong>${employee.metrics.voids}</strong>
            </div>
            <div>
              <span>${text("turn")}</span>
              <strong>${employee.shift ? formatTurn(employee.shift.turn) : "0"}</strong>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function openEmployeeDashboard() {
  renderEmployeeDashboard();
  closeFunctions();
}

function openDailyCloseReports() {
  currentMainView = "closeReports";
  selectedEmployee = null;
  currentTicket = [];
  closeFunctions();

  const serviceSection = document.querySelectorAll(".content-section")[0];
  const reports = [...dailyCloseReports].sort((first, second) =>
    new Date(second.closedAt) - new Date(first.closedAt)
  );

  serviceSection.innerHTML = `
    <h3>DAILY CLOSE OUT</h3>
    <div class="close-report-actions">
      <button onclick="manualCloseOutToday()">Close Out Today</button>
    </div>
    <div class="close-report-list">
      ${reports.length === 0 ? `<div class="empty-report">No close out records yet</div>` : reports.map(report => `
        <div class="close-report-card">
          <div class="close-report-top">
            <strong>${report.date}</strong>
            <span>Closed ${new Date(report.closedAt).toLocaleString("en-US")}</span>
          </div>
          <div class="close-report-summary">
            <div><span>Cash</span><strong>${formatMoney(report.totals.cashSales)}</strong></div>
            <div><span>Card</span><strong>${formatMoney(report.totals.cardSales)}</strong></div>
            <div><span>Total</span><strong>${formatMoney(report.totals.totalSales)}</strong></div>
          </div>
          <div class="close-report-employees">
            ${report.employees.map(employee => `
              <div class="close-report-row">
                <span>${employee.name}</span>
                <span>Cash ${formatMoney(employee.cashSales)}</span>
                <span>Card ${formatMoney(employee.cardSales)}</span>
                <span>${employee.tickets} tickets</span>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function manualCloseOutToday() {
  const today = new Date();
  const reportDate = formatDateString(today);
  const reportInputDate = getInputDateString(today);

  if (!confirm("Close out all clocked-in employees for today?")) return;

  const didClose = closeOutBusinessDay(reportDate, reportInputDate, false);

  if (!didClose) {
    alert("No clocked-in employees to close out.");
  }

  openDailyCloseReports();
}

function parseTicketDate(ticketDate) {
  if (!ticketDate) return null;

  const parts = String(ticketDate).split("/");
  if (parts.length !== 3) return null;

  return new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
}

function getDateRangeLabel(startInputDate, endInputDate) {
  return formatInputDateForTickets(startInputDate) + " - " + formatInputDateForTickets(endInputDate);
}

function getOwnerReportRangeFromInputs() {
  const startInput = document.getElementById("ownerReportStartDate");
  const endInput = document.getElementById("ownerReportEndDate");
  const today = getTodayInputString();
  const startDate = startInput?.value || today;
  const endDate = endInput?.value || startDate;

  return {
    startDate,
    endDate: endDate < startDate ? startDate : endDate
  };
}

function getSalonRevenueReport(startInputDate, endInputDate = startInputDate) {
  const safeStart = startInputDate || getTodayInputString();
  const safeEnd = endInputDate || safeStart;
  const startDate = safeEnd < safeStart ? safeEnd : safeStart;
  const endDate = safeEnd < safeStart ? safeStart : safeEnd;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T23:59:59");
  const paidTickets = closedTickets.filter(ticket => {
    const ticketDate = parseTicketDate(ticket.date);
    return ticketDate && ticketDate >= start && ticketDate <= end && !ticket.voided;
  });

  const cashSales = paidTickets
    .filter(ticket => ticket.paymentMethod === "Cash")
    .reduce((sum, ticket) => sum + ticket.total, 0);
  const cardSales = paidTickets
    .filter(ticket => ticket.paymentMethod === "Card")
    .reduce((sum, ticket) => sum + ticket.total, 0);
  const tipTotal = paidTickets.reduce((sum, ticket) => sum + Number(ticket.tipAmount || 0), 0);
  const cardFeeTotal = paidTickets.reduce((sum, ticket) => sum + Number(ticket.cardFeeAmount || 0), 0);
  const employeeCommissionTotal = paidTickets.reduce((sum, ticket) => {
    const employee = employees.find(staff => staff.name === ticket.employee);
    const payrollPercent = Number(employee?.payrollPercent || 0);
    const serviceSales = Math.max(0, Number(ticket.subtotal ?? ticket.total ?? 0) - Number(ticket.discountAmount || 0));
    return sum + (serviceSales * (payrollPercent / 100));
  }, 0);
  const totalSales = cashSales + cardSales;

  const employeeNames = [...new Set([
    ...employees.map(employee => employee.name),
    ...paidTickets.map(ticket => ticket.employee)
  ])];

  return {
    reportDate: getDateRangeLabel(startDate, endDate),
    startDate,
    endDate,
    ticketCount: paidTickets.length,
    cashSales,
    cardSales,
    tipTotal,
    cardFeeTotal,
    employeeCommissionTotal,
    profitAfterCommission: Math.max(0, totalSales - employeeCommissionTotal),
    totalSales,
    employees: employeeNames.map(name => {
      const employee = employees.find(staff => staff.name === name);
      const payrollPercent = Number(employee?.payrollPercent || 0);
      const employeeTickets = paidTickets.filter(ticket => ticket.employee === name);
      const employeeCash = employeeTickets
        .filter(ticket => ticket.paymentMethod === "Cash")
        .reduce((sum, ticket) => sum + ticket.total, 0);
      const employeeCard = employeeTickets
        .filter(ticket => ticket.paymentMethod === "Card")
        .reduce((sum, ticket) => sum + ticket.total, 0);
      const employeeServiceSales = employeeTickets.reduce((sum, ticket) => {
        const serviceSales = Math.max(0, Number(ticket.subtotal ?? ticket.total ?? 0) - Number(ticket.discountAmount || 0));
        return sum + serviceSales;
      }, 0);
      const employeeCommission = employeeServiceSales * (payrollPercent / 100);

      return {
        name,
        payrollPercent,
        tickets: employeeTickets.length,
        cashSales: employeeCash,
        cardSales: employeeCard,
        totalSales: employeeCash + employeeCard,
        tips: employeeTickets.reduce((sum, ticket) => sum + Number(ticket.tipAmount || 0), 0),
        commission: employeeCommission,
        profitAfterCommission: Math.max(0, employeeCash + employeeCard - employeeCommission)
      };
    })
  };
}

function getRevenueByDate() {
  const reportMap = {};

  closedTickets
    .filter(ticket => !ticket.voided)
    .forEach(ticket => {
      if (!reportMap[ticket.date]) {
        reportMap[ticket.date] = {
          date: ticket.date,
          cashSales: 0,
          cardSales: 0,
          totalSales: 0
        };
      }

      if (ticket.paymentMethod === "Cash") {
        reportMap[ticket.date].cashSales += ticket.total;
      }

      if (ticket.paymentMethod === "Card") {
        reportMap[ticket.date].cardSales += ticket.total;
      }

      reportMap[ticket.date].totalSales += ticket.total;
    });

  return Object.values(reportMap)
    .sort((first, second) => new Date(first.date) - new Date(second.date))
    .slice(-10);
}

function requireOwnerAccess(activeOwnerTab) {
  if (currentAccessRole === "owner") return false;
  if (["setup", "payroll"].includes(activeOwnerTab)) {
    alert("Owner access required.");
    openOwnerDashboard(false, "dashboard");
    return true;
  }
  return false;
}

function openOwnerDashboard(requirePassword = true, activeOwnerTab = "dashboard") {
  if (requirePassword) {
    openOwnerPasswordModal(activeOwnerTab);
    return;
  }

  if (requireOwnerAccess(activeOwnerTab)) return;

  currentMainView = "owner";
  selectedEmployee = null;
  currentTicket = [];

  const reportDate = getTodayInputString();
  const report = getSalonRevenueReport(reportDate, reportDate);
  const serviceSection = document.querySelectorAll(".content-section")[0];
  const ownerOnlyTabs = currentAccessRole === "owner"
    ? `
      <button class="${activeOwnerTab === "payroll" ? "active" : ""}" onclick="openOwnerDashboard(false, 'payroll')">Payroll</button>
      <button class="${activeOwnerTab === "setup" ? "active" : ""}" onclick="openOwnerDashboard(false, 'setup')">Setup</button>
    `
    : "";
  const ownerTabs = `
    <div class="owner-tabs">
      <button class="${activeOwnerTab === "dashboard" ? "active" : ""}" onclick="openOwnerDashboard(false, 'dashboard')">Dashboard</button>
      <button class="${activeOwnerTab === "services" ? "active" : ""}" onclick="openOwnerDashboard(false, 'services')">Service Menu</button>
      ${ownerOnlyTabs}
    </div>
  `;

  if (activeOwnerTab === "setup") {
    serviceSection.innerHTML = `
      <h3>OWNER</h3>
      ${ownerTabs}

      <section class="owner-panel owner-setup-screen">
        <div class="owner-panel-title">
          <strong>Salon Setup</strong>
          <span>Saved on this computer</span>
        </div>

        <div class="owner-setup-grid">
          <label>Salon name<input id="setupSalonName" type="text" value="${escapeHtml(salonSettings.salonName)}"></label>
          <label>Receipt name<input id="setupReceiptName" type="text" value="${escapeHtml(salonSettings.receiptName)}"></label>
          <label>Address line 1<input id="setupAddressLine1" type="text" value="${escapeHtml(salonSettings.addressLine1)}"></label>
          <label>Address line 2<input id="setupAddressLine2" type="text" value="${escapeHtml(salonSettings.addressLine2)}"></label>
          <label>Phone<input id="setupPhone" type="text" value="${escapeHtml(salonSettings.phone)}"></label>
          <label>Station name<input id="setupStationName" type="text" value="${escapeHtml(salonSettings.stationName)}"></label>
          <label>Payment provider
            <select id="setupPaymentProvider">
              <option ${salonSettings.paymentProvider === "Square" ? "selected" : ""}>Square</option>
              <option ${salonSettings.paymentProvider === "Clover" ? "selected" : ""}>Clover</option>
              <option ${salonSettings.paymentProvider === "Manual" ? "selected" : ""}>Manual</option>
            </select>
          </label>
          <label>Card fee percent<input id="setupCardFeePercent" type="number" min="0" max="10" step="0.01" value="${getCardFeePercentDefault().toFixed(2)}"></label>
          <label>Manager password<input id="setupManagerPassword" type="password" value="${escapeHtml(managerPassword)}"></label>
          <label class="owner-setup-wide">Receipt footer<input id="setupReceiptFooter" type="text" value="${escapeHtml(salonSettings.receiptFooter)}"></label>
        </div>

        <div class="owner-setup-actions">
          <button onclick="saveSalonSetup()">Save Setup</button>
          <button onclick="resetSalonSetup()">Reset Default</button>
        </div>
      </section>
    `;
    return;
  }

  if (activeOwnerTab === "services") {
    serviceSection.innerHTML = `
      <h3>OWNER</h3>
      ${ownerTabs}

      <section class="owner-panel owner-service-screen">
        <div class="owner-panel-title">
          <strong>Service Menu</strong>
        </div>

        <div class="owner-service-box">
          <div class="owner-add-service">
            <select id="ownerServiceCategory">
              ${Object.keys(services).map(category => `<option value="${escapeHtml(category)}">${serviceText(category)}</option>`).join("")}
            </select>
            <input id="ownerNewServiceCategory" type="text" placeholder="New category optional">
            <input id="ownerServiceName" type="text" placeholder="Service name">
            <input id="ownerServicePrice" type="number" min="0" step="1" placeholder="Price">
            <button onclick="addOwnerService()">Add Service</button>
          </div>
          <div id="ownerServiceList" class="owner-service-list owner-service-list-wide"></div>
        </div>
      </section>
    `;

    renderOwnerServiceList();
    return;
  }

  if (activeOwnerTab === "payroll") {
    serviceSection.innerHTML = `
      <h3>OWNER</h3>
      ${ownerTabs}

      <section class="owner-panel owner-payroll-screen">
        <div class="owner-panel-title owner-report-title">
          <strong>Payroll</strong>
          <div class="owner-report-controls">
            <input id="payrollStartDate" type="date" value="${report.startDate}" onchange="refreshPayrollReport()">
            <span>to</span>
            <input id="payrollEndDate" type="date" value="${report.endDate}" onchange="refreshPayrollReport()">
          </div>
        </div>

        <div class="owner-report-presets">
          <button onclick="setPayrollPreset('today')">Today</button>
          <button onclick="setPayrollPreset('thisMonth')">This Month</button>
          <button onclick="setPayrollPreset('lastMonth')">Last Month</button>
          <button onclick="setPayrollPreset('thisYear')">This Year</button>
          <button onclick="setPayrollPreset('lastYear')">Last Year</button>
          <button onclick="setPayrollPreset('all')">All</button>
        </div>

        <div id="payrollSummary" class="owner-report-summary"></div>
        <div id="payrollRows" class="owner-payroll-list"></div>
      </section>
    `;

    refreshPayrollReport();
    return;
  }

  serviceSection.innerHTML = `
    <h3>OWNER</h3>
    ${ownerTabs}

    <div class="owner-layout">
      <section class="owner-panel">
        <div class="owner-panel-title">
          <strong>Employees</strong>
        </div>

        <div class="owner-add-employee">
          <input id="ownerEmployeeName" type="text" placeholder="Employee name">
          <input id="ownerEmployeePin" type="text" inputmode="numeric" maxlength="4" placeholder="4-digit PIN">
          <select id="ownerEmployeeRole">
            <option>Employee</option>
            <option>Manager</option>
          </select>
          <input id="ownerEmployeePayrollPercent" type="number" min="0" max="100" step="0.01" placeholder="Payroll %">
          <button onclick="addOwnerEmployee()">Add</button>
        </div>

        <div id="ownerEmployeeList" class="owner-employee-list"></div>

        ${currentAccessRole === "owner" ? `
          <div class="owner-password-box">
            <strong>Change Owner Password</strong>
            <input id="ownerCurrentPassword" type="password" placeholder="Current password">
            <input id="ownerNewPassword" type="password" placeholder="New password">
            <input id="ownerConfirmPassword" type="password" placeholder="Confirm new password">
            <button onclick="changeOwnerPassword()">Update Password</button>
          </div>

          <div class="owner-maintenance-box">
            <strong>Safe POS Tools</strong>
            <span>Refresh reloads the screen only. Backup saves records to a file. Restore brings records back from a saved backup.</span>
            <div class="owner-maintenance-actions">
              <button type="button" onclick="refreshPosApp()">Refresh POS</button>
              <button type="button" onclick="downloadPosBackup()">Backup Records</button>
              <button type="button" onclick="choosePosBackupFile()">Restore Backup</button>
              <button type="button" onclick="openAuditLog()">Audit Log</button>
            </div>
            <input id="posBackupFileInput" type="file" accept="application/json" onchange="restorePosBackup(this)" hidden>
          </div>
        ` : ""}
      </section>

      <section class="owner-panel">
        <div class="owner-panel-title owner-report-title">
          <strong>Salon Income <small class="owner-version-pill">Profit View</small></strong>
          <div class="owner-report-controls">
            <input id="ownerReportStartDate" type="date" value="${report.startDate}" onchange="refreshOwnerReport()">
            <span>to</span>
            <input id="ownerReportEndDate" type="date" value="${report.endDate}" onchange="refreshOwnerReport()">
          </div>
        </div>

        <div class="owner-report-presets">
          <button onclick="setOwnerReportPreset('today')">Today</button>
          <button onclick="setOwnerReportPreset('thisMonth')">This Month</button>
          <button onclick="setOwnerReportPreset('lastMonth')">Last Month</button>
          <button onclick="setOwnerReportPreset('thisYear')">This Year</button>
          <button onclick="setOwnerReportPreset('lastYear')">Last Year</button>
          <button onclick="setOwnerReportPreset('all')">All</button>
        </div>

        <div id="ownerReportSummary" class="owner-report-summary"></div>
        <div id="ownerRevenueChart" class="owner-revenue-chart"></div>
        <div id="ownerReportEmployees" class="owner-report-employees"></div>
      </section>

    </div>
  `;

  renderOwnerEmployeeList();
  renderOwnerReport(report);
}

function openOwnerPasswordModal(activeOwnerTab = "dashboard") {
  pendingOwnerTab = activeOwnerTab;

  const modal = document.getElementById("ownerPasswordModal");
  const input = document.getElementById("ownerAccessPassword");
  const error = document.getElementById("ownerAccessError");

  if (!modal || !input || !error) return;

  input.value = "";
  error.textContent = "";
  document.querySelector(".owner-password-kicker").textContent = "Owner / Manager Access";
  document.querySelector(".owner-password-card h2").textContent = "Enter Access Password";
  modal.style.display = "flex";

  setTimeout(() => input.focus(), 50);
}

function closeOwnerPasswordModal() {
  const modal = document.getElementById("ownerPasswordModal");
  if (modal) modal.style.display = "none";
}

function submitOwnerPassword() {
  const input = document.getElementById("ownerAccessPassword");
  const error = document.getElementById("ownerAccessError");
  const card = document.querySelector(".owner-password-card");

  if (!input || !error) return;

  if (input.value === ownerPassword) {
    currentAccessRole = "owner";
  } else if (input.value === managerPassword) {
    currentAccessRole = "manager";
    if (["setup", "payroll"].includes(pendingOwnerTab)) {
      pendingOwnerTab = "dashboard";
    }
  } else {
    error.textContent = "Incorrect access password.";
    card?.classList.remove("pin-error");
    void card?.offsetWidth;
    card?.classList.add("pin-error");
    input.select();
    return;
  }

  closeOwnerPasswordModal();
  openOwnerDashboard(false, pendingOwnerTab);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function saveSalonSetup() {
  const nextCardFeePercent = Number(document.getElementById("setupCardFeePercent")?.value || 0);

  salonSettings = {
    salonName: document.getElementById("setupSalonName")?.value.trim() || DEFAULT_SALON_SETTINGS.salonName,
    receiptName: document.getElementById("setupReceiptName")?.value.trim() || DEFAULT_SALON_SETTINGS.receiptName,
    addressLine1: document.getElementById("setupAddressLine1")?.value.trim() || "",
    addressLine2: document.getElementById("setupAddressLine2")?.value.trim() || "",
    phone: document.getElementById("setupPhone")?.value.trim() || "",
    stationName: document.getElementById("setupStationName")?.value.trim() || DEFAULT_SALON_SETTINGS.stationName,
    paymentProvider: document.getElementById("setupPaymentProvider")?.value || DEFAULT_SALON_SETTINGS.paymentProvider,
    cardFeePercent: Number.isFinite(nextCardFeePercent) && nextCardFeePercent >= 0 ? nextCardFeePercent : DEFAULT_SALON_SETTINGS.cardFeePercent,
    receiptFooter: document.getElementById("setupReceiptFooter")?.value.trim() || DEFAULT_SALON_SETTINGS.receiptFooter
  };

  managerPassword = document.getElementById("setupManagerPassword")?.value.trim() || DEFAULT_MANAGER_PASSWORD;
  addAuditLog("Salon Setup Updated", {
    actor: "Owner",
    note: "Owner updated salon settings, payment provider, card fee, or manager password."
  });

  saveAppState();
  applySalonSettings();
  alert("Salon setup saved.");
  openOwnerDashboard(false, "setup");
}

function resetSalonSetup() {
  if (!confirm("Reset salon setup to default?")) return;

  salonSettings = { ...DEFAULT_SALON_SETTINGS };
  managerPassword = document.getElementById("setupManagerPassword")?.value.trim() || DEFAULT_MANAGER_PASSWORD;
  addAuditLog("Salon Setup Reset", {
    actor: "Owner",
    note: "Owner reset salon setup to default values."
  });

  saveAppState();
  applySalonSettings();
  openOwnerDashboard(false, "setup");
}

function getAllServices() {
  return Object.entries(services).flatMap(([category, categoryServices]) =>
    categoryServices.map(service => ({ ...service, category }))
  );
}

function getServiceOptionsHtml(selectedService = "") {
  return getAllServices().map(service => {
    const selected = service.name === selectedService ? "selected" : "";
    return `<option value="${escapeHtml(service.name)}" ${selected}>${serviceText(service.name)} - $${service.price}</option>`;
  }).join("");
}

function getDefaultServiceName() {
  return getAllServices()[0]?.name || "";
}

function renderOwnerEmployeeList() {
  const list = document.getElementById("ownerEmployeeList");
  if (!list) return;

  list.innerHTML = employees.map((employee, index) => {
    const activeEmployee = clockedInEmployees.find(active => active.name === employee.name);
    const isClockedIn = Boolean(activeEmployee);

    return `
      <div class="owner-employee-row">
        <div>
          <strong>${employee.name}</strong>
          <span>PIN ${employee.pin}</span>
          <span>${employee.role || "Employee"} | Payroll ${Number(employee.payrollPercent || 0).toFixed(2)}%</span>
          <span class="owner-clock-status">
            ${isClockedIn ? "Clocked in " + activeEmployee.clockInTime : "Not clocked in"}
          </span>
        </div>
        <div class="owner-employee-actions">
          <button class="edit-employee-btn" onclick="editOwnerEmployee(${index})">Edit</button>
          <button class="${isClockedIn ? "owner-clock-out-btn" : "owner-clock-in-btn"}" onclick="toggleOwnerEmployeeClock(${index})">
            ${isClockedIn ? "Clock Out" : "Clock In"}
          </button>
          <button ${isClockedIn ? "disabled" : ""} onclick="removeOwnerEmployee(${index})">
            ${isClockedIn ? "Clocked In" : "Remove"}
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function addOwnerEmployee() {
  const nameInput = document.getElementById("ownerEmployeeName");
  const pinInput = document.getElementById("ownerEmployeePin");
  const roleInput = document.getElementById("ownerEmployeeRole");
  const payrollInput = document.getElementById("ownerEmployeePayrollPercent");
  const name = nameInput.value.trim();
  const pin = pinInput.value.trim();
  const payrollPercent = Number(payrollInput?.value || 0);

  if (!name || !pin) {
    alert("Please enter employee name and PIN.");
    return;
  }

  if (!/^\d{4}$/.test(pin)) {
    alert("PIN must be 4 numbers.");
    return;
  }

  if (employees.some(employee => employee.name.toLowerCase() === name.toLowerCase())) {
    alert("Employee name already exists.");
    return;
  }

  if (employees.some(employee => employee.pin === pin)) {
    alert("PIN already exists.");
    return;
  }

  employees.push({ name, pin, role: roleInput?.value || "Employee", payrollPercent: Number.isFinite(payrollPercent) ? payrollPercent : 0 });
  addAuditLog("Employee Added", {
    actor: "Owner",
    employee: name,
    note: `${name} added as ${roleInput?.value || "Employee"} with payroll ${Number.isFinite(payrollPercent) ? payrollPercent : 0}%.`
  });
  saveAppState();
  nameInput.value = "";
  pinInput.value = "";
  if (payrollInput) payrollInput.value = "";
  renderOwnerEmployeeList();
  renderEmployeeDashboard();
}

function renderOwnerServiceList() {
  const list = document.getElementById("ownerServiceList");
  if (!list) return;

  list.innerHTML = Object.entries(services).map(([category, categoryServices]) => {
    const categoryKey = encodeURIComponent(category);

    return `
      <div class="owner-service-category">
        <strong>${serviceText(category)}</strong>
        ${categoryServices.length === 0 ? `<span>No services in this category</span>` : categoryServices.map((service, index) => `
          <div class="owner-service-row">
            <span>${serviceText(service.name)}</span>
            <strong>$${service.price}</strong>
            <button class="edit-service-btn" onclick="editOwnerService('${categoryKey}', ${index})">Edit</button>
            <button onclick="removeOwnerService('${categoryKey}', ${index})">Remove</button>
          </div>
        `).join("")}
      </div>
    `;
  }).join("");
}

function addOwnerService() {
  const categorySelect = document.getElementById("ownerServiceCategory");
  const newCategoryInput = document.getElementById("ownerNewServiceCategory");
  const nameInput = document.getElementById("ownerServiceName");
  const priceInput = document.getElementById("ownerServicePrice");

  const category = newCategoryInput.value.trim() || categorySelect.value;
  const name = nameInput.value.trim();
  const price = Number(priceInput.value);

  if (!category || !name || !Number.isFinite(price) || price < 0) {
    alert("Please enter category, service name, and price.");
    return;
  }

  if (!services[category]) {
    services[category] = [];
  }

  if (services[category].some(service => service.name.toLowerCase() === name.toLowerCase())) {
    alert("That service already exists in this category.");
    return;
  }

  services[category].push({ name, price });
  addAuditLog("Service Added", {
    actor: "Owner",
    note: `${name} added to ${category} at ${formatMoney(price)}.`
  });
  saveAppState();
  newCategoryInput.value = "";
  nameInput.value = "";
  priceInput.value = "";
  openOwnerDashboard(false, "services");
}

function editOwnerService(category, index) {
  category = decodeURIComponent(category);
  const service = services[category]?.[index];
  if (!service) return;

  const newName = prompt("Service name:", service.name);
  if (newName === null) return;

  const cleanName = newName.trim();
  if (!cleanName) {
    alert("Service name cannot be blank.");
    return;
  }

  const newPrice = prompt("Service price:", service.price);
  if (newPrice === null) return;

  const cleanPrice = Number(newPrice);
  if (!Number.isFinite(cleanPrice) || cleanPrice < 0) {
    alert("Price must be a valid number.");
    return;
  }

  services[category][index] = {
    name: cleanName,
    price: cleanPrice
  };
  addAuditLog("Service Updated", {
    actor: "Owner",
    note: `${service.name} changed to ${cleanName} at ${formatMoney(cleanPrice)}.`
  });

  saveAppState();
  renderOwnerServiceList();
}

function removeOwnerService(category, index) {
  category = decodeURIComponent(category);
  const service = services[category]?.[index];
  if (!service) return;

  if (!confirm("Remove " + service.name + "?")) return;

  services[category].splice(index, 1);
  addAuditLog("Service Removed", {
    actor: "Owner",
    note: `${service.name} removed from ${category}.`
  });

  if (services[category].length === 0) {
    delete services[category];
  }

  saveAppState();
  openOwnerDashboard(false, "services");
}

function editOwnerEmployee(index) {
  const employee = employees[index];
  if (!employee) return;

  const newName = prompt("Employee name:", employee.name);
  if (newName === null) return;

  const cleanName = newName.trim();
  if (!cleanName) {
    alert("Employee name cannot be blank.");
    return;
  }

  const newPin = prompt("4-digit PIN:", employee.pin);
  if (newPin === null) return;

  const cleanPin = newPin.trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    alert("PIN must be 4 numbers.");
    return;
  }

  if (employees.some((otherEmployee, otherIndex) =>
    otherIndex !== index && otherEmployee.name.toLowerCase() === cleanName.toLowerCase()
  )) {
    alert("Employee name already exists.");
    return;
  }

  if (employees.some((otherEmployee, otherIndex) =>
    otherIndex !== index && otherEmployee.pin === cleanPin
  )) {
    alert("PIN already exists.");
    return;
  }

  const newRole = prompt("Role: Employee or Manager", employee.role || "Employee");
  if (newRole === null) return;
  const cleanRole = newRole.trim().toLowerCase() === "manager" ? "Manager" : "Employee";

  const newPayrollPercent = prompt("Payroll commission percent:", Number(employee.payrollPercent || 0));
  if (newPayrollPercent === null) return;
  const cleanPayrollPercent = Number(newPayrollPercent);
  if (!Number.isFinite(cleanPayrollPercent) || cleanPayrollPercent < 0 || cleanPayrollPercent > 100) {
    alert("Payroll percent must be between 0 and 100.");
    return;
  }

  const oldName = employee.name;
  const oldPin = employee.pin;

  employees[index] = {
    name: cleanName,
    pin: cleanPin,
    role: cleanRole,
    payrollPercent: cleanPayrollPercent
  };

  clockedInEmployees.forEach(activeEmployee => {
    if (activeEmployee.name === oldName || activeEmployee.pin === oldPin) {
      activeEmployee.name = cleanName;
      activeEmployee.pin = cleanPin;
      activeEmployee.role = cleanRole;
      activeEmployee.payrollPercent = cleanPayrollPercent;
    }
  });

  appointments.forEach(appointment => {
    if (appointment.employee === oldName) {
      appointment.employee = cleanName;
    }
  });
  addAuditLog("Employee Updated", {
    actor: "Owner",
    employee: cleanName,
    note: `${oldName} updated to ${cleanName}; role ${cleanRole}; payroll ${cleanPayrollPercent}%.`
  });

  saveAppState();
  renderOwnerEmployeeList();
  refreshOwnerReport();
  displayQueue();
  renderEmployeeDashboard();
}

function removeOwnerEmployee(index) {
  const employeeToRemove = employees[index];
  if (!employeeToRemove) return;

  const name = employeeToRemove.name;

  if (clockedInEmployees.some(employee => employee.name === name)) {
    alert("Clock this employee out before removing them.");
    return;
  }

  if (!confirm("Remove " + name + " from employees?")) return;

  employees = employees.filter(employee => employee.name !== name);
  addAuditLog("Employee Removed", {
    actor: "Owner",
    employee: name,
    note: `${name} removed from employee list.`
  });
  saveAppState();
  renderOwnerEmployeeList();
  refreshOwnerReport();
  renderEmployeeDashboard();
}

function toggleOwnerEmployeeClock(index) {
  const employee = employees[index];
  if (!employee) return;

  const activeIndex = clockedInEmployees.findIndex(active => active.name === employee.name || active.pin === employee.pin);

  if (activeIndex === -1) {
    ownerClockInEmployee(employee);
    return;
  }

  ownerClockOutEmployee(activeIndex);
}

function ownerClockInEmployee(employee) {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });

  clockedInEmployees.push({
    name: employee.name,
    pin: employee.pin,
    clockInTime: time,
    clockInISO: now.toISOString(),
    turn: 0
  });
  addAuditLog("Owner Clock In", {
    actor: "Owner",
    employee: employee.name,
    note: `Owner clocked in ${employee.name} at ${time}.`
  });

  saveAppState();
  renderOwnerEmployeeList();
  refreshOwnerReport();
  displayQueue();
  renderEmployeeDashboard();
  alert(employee.name + " clocked in at " + time);
}

function ownerClockOutEmployee(activeIndex) {
  const employee = clockedInEmployees[activeIndex];
  if (!employee) return;

  if (!confirm("Clock out " + employee.name + "?")) return;

  clockedInEmployees.splice(activeIndex, 1);
  addAuditLog("Owner Clock Out", {
    actor: "Owner",
    employee: employee.name,
    note: `Owner clocked out ${employee.name}.`
  });

  saveAppState();
  renderOwnerEmployeeList();
  refreshOwnerReport();
  displayQueue();
  renderEmployeeDashboard();

  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });

  alert(employee.name + " clocked out at " + time);
}

function changeOwnerPassword() {
  const currentInput = document.getElementById("ownerCurrentPassword");
  const newInput = document.getElementById("ownerNewPassword");
  const confirmInput = document.getElementById("ownerConfirmPassword");
  const currentPassword = currentInput.value;
  const newPassword = newInput.value.trim();
  const confirmPassword = confirmInput.value.trim();

  if (currentPassword !== ownerPassword) {
    alert("Current owner password is incorrect.");
    return;
  }

  if (newPassword.length < 4) {
    alert("New owner password must be at least 4 characters.");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("New passwords do not match.");
    return;
  }

  ownerPassword = newPassword;
  addAuditLog("Owner Password Updated", {
    actor: "Owner",
    note: "Owner password was changed."
  });
  saveAppState();
  currentInput.value = "";
  newInput.value = "";
  confirmInput.value = "";
  alert("Owner password updated.");
}

function getPosBackupData() {
  const savedData = {};
  Object.values(STORAGE_KEYS).forEach(key => {
    savedData[key] = loadSavedData(key, null);
  });

  return {
    app: "GloominGrowPOS",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: savedData
  };
}

function refreshPosApp() {
  addAuditLog("POS Refreshed", { actor: "Owner", note: "Owner refreshed the POS screen." });
  saveAppState();
  location.reload();
}

function downloadPosBackup() {
  addAuditLog("Backup Downloaded", { actor: "Owner", note: "Owner downloaded a full POS backup." });
  saveAppState();
  const backup = getPosBackupData();
  const today = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `gloomin-grow-pos-backup-${today}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function choosePosBackupFile() {
  const input = document.getElementById("posBackupFileInput");
  if (input) input.click();
}

function restorePosBackup(input) {
  const file = input?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      const allowedKeys = new Set(Object.values(STORAGE_KEYS));

      if (backup?.app !== "GloominGrowPOS" || !backup.data || typeof backup.data !== "object") {
        alert("This backup file does not look like a Gloomin Grow POS backup.");
        return;
      }

      if (!confirm("Restore this backup? This will replace the saved POS records on this computer.")) {
        return;
      }

      Object.entries(backup.data).forEach(([key, value]) => {
        if (allowedKeys.has(key)) {
          localStorage.setItem(key, JSON.stringify(value));
        }
      });

      const restoredAuditLog = loadSavedData(STORAGE_KEYS.auditLog, []);
      auditLog = Array.isArray(restoredAuditLog) ? restoredAuditLog : [];
      addAuditLog("Backup Restored", {
        actor: "Owner",
        fileName: file.name,
        note: "Owner restored POS records from backup."
      });

      alert("Backup restored. The app will reload now.");
      location.reload();
    } catch (error) {
      alert("Could not restore this backup file. Please choose a valid POS backup.");
    } finally {
      input.value = "";
    }
  };
  reader.readAsText(file);
}

function resetOwnerSystem() {
  alert("Full reset is developer-only now. Please make a backup first, then call support if this salon needs a full reset.");
}

function developerResetOwnerSystem() {
  const developerCode = prompt("Developer reset code:");

  if (developerCode !== "DEVELOPER RESET") {
    alert("Reset cancelled.");
    return;
  }

  if (!confirm("Developer reset will erase saved POS data on this computer. A backup should be downloaded first. Continue?")) {
    return;
  }

  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  alert("Developer reset complete. The app will reload now.");
  location.reload();
}


function getPayrollReport(startInputDate, endInputDate) {
  const report = getSalonRevenueReport(startInputDate, endInputDate);
  const paidTickets = closedTickets.filter(ticket => {
    const ticketDate = parseTicketDate(ticket.date);
    const start = new Date(report.startDate + "T00:00:00");
    const end = new Date(report.endDate + "T23:59:59");
    return ticketDate && ticketDate >= start && ticketDate <= end && !ticket.voided;
  });

  const rows = employees.map(employee => {
    const employeeTickets = paidTickets.filter(ticket => ticket.employee === employee.name);
    const serviceSales = employeeTickets.reduce((sum, ticket) => {
      const subtotal = typeof ticket.subtotal === "number" ? ticket.subtotal : Number(ticket.total || 0);
      const discount = Number(ticket.discountAmount || 0);
      return sum + Math.max(0, subtotal - discount);
    }, 0);
    const tips = employeeTickets.reduce((sum, ticket) => sum + Number(ticket.tipAmount || 0), 0);
    const payrollPercent = Number(employee.payrollPercent || 0);
    const commission = serviceSales * (payrollPercent / 100);

    return {
      name: employee.name,
      role: employee.role || "Employee",
      payrollPercent,
      tickets: employeeTickets.length,
      serviceSales,
      tips,
      commission,
      totalPay: commission + tips
    };
  });

  return {
    ...report,
    rows,
    serviceSales: rows.reduce((sum, row) => sum + row.serviceSales, 0),
    payrollTotal: rows.reduce((sum, row) => sum + row.totalPay, 0)
  };
}

function getPayrollRangeFromInputs() {
  const startDate = document.getElementById("payrollStartDate")?.value || getTodayInputString();
  const endDate = document.getElementById("payrollEndDate")?.value || startDate;
  return { startDate, endDate: endDate < startDate ? startDate : endDate };
}

function refreshPayrollReport() {
  const range = getPayrollRangeFromInputs();
  const report = getPayrollReport(range.startDate, range.endDate);
  const summary = document.getElementById("payrollSummary");
  const rows = document.getElementById("payrollRows");

  if (!summary || !rows) return;

  summary.innerHTML = `
    <div><span>Range</span><strong>${report.reportDate}</strong></div>
    <div><span>Service Sales</span><strong>${formatMoney(report.serviceSales)}</strong></div>
    <div><span>Tips</span><strong>${formatMoney(report.tipTotal)}</strong></div>
    <div><span>Payroll Total</span><strong>${formatMoney(report.payrollTotal)}</strong></div>
  `;

  rows.innerHTML = report.rows.map(row => `
    <div class="owner-payroll-row">
      <span><strong>${row.name}</strong><small>${row.role} | ${row.payrollPercent.toFixed(2)}%</small></span>
      <span>Tickets ${row.tickets}</span>
      <span>Sales ${formatMoney(row.serviceSales)}</span>
      <span>Tips ${formatMoney(row.tips)}</span>
      <span>Commission ${formatMoney(row.commission)}</span>
      <strong>${formatMoney(row.totalPay)}</strong>
    </div>
  `).join("");
}

function setPayrollPreset(preset) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (preset === "thisMonth") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (preset === "lastMonth") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (preset === "thisYear") {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  } else if (preset === "lastYear") {
    start = new Date(now.getFullYear() - 1, 0, 1);
    end = new Date(now.getFullYear() - 1, 11, 31);
  } else if (preset === "all") {
    const ticketDates = closedTickets.map(ticket => parseTicketDate(ticket.date)).filter(Boolean).sort((first, second) => first - second);
    start = ticketDates[0] || now;
    end = ticketDates[ticketDates.length - 1] || now;
  }

  document.getElementById("payrollStartDate").value = getInputDateString(start);
  document.getElementById("payrollEndDate").value = getInputDateString(end);
  refreshPayrollReport();
}
function refreshOwnerReport() {
  const range = getOwnerReportRangeFromInputs();
  renderOwnerReport(getSalonRevenueReport(range.startDate, range.endDate));
}

function setOwnerReportPreset(preset) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (preset === "thisMonth") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (preset === "lastMonth") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (preset === "thisYear") {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  } else if (preset === "lastYear") {
    start = new Date(now.getFullYear() - 1, 0, 1);
    end = new Date(now.getFullYear() - 1, 11, 31);
  } else if (preset === "all") {
    const ticketDates = closedTickets
      .map(ticket => parseTicketDate(ticket.date))
      .filter(Boolean)
      .sort((first, second) => first - second);
    start = ticketDates[0] || now;
    end = ticketDates[ticketDates.length - 1] || now;
  }

  document.getElementById("ownerReportStartDate").value = getInputDateString(start);
  document.getElementById("ownerReportEndDate").value = getInputDateString(end);
  refreshOwnerReport();
}

function renderOwnerReport(report) {
  const summary = document.getElementById("ownerReportSummary");
  const chart = document.getElementById("ownerRevenueChart");
  const employeeList = document.getElementById("ownerReportEmployees");

  if (!summary || !chart || !employeeList) return;

  summary.innerHTML = `
    <div><span>Range</span><strong>${report.reportDate}</strong></div>
    <div><span>Tickets</span><strong>${report.ticketCount}</strong></div>
    <div><span>Cash</span><strong>${formatMoney(report.cashSales)}</strong></div>
    <div><span>Card</span><strong>${formatMoney(report.cardSales)}</strong></div>
    <div><span>Tips</span><strong>${formatMoney(report.tipTotal)}</strong></div>
    <div><span>Card Fees</span><strong>${formatMoney(report.cardFeeTotal)}</strong></div>
    <div><span>Total Revenue</span><strong>${formatMoney(report.totalSales)}</strong></div>
    <div><span>Employee Commission</span><strong>${formatMoney(report.employeeCommissionTotal)}</strong></div>
    <div><span>Profit After Commission</span><strong>${formatMoney(report.profitAfterCommission)}</strong></div>
  `;

  const chartData = getRevenueByDate().filter(day => { const dayDate = parseTicketDate(day.date); const start = new Date(report.startDate + "T00:00:00"); const end = new Date(report.endDate + "T23:59:59"); return dayDate && dayDate >= start && dayDate <= end; });
  const maxTotal = Math.max(...chartData.map(day => day.totalSales), 1);

  chart.innerHTML = `
    <div class="owner-chart-title">
      <strong>Sales Days In Range</strong>
      <span>Cash + Card</span>
    </div>
    <div class="owner-chart-bars">
      ${chartData.length === 0 ? `<div class="owner-chart-empty">No paid tickets yet</div>` : chartData.map(day => {
        const totalHeight = Math.max((day.totalSales / maxTotal) * 100, 4);
        const cashPercent = day.totalSales > 0 ? (day.cashSales / day.totalSales) * 100 : 0;
        const cardPercent = 100 - cashPercent;

        return `
          <div class="owner-chart-day" title="${day.date} Total ${formatMoney(day.totalSales)}">
            <div class="owner-chart-value">${formatMoney(day.totalSales)}</div>
            <div class="owner-chart-bar" style="height: ${totalHeight}%">
              <span class="cash-part" style="height: ${cashPercent}%"></span>
              <span class="card-part" style="height: ${cardPercent}%"></span>
            </div>
            <div class="owner-chart-date">${day.date.slice(0, 5)}</div>
          </div>
        `;
      }).join("")}
    </div>
    <div class="owner-chart-legend">
      <span><i class="cash-dot"></i>Cash</span>
      <span><i class="card-dot"></i>Card</span>
    </div>
  `;

  employeeList.innerHTML = report.employees.map(employeeReport => {
    return `
      <div class="owner-report-row">
        <span>${employeeReport.name}</span>
        <span>Cash ${formatMoney(employeeReport.cashSales)}</span>
        <span>Card ${formatMoney(employeeReport.cardSales)}</span>
        <span>Tips ${formatMoney(employeeReport.tips || 0)}</span>
        <span>Total ${formatMoney(employeeReport.totalSales)}</span>
        <span>Commission ${formatMoney(employeeReport.commission || 0)}</span>
        <span>Profit ${formatMoney(employeeReport.profitAfterCommission || 0)}</span>
      </div>
    `;
  }).join("");
}

function selectEmployee(employee) {
  const isSameEmployeeOpen =
    currentMainView === "service" &&
    selectedEmployee &&
    selectedEmployee.name === employee.name &&
    selectedEmployee.pin === employee.pin;

  if (isSameEmployeeOpen) {
    if (currentTicket.length > 0 && !confirm("Close this service screen and clear the current ticket?")) {
      return;
    }

    goHome();
    return;
  }

  currentMainView = "service";
  selectedEmployee = employee;
  currentTicket = restoreHeldTicketForEmployee(employee);

  const serviceSection = document.querySelectorAll(".content-section")[0];

  serviceSection.innerHTML = `
    <h3>${text("service")} - ${employee.name}</h3>

    <div class="service-tabs" id="serviceTabs"></div>

    <div class="checkout-layout">
      <div id="serviceList" class="service-list"></div>

      <div class="ticket-panel">
        <h3>${text("currentTicket")}</h3>
        <div id="ticketItems"></div>

        <h2>${text("total")}: $<span id="ticketTotal">0</span></h2>

        <div class="ticket-actions">
          <button onclick="openPaymentOptions()">${text("pay")}</button>
          <button onclick="cancelTicket()">${text("cancel")}</button>
          <button onclick="voidTicket()">${text("void")}</button>
          <button onclick="holdTicket()">${text("hold")}</button>
          <button onclick="combineTicket()">${text("combine")}</button>
        </div>
      </div>
    </div>
  `;

  showServiceCategory(services.Manicure ? "Manicure" : Object.keys(services)[0]);
  updateTicket();
}

function canShowCustomServiceButton(categoryName) {
  return ["Manicure", "Pedicure", "GiftCard"].includes(categoryName);
}

function showServiceCategory(categoryName) {
  const tabs = document.getElementById("serviceTabs");
  const list = document.getElementById("serviceList");
  const categories = Object.keys(services);

  if (!categories.length) {
    tabs.innerHTML = "";
    list.innerHTML = "<p>No services have been added yet.</p>";
    return;
  }

  if (!services[categoryName]) {
    categoryName = categories[0];
  }

  tabs.innerHTML = "";
  list.innerHTML = "";

  categories.forEach(category => {
    const tab = document.createElement("button");
    tab.className = category === categoryName ? "service-tab active" : "service-tab";
    tab.textContent = serviceText(category);

    tab.onclick = function () {
      showServiceCategory(category);
    };

    tabs.appendChild(tab);
  });

  services[categoryName].forEach(service => {
    const btn = document.createElement("button");
    btn.className = "big-service-btn";
    btn.innerHTML = `${serviceText(service.name)}<br>$${service.price}`;

    btn.onclick = function () {
      addService({
        ...service,
        category: categoryName,
        giftCardSale: categoryName === "GiftCard"
      });
    };

    list.appendChild(btn);
  });
  if (canShowCustomServiceButton(categoryName)) {
    const customBtn = document.createElement("button");
    customBtn.className = "big-service-btn custom-service-btn";
    customBtn.innerHTML = `${categoryName === "GiftCard" ? "Custom Gift Card" : "Custom " + serviceText(categoryName)}<br>Enter Price`;

    customBtn.onclick = function () {
      addCustomService(categoryName);
    };

    list.appendChild(customBtn);
  }
}

function addCustomService(categoryName) {
  ensureCustomServiceModal();
  customServiceCategory = categoryName;
  customServicePriceDigits = "";

  document.getElementById("customServiceTitle").textContent = categoryName === "GiftCard" ? "Custom Gift Card" : "Custom " + serviceText(categoryName);
  document.getElementById("customServiceName").value = categoryName === "GiftCard" ? "Gift Card Custom" : "Custom " + categoryName;
  const codeBox = document.getElementById("customGiftCardCodeBox");
  const codeInput = document.getElementById("customGiftCardCode");
  if (codeBox) codeBox.style.display = categoryName === "GiftCard" ? "grid" : "none";
  if (codeInput) codeInput.value = "";
  document.getElementById("customServiceModal").style.display = "flex";
  updateCustomServicePriceDisplay();
}

function ensureCustomServiceModal() {
  if (document.getElementById("customServiceModal")) return;

  const modal = document.createElement("div");
  modal.id = "customServiceModal";
  modal.className = "custom-service-modal";
  modal.innerHTML = `
    <div class="custom-service-box">
      <div class="custom-service-head">
        <div>
          <span>Custom Service</span>
          <strong id="customServiceTitle">Custom Service</strong>
        </div>
        <button onclick="closeCustomServiceModal()" aria-label="Close custom service">x</button>
      </div>

      <label class="custom-service-name">
        Service name
        <input id="customServiceName" type="text" value="Custom Service">
      </label>

      <label id="customGiftCardCodeBox" class="custom-gift-card-code">
        Gift card code / card number
        <input id="customGiftCardCode" type="text" placeholder="Scan or type card number">
        <span>Optional. Leave blank and POS will create a code.</span>
      </label>

      <div class="custom-price-display">
        $<span id="customServicePriceDisplay">0.00</span>
      </div>

      <div class="custom-price-keypad">
        <button onclick="addCustomPriceDigit('1')">1</button>
        <button onclick="addCustomPriceDigit('2')">2</button>
        <button onclick="addCustomPriceDigit('3')">3</button>
        <button onclick="addCustomPriceDigit('4')">4</button>
        <button onclick="addCustomPriceDigit('5')">5</button>
        <button onclick="addCustomPriceDigit('6')">6</button>
        <button onclick="addCustomPriceDigit('7')">7</button>
        <button onclick="addCustomPriceDigit('8')">8</button>
        <button onclick="addCustomPriceDigit('9')">9</button>
        <button onclick="clearCustomServicePrice()">Clear</button>
        <button onclick="addCustomPriceDigit('0')">0</button>
        <button onclick="deleteCustomPriceDigit()">Del</button>
      </div>

      <div class="custom-service-actions">
        <button class="custom-service-add" onclick="confirmCustomService()">Add Service</button>
        <button onclick="closeCustomServiceModal()">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function getCustomServicePrice() {
  return Number(customServicePriceDigits || 0) / 100;
}

function updateCustomServicePriceDisplay() {
  const display = document.getElementById("customServicePriceDisplay");
  if (display) {
    display.textContent = getCustomServicePrice().toFixed(2);
  }
}

function addCustomPriceDigit(digit) {
  if (customServicePriceDigits.length >= 7) return;
  customServicePriceDigits += digit;
  customServicePriceDigits = customServicePriceDigits.replace(/^0+(?=\d)/, "");
  updateCustomServicePriceDisplay();
}

function deleteCustomPriceDigit() {
  customServicePriceDigits = customServicePriceDigits.slice(0, -1);
  updateCustomServicePriceDisplay();
}

function clearCustomServicePrice() {
  customServicePriceDigits = "";
  updateCustomServicePriceDisplay();
}

function closeCustomServiceModal() {
  const modal = document.getElementById("customServiceModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function confirmCustomService() {
  const price = getCustomServicePrice();
  const name = document.getElementById("customServiceName")?.value.trim() || "Custom " + customServiceCategory;
  const requestedGiftCardCode = customServiceCategory === "GiftCard"
    ? normalizeGiftCardCode(document.getElementById("customGiftCardCode")?.value || "")
    : "";

  if (price <= 0) {
    alert("Please enter a custom price.");
    return;
  }

  addService({
    name,
    price: Math.round(price * 100) / 100,
    custom: true,
    category: customServiceCategory,
    giftCardSale: customServiceCategory === "GiftCard",
    requestedGiftCardCode
  });

  closeCustomServiceModal();
}
function addService(service) {
  currentTicket.push(service);
  updateTicket();
}

function updateTicket() {
  const ticketItems = document.getElementById("ticketItems");
  const ticketTotal = document.getElementById("ticketTotal");

  if (!ticketItems || !ticketTotal) return;

  ticketItems.innerHTML = "";

  let total = 0;

  currentTicket.forEach((service, index) => {
    total += service.price;

    const item = document.createElement("div");
    item.className = "ticket-item";
    item.innerHTML = `
      <span>
        ${serviceText(service.name)}
        ${service.combinedFrom ? `<small>From ${service.combinedFrom}</small>` : ""}
      </span>
      <span>$${service.price}</span>
      <button onclick="removeService(${index})">X</button>
    `;

    ticketItems.appendChild(item);
  });

  ticketTotal.textContent = total;
}

function removeService(index) {
  currentTicket.splice(index, 1);
  updateTicket();
}

function cancelTicket() {
  currentTicket = [];
  updateTicket();
}

function getEmployeeTicketKey(employee) {
  return employee?.pin || employee?.name || "";
}

function findHeldTicketIndex(employee) {
  const employeeKey = getEmployeeTicketKey(employee);
  return heldTickets.findIndex(ticket => ticket.employeeKey === employeeKey);
}

function getHeldTicketForEmployee(employee) {
  const heldIndex = findHeldTicketIndex(employee);
  return heldIndex === -1 ? null : heldTickets[heldIndex];
}

function restoreHeldTicketForEmployee(employee) {
  const heldIndex = findHeldTicketIndex(employee);

  if (heldIndex === -1) {
    return [];
  }

  const heldTicket = heldTickets.splice(heldIndex, 1)[0];
  addAuditLog("Held Ticket Reopened", {
    actor: employee.name,
    employee: employee.name,
    total: Number(heldTicket.total || 0),
    note: `${employee.name} reopened a held ticket.`
  });
  saveAppState();
  displayQueue();

  return [...heldTicket.services];
}

function holdTicket() {
  if (!selectedEmployee) {
    alert("Select an employee first.");
    return;
  }

  if (currentTicket.length === 0) {
    alert("No ticket to hold.");
    return;
  }

  const existingHeldIndex = findHeldTicketIndex(selectedEmployee);
  const employeeName = selectedEmployee.name;

  if (existingHeldIndex !== -1 && !confirm("Replace this employee's existing held ticket?")) {
    return;
  }

  if (existingHeldIndex !== -1) {
    heldTickets.splice(existingHeldIndex, 1);
  }

  const now = new Date();
  const heldTicket = {
    employee: selectedEmployee.name,
    employeeKey: getEmployeeTicketKey(selectedEmployee),
    services: [...currentTicket],
    total: getCurrentTicketSubtotal(),
    heldAtISO: now.toISOString(),
    time: now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit"
    }),
    date: now.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric"
    })
  };

  heldTickets.push(heldTicket);
  currentTicket = [];
  addAuditLog("Ticket Held", {
    actor: employeeName,
    employee: employeeName,
    total: heldTicket.total,
    note: `${employeeName} held a ticket with ${heldTicket.services.length} item(s).`
  });

  saveAppState();
  displayQueue();
  renderEmployeeDashboard();
  goHome();

  alert(employeeName + "'s ticket is on hold.");
}

function voidTicket() {
  if (currentTicket.length === 0) {
    alert("No ticket to void");
    return;
  }

  let total = currentTicket.reduce((sum, service) => sum + service.price, 0);

  const now = new Date();

  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const date = now.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });

  const voidedTicket = {
    employee: selectedEmployee.name,
    services: [...currentTicket],
    total: total,
    paymentMethod: "VOIDED",
    time: time,
    date: date,
    voided: true
  };

  closedTickets.push(voidedTicket);
  addAuditLog("Ticket Voided", {
    actor: selectedEmployee?.name || "Employee",
    employee: selectedEmployee?.name || "",
    ticketNumber: closedTickets.length,
    total,
    paymentMethod: "VOIDED",
    note: "Ticket was voided before payment."
  });

  saveAppState();
  if (currentMainView === "owner") {
    openOwnerDashboard(false);
  } else if (currentMainView === "closed") {
    displayClosedTickets();
  }
  renderEmployeeDashboard();

  currentTicket = [];
  updateTicket();

  alert("Ticket voided");
}

function combineTicket() {
  if (!selectedEmployee) {
    alert("Select an employee first.");
    return;
  }

  const availableHeldTickets = heldTickets
    .map((ticket, index) => ({ ...ticket, heldIndex: index }))
    .filter(ticket => ticket.employeeKey !== getEmployeeTicketKey(selectedEmployee));

  if (!availableHeldTickets.length) {
    alert("No other held tickets to combine.");
    return;
  }

  openCombineModal(availableHeldTickets);
}

function ensureCombineModal() {
  if (document.getElementById("combineModal")) return;

  const modal = document.createElement("div");
  modal.id = "combineModal";
  modal.className = "combine-modal";
  modal.innerHTML = `
    <div class="combine-box">
      <div class="combine-head">
        <div>
          <span>Combine Tickets</span>
          <strong>Add held tickets to current checkout</strong>
        </div>
        <button onclick="closeCombineModal()" aria-label="Close combine">x</button>
      </div>
      <div id="combineHeldList" class="combine-held-list"></div>
      <div class="combine-footer">
        <div>
          <span>Selected</span>
          <strong id="combineSelectedSummary">0 tickets</strong>
        </div>
        <button class="combine-confirm" onclick="confirmCombineTickets()">Combine Selected</button>
        <button onclick="closeCombineModal()">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function openCombineModal(availableHeldTickets) {
  ensureCombineModal();
  selectedCombineHeldIndexes = [];
  const list = document.getElementById("combineHeldList");

  list.innerHTML = availableHeldTickets.map(ticket => {
    const serviceList = ticket.services
      .map(service => serviceText(service.name))
      .join(", ");

    return `
      <button class="combine-ticket-card" data-held-index="${ticket.heldIndex}" onclick="toggleCombineHeldTicket(${ticket.heldIndex})">
        <span>${ticket.employee}</span>
        <strong>${formatMoney(ticket.total)}</strong>
        <small>${ticket.services.length} ${ticket.services.length === 1 ? "service" : "services"}</small>
        <em>${serviceList}</em>
      </button>
    `;
  }).join("");

  document.getElementById("combineModal").style.display = "flex";
  updateCombineSelectionDisplay();
}

function closeCombineModal() {
  const modal = document.getElementById("combineModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function toggleCombineHeldTicket(heldIndex) {
  if (selectedCombineHeldIndexes.includes(heldIndex)) {
    selectedCombineHeldIndexes = selectedCombineHeldIndexes.filter(index => index !== heldIndex);
  } else {
    selectedCombineHeldIndexes.push(heldIndex);
  }

  updateCombineSelectionDisplay();
}

function updateCombineSelectionDisplay() {
  document.querySelectorAll(".combine-ticket-card").forEach(card => {
    const heldIndex = Number(card.dataset.heldIndex);
    card.classList.toggle("selected", selectedCombineHeldIndexes.includes(heldIndex));
  });

  const selectedTickets = selectedCombineHeldIndexes
    .map(heldIndex => heldTickets[heldIndex])
    .filter(Boolean);

  const selectedTotal = selectedTickets.reduce((sum, ticket) => sum + Number(ticket.total || 0), 0);
  const selectedCount = selectedTickets.length;
  document.getElementById("combineSelectedSummary").textContent =
    `${selectedCount} ${selectedCount === 1 ? "ticket" : "tickets"} | ${formatMoney(selectedTotal)}`;
}

function confirmCombineTickets() {
  if (!selectedCombineHeldIndexes.length) {
    alert("Select at least one held ticket.");
    return;
  }

  const heldIndexesToRemove = [...selectedCombineHeldIndexes].sort((a, b) => b - a);

  heldIndexesToRemove.forEach(heldIndex => {
    const heldTicket = heldTickets.splice(heldIndex, 1)[0];

    if (!heldTicket) return;

    heldTicket.services.forEach(service => {
      currentTicket.push({
        ...service,
        combinedFrom: heldTicket.employee
      });
    });
  });

  saveAppState();
  displayQueue();
  updateTicket();
  closeCombineModal();
  alert("Held ticket combined.");
}

const CLOVER_BACKEND_URL = "http://localhost:8787";
const SQUARE_BACKEND_URL = "http://localhost:8788";

let selectedCheckoutPaymentMethod = "Cash";
let squareCheckoutInProgress = false;
let squareCheckoutCanceledByUser = false;

function openPaymentOptions() {
  if (currentTicket.length === 0) {
    alert("Please select at least one service");
    return;
  }

  openCheckoutModal();
}

function openCheckoutModal() {
  ensureCheckoutModal();
  selectedCheckoutPaymentMethod = "Cash";
  document.getElementById("checkoutTipAmount").value = "0.00";
  document.getElementById("checkoutDiscountAmount").value = "0.00";
  document.getElementById("checkoutCardFeeEnabled").checked = false;
  document.getElementById("checkoutCardFeePercent").value = getCardFeePercentDefault().toFixed(2);
  document.getElementById("checkoutTenderedAmount").value = "";
  selectedGiftCardCode = "";
  const giftInput = document.getElementById("checkoutGiftCardCode");
  if (giftInput) giftInput.value = "";
  document.getElementById("checkoutModal").style.display = "flex";
  renderCheckoutModal();
}

function ensureCheckoutModal() {
  if (document.getElementById("checkoutModal")) return;

  const modal = document.createElement("div");
  modal.id = "checkoutModal";
  modal.className = "checkout-modal";
  modal.innerHTML = `
    <div class="checkout-box">
      <div class="checkout-head">
        <div>
          <span>Ticket Checkout</span>
          <strong id="checkoutEmployeeName">Employee</strong>
        </div>
        <button onclick="cancelCheckoutModal()" aria-label="Close checkout">x</button>
      </div>

      <div class="checkout-body">
        <section class="checkout-ticket">
          <div class="checkout-ticket-title">
            <strong>Ticket Items</strong>
            <span id="checkoutItemCount">0 items</span>
          </div>
          <div id="checkoutItems" class="checkout-items"></div>
        </section>

        <section class="checkout-pay">
          <div class="checkout-amount-card">
            <div><span>Subtotal</span><strong id="checkoutSubtotal">$0.00</strong></div>
            <div><span>Discount</span><strong id="checkoutDiscountDisplay">$0.00</strong></div>
            <div><span>Tip</span><strong id="checkoutTipDisplay">$0.00</strong></div>
            <div><span>Card Fee</span><strong id="checkoutCardFeeDisplay">$0.00</strong></div>
            <div class="checkout-total-row"><span>Amount Due</span><strong id="checkoutAmountDue">$0.00</strong></div>
          </div>

          <div class="checkout-fields">
            <label>
              Tip
              <input id="checkoutTipAmount" type="number" min="0" step="0.01" value="0.00" oninput="renderCheckoutModal()">
            </label>
            <label>
              Discount
              <input id="checkoutDiscountAmount" type="number" min="0" step="0.01" value="0.00" oninput="renderCheckoutModal()">
            </label>
          </div>

          <div class="checkout-tip-buttons">
            <button onclick="setCheckoutTipPercent(15)">15%</button>
            <button onclick="setCheckoutTipPercent(18)">18%</button>
            <button onclick="setCheckoutTipPercent(20)">20%</button>
          </div>
          <div id="checkoutSquareTipNotice" class="checkout-square-tip-notice">
            Customer selects tip on Square Terminal
          </div>

          <div class="checkout-card-fee">
            <label>
              <input id="checkoutCardFeeEnabled" type="checkbox" onchange="toggleCheckoutCardFee()">
              Charge card fee
            </label>
            <div>
              <input id="checkoutCardFeePercent" type="number" min="0" max="10" step="0.01" value="${getCardFeePercentDefault().toFixed(2)}" oninput="renderCheckoutModal()">
              <span>%</span>
            </div>
          </div>

          <div class="checkout-methods">
            <button id="checkoutMethodCash" onclick="setCheckoutPaymentMethod('Cash')">Cash</button>
            <button id="checkoutMethodCard" onclick="setCheckoutPaymentMethod('Card')">Square</button>
            <button id="checkoutMethodGift" onclick="setCheckoutPaymentMethod('Gift')">Gift</button>
            <button id="checkoutMethodLoyalty" onclick="setCheckoutPaymentMethod('Loyalty')">Loyalty</button>
          </div>

          <div class="checkout-selected-method">
            <span>Payment</span>
            <strong id="checkoutSelectedMethod">Cash</strong>
          </div>

          <div id="checkoutGiftCardBox" class="checkout-gift-card-box">
            <label>
              Gift card number
              <input id="checkoutGiftCardCode" type="text" placeholder="GC-000000" oninput="clearCheckoutGiftCardSelection()">
            </label>
            <button type="button" onclick="checkCheckoutGiftCardBalance()">Check Balance</button>
            <div id="checkoutGiftCardStatus" class="gift-card-status">No gift card selected</div>
          </div>

          <label class="checkout-tendered">
            Tendered
            <input id="checkoutTenderedAmount" type="number" min="0" step="0.01" placeholder="0.00" oninput="renderCheckoutModal()">
          </label>

          <div class="checkout-change">
            <span>Change Due</span>
            <strong id="checkoutChangeDue">$0.00</strong>
          </div>

          <div class="checkout-actions">
            <button class="checkout-complete" onclick="completeCheckout()">Close Ticket</button>
            <button onclick="cancelCheckoutModal()">Cancel</button>
            <button onclick="voidTicket(); closeCheckoutModal()">Void Ticket</button>
          </div>
        </section>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function closeCheckoutModal() {
  const modal = document.getElementById("checkoutModal");
  if (modal) {
    modal.style.display = "none";
  }
}

async function cancelCheckoutModal() {
  if (squareCheckoutInProgress) {
    squareCheckoutCanceledByUser = true;
    await cancelSquareTerminalCheckout();
  }

  closeCheckoutModal();
}

function getInputMoneyValue(id) {
  const input = document.getElementById(id);
  const value = Number(input?.value || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getCheckoutTotals() {
  const subtotal = getCurrentTicketSubtotal();
  const discountAmount = Math.min(getInputMoneyValue("checkoutDiscountAmount"), subtotal);
  const tipAmount = ["Card", "Gift"].includes(selectedCheckoutPaymentMethod) ? 0 : getInputMoneyValue("checkoutTipAmount");
  const netSales = Math.max(0, subtotal - discountAmount);
  const cardFeeEnabled = document.getElementById("checkoutCardFeeEnabled")?.checked &&
    selectedCheckoutPaymentMethod === "Card";
  const cardFeePercent = getInputMoneyValue("checkoutCardFeePercent");
  const cardFeeAmount = cardFeeEnabled
    ? Math.round(netSales * (cardFeePercent / 100) * 100) / 100
    : 0;
  const amountDue = Math.max(0, netSales + tipAmount + cardFeeAmount);
  const tenderedAmount = getInputMoneyValue("checkoutTenderedAmount");
  const changeDue = selectedCheckoutPaymentMethod === "Cash"
    ? Math.max(0, tenderedAmount - amountDue)
    : 0;

  return {
    subtotal,
    discountAmount,
    tipAmount,
    cardFeeEnabled,
    cardFeePercent,
    cardFeeAmount,
    amountDue,
    tenderedAmount,
    changeDue
  };
}

function renderCheckoutModal() {
  const modal = document.getElementById("checkoutModal");
  if (!modal) return;

  const totals = getCheckoutTotals();
  const checkoutItems = document.getElementById("checkoutItems");
  const itemCount = document.getElementById("checkoutItemCount");

  document.getElementById("checkoutEmployeeName").textContent = selectedEmployee?.name || "Employee";
  itemCount.textContent = currentTicket.length + (currentTicket.length === 1 ? " item" : " items");

  checkoutItems.innerHTML = currentTicket.map((service, index) => {
    return `
      <div class="checkout-item">
        <div>
          <strong>${index + 1}. ${serviceText(service.name)}</strong>
          <span>${service.combinedFrom ? "From " + service.combinedFrom : selectedEmployee?.name || ""}</span>
        </div>
        <strong>${formatMoney(Number(service.price || 0))}</strong>
      </div>
    `;
  }).join("");

  document.getElementById("checkoutSubtotal").textContent = formatMoney(totals.subtotal);
  document.getElementById("checkoutDiscountDisplay").textContent = "-" + formatMoney(totals.discountAmount);
  document.getElementById("checkoutTipDisplay").textContent = selectedCheckoutPaymentMethod === "Card"
    ? "On Terminal"
    : formatMoney(totals.tipAmount);
  document.getElementById("checkoutCardFeeDisplay").textContent = formatMoney(totals.cardFeeAmount);
  document.getElementById("checkoutAmountDue").textContent = formatMoney(totals.amountDue);
  document.getElementById("checkoutChangeDue").textContent = formatMoney(totals.changeDue);
  document.getElementById("checkoutSelectedMethod").textContent = getCheckoutPaymentMethodLabel();

  const completeButton = document.querySelector(".checkout-complete");
  if (completeButton && !completeButton.disabled) {
    completeButton.textContent = selectedCheckoutPaymentMethod === "Card"
      ? "Send to Square"
      : "Close Ticket";
  }

  const cardFeeBox = document.querySelector(".checkout-card-fee");
  if (cardFeeBox) {
    cardFeeBox.classList.toggle("disabled", selectedCheckoutPaymentMethod !== "Card");
  }

  const squareTipMode = selectedCheckoutPaymentMethod === "Card";
  const tipInput = document.getElementById("checkoutTipAmount");
  const tipNotice = document.getElementById("checkoutSquareTipNotice");
  const tipButtons = document.querySelectorAll(".checkout-tip-buttons button");
  if (tipInput) {
    tipInput.disabled = squareTipMode || selectedCheckoutPaymentMethod === "Gift";
    if ((squareTipMode || selectedCheckoutPaymentMethod === "Gift") && tipInput.value !== "0.00") {
      tipInput.value = "0.00";
    }
  }
  tipButtons.forEach(button => {
    button.disabled = squareTipMode || selectedCheckoutPaymentMethod === "Gift";
  });

  const giftCardBox = document.getElementById("checkoutGiftCardBox");
  if (giftCardBox) {
    giftCardBox.classList.toggle("active", selectedCheckoutPaymentMethod === "Gift");
  }
  updateCheckoutGiftCardStatus(totals.amountDue);

  if (tipNotice) {
    tipNotice.classList.toggle("active", squareTipMode);
  }

  ["Cash", "Card", "Gift", "Loyalty"].forEach(method => {
    const button = document.getElementById("checkoutMethod" + method);
    if (button) {
      button.classList.toggle("active", selectedCheckoutPaymentMethod === method);
    }
  });
}

function setCheckoutTipPercent(percent) {
  if (selectedCheckoutPaymentMethod === "Card") return;
  const subtotal = getCurrentTicketSubtotal();
  setCheckoutTipAmount(subtotal * (percent / 100));
}

function setCheckoutTipAmount(amount) {
  if (selectedCheckoutPaymentMethod === "Card") return;
  document.getElementById("checkoutTipAmount").value = Number(amount || 0).toFixed(2);
  renderCheckoutModal();
}

function setCheckoutPaymentMethod(method) {
  selectedCheckoutPaymentMethod = method;

  if (method === "Card") {
    const tipInput = document.getElementById("checkoutTipAmount");
    if (tipInput) {
      tipInput.value = "0.00";
    }
  }

  if (method !== "Card") {
    const cardFeeCheckbox = document.getElementById("checkoutCardFeeEnabled");
    if (cardFeeCheckbox) {
      cardFeeCheckbox.checked = false;
    }
  }

  renderCheckoutModal();
}

function getCheckoutPaymentMethodLabel() {
  if (selectedCheckoutPaymentMethod === "Card") return "Square Terminal";
  if (selectedCheckoutPaymentMethod === "Gift") return "Gift Card";
  return selectedCheckoutPaymentMethod;
}

function toggleCheckoutCardFee() {
  const cardFeeCheckbox = document.getElementById("checkoutCardFeeEnabled");

  if (cardFeeCheckbox?.checked) {
    selectedCheckoutPaymentMethod = "Card";
  }

  renderCheckoutModal();
}

async function completeCheckout() {
  const totals = getCheckoutTotals();

  if (selectedCheckoutPaymentMethod === "Cash" && totals.tenderedAmount > 0 && totals.tenderedAmount < totals.amountDue) {
    alert("Cash tendered is less than amount due.");
    return;
  }

  if (selectedCheckoutPaymentMethod === "Card") {
    await completeSquareCheckout(totals);
    return;
  }

  let giftCardPayment = null;
  if (selectedCheckoutPaymentMethod === "Gift") {
    giftCardPayment = redeemSelectedGiftCard(totals.amountDue);
    if (!giftCardPayment) return;
  }

  payTicket(selectedCheckoutPaymentMethod, {
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    tipAmount: totals.tipAmount,
    cardFeeAmount: totals.cardFeeAmount,
    cardFeePercent: totals.cardFeePercent,
    tenderedAmount: totals.tenderedAmount,
    changeDue: totals.changeDue,
    giftCard: giftCardPayment
  });

  closeCheckoutModal();
}

async function completeSquareCheckout(totals) {
  const completeButton = document.querySelector(".checkout-complete");
  const originalText = completeButton?.textContent || "Close Ticket";

  try {
    squareCheckoutInProgress = true;
    squareCheckoutCanceledByUser = false;

    if (completeButton) {
      completeButton.disabled = true;
      completeButton.textContent = "Waiting for Square...";
    }

    const squareResult = await sendSquareTerminalCheckout({
      amount: dollarsToCents(totals.amountDue),
      referenceId: createExternalPaymentId(),
      note: buildSquareCheckoutSummary(totals),
      employeeName: selectedEmployee?.name || "",
      items: currentTicket.map(service => ({
        name: serviceText(service.name),
        amount: dollarsToCents(Number(service.price || 0)),
        technician: service.combinedFrom || selectedEmployee?.name || ""
      })),
      discountAmount: dollarsToCents(totals.discountAmount),
      cardFeeAmount: dollarsToCents(totals.cardFeeAmount),
      cardFeePercent: totals.cardFeePercent
    });

    if (!squareResult || squareResult.result !== "SUCCESS") {
      if (!squareCheckoutCanceledByUser) {
        alert("Square payment was not approved.");
      }
      return;
    }

    const squareTipAmount = centsToDollars(squareResult.tipAmount || 0);

    payTicket("Card", {
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      tipAmount: squareTipAmount,
      cardFeeAmount: totals.cardFeeAmount,
      cardFeePercent: totals.cardFeePercent,
      tenderedAmount: 0,
      changeDue: 0,
      square: {
        checkoutId: squareResult.checkoutId,
        paymentId: squareResult.paymentId,
        receiptNumber: squareResult.receiptNumber,
        receiptUrl: squareResult.receiptUrl,
        cardholderName: squareResult.cardholderName || "",
        cardType: squareResult.cardType || "",
        last4: squareResult.last4 || "",
        result: squareResult.result
      }
    });

    closeCheckoutModal();
  } catch (error) {
    console.error("Square payment failed", error);
    alert(
      "Square payment failed.\n\n" +
      error.message +
      "\n\nCheck the Square bridge PowerShell window for details."
    );
  } finally {
    squareCheckoutInProgress = false;
    if (completeButton) {
      completeButton.disabled = false;
      completeButton.textContent = originalText;
    }
  }
}

async function sendSquareTerminalCheckout(paymentRequest) {
  const response = await fetch(SQUARE_BACKEND_URL + "/api/payments/square/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(paymentRequest)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Square checkout request failed");
  }

  return data;
}

function buildSquareCheckoutSummary(totals) {
  const serviceNames = currentTicket
    .slice(0, 3)
    .map(service => serviceText(service.name));
  const extraCount = Math.max(0, currentTicket.length - serviceNames.length);
  const summary = serviceNames.join(", ") + (extraCount ? " +" + extraCount + " more" : "");
  const adjustments = [];

  if (totals.discountAmount > 0) {
    adjustments.push("Discount -" + formatMoney(totals.discountAmount));
  }

  if (totals.cardFeeAmount > 0) {
    adjustments.push("Card Fee " + formatMoney(totals.cardFeeAmount));
  }

  return [
    summary || "Gloomin Grow POS checkout",
    selectedEmployee?.name ? "Checkout by " + selectedEmployee.name : "",
    adjustments.join(", ")
  ].filter(Boolean).join(" | ");
}

async function cancelSquareTerminalCheckout() {
  try {
    const response = await fetch(SQUARE_BACKEND_URL + "/api/payments/square/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: "{}"
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Square cancel request failed");
    }
  } catch (error) {
    console.error("Square cancel failed", error);
    alert(
      "Could not cancel Square from the POS.\n\n" +
      "Use the cancel button on the Square Terminal, then check the Square bridge PowerShell window."
    );
  }
}

async function openCloverPaymentScreen() {
  const subtotal = getCurrentTicketSubtotal();
  const externalPaymentId = createExternalPaymentId();

  try {
    const paymentResult = await sendCloverPayment({
      amount: dollarsToCents(subtotal),
      externalPaymentId,
      employeeName: selectedEmployee.name
    });

    if (!paymentResult || paymentResult.result !== "SUCCESS") {
      alert("Clover payment was not approved.");
      return;
    }

    const tipAmount = promptForTipAmount(subtotal);
    let finalPaymentResult = paymentResult;

    if (tipAmount > 0) {
      finalPaymentResult = await sendCloverTipAdjust({
        paymentId: paymentResult.paymentId,
        tipAmount: dollarsToCents(tipAmount),
        externalPaymentId
      });
    }

    payTicket("Card", {
      subtotal,
      tipAmount,
      clover: {
        paymentId: finalPaymentResult.paymentId || paymentResult.paymentId,
        externalPaymentId,
        cardholderName: finalPaymentResult.cardholderName || paymentResult.cardholderName || "",
        cardType: finalPaymentResult.cardType || paymentResult.cardType || "",
        last4: finalPaymentResult.last4 || paymentResult.last4 || "",
        authCode: finalPaymentResult.authCode || paymentResult.authCode || "",
        result: finalPaymentResult.result || paymentResult.result || "SUCCESS"
      }
    });
  } catch (error) {
    console.error("Clover payment failed", error);
    alert(
      "Clover payment failed.\n\n" +
      error.message +
      "\n\nCheck the PowerShell bridge window for details."
    );
  }
}

function getCurrentTicketSubtotal() {
  return currentTicket.reduce((sum, service) => sum + Number(service.price || 0), 0);
}

function dollarsToCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function centsToDollars(amount) {
  return Number(amount || 0) / 100;
}

function createExternalPaymentId() {
  return "gg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function promptForTipAmount(subtotal) {
  const value = prompt(
    "Card approved.\n\n" +
    "Service total: $" + subtotal.toFixed(2) + "\n" +
    "Enter tip amount to add, or leave blank for no tip:"
  );

  if (value === null || value.trim() === "") return 0;

  const tipAmount = Number(value.replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(tipAmount) || tipAmount < 0) {
    alert("Invalid tip amount. Tip set to $0.");
    return 0;
  }

  return Math.round(tipAmount * 100) / 100;
}

async function sendCloverPayment(paymentRequest) {
  const response = await fetch(CLOVER_BACKEND_URL + "/api/clover/pay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(paymentRequest)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Clover payment request failed");
  }

  return data;
}

async function sendCloverTipAdjust(tipRequest) {
  const response = await fetch(CLOVER_BACKEND_URL + "/api/clover/tip-adjust", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(tipRequest)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Clover tip adjust request failed");
  }

  return data;
}

function payTicket(paymentMethod, paymentInfo = {}) {
  const subtotal = typeof paymentInfo.subtotal === "number"
    ? paymentInfo.subtotal
    : getCurrentTicketSubtotal();
  const discountAmount = Number(paymentInfo.discountAmount || 0);
  const tipAmount = Number(paymentInfo.tipAmount || 0);
  const cardFeeAmount = Number(paymentInfo.cardFeeAmount || 0);
  const cardFeePercent = Number(paymentInfo.cardFeePercent || 0);
  const netSales = Math.max(0, subtotal - discountAmount);
  const total = netSales + tipAmount + cardFeeAmount;

  const now = new Date();

  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const date = now.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });

  const closedTicket = {
    employee: selectedEmployee.name,
    services: [...currentTicket],
    subtotal: subtotal,
    discountAmount: discountAmount,
    tipAmount: tipAmount,
    cardFeeAmount: cardFeeAmount,
    cardFeePercent: cardFeePercent,
    total: total,
    paymentMethod: paymentMethod,
    clover: paymentInfo.clover || null,
    square: paymentInfo.square || null,
    giftCard: paymentInfo.giftCard || null,
    tenderedAmount: Number(paymentInfo.tenderedAmount || 0),
    changeDue: Number(paymentInfo.changeDue || 0),
    time: time,
    date: date,
    voided: false
  };

  closedTickets.push(closedTicket);
  const issuedGiftCards = issueGiftCardsFromTicket(closedTicket, closedTickets.length);
  addAuditLog("Ticket Paid", {
    actor: selectedEmployee.name,
    employee: selectedEmployee.name,
    ticketNumber: closedTickets.length,
    total,
    paymentMethod,
    note: `${currentTicket.length} item(s), discount ${formatMoney(discountAmount)}, tip ${formatMoney(tipAmount)}, card fee ${formatMoney(cardFeeAmount)}.`
  });

  const turnCredit = calculateTurnCredit(netSales);
  selectedEmployee.turn = Number(selectedEmployee.turn || 0) + turnCredit;
  rotateEmployeeTurn(selectedEmployee, turnCredit);
  saveAppState();
  displayQueue();
  if (currentMainView === "owner") {
    openOwnerDashboard(false);
  } else if (currentMainView === "closed") {
    displayClosedTickets();
  }
  renderEmployeeDashboard();

  currentTicket = [];
  updateTicket();

  alert(
    selectedEmployee.name +
    " checked out customer. Total: $" +
    total.toFixed(2) +
    (discountAmount > 0 ? " (Discount: $" + discountAmount.toFixed(2) + ")" : "") +
    (tipAmount > 0 ? " (Tip: $" + tipAmount.toFixed(2) + ")" : "") +
    (cardFeeAmount > 0 ? " (Card fee: $" + cardFeeAmount.toFixed(2) + ")" : "") +
    (issuedGiftCards.length ? "\nGift cards issued: " + issuedGiftCards.map(card => card.code + " $" + card.originalAmount.toFixed(2)).join(", ") : "") +
    " paid by " +
    paymentMethod +
    (paymentInfo.clover?.last4 ? " ending in " + paymentInfo.clover.last4 : "") +
    (paymentInfo.square?.last4 ? " ending in " + paymentInfo.square.last4 : "") +
    "\nTurn added: " +
    formatTurn(turnCredit) +
    "\nNew turn total: " +
    formatTurn(selectedEmployee.turn)
  );
}


function normalizeGiftCardCode(code) {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

function generateGiftCardCode() {
  let code = "";
  do {
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    code = "GC-" + datePart + "-" + randomPart;
  } while (giftCards.some(card => normalizeGiftCardCode(card.code) === normalizeGiftCardCode(code)));

  return code;
}

function getGiftCardByCode(code) {
  const normalizedCode = normalizeGiftCardCode(code);
  return giftCards.find(card => normalizeGiftCardCode(card.code) === normalizedCode) || null;
}

function getGiftCardStatus(card) {
  if (!card) return "Not found";
  if (Number(card.balance || 0) <= 0) return "Redeemed";
  return "Active";
}

function issueGiftCardsFromTicket(ticket, ticketNumber) {
  const issuedCards = [];

  ticket.services
    .filter(service => service.giftCardSale || service.category === "GiftCard")
    .forEach(service => {
      const amount = Number(service.price || 0);
      if (amount <= 0) return;

      const requestedCode = normalizeGiftCardCode(service.requestedGiftCardCode || "");
      const code = requestedCode && !getGiftCardByCode(requestedCode)
        ? requestedCode
        : generateGiftCardCode();
      const now = new Date();
      const card = {
        code,
        originalAmount: amount,
        balance: amount,
        issuedDate: now.toLocaleDateString("en-US"),
        issuedTime: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        issuedBy: ticket.employee,
        soldTicketNumber: ticketNumber,
        status: "Active",
        history: [
          {
            type: "Issued",
            amount,
            date: ticket.date,
            time: ticket.time,
            ticketNumber,
            assignedCodeBy: ticket.employee
          }
        ]
      };

      giftCards.push(card);
      issuedCards.push(card);
      addAuditLog("Gift Card Issued", {
        actor: ticket.employee,
        employee: ticket.employee,
        giftCardCode: code,
        ticketNumber,
        amount,
        note: `Gift card issued with starting balance ${formatMoney(amount)}.`
      });
    });

  return issuedCards;
}

function clearCheckoutGiftCardSelection() {
  selectedGiftCardCode = "";
  updateCheckoutGiftCardStatus(getCheckoutTotals().amountDue);
}

function checkCheckoutGiftCardBalance() {
  const code = normalizeGiftCardCode(document.getElementById("checkoutGiftCardCode")?.value || "");
  const card = getGiftCardByCode(code);

  if (!card) {
    selectedGiftCardCode = "";
    updateCheckoutGiftCardStatus(getCheckoutTotals().amountDue, "Gift card not found.");
    return;
  }

  selectedGiftCardCode = card.code;
  updateCheckoutGiftCardStatus(getCheckoutTotals().amountDue);
}

function updateCheckoutGiftCardStatus(amountDue = 0, message = "") {
  const status = document.getElementById("checkoutGiftCardStatus");
  if (!status) return;

  if (message) {
    status.textContent = message;
    status.className = "gift-card-status warning";
    return;
  }

  const card = getGiftCardByCode(selectedGiftCardCode || document.getElementById("checkoutGiftCardCode")?.value);
  if (!card) {
    status.textContent = "No gift card selected";
    status.className = "gift-card-status";
    return;
  }

  const balance = Number(card.balance || 0);
  const canCover = balance >= Number(amountDue || 0);
  status.textContent = `${card.code} | ${getGiftCardStatus(card)} | Balance ${formatMoney(balance)}${canCover ? "" : " | Not enough for this ticket"}`;
  status.className = canCover ? "gift-card-status good" : "gift-card-status warning";
}

function redeemSelectedGiftCard(amountDue) {
  const typedCode = document.getElementById("checkoutGiftCardCode")?.value || selectedGiftCardCode;
  const card = getGiftCardByCode(typedCode);
  const amount = Math.round(Number(amountDue || 0) * 100) / 100;

  if (!card) {
    alert("Gift card not found. Please check the number.");
    return null;
  }

  if (Number(card.balance || 0) <= 0) {
    alert("This gift card has already been fully redeemed.");
    return null;
  }

  if (Number(card.balance || 0) < amount) {
    alert("Gift card balance is only " + formatMoney(card.balance) + ". Use another payment method for this ticket.");
    return null;
  }

  card.balance = Math.round((Number(card.balance || 0) - amount) * 100) / 100;
  card.status = getGiftCardStatus(card);
  card.history = card.history || [];
  card.history.push({
    type: "Redeemed",
    amount,
    date: new Date().toLocaleDateString("en-US"),
    time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    employee: selectedEmployee?.name || ""
  });
  addAuditLog("Gift Card Redeemed", {
    actor: selectedEmployee?.name || "Employee",
    employee: selectedEmployee?.name || "",
    giftCardCode: card.code,
    amount,
    note: `Remaining balance ${formatMoney(card.balance)}.`
  });

  return {
    code: card.code,
    redeemedAmount: amount,
    remainingBalance: card.balance
  };
}

function openGiftCardManager() {
  closeFunctions();
  ensureGiftCardModal();
  renderGiftCardManager();
  document.getElementById("giftCardModal").style.display = "flex";
}

function closeGiftCardManager() {
  const modal = document.getElementById("giftCardModal");
  if (modal) modal.style.display = "none";
}

function ensureGiftCardModal() {
  if (document.getElementById("giftCardModal")) return;

  const modal = document.createElement("div");
  modal.id = "giftCardModal";
  modal.className = "gift-card-modal";
  modal.innerHTML = `
    <div class="gift-card-box">
      <div class="gift-card-head">
        <div>
          <span>Gift Cards</span>
          <strong>Balance & Redemption</strong>
        </div>
        <button onclick="closeGiftCardManager()" aria-label="Close gift cards">x</button>
      </div>

      <div class="gift-card-check">
        <input id="giftCardLookupCode" type="text" placeholder="Gift card number">
        <button onclick="lookupGiftCard()">Check Balance</button>
      </div>

      <div id="giftCardLookupResult" class="gift-card-lookup-result">Enter a gift card number to check status.</div>
      <div id="giftCardList" class="gift-card-list"></div>
    </div>
  `;

  document.body.appendChild(modal);
}

function lookupGiftCard() {
  const code = document.getElementById("giftCardLookupCode")?.value || "";
  const card = getGiftCardByCode(code);
  const result = document.getElementById("giftCardLookupResult");

  if (!card) {
    result.innerHTML = `<strong>Not found</strong><span>No gift card matches that number.</span>`;
    return;
  }

  const redeemedTotal = (card.history || [])
    .filter(entry => entry.type === "Redeemed")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  result.innerHTML = `
    <strong>${escapeHtml(card.code)} | ${getGiftCardStatus(card)}</strong>
    <span>Balance: ${formatMoney(card.balance)} of ${formatMoney(card.originalAmount)}</span>
    <span>Redeemed: ${formatMoney(redeemedTotal)}</span>
    <span>Issued: ${escapeHtml(card.issuedDate || "")} ${escapeHtml(card.issuedTime || "")}</span>
  `;
}

function renderGiftCardManager() {
  const list = document.getElementById("giftCardList");
  if (!list) return;

  if (!giftCards.length) {
    list.innerHTML = `<div class="gift-card-empty">No gift cards issued yet.</div>`;
    return;
  }

  list.innerHTML = [...giftCards].reverse().map(card => {
    const redeemedTotal = (card.history || [])
      .filter(entry => entry.type === "Redeemed")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

    return `
      <div class="gift-card-row">
        <div>
          <strong>${escapeHtml(card.code)}</strong>
          <span>${getGiftCardStatus(card)} | Issued by ${escapeHtml(card.issuedBy || "")}</span>
          <small>Redeemed ${formatMoney(redeemedTotal)}${card.soldTicketNumber ? " | Sold on ticket #" + card.soldTicketNumber : ""}</small>
        </div>
        <div>
          <strong>${formatMoney(card.balance)}</strong>
          <span>of ${formatMoney(card.originalAmount)}</span>
        </div>
      </div>
    `;
  }).join("");
}
function displayClosedTickets() {
  currentMainView = "closed";
  selectedEmployee = null;
  currentTicket = [];

  const closedSection = document.querySelectorAll(".content-section")[0];

  closedSection.innerHTML = `
    <h3 id="closedText">${text("closedTicket")}</h3>

    <div class="closed-toolbar">
      <input type="date" id="closedDateFilter" value="${getTodayInputString()}" onchange="filterClosedTickets()">

      <select id="closedTechFilter" onchange="filterClosedTickets()">
        <option value="All Technicians">${text("allTechnicians")}</option>
        ${employees.map(emp => `<option>${emp.name}</option>`).join("")}
      </select>

      <select id="closedPaymentFilter" onchange="filterClosedTickets()">
        <option value="All Payments">${text("allPayments")}</option>
        <option value="Cash">Cash</option>
        <option value="Card">Card</option>
        <option value="Gift">Gift</option>
        <option value="Loyalty">Loyalty</option>
        <option value="VOIDED">VOIDED</option>
      </select>

      <input type="text" id="closedSearch" placeholder="${text("search")}" oninput="filterClosedTickets()">
    </div>

    <div class="closed-table">
      <div class="closed-table-header">
        <span>${text("ticketDate")}</span>
        <span>${text("technician")}</span>
        <span>${text("payment")}</span>
        <span>${text("total")}</span>
        <span>${text("time")}</span>
      </div>

      <div id="closedTicketList"></div>
    </div>
  `;

  filterClosedTickets();
}
function filterClosedTickets() {
  const list = document.getElementById("closedTicketList");
  if (!list) return;

  const dateFilter = document.getElementById("closedDateFilter").value;
  const techFilter = document.getElementById("closedTechFilter").value;
  const paymentFilter = document.getElementById("closedPaymentFilter").value;
  const searchText = document.getElementById("closedSearch").value.toLowerCase();

  list.innerHTML = "";

  closedTickets.forEach((ticket, index) => {
    const ticketDateFormatted = convertDateToInputFormat(ticket.date);

    const matchDate =
      dateFilter === "" || ticketDateFormatted === dateFilter;

    const matchTech =
      techFilter === "All Technicians" || ticket.employee === techFilter;

    const matchPayment =
      paymentFilter === "All Payments" || ticket.paymentMethod === paymentFilter;

    const paymentLabel = getTicketPaymentLabel(ticket);
    const cardholderName = ticket.clover?.cardholderName || "";
    const squareCardholderName = ticket.square?.cardholderName || "";
    const cardLast4 = ticket.clover?.last4 || ticket.square?.last4 || "";

    const matchSearch =
      searchText === "" ||
      ticket.employee.toLowerCase().includes(searchText) ||
      ticket.paymentMethod.toLowerCase().includes(searchText) ||
      paymentLabel.toLowerCase().includes(searchText) ||
      cardholderName.toLowerCase().includes(searchText) ||
      squareCardholderName.toLowerCase().includes(searchText) ||
      cardLast4.includes(searchText) ||
      String(index + 1).includes(searchText);

    if (matchDate && matchTech && matchPayment && matchSearch) {
      const row = document.createElement("div");

      row.className = ticket.voided
        ? "closed-ticket-row voided-ticket"
        : "closed-ticket-row";

      row.onclick = function () {
        openClosedTicketOptions(index);
      };

      row.innerHTML = `
        <span>
          #${index + 1}<br>
          <small>${ticket.date}</small>
        </span>

        <span>
          ${ticket.employee}
          ${ticket.voided ? "<br><small>VOIDED</small>" : ""}
        </span>

        <span>${paymentLabel}</span>
        <span>$${Number(ticket.total || 0).toFixed(2)}</span>
        <span>${ticket.time}</span>
      `;

      list.prepend(row);
    }
  });
}

function getTicketPaymentLabel(ticket) {
  if (ticket?.square) {
    const cardParts = [
      ticket.square.cardType || "Square Card",
      ticket.square.last4 ? "ending " + ticket.square.last4 : ""
    ].filter(Boolean);

    return cardParts.join(" ");
  }

  if (!ticket || !ticket.clover) return ticket.paymentMethod;

  const cardParts = [
    ticket.clover.cardType || "Card",
    ticket.clover.last4 ? "ending " + ticket.clover.last4 : ""
  ].filter(Boolean);

  return cardParts.join(" ");
}
function convertDateToInputFormat(dateString) {
  const parts = dateString.split("/");
  const month = parts[0].padStart(2, "0");
  const day = parts[1].padStart(2, "0");
  const year = parts[2];

  return `${year}-${month}-${day}`;
}

function openClosedTicketOptions(index) {
  const option = prompt(
    `Closed Ticket #${index + 1}\n\n` +
    `1 = Open / Edit Ticket\n` +
    `2 = Print Itemized Receipt\n` +
    `3 = Reopen Ticket\n\n` +
    `Enter option number:`
  );

  if (option === "1") {
    editClosedTicket(index);
  }

  if (option === "2") {
    printItemizedReceipt(index);
  }

  if (option === "3") {
    reopenTicket(index);
  }
}

function editClosedTicket(index) {
  const ticket = closedTickets[index];

  const employee = clockedInEmployees.find(emp => emp.name === ticket.employee);

  if (!employee) {
    alert("Employee must be clocked in to edit this ticket.");
    return;
  }

  selectedEmployee = employee;
  currentTicket = [...ticket.services];

  closedTickets.splice(index, 1);
  saveAppState();
  displayClosedTickets();

  selectEmployee(employee);
  currentTicket = [...ticket.services];
  updateTicket();
}

function reopenTicket(index) {
  editClosedTicket(index);
  alert("Ticket reopened.");
}

function printItemizedReceipt(index) {
  const ticket = closedTickets[index];
  const subtotal = typeof ticket.subtotal === "number" ? ticket.subtotal : ticket.total;
  const discountAmount = Number(ticket.discountAmount || 0);
  const tipAmount = Number(ticket.tipAmount || 0);
  const cardFeeAmount = Number(ticket.cardFeeAmount || 0);
  const cardFeePercent = Number(ticket.cardFeePercent || 0);
  const tenderedAmount = Number(ticket.tenderedAmount || 0);
  const changeDue = Number(ticket.changeDue || 0);
  const paymentLines = ticket.clover ? `
        <div class="payment-detail">Card: ${ticket.clover.cardType || "Card"}${ticket.clover.last4 ? " ending " + ticket.clover.last4 : ""}</div>
        ${ticket.clover.cardholderName ? `<div class="payment-detail">Name: ${ticket.clover.cardholderName}</div>` : ""}
        ${ticket.clover.paymentId ? `<div class="payment-detail small-text">Clover ID: ${ticket.clover.paymentId}</div>` : ""}
      ` : ticket.square ? `
        <div class="payment-detail">Card: ${ticket.square.cardType || "Square Card"}${ticket.square.last4 ? " ending " + ticket.square.last4 : ""}</div>
        ${ticket.square.cardholderName ? `<div class="payment-detail">Name: ${ticket.square.cardholderName}</div>` : ""}
        ${ticket.square.paymentId ? `<div class="payment-detail small-text">Square ID: ${ticket.square.paymentId}</div>` : ""}
        ${ticket.square.receiptUrl ? `<div class="payment-detail small-text">Receipt available by Square</div>` : ""}
      ` : ticket.giftCard ? `
        <div class="payment-detail">Gift Card: ${ticket.giftCard.code || "Gift Card"}</div>
        <div class="payment-detail">Redeemed: $${Number(ticket.giftCard.redeemedAmount || 0).toFixed(2)}</div>
        <div class="payment-detail">Balance Left: $${Number(ticket.giftCard.remainingBalance || 0).toFixed(2)}</div>
      ` : "";

  const items = ticket.services.map(service => {
    const technicianName = service.combinedFrom || ticket.employee;

    return `
      <div class="receipt-item">
        <div>
          <strong>${service.name}</strong>
          <span>${service.issuedGiftCardCode ? "Gift Card # " + service.issuedGiftCardCode : "Provided by " + technicianName}</span>
        </div>
        <strong>$${Number(service.price || 0).toFixed(2)}</strong>
      </div>
    `;
  }).join("");

  const receiptWindow = window.open("", "_blank");

  receiptWindow.document.write(`
    <html>
      <head>
        <title>Itemized Receipt</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            width: 320px;
            padding: 20px;
            color: #111;
          }

          h2, p {
            text-align: center;
          }

          .receipt-meta {
            text-align: center;
            line-height: 1.45;
            margin: 8px 0;
          }

          .payment-box {
            text-align: center;
            border-top: 1px dashed #999;
            border-bottom: 1px dashed #999;
            padding: 10px 0;
            margin: 12px 0;
          }

          .payment-detail {
            margin: 4px 0;
            overflow-wrap: anywhere;
          }

          .small-text {
            font-size: 11px;
          }

          .receipt-items {
            margin-top: 12px;
          }

          .receipt-item {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 9px 0;
            border-bottom: 1px dashed #999;
          }

          .receipt-item div {
            min-width: 0;
          }

          .receipt-item strong {
            display: block;
          }

          .receipt-item span {
            display: block;
            margin-top: 3px;
            font-size: 12px;
            color: #555;
          }

          .receipt-item > strong {
            white-space: nowrap;
            text-align: right;
          }

          .totals {
            margin-top: 12px;
          }

          .total {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            font-size: 16px;
            font-weight: bold;
            margin-top: 8px;
          }

          .grand-total {
            font-size: 21px;
            border-top: 1px solid #111;
            padding-top: 8px;
          }

          .voided {
            color: red;
            text-decoration: line-through;
            font-weight: bold;
          }
        </style>
      </head>

      <body>
        <h2>${escapeHtml(salonSettings.receiptName)}</h2>
        <p>${getSalonAddressHtml()}${salonSettings.phone ? `<br>${escapeHtml(salonSettings.phone)}` : ""}</p>
        <div class="receipt-meta">
          <div>Ticket #${index + 1}</div>
          <div>${ticket.date} ${ticket.time}</div>
          <div>Checkout: ${ticket.employee}</div>
        </div>

        <div class="payment-box ${ticket.voided ? "voided" : ""}">
          <strong>Payment: ${getTicketPaymentLabel(ticket)}</strong>
          ${paymentLines}
        </div>

        <div class="receipt-items">
          ${items}
        </div>

        <div class="totals">
          ${(discountAmount > 0 || tipAmount > 0 || cardFeeAmount > 0) ? `<div class="total"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>` : ""}
          ${discountAmount > 0 ? `<div class="total"><span>Discount</span><span>-$${discountAmount.toFixed(2)}</span></div>` : ""}
          ${tipAmount > 0 ? `<div class="total"><span>Tip</span><span>$${tipAmount.toFixed(2)}</span></div>` : ""}
          ${cardFeeAmount > 0 ? `<div class="total"><span>Card Fee</span><span>$${cardFeeAmount.toFixed(2)}</span></div>` : ""}
          <div class="total grand-total"><span>Total</span><span>$${Number(ticket.total || 0).toFixed(2)}</span></div>
          ${tenderedAmount > 0 ? `<div class="total"><span>Tendered</span><span>$${tenderedAmount.toFixed(2)}</span></div>` : ""}
          ${changeDue > 0 ? `<div class="total"><span>Change</span><span>$${changeDue.toFixed(2)}</span></div>` : ""}
        </div>

        <p>${escapeHtml(salonSettings.receiptFooter)}</p>

        <script>
          window.print();
        <\/script>
      </body>
    </html>
  `);

  receiptWindow.document.close();
}

function goHome() {
  currentMainView = "service";
  selectedEmployee = null;
  currentTicket = [];

  const serviceSection = document.querySelectorAll(".content-section")[0];

  serviceSection.innerHTML = `
    <h3>${text("service")}</h3>
  `;
}

function getScheduleGridStyle() {
  return `grid-template-columns: 110px repeat(${employees.length + 1}, minmax(190px, 1fr)); min-width: ${110 + ((employees.length + 1) * 190)}px;`;
}

function openAppointmentSheet() {
  currentMainView = "appointment";
  selectedEmployee = null;
  currentTicket = [];

  const serviceSection = document.querySelectorAll(".content-section")[0];

  serviceSection.innerHTML = `
    <div class="appt-screen">
      <div class="appt-top">
        <label class="appt-date-picker">
          <span>${text("selectDate")}</span>
          <input type="date" id="scheduleDatePicker" value="${selectedAppointmentDate}" onchange="changeAppointmentDate(this.value)">
        </label>
      </div>

      <div class="schedule-table">
        <div class="schedule-header" style="${getScheduleGridStyle()}">
          <div class="time-col"></div>

          <div class="tech-header">
            <div class="tech-icon">ðŸ‘¤</div>
            <span>${text("anyTechnician")}</span>
          </div>

          ${employees.map(emp => `
            <div class="tech-header">
              <div class="tech-icon">ðŸ‘¤</div>
              <span>${emp.name}</span>
            </div>
          `).join("")}
        </div>

        <div id="scheduleBody" class="schedule-body"></div>
      </div>
    </div>

    <div id="appointmentModal" class="appointment-modal">
      <div class="appointment-box">
        <h2 id="appointmentModalTitle">${text("addAppointment")}</h2>

        <input type="text" id="apptName" placeholder="${text("customerName")}">
        <input type="text" id="apptPhone" placeholder="${text("phoneNumber")}">
        <input type="date" id="apptDate">
        <input type="time" id="apptTime">

        <select id="apptService">
          ${getServiceOptionsHtml()}
        </select>

        <select id="apptEmployee">
          <option value="Any Technician">${text("anyTechnician")}</option>
          ${employees.map(emp => `<option value="${emp.name}">${emp.name}</option>`).join("")}
        </select>

        <label class="reminder-toggle">
          <input type="checkbox" id="apptReminder">
          <span>${text("textReminder")}</span>
        </label>

        <div class="appt-modal-actions">
          <button onclick="saveAppointment()">${text("save")}</button>
          <button onclick="closeAppointmentModal()">${text("cancel")}</button>
          <button onclick="deleteCurrentAppointment()">${text("delete")}</button>
        </div>
      </div>
    </div>
  `;

  displaySchedule();
}

function showTodayAppointments() {
  selectedAppointmentDate = getTodayInputString();

  const datePicker = document.getElementById("scheduleDatePicker");
  if (datePicker) {
    datePicker.value = selectedAppointmentDate;
  }

  displaySchedule();
}

function changeAppointmentDate(dateValue) {
  if (!dateValue) return;

  selectedAppointmentDate = dateValue;
  displaySchedule();
}

function displaySchedule() {
  const scheduleBody = document.getElementById("scheduleBody");
  if (!scheduleBody) return;

  scheduleBody.innerHTML = "";

  const times = [
    "09:00 AM", "09:30 AM",
    "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM",
    "12:00 PM", "12:30 PM",
    "01:00 PM", "01:30 PM",
    "02:00 PM", "02:30 PM",
    "03:00 PM", "03:30 PM",
    "04:00 PM", "04:30 PM",
    "05:00 PM", "05:30 PM",
    "06:00 PM"
  ];

  times.forEach(time => {
    const row = document.createElement("div");
    row.className = "schedule-row";
    row.setAttribute("style", getScheduleGridStyle());

    const anyIndex = findAppointmentIndex("Any Technician", time);
    const anyHtml = anyIndex !== -1
      ? getAppointmentBlock(appointments[anyIndex], anyIndex)
      : "";

    row.innerHTML = `
      <div class="time-cell">${time}</div>

      <div class="schedule-cell" onclick="openAppointmentFromCell('Any Technician', '${time}', ${anyIndex})">
        ${anyHtml}
      </div>

      ${employees.map(emp => {
        const appointmentIndex = findAppointmentIndex(emp.name, time);
        const appointmentHtml = appointmentIndex !== -1
          ? getAppointmentBlock(appointments[appointmentIndex], appointmentIndex)
          : "";

        return `
          <div class="schedule-cell" onclick="openAppointmentFromCell('${emp.name}', '${time}', ${appointmentIndex})">
            ${appointmentHtml}
          </div>
        `;
      }).join("")}
    `;

    scheduleBody.appendChild(row);
  });
}

function findAppointmentIndex(employeeName, time) {
  return appointments.findIndex(appt =>
    appt.employee === employeeName &&
    appt.date === selectedAppointmentDate &&
    formatTimeToAMPM(appt.time) === time
  );
}

function getAppointmentBlock(appt, index) {
  return `
    <div class="appt-block">
      <strong>${appt.name}</strong><br>
      ${serviceText(appt.service)}<br>
      ${appt.phone}
      ${appt.reminder ? `<button class="reminder-btn" onclick="event.stopPropagation(); sendAppointmentReminder(${index})">${text("sendReminderNow")}</button>` : ""}
    </div>
  `;
}

function openAppointmentFromCell(employeeName, time, appointmentIndex) {
  editingAppointmentIndex = appointmentIndex;

  const selectedDate = selectedAppointmentDate || getTodayInputString();

  document.getElementById("appointmentModal").style.display = "flex";

  if (appointmentIndex !== -1) {
    const appt = appointments[appointmentIndex];

    document.getElementById("appointmentModalTitle").textContent = text("editAppointment");
    document.getElementById("apptName").value = appt.name;
    document.getElementById("apptPhone").value = appt.phone;
    document.getElementById("apptDate").value = appt.date;
    document.getElementById("apptTime").value = appt.time;
    document.getElementById("apptService").value = appt.service;
    document.getElementById("apptEmployee").value = appt.employee;
    document.getElementById("apptReminder").checked = Boolean(appt.reminder);
  } else {
    document.getElementById("appointmentModalTitle").textContent = text("addAppointment");
    document.getElementById("apptName").value = "";
    document.getElementById("apptPhone").value = "";
    document.getElementById("apptDate").value = selectedDate;
    document.getElementById("apptTime").value = convertAMPMToInputTime(time);
    document.getElementById("apptService").value = getDefaultServiceName();
    document.getElementById("apptEmployee").value = employeeName;
    document.getElementById("apptReminder").checked = false;
  }
}

function closeAppointmentModal() {
  document.getElementById("appointmentModal").style.display = "none";
  editingAppointmentIndex = null;
}

function deleteCurrentAppointment() {
  if (editingAppointmentIndex === null || editingAppointmentIndex === -1) {
    closeAppointmentModal();
    return;
  }

  appointments.splice(editingAppointmentIndex, 1);
  saveAppState();
  closeAppointmentModal();
  displaySchedule();
}

function formatTimeToAMPM(time) {
  if (!time) return "";

  const [hour, minute] = time.split(":");
  let h = Number(hour);
  const ampm = h >= 12 ? "PM" : "AM";

  h = h % 12;
  h = h ? h : 12;

  return `${String(h).padStart(2, "0")}:${minute} ${ampm}`;
}

function convertAMPMToInputTime(time) {
  const [clock, ampm] = time.split(" ");
  let [hour, minute] = clock.split(":");

  hour = Number(hour);

  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${minute}`;
}
function displaySchedule() {
  const scheduleBody = document.getElementById("scheduleBody");
  if (!scheduleBody) return;

  scheduleBody.innerHTML = "";

  const times = [
    "09:00 AM", "09:30 AM",
    "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM",
    "12:00 PM", "12:30 PM",
    "01:00 PM", "01:30 PM",
    "02:00 PM", "02:30 PM",
    "03:00 PM", "03:30 PM",
    "04:00 PM", "04:30 PM",
    "05:00 PM", "05:30 PM",
    "06:00 PM"
  ];

  times.forEach(time => {
    const row = document.createElement("div");
    row.className = "schedule-row";
    row.setAttribute("style", getScheduleGridStyle());

    row.innerHTML = `
      <div class="time-cell">${time}</div>

      ${(() => {
        const anyIndex = findAppointmentIndex("Any Technician", time);
        const anyHtml = anyIndex !== -1
          ? getAppointmentBlock(appointments[anyIndex], anyIndex)
          : "";

        return `
          <div class="schedule-cell" ondragover="allowAppointmentDrop(event)" ondragleave="clearAppointmentDropTarget(event)" ondrop="dropAppointment(event, 'Any Technician', '${time}')" onclick="openAppointmentFromCell('Any Technician', '${time}', ${anyIndex})">
            ${anyHtml}
          </div>
        `;
      })()}

      ${employees.map(emp => {
        const appointmentIndex = findAppointmentIndex(emp.name, time);
        const appointmentHtml = appointmentIndex !== -1
          ? getAppointmentBlock(appointments[appointmentIndex], appointmentIndex)
          : "";

        return `
          <div class="schedule-cell" ondragover="allowAppointmentDrop(event)" ondragleave="clearAppointmentDropTarget(event)" ondrop="dropAppointment(event, '${emp.name}', '${time}')" onclick="openAppointmentFromCell('${emp.name}', '${time}', ${appointmentIndex})">
            ${appointmentHtml}
          </div>
        `;
      }).join("")}
    `;

    scheduleBody.appendChild(row);
  });
}
function findAppointmentIndex(employeeName, time) {
  return appointments.findIndex(appt =>
    appt.employee === employeeName &&
    appt.date === selectedAppointmentDate &&
    formatTimeToAMPM(appt.time) === time
  );
}

function getAppointmentBlock(appt, index) {
  return `
    <div class="appt-block" draggable="true" ondragstart="startAppointmentDrag(event, ${index})">
      <strong>${appt.name}</strong><br>
      ${serviceText(appt.service)}<br>
      ${appt.phone}
      ${appt.reminder ? `<button class="reminder-btn" onclick="event.stopPropagation(); sendAppointmentReminder(${index})">${text("sendReminderNow")}</button>` : ""}
    </div>
  `;
}

function startAppointmentDrag(event, appointmentIndex) {
  event.dataTransfer.setData("text/plain", String(appointmentIndex));
  event.dataTransfer.effectAllowed = "move";
}

function allowAppointmentDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.add("drop-target");
}

function clearAppointmentDropTarget(event) {
  event.currentTarget.classList.remove("drop-target");
}

function dropAppointment(event, employeeName, time) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove("drop-target");

  const appointmentIndex = Number(event.dataTransfer.getData("text/plain"));
  const appointment = appointments[appointmentIndex];

  if (!appointment) return;

  appointment.employee = employeeName;
  appointment.time = convertAMPMToInputTime(time);
  appointment.date = selectedAppointmentDate;

  saveAppState();
  displaySchedule();
}

function openAppointmentFromCell(employeeName, time, appointmentIndex) {
  editingAppointmentIndex = appointmentIndex;

  const selectedDate = selectedAppointmentDate || getTodayInputString();

  document.getElementById("appointmentModal").style.display = "flex";

  if (appointmentIndex !== -1) {
    const appt = appointments[appointmentIndex];

    document.getElementById("appointmentModalTitle").textContent = text("editAppointment");
    document.getElementById("apptName").value = appt.name;
    document.getElementById("apptPhone").value = appt.phone;
    document.getElementById("apptDate").value = appt.date;
    document.getElementById("apptTime").value = appt.time;
    document.getElementById("apptService").value = appt.service;
    document.getElementById("apptEmployee").value = appt.employee;
    document.getElementById("apptReminder").checked = Boolean(appt.reminder);
  } else {
    document.getElementById("appointmentModalTitle").textContent = text("addAppointment");
    document.getElementById("apptName").value = "";
    document.getElementById("apptPhone").value = "";
    document.getElementById("apptDate").value = selectedDate;
    document.getElementById("apptTime").value = convertAMPMToInputTime(time);
    document.getElementById("apptService").value = getDefaultServiceName();
    document.getElementById("apptEmployee").value = employeeName;
    document.getElementById("apptReminder").checked = false;
  }
}

function closeAppointmentModal() {
  document.getElementById("appointmentModal").style.display = "none";
  editingAppointmentIndex = null;
}

function deleteCurrentAppointment() {
  if (editingAppointmentIndex === null || editingAppointmentIndex === -1) {
    closeAppointmentModal();
    return;
  }

  appointments.splice(editingAppointmentIndex, 1);
  closeAppointmentModal();
  displaySchedule();
}

function getAppointmentForCell(employeeName, time) {
  const appt = appointments.find(a =>
    a.employee === employeeName &&
    formatTimeToAMPM(a.time) === time
  );

  if (!appt) return "";

  return `
    <div class="appt-block">
      <strong>${appt.name}</strong><br>
      ${appt.service}<br>
      ${appt.phone}
    </div>
  `;
}

function quickAddAppointment(employeeName, time) {
  document.getElementById("apptEmployee").value = employeeName;
  document.getElementById("apptTime").value = convertAMPMToInputTime(time);
}
function formatTimeToAMPM(time) {
  if (!time) return "";

  const [hour, minute] = time.split(":");
  let h = Number(hour);
  const ampm = h >= 12 ? "PM" : "AM";

  h = h % 12;
  h = h ? h : 12;

  return `${String(h).padStart(2, "0")}:${minute} ${ampm}`;
}

function convertAMPMToInputTime(time) {
  const [clock, ampm] = time.split(" ");
  let [hour, minute] = clock.split(":");

  hour = Number(hour);

  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function saveAppointment() {
  const name = document.getElementById("apptName").value;
  const phone = document.getElementById("apptPhone").value;
  const date = document.getElementById("apptDate").value;
  const time = document.getElementById("apptTime").value;
  const service = document.getElementById("apptService").value;
  const employee = document.getElementById("apptEmployee").value;
  const reminder = document.getElementById("apptReminder").checked;

  if (name === "" || date === "" || time === "") {
    alert("Please fill in required fields");
    return;
  }

  const appointmentData = {
    name,
    phone,
    date,
    time,
    service,
    employee,
    reminder
  };

  if (editingAppointmentIndex !== null && editingAppointmentIndex !== -1) {
    appointments[editingAppointmentIndex] = appointmentData;
  } else {
    appointments.push(appointmentData);
  }

  selectedAppointmentDate = date;
  const datePicker = document.getElementById("scheduleDatePicker");
  if (datePicker) {
    datePicker.value = selectedAppointmentDate;
  }

  saveAppState();
  closeAppointmentModal();
  displaySchedule();

  if (reminder && phone) {
    openReminderMessage(appointmentData);
  }
}

function openReminderMessage(appt) {
  const message = encodeURIComponent(
    `Reminder: ${appt.name}, your appointment at Zen Nail is scheduled for ${appt.date} at ${formatTimeToAMPM(appt.time)} for ${serviceText(appt.service)}.`
  );
  const cleanPhone = appt.phone.replace(/[^\d+]/g, "");

  window.location.href = `sms:${cleanPhone}?&body=${message}`;
}

function sendAppointmentReminder(index) {
  const appt = appointments[index];

  if (!appt) return;

  if (!appt.phone) {
    alert("This appointment does not have a phone number.");
    return;
  }

  openReminderMessage(appt);
}

function displayCalendar() {
  const calendarDays = document.getElementById("calendarDays");

  if (!calendarDays) return;

  calendarDays.innerHTML = "";

  const today = new Date();

  const year = today.getFullYear();
  const month = today.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const emptyBox = document.createElement("div");
    emptyBox.className = "calendar-day empty";
    calendarDays.appendChild(emptyBox);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayBox = document.createElement("div");
    dayBox.className = "calendar-day";

    const dateString =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const dayAppointments = appointments
      .map((appt, index) => ({ ...appt, index }))
      .filter(appt => appt.date === dateString);

    dayBox.innerHTML = `
      <div class="calendar-date">${day}</div>
    `;

    dayAppointments.forEach(appt => {
      const apptDiv = document.createElement("div");
      apptDiv.className = "calendar-appt";

      apptDiv.innerHTML = `
        <strong>${appt.time}</strong><br>
      ${appt.name}<br>
        ${serviceText(appt.service)}<br>
        ${appt.employee}<br>

        <div class="calendar-buttons">
          <button onclick="editAppointment(${appt.index})">Edit</button>
          <button onclick="deleteAppointment(${appt.index})">Delete</button>
        </div>
      `;

      dayBox.appendChild(apptDiv);
    });

    calendarDays.appendChild(dayBox);
  }
}

function editAppointment(index) {
  const appt = appointments[index];

  editingAppointmentIndex = index;

  document.getElementById("apptName").value = appt.name;
  document.getElementById("apptPhone").value = appt.phone;
  document.getElementById("apptDate").value = appt.date;
  document.getElementById("apptTime").value = appt.time;
  document.getElementById("apptService").value = appt.service;
  document.getElementById("apptEmployee").value = appt.employee;

  document.getElementById("apptSaveBtn").textContent = "Update Appointment";
}

function deleteAppointment(index) {
  appointments.splice(index, 1);
  saveAppState();
  displayCalendar();
}

document.addEventListener("keydown", function (event) {

  const pinModal = document.getElementById("pinModal");

  if (!pinModal) return;

  if (pinModal.style.display !== "flex") return;

  if (event.key >= "0" && event.key <= "9") {

    addPinNumber(event.key);

    if (enteredPin.length === 4) {
      setTimeout(() => {
        submitPin();
      }, 100);
    }

  }

  if (event.key === "Backspace") {
    deletePin();
  }

  if (event.key === "Enter") {

    if (enteredPin.length === 4) {
      submitPin();
    }

  }

  if (event.key === "Escape") {
    closePinModal();
  }

});
let oldLanguageBlock = "en";

const oldTranslations = {
  en: {
    functions: "Functions",
    balance: "BALANCE",
    appointment: "Appointment",
    queueService: "QUEUE SERVICE",
    service: "SERVICE",
    closedTicket: "CLOSED TICKET",
    turnDetail: "TURN DETAIL",
    clockIn: "Clock In",
    clockOut: "Clock Out"
  },
  km: {
    functions: "áž˜áž»ážáž„áž¶ážš",
    balance: "ážŸáž˜ážáž»áž›áŸ’áž™",
    appointment: "áž€áž¶ážšážŽáž¶ážáŸ‹áž‡áž½áž”",
    queueService: "áž‡áž½ážšáž”áž»áž‚áŸ’áž‚áž›áž·áž€",
    service: "ážŸáŸážœáž¶áž€áž˜áŸ’áž˜",
    closedTicket: "ážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážšáž”áž·áž‘",
    turnDetail: "áž–áŸážáŸŒáž˜áž¶áž“ážœáŸáž“",
    clockIn: "áž…áž¼áž›áž’áŸ’ážœáž¾áž€áž¶ážš",
    clockOut: "áž…áŸáž‰áž–áž¸áž’áŸ’ážœáž¾áž€áž¶ážš"
  }
};

function switchLanguage() {
  currentLanguage = currentLanguage === "en" ? "km" : "en";
  applyLanguage();
applySalonSettings();
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage === "km" ? "km" : "en";
  document.getElementById("functionsText").textContent = text("functions");
  document.getElementById("balanceText").textContent = text("staff");
  document.getElementById("appointmentText").textContent = text("appointment");
  document.getElementById("closedTicketText").textContent = text("closedTicket");
  document.getElementById("ownerText").textContent = text("owner");
  const homeButton = document.querySelector(".home");
  homeButton.setAttribute("aria-label", text("home"));
  homeButton.setAttribute("title", text("home"));
  document.querySelector(".home-label").textContent = text("home");
  document.getElementById("queueText").textContent = text("queueService");
  const closedHeading = document.getElementById("closedText");
  if (closedHeading) {
    closedHeading.textContent = text("closedTicket");
  }

  const staffHeading = document.getElementById("turnText");
  if (staffHeading) {
    staffHeading.textContent = text("staffStatus");
  }

  const serviceHeading = document.querySelectorAll(".content-section")[0]?.querySelector("h3");
  if (serviceHeading && !selectedEmployee) {
    serviceHeading.textContent = text("service");
  }

  const emptyMessage = document.querySelector(".empty-message");
  if (emptyMessage) {
    emptyMessage.textContent = text("noTicketFound");
  }

  const modalTitle = document.querySelector(".modal-content h2");
  if (modalTitle) {
    modalTitle.textContent = text("dailyTasks");
  }

  const functionCards = document.querySelectorAll(".function-card");
  [
    "clockIn",
    "clockOut",
    "ticketPayment",
    "customers",
    "refund",
    "cashDrawer",
    "closeOut",
    "staffStatus",
    "settings"
  ].forEach((key, index) => {
    if (functionCards[index]) {
      functionCards[index].textContent = text(key);
    }
  });

  const closeButton = document.querySelector(".close-btn");
  if (closeButton) {
    closeButton.textContent = text("close");
  }

  const pinTitle = document.querySelector(".pin-header h2");
  if (pinTitle) {
    pinTitle.textContent = text("password");
  }

  const keypadButtons = document.querySelectorAll(".keypad button");
  if (keypadButtons[9]) keypadButtons[9].textContent = text("clear");
  if (keypadButtons[11]) keypadButtons[11].textContent = text("delete");
  document.getElementById("confirmPinBtn").textContent = text("confirm");

  if (currentMainView === "owner") {
    openOwnerDashboard(false);
  } else if (currentMainView === "closed") {
    displayClosedTickets();
  } else if (currentMainView === "appointment") {
    openAppointmentSheet();
  } else if (selectedEmployee) {
    const savedTicket = [...currentTicket];
    selectEmployee(selectedEmployee);
    currentTicket = savedTicket;
    updateTicket();
  } else {
    goHome();
  }

  displayQueue();
  renderEmployeeDashboard();
}

applyLanguage();
applySalonSettings();













