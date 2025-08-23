// Global variables
let currentUser = null;
let authToken = null;

// DOM elements
const loginContainer = document.getElementById('loginContainer');
const registerContainer = document.getElementById('registerContainer');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const backToLoginBtn = document.getElementById('backToLogin');
const logoutBtn = document.getElementById('logoutBtn');
const togglePassword = document.getElementById('togglePassword');
const toggleRegPassword = document.getElementById('toggleRegPassword');
const rememberMeCheckbox = document.getElementById('rememberMe');

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', function () {
  checkAuthStatus();
  setupEventListeners();
  // Handle deep links like /item/:id
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'item' && parts[1]) {
    // Ensure dashboard is visible and try to open the item modal after auth
    const openAfterAuth = () => {
      showDashboard();
      // small delay to allow dashboard render
      setTimeout(() => showItemDetailModal(parts[1]), 300);
    };
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser && isTokenValid(savedToken)) {
      authToken = savedToken;
      currentUser = JSON.parse(savedUser);
      openAfterAuth();
    } else {
      // Show login; after login, open the item
      const onLoginOpen = async (e) => {
        if (e.detail === 'logged-in') {
          window.removeEventListener('app-auth', onLoginOpen);
          openAfterAuth();
        }
      };
      window.addEventListener('app-auth', onLoginOpen);
    }
  }
});

// Setup event listeners
function setupEventListeners() {
  // Login form submission
  loginForm.addEventListener('submit', handleLogin);

  // Registration form submission
  registerForm.addEventListener('submit', handleRegistration);

  // Show registration form
  showRegisterLink.addEventListener('click', showRegistration);

  // Back to login
  backToLoginBtn.addEventListener('click', showLogin);

  // Logout
  logoutBtn.addEventListener('click', handleLogout);

  // Password visibility toggles
  togglePassword.addEventListener('click', () => togglePasswordVisibility('password'));
  toggleRegPassword.addEventListener('click', () => togglePasswordVisibility('regPassword'));

  // Remember me checkbox
  rememberMeCheckbox.addEventListener('change', handleRememberMe);

  // Company setup button
  const setupCompanyBtn = document.getElementById('setupCompanyBtn');
  if (setupCompanyBtn) {
    setupCompanyBtn.addEventListener('click', setupDemoCompany);
  }

  // Create first list button
  const createFirstListBtn = document.getElementById('createFirstListBtn');
  if (createFirstListBtn) {
    createFirstListBtn.addEventListener('click', showCreateFirstListModal);
  }

  // Create list from form button
  const createListFromFormBtn = document.getElementById('createListFromForm');
  if (createListFromFormBtn) {
    createListFromFormBtn.addEventListener('click', showCreateListFromFormModal);
  }

  // Create list button in main toolbar
  const createListBtn = document.getElementById('createListBtn');
  if (createListBtn) {
    createListBtn.addEventListener('click', showCreateListModal);
  }

  // OOS visibility toggle
  const chkDrawer = document.getElementById('drawerShowOOS');
  if (chkDrawer) {
    chkDrawer.checked = getShowOOS();
    chkDrawer.addEventListener('change', () => {
      setShowOOS(chkDrawer.checked);
      loadInventoryItems(); // re-render with new filter
    });
  }

  // Modal close buttons for OOS
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close')));
  });

  // Setup OOS form handlers
  setupOOSFormHandlers();

  // Maintenance checkbox toggle
  const useMaintenanceCheckbox = document.getElementById('useMaintenance');
  const maintenanceFields = document.getElementById('maintenanceFields');

  if (useMaintenanceCheckbox && maintenanceFields) {
    useMaintenanceCheckbox.addEventListener('change', function () {
      maintenanceFields.style.display = this.checked ? 'block' : 'none';

      // Clear maintenance fields when unchecked
      if (!this.checked) {
        const maintenanceInputs = maintenanceFields.querySelectorAll('input, select');
        maintenanceInputs.forEach((input) => {
          if (input.type === 'file') {
            input.value = '';
          } else if (input.type === 'date') {
            input.value = '';
          } else if (input.type === 'number') {
            input.value = '6';
          } else if (input.tagName === 'SELECT') {
            input.selectedIndex = 0;
          }
        });
      }
    });
  }

  // Column customizer (now merged with lists functionality)
  const columnCustomizerBtn = document.getElementById('columnCustomizerBtn');
  const columnCustomizerMenu = document.getElementById('columnCustomizerMenu');

  if (columnCustomizerBtn && columnCustomizerMenu) {
    columnCustomizerBtn.addEventListener('click', async function (e) {
      e.stopPropagation();

      // Always refresh lists when opening the menu
      if (!columnCustomizerMenu.classList.contains('show')) {
        await loadListsIntoSelectors();
      }

      columnCustomizerMenu.classList.toggle('show');

      // Smart positioning to ensure menu is always visible
      if (columnCustomizerMenu.classList.contains('show')) {
        positionColumnCustomizerMenu();
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (e) {
      if (!columnCustomizerMenu.contains(e.target) && !columnCustomizerBtn.contains(e.target)) {
        columnCustomizerMenu.classList.remove('show');
      }
    });

    // Setup column visibility toggles
    const columnOptions = columnCustomizerMenu.querySelectorAll('.column-option input');
    columnOptions.forEach((checkbox) => {
      checkbox.addEventListener('change', function () {
        toggleColumnVisibility(this.dataset.column, this.checked);
      });
    });

    // Setup lists functionality
    const listOptions = document.getElementById('listOptions');
    const listsShowAllBtn = document.getElementById('listsShowAllBtn');
    const addListInlineBtn = document.getElementById('addListInlineBtn');

    if (listsShowAllBtn) {
      listsShowAllBtn.addEventListener('click', async () => {
        localStorage.removeItem('hiddenLists');
        await loadListsIntoSelectors();
        await loadInventoryItems();
      });
    }

    if (addListInlineBtn) {
      addListInlineBtn.addEventListener('click', () => {
        showCreateListModal();
      });
    }

    // Load saved column preferences
    loadColumnPreferences();
  }

  // Handle window resize to reposition menu if needed
  window.addEventListener('resize', function () {
    if (columnCustomizerMenu && columnCustomizerMenu.classList.contains('show')) {
      positionColumnCustomizerMenu();
    }
  });
}

// Check authentication status
function checkAuthStatus() {
  const savedToken = localStorage.getItem('authToken');
  const savedUser = localStorage.getItem('user');

  if (savedToken && savedUser) {
    try {
      authToken = savedToken;
      currentUser = JSON.parse(savedUser);

      // Verify token is still valid
      if (isTokenValid(authToken)) {
        showDashboard();
        return;
      }
    } catch (error) {
      console.error('Error parsing saved user data:', error);
    }
  }

  // Clear invalid data
  clearAuthData();
  showLogin();
}

// Check if token is valid (simple expiration check)
function isTokenValid(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch (error) {
    return false;
  }
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const email = formData.get('email');
  const password = formData.get('password');

  // Show loading state
  const submitBtn = loginForm.querySelector('.login-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');

  btnText.style.display = 'none';
  btnLoader.style.display = 'block';

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Login successful
      authToken = data.token;
      currentUser = data.user;

      // Save to localStorage if remember me is checked
      if (rememberMeCheckbox.checked) {
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('user', JSON.stringify(currentUser));
      }

      showToast('Login successful!', 'success');
      showDashboard();
      // notify deep-link handler
      window.dispatchEvent(new CustomEvent('app-auth', { detail: 'logged-in' }));
    } else {
      // Login failed
      showToast(data.error || 'Login failed', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Network error. Please try again.', 'error');
  } finally {
    // Reset button state
    btnText.style.display = 'block';
    btnLoader.style.display = 'none';
  }
}

// Handle registration form submission
async function handleRegistration(event) {
  event.preventDefault();

  const formData = new FormData(registerForm);
  const email = formData.get('email');
  const password = formData.get('password');
  const firstName = formData.get('firstName');
  const lastName = formData.get('lastName');
  const inviteCode = formData.get('inviteCode');

  // Show loading state
  const submitBtn = registerForm.querySelector('.register-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');

  btnText.style.display = 'none';
  btnLoader.style.display = 'block';

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        firstName,
        lastName,
        inviteCode,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Registration successful
      authToken = data.token;
      currentUser = data.user;

      showToast('Account created successfully!', 'success');
      showDashboard();
    } else {
      // Registration failed
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch (error) {
    console.error('Registration error:', error);
    showToast('Network error. Please try again.', 'error');
  } finally {
    // Reset button state
    btnText.style.display = 'block';
    btnLoader.style.display = 'none';
  }
}

// Handle logout
function handleLogout() {
  clearAuthData();
  showToast('Logged out successfully', 'success');
  showLogin();
  // Ensure URL is reset to root so deep-links don't reopen modals after logout
  if (window.location.pathname !== '/') {
    history.replaceState({}, '', '/');
  }
}

// Setup demo company
async function setupDemoCompany() {
  try {
    const response = await fetch('/api/company/setup-demo', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      showToast('Demo company created successfully!', 'success');
      // Hide the setup button
      const setupCompanyBtn = document.getElementById('setupCompanyBtn');
      if (setupCompanyBtn) {
        setupCompanyBtn.style.display = 'none';
      }
      // Show the create first list button
      const createFirstListBtn = document.getElementById('createFirstListBtn');
      if (createFirstListBtn) {
        createFirstListBtn.style.display = 'inline-block';
      }
      // Update welcome message
      const welcomeMessage = document.getElementById('welcomeMessage');
      if (welcomeMessage) {
        welcomeMessage.querySelector('p').textContent =
          'Your company is set up! Create your first list, then add items.';
      }
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to setup company', 'error');
    }
  } catch (error) {
    console.error('Error setting up company:', error);
    showToast('Network error. Please try again.', 'error');
  }
}

// Clear authentication data
function clearAuthData() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
}

// Handle remember me checkbox
function handleRememberMe() {
  if (!rememberMeCheckbox.checked) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }
}

// Show registration form
function showRegistration() {
  loginContainer.style.display = 'none';
  registerContainer.style.display = 'block';
}

// Show login form
function showLogin() {
  registerContainer.style.display = 'none';
  loginContainer.style.display = 'block';
}

// Show dashboard
function showDashboard() {
  loginContainer.style.display = 'none';
  registerContainer.style.display = 'none';
  dashboard.style.display = 'flex';

  // Update user info in dashboard
  updateDashboardUserInfo();

  // Load dashboard data
  loadDashboardData();
}

// Update user information in dashboard
function updateDashboardUserInfo() {
  if (currentUser) {
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');

    if (userNameElement) {
      userNameElement.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    }

    if (userRoleElement) {
      userRoleElement.textContent = formatUserRole(currentUser.role);
    }
  }
}

// Format user role for display
function formatUserRole(role) {
  const roleMap = {
    admin: 'Administrator',
    company_owner: 'Company Owner',
    company_manager: 'Company Manager',
    region_manager: 'Region Manager',
    lab_manager: 'Lab Manager',
    user: 'User',
    viewer: 'Viewer',
  };

  return roleMap[role] || role;
}

// Load dashboard data
async function loadDashboardData() {
  try {
    // Load user profile to get updated info
    const response = await fetch('/api/auth/profile', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      updateDashboardUserInfo();
    }

    // Load lists first (needed for inventory filtering)
    await loadListsIntoSelectors();

    // Load inventory statistics
    await loadInventoryStats();

    // Load inventory items
    await loadInventoryItems();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

// Toggle password visibility
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  const toggleBtn = input.parentElement.querySelector('.toggle-password i');

  if (input.type === 'password') {
    input.type = 'text';
    toggleBtn.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    toggleBtn.className = 'fas fa-eye';
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');

  // Set message and type
  toast.textContent = message;
  toast.className = `toast ${type}`;

  // Show toast
  toast.classList.add('show');

  // Hide after 5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}

// API helper function
async function apiCall(endpoint, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    },
  };

  const response = await fetch(endpoint, { ...defaultOptions, ...options });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Navigation handling
document.addEventListener('click', function (e) {
  const link = e.target.closest('.nav-link');
  if (link) {
    e.preventDefault();

    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.remove('active');
    });

    // Add active class to clicked item
    const navItem = link.closest('.nav-item');
    if (navItem) navItem.classList.add('active');

    // Handle navigation
    const href = link.getAttribute('href');
    handleNavigation(href);
    if (href === '#inventory') {
      const welcomeMessage = document.getElementById('welcomeMessage');
      const inventorySection = document.getElementById('inventorySection');
      if (welcomeMessage) welcomeMessage.style.display = 'none';
      if (inventorySection) inventorySection.style.display = 'block';
      loadInventoryItems();
    }
  }
});

// Handle navigation
function handleNavigation(route) {
  const breadcrumb = document.querySelector('.breadcrumb span');

  switch (route) {
    case '#inventory':
      breadcrumb.textContent = 'Inventory';
      // Show inventory section, hide calendar
      const invSec = document.getElementById('inventorySection');
      const calSec = document.getElementById('calendarSection');
      if (invSec) invSec.style.display = 'block';
      if (calSec) calSec.style.display = 'none';
      loadInventoryItems();
      break;
    case '#calendar':
      breadcrumb.textContent = 'Calendar';
      // Show calendar section, hide inventory
      const calSec2 = document.getElementById('calendarSection');
      const invSec2 = document.getElementById('inventorySection');
      if (invSec2) invSec2.style.display = 'none';
      if (calSec2) {
        calSec2.style.display = 'block';
        loadCalendarView();
      }
      break;
    case '#reports':
      breadcrumb.textContent = 'Reports';
      // TODO: Load reports view
      break;
    case '#settings':
      breadcrumb.textContent = 'Settings';
      // TODO: Load settings view
      break;
    case '#support':
      breadcrumb.textContent = 'Support';
      // TODO: Load support view
      break;
  }
}

// Add item button handler
document.getElementById('addItemBtn').addEventListener('click', function () {
  showAddItemModal();
});

// Calibration type change handler
document.addEventListener('DOMContentLoaded', function () {
  const calibrationTypeSelect = document.getElementById('calibrationType');
  if (calibrationTypeSelect) {
    calibrationTypeSelect.addEventListener('change', handleCalibrationTypeChange);
  }
});

// Search functionality
document.querySelector('.search-box input').addEventListener('input', function (e) {
  const searchTerm = e.target.value;
  // TODO: Implement search functionality
  console.log('Searching for:', searchTerm);
});

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
  // Ctrl/Cmd + K for search focus
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.querySelector('.search-box input').focus();
  }

  // Escape to close modals (when implemented)
  if (e.key === 'Escape') {
    // TODO: Close any open modals
  }
});

// Auto-save form data (for better UX)
function autoSaveForm(formId) {
  const form = document.getElementById(formId);
  const formData = new FormData(form);
  const data = {};

  for (let [key, value] of formData.entries()) {
    data[key] = value;
  }

  localStorage.setItem(`form_${formId}`, JSON.stringify(data));
}

function loadFormData(formId) {
  const saved = localStorage.getItem(`form_${formId}`);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      const form = document.getElementById(formId);

      Object.keys(data).forEach((key) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) {
          input.value = data[key];
        }
      });
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  }
}

// Auto-save forms on input
document.querySelectorAll('input, textarea, select').forEach((input) => {
  input.addEventListener('input', function () {
    const form = this.closest('form');
    if (form) {
      autoSaveForm(form.id);
    }
  });
});

// Load saved form data when forms are shown
document.addEventListener('DOMContentLoaded', function () {
  loadFormData('loginForm');
  loadFormData('registerForm');
});

// Inventory Management Functions
async function loadInventoryStats() {
  try {
    const response = await fetch('/api/inventory/stats/overview', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      updateDashboardStats(data);
    }
  } catch (error) {
    console.error('Error loading inventory stats:', error);
  }
}

function updateDashboardStats(stats) {
  const totalItemsElement = document.getElementById('totalItems');
  const dueThisMonthElement = document.getElementById('dueThisMonth');
  const maintenanceDueElement = document.getElementById('maintenanceDue');

  if (totalItemsElement) {
    totalItemsElement.textContent = stats.totalItems || 0;
    // Make the number clickable to show the inventory list
    totalItemsElement.style.cursor = 'pointer';
    totalItemsElement.onclick = () => {
      const welcomeMessage = document.getElementById('welcomeMessage');
      const inventorySection = document.getElementById('inventorySection');
      if (welcomeMessage) welcomeMessage.style.display = 'none';
      if (inventorySection) inventorySection.style.display = 'block';
      loadInventoryItems();
    };
  }
  if (dueThisMonthElement) dueThisMonthElement.textContent = stats.dueThisMonth || 0;
  if (maintenanceDueElement) maintenanceDueElement.textContent = stats.maintenanceDue || 0;
}

async function loadInventoryItems() {
  const showOOS = getShowOOS();
  logStep('loadInventoryItems:start', { showOOS, cacheLen: _itemsCache.length });

  // If cache is empty, fetch fresh data
  if (_itemsCache.length === 0) {
  try {
    console.log('Loading inventory items...');
    const response = await fetch(`/api/inventory`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Inventory response:', data);
      const allItems = Array.isArray(data.items) ? data.items : [];
        _itemsCache = allItems;
        logStep('loadInventoryItems:fetched', { count: allItems.length });
    } else {
      console.error('Failed to load inventory:', response.status, response.statusText);
        _itemsCache = [];
    }
  } catch (error) {
    console.error('Error loading inventory items:', error);
      _itemsCache = [];
    }
  }

  // Apply list filtering
  const hiddenLists = JSON.parse(localStorage.getItem('hiddenLists') || '[]');
  let visibleItems = _itemsCache.filter(
    (item) => !item.listId || !hiddenLists.includes(item.listId),
  );
  
  // Apply OOS filtering
  if (!showOOS) {
    visibleItems = visibleItems.filter(item => !item.isOutOfService);
  }
  
  logStep('loadInventoryItems:afterFilter', { rows: visibleItems.length });

  try {
    displayInventoryItems(visibleItems);
    logStep('loadInventoryItems:rendered');
  } catch (e) {
    console.error('[INV] displayInventoryItems error', e);
  }
}

function displayInventoryItems(items) {
  const welcomeMessage = document.getElementById('welcomeMessage');
  const inventorySection = document.getElementById('inventorySection');
  const tableBody = document.getElementById('inventoryTableBody');

  logStep('displayInventoryItems:start', { itemCount: Array.isArray(items) ? items.length : 'not-array', hasTableBody: !!tableBody });

  // Keep a global copy so actions like Edit can find items quickly
  window.inventoryItems = Array.isArray(items) ? items : [];

  if (!tableBody) {
    console.error('[INV] tbody #inventoryTableBody not found');
    return;
  }

  // Clear existing table rows
  tableBody.innerHTML = '';

  if (Array.isArray(items) && items.length > 0) {
    // Hide welcome message, show inventory
    if (welcomeMessage) welcomeMessage.style.display = 'none';
    if (inventorySection) inventorySection.style.display = 'block';

    // Add items to table using document fragment for performance
    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      try {
      const row = createInventoryRow(item);
        fragment.appendChild(row);
      } catch (e) {
        console.warn(`[INV] row render error for item ${index}:`, item?.id, e);
      }
    });
    tableBody.appendChild(fragment);
    logStep('displayInventoryItems:rowsAdded', { count: items.length });
  } else {
    // Show empty state in table
    if (inventorySection) inventorySection.style.display = 'block';
    if (welcomeMessage) welcomeMessage.style.display = 'none';
    
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="17" style="padding: 2rem; text-align: center; opacity: 0.7; color: #b8b8d1;">
          ${_itemsCache.length === 0 ? 'No items found. Try adding some inventory items.' : 'No items match the current filters.'}
        </td>
      </tr>
    `;
    logStep('displayInventoryItems:emptyState');
  }
}

// Generate consistent colors for lists based on their ID
function getListColor(listId) {
  if (!listId) return { bgColor: '#6b7280', textColor: '#ffffff' }; // Gray for unassigned

  // Find the list in the loaded lists to get its actual color
  const list = window.loadedLists?.find((l) => l.id === listId);
  console.log('getListColor called for listId:', listId, 'found list:', list);

  if (list && list.color && list.textColor) {
    console.log('Returning list colors:', { bgColor: list.color, textColor: list.textColor });
    return { bgColor: list.color, textColor: list.textColor };
  }

  console.log('List not found or missing colors, using fallback');

  // Fallback to generated color if list not found or colors missing
  let hash = 0;
  for (let i = 0; i < listId.length; i++) {
    const char = listId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const hue = Math.abs(hash) % 360;
  const saturation = 70 + (Math.abs(hash) % 20); // 70-90%
  const lightness = 45 + (Math.abs(hash) % 15); // 45-60%

  return { bgColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`, textColor: '#ffffff' };
}

function createInventoryRow(item) {
  const row = document.createElement('tr');

  // Add OOS row styling
  if (item.isOutOfService) {
    row.classList.add('row-oos');
  }

  // Add list color coding (background and text color)
  const listColors = getListColor(item.listId);
  console.log(
    'Creating row for item:',
    item.nickname,
    'with listId:',
    item.listId,
    'colors:',
    listColors,
  );

  row.style.setProperty('--list-bg-color', listColors.bgColor);
  row.style.setProperty('--list-text-color', listColors.textColor);
  row.style.backgroundColor = listColors.bgColor;
  row.style.color = listColors.textColor;

  console.log('Applied styles to row:', {
    '--list-bg-color': row.style.getPropertyValue('--list-bg-color'),
    '--list-text-color': row.style.getPropertyValue('--list-text-color'),
    backgroundColor: row.style.backgroundColor,
    color: row.style.color,
  });

  // Add color coding for calibration type (border for outsourced)
  if (item.isOutsourced === 1 || item.isOutsourced === true) {
    row.classList.add('outsourced');
  } else {
    row.classList.add('in-house');
  }

  // Add list ID attribute for CSS targeting
  if (item.listId) {
    row.setAttribute('data-list-id', item.listId);
  } else {
    row.setAttribute('data-list-id', ''); // Empty string for unassigned items
  }

  // Format dates
  const nextCalDue = item.nextCalibrationDue
    ? new Date(item.nextCalibrationDue).toLocaleDateString()
    : 'N/A';
  const maintenanceDue = item.maintenanceDue
    ? new Date(item.maintenanceDue).toLocaleDateString()
    : 'N/A';
  const lastMaintenance = item.maintenanceDate
    ? new Date(item.maintenanceDate).toLocaleDateString()
    : 'N/A';
  const dateReceived = item.dateReceived ? new Date(item.dateReceived).toLocaleDateString() : 'N/A';
  const dateInService = item.datePlacedInService
    ? new Date(item.datePlacedInService).toLocaleDateString()
    : 'N/A';
  const lastCal = item.calibrationDate
    ? new Date(item.calibrationDate).toLocaleDateString()
    : 'N/A';

  // Format calibration interval
  const calInterval =
    item.calibrationInterval && item.calibrationIntervalType
      ? `${item.calibrationInterval} ${item.calibrationIntervalType}`
      : 'N/A';

  // Format calibration type
  const calType = item.isOutsourced === 1 ? 'Outsourced' : 'In-House';

  row.innerHTML = `
        <td class="column-itemType">${item.itemType || 'N/A'}</td>
        <td class="column-nickname">${renderNicknameCell(item)}</td>
        <td class="column-labId">${item.labId || 'N/A'}</td>
        <td class="column-make">${item.make || 'N/A'}</td>
        <td class="column-model">${item.model || 'N/A'}</td>
        <td class="column-serialNumber">${item.serialNumber || 'N/A'}</td>
        <td class="column-condition">${item.condition || 'N/A'}</td>
        <td class="column-dateReceived">${dateReceived}</td>
        <td class="column-location">${item.location || 'N/A'}</td>
        <td class="column-calibrationType">${calType}</td>
        <td class="column-calibrationDate">${lastCal}</td>
        <td class="column-nextCalibrationDue">${nextCalDue}</td>
        <td class="column-calibrationInterval">${calInterval}</td>
        <td class="column-calibrationMethod">${item.calibrationMethod || 'N/A'}</td>
        <td class="column-maintenanceDate">${lastMaintenance}</td>
        <td class="column-maintenanceDue">${maintenanceDue}</td>
        <td class="column-notes">${item.notes || 'N/A'}</td>
        <td class="actions">
            ${renderActionsCell(item)}
        </td>
    `;

  return row;
}

function toggleActionMenu(e) {
  e.stopPropagation();
  const menu = e.currentTarget.parentElement;
  document.querySelectorAll('.action-menu.show').forEach((m) => {
    if (m !== menu) m.classList.remove('show');
  });
  // Toggle first so we can measure
  const willShow = !menu.classList.contains('show');
  menu.classList.toggle('show');

  // Decide whether to open up or down based on viewport space
  if (willShow) {
    const list = menu.querySelector('.action-menu-list');
    if (list) {
      // Reset orientation, then measure
      menu.classList.remove('open-up');
      list.classList.remove('floating');

      // Temporarily show to measure natural size
      const prevDisplay = list.style.display;
      const prevVisibility = list.style.visibility;
      list.style.display = 'flex';
      list.style.visibility = 'hidden'; // Hide while measuring to prevent flicker

      const btnRect = e.currentTarget.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const spaceBelow = window.innerHeight - btnRect.bottom;
      const spaceAbove = btnRect.top;
      const wantHeight = Math.min(listRect.height || 200, 300);

      // Flip if not enough space below
      const openUp = spaceBelow < wantHeight && spaceAbove > spaceBelow;
      if (openUp) {
        menu.classList.add('open-up');
      }

      // Always use floating positioning to avoid scrollbar and container clipping issues
      list.classList.add('floating');

      // Anchor to viewport using the button coordinates
      const top = openUp ? btnRect.top - wantHeight - 8 : btnRect.bottom + 8;

      // Ensure the menu doesn't extend beyond the right edge of the viewport
      const menuWidth = listRect.width || 180;
      let left = btnRect.right - menuWidth; // Align right edge of menu with right edge of button

      // If menu would go off the left edge, align left edge with button's left edge
      if (left < 8) {
        left = btnRect.left;
      }

      // If menu would go off the right edge, move it left
      if (left + menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - menuWidth - 8;
      }

      list.style.top = `${top}px`;
      list.style.left = `${left}px`;

      // Restore original display properties
      list.style.display = prevDisplay || '';
      list.style.visibility = prevVisibility || '';
    }
  }
}

// Delete a single record
async function deleteRecord(recordId, type, itemId) {
  if (!confirm('Remove this record?')) return;
  try {
    const resp = await fetch(`/api/inventory/${itemId}/records/${recordId}?type=${type}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (resp.ok) {
      showToast('Record removed', 'success');
      await loadItemDetails(itemId);
    } else {
      const err = await resp.json().catch(() => ({}));
      showToast(err.error || 'Failed to remove record', 'error');
    }
  } catch (err) {
    console.error('Delete record error:', err);
    showToast('Network error. Please try again.', 'error');
  }
}

// Close menus on outside click
document.addEventListener('click', () => {
  document.querySelectorAll('.action-menu.show').forEach((m) => m.classList.remove('show'));
});

async function deleteItem(itemId) {
  if (!confirm('Delete this item and all associated records? This cannot be undone.')) return;
  try {
    const resp = await fetch(`/api/inventory/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (resp.ok) {
      showToast('Item deleted', 'success');
      await loadInventoryItems();
      await loadInventoryStats();
    } else {
      const err = await resp.json().catch(() => ({}));
      showToast(err.error || 'Failed to delete item', 'error');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Network error. Please try again.', 'error');
  }
}

// Item action functions
function viewItem(itemId) {
  showItemDetailModal(itemId);
}

function editItem(itemId) {
  // Open the existing Add Item modal prefilled for this item
  const item = window.inventoryItems?.find((it) => it.id === itemId);
  if (!item) {
    showToast('Item not found in list. Try refreshing.', 'error');
    return;
  }
  showAddItemModal();
  const form = document.getElementById('addItemForm');
  // Update modal title and button text for edit mode
  const titleEl = document.querySelector('#addItemModal .modal-header h2');
  if (titleEl) titleEl.textContent = 'Edit Inventory Item';
  const submitBtn = form.querySelector('.btn-primary .btn-text');
  if (submitBtn) submitBtn.textContent = 'Save Changes';
  form.dataset.editing = 'true';
  form.dataset.itemId = itemId;
  form.querySelector('#itemType').value = item.itemType || '';
  form.querySelector('#nickname').value = item.nickname || '';
  form.querySelector('#labId').value = item.labId || '';
  form.querySelector('#make').value = item.make || '';
  form.querySelector('#model').value = item.model || '';
  form.querySelector('#serialNumber').value = item.serialNumber || '';
  form.querySelector('#condition').value = item.condition || 'new';
  form.querySelector('#dateReceived').value = item.dateReceived
    ? item.dateReceived.split('T')[0]
    : '';
  form.querySelector('#datePlacedInService').value = item.datePlacedInService
    ? item.datePlacedInService.split('T')[0]
    : '';
  form.querySelector('#location').value = item.location || '';
  form.querySelector('#calibrationDate').value = item.calibrationDate
    ? item.calibrationDate.split('T')[0]
    : '';
  form.querySelector('#nextCalibrationDue').value = item.nextCalibrationDue
    ? item.nextCalibrationDue.split('T')[0]
    : '';
  form.querySelector('#calibrationInterval').value = item.calibrationInterval || 12;
  form.querySelector('#calibrationIntervalType').value = item.calibrationIntervalType || 'months';
  form.querySelector('#calibrationMethod').value = item.calibrationMethod || '';

  // Set calibration type and trigger change event to update method label
  const calibrationType = item.isOutsourced === 1 ? 'outsourced' : 'in_house';
  form.querySelector('#calibrationType').value = calibrationType;
  handleCalibrationTypeChange(); // Update the form labels

  form.querySelector('#maintenanceDate').value = item.maintenanceDate
    ? item.maintenanceDate.split('T')[0]
    : '';
  form.querySelector('#maintenanceDue').value = item.maintenanceDue
    ? item.maintenanceDue.split('T')[0]
    : '';
  form.querySelector('#maintenanceInterval').value = item.maintenanceInterval || '';
  form.querySelector('#maintenanceIntervalType').value = item.maintenanceIntervalType || 'months';

  // Enhanced file upload areas for edit mode
  enhanceFileUploadsForEdit(item);

  // Ensure the create-item handler does not run in edit mode
  try {
    form.removeEventListener('submit', handleAddItem);
  } catch {}
  // Change submit handler to PUT
  form.onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('.btn-primary');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const resp = await fetch(`/api/inventory/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(data),
      });
      if (resp.ok) {
        showToast('Item updated', 'success');
        hideAddItemModal();
        await loadInventoryItems();
      } else {
        const err = await resp.json().catch(() => ({}));
        showToast(err.error || 'Failed to update item', 'error');
      }
    } catch (error) {
      // Keep form in edit mode if there's an error
      console.error('Error updating item:', error);
      btnText.style.display = 'block';
      btnLoader.style.display = 'none';
      // Don't reset the form - keep it in edit mode
      return;
    }

    // Only reset form on successful update
    btnText.style.display = 'block';
    btnLoader.style.display = 'none';
    // Restore default submit handler for create mode
    form.onsubmit = null;
    try {
      form.addEventListener('submit', handleAddItem);
    } catch {}
    delete form.dataset.editing;
    delete form.dataset.itemId;
    const titleEl2 = document.querySelector('#addItemModal .modal-header h2');
    if (titleEl2) titleEl2.textContent = 'Add New Inventory Item';
    const submitText = form.querySelector('.btn-primary .btn-text');
    if (submitText) submitText.textContent = 'Add Item';
  };
}

function markOutOfService(itemId) {
  if (confirm('Are you sure you want to mark this item as out of service?')) {
    showToast(`Marking item ${itemId} as out of service - Feature coming soon!`, 'info');
    // TODO: Implement out of service functionality
  }
}

// Enhance file upload areas for edit mode
function enhanceFileUploadsForEdit(item) {
  // Debug: log the item to see what fields exist
  console.log('Edit item data:', item);
  console.log('Available item keys:', Object.keys(item));

  const fileFields = [
    {
      field: 'calibrationTemplate',
      path:
        item.calibrationTemplate ||
        item.calibrationTemplatePath ||
        item.calibration_template ||
        item.calibration_template_path,
      label: 'Calibration Template',
    },
    {
      field: 'calibrationInstructions',
      path:
        item.calibrationInstructions ||
        item.calibrationInstructionsPath ||
        item.calibration_instructions ||
        item.calibration_instructions_path,
      label: 'Calibration Instructions',
    },
    {
      field: 'maintenanceTemplate',
      path:
        item.maintenanceTemplate ||
        item.maintenanceTemplatePath ||
        item.maintenance_template ||
        item.maintenance_template_path,
      label: 'Maintenance Template',
    },
    {
      field: 'maintenanceInstructions',
      path:
        item.maintenanceInstructions ||
        item.maintenanceInstructionsPath ||
        item.maintenance_instructions ||
        item.maintenance_instructions_path,
      label: 'Maintenance Instructions',
    },
  ];

  fileFields.forEach(({ field, path, label }) => {
    const fileInput = document.getElementById(field);
    const fileInfo = fileInput.nextElementSibling; // The .file-info span

    if (path) {
      // File exists - show file name and replace option
      fileInfo.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                    <i class="fas fa-file-alt" style="color: var(--accent-primary);"></i>
                    <span class="file-display" style="color: var(--text-primary); font-weight: 500;" title="${path.split('/').pop()}">
                        ${truncateFileName(path.split('/').pop())} 
                    </span>
                    <button type="button" onclick="downloadFile('${path}', '${field}')" 
                            style="background: var(--accent-primary); color: white; border: none; 
                                   padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;"
                            title="Download ${label}">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
                <div style="margin-top: 4px; font-size: 0.8rem; color: var(--text-secondary);">
                    Upload a new file to replace the current one
                </div>
            `;
    } else {
      // No file - show upload prompt
      fileInfo.innerHTML = `
                <div style="margin-top: 4px; font-size: 0.8rem; color: var(--text-secondary);">
                    No ${label.toLowerCase()} uploaded
                </div>
            `;
    }
  });
}

// Modal functionality
function showAddItemModal() {
  const modal = document.getElementById('addItemModal');
  const form = document.getElementById('addItemForm');

  // RESET modal to ADD mode (not edit mode)
  const titleEl = document.querySelector('#addItemModal .modal-header h2');
  if (titleEl) titleEl.textContent = 'Add New Inventory Item';

  const submitBtn = form.querySelector('.btn-primary .btn-text');
  if (submitBtn) submitBtn.textContent = 'Add Item';

  // Clear edit mode data attributes
  delete form.dataset.editing;
  delete form.dataset.itemId;

  // Reset form to original submit handler
  form.onsubmit = null; // Clear any custom edit submit handler

  // Reset all file upload areas to default state
  resetFileUploadAreas();

  modal.classList.add('show');

  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('dateReceived').value = today;
  document.getElementById('datePlacedInService').value = today;

  // Set default calibration date to today (now required)
  document.getElementById('calibrationDate').value = today;

  // Set default calibration due date (1 year from today)
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  document.getElementById('nextCalibrationDue').value = nextYear.toISOString().split('T')[0];

  // Set default maintenance due date (6 months from today) - optional now
  const nextMaintenance = new Date();
  nextMaintenance.setMonth(nextMaintenance.getMonth() + 6);
  document.getElementById('maintenanceDue').value = nextMaintenance.toISOString().split('T')[0];
}

// Reset file upload areas to default state
function resetFileUploadAreas() {
  const fileFields = [
    'calibrationTemplate',
    'calibrationInstructions',
    'maintenanceTemplate',
    'maintenanceInstructions',
  ];

  fileFields.forEach((field) => {
    const fileInput = document.getElementById(field);
    const fileInfo = fileInput.nextElementSibling;

    if (fileInfo) {
      // Reset to default text
      const defaultTexts = {
        calibrationTemplate: 'Upload template form',
        calibrationInstructions: 'Upload procedure',
        maintenanceTemplate: 'Upload template form',
        maintenanceInstructions: 'Upload procedure',
      };

      fileInfo.innerHTML = `<span class="file-info">${defaultTexts[field]}</span>`;
    }
  });
}

function hideAddItemModal() {
  const modal = document.getElementById('addItemModal');
  modal.classList.remove('show');
  document.getElementById('addItemForm').reset();
}

// Handle calibration type change
function handleCalibrationTypeChange() {
  const calibrationType = document.getElementById('calibrationType').value;
  const calibrationMethodLabel = document.getElementById('calibrationMethodLabel');
  const calibrationMethodInput = document.getElementById('calibrationMethod');

  if (calibrationType === 'outsourced') {
    calibrationMethodLabel.textContent = 'Calibration Company *';
    calibrationMethodInput.placeholder = 'e.g., ABC Calibration Services';
  } else {
    calibrationMethodLabel.textContent = 'Calibration Method *';
    calibrationMethodInput.placeholder = 'e.g., ASTM D4753';
  }
}

function showItemDetailModal(itemId) {
  const modal = document.getElementById('itemDetailModal');
  modal.classList.add('show');
  loadItemDetails(itemId);
}

function hideItemDetailModal() {
  const modal = document.getElementById('itemDetailModal');
  modal.classList.remove('show');
}

// Setup modal event listeners
document.addEventListener('DOMContentLoaded', function () {
  // Add Item Modal
  const addItemModal = document.getElementById('addItemModal');
  const closeAddItemModal = document.getElementById('closeAddItemModal');
  const cancelAddItem = document.getElementById('cancelAddItem');
  const addItemForm = document.getElementById('addItemForm');

  if (closeAddItemModal) {
    closeAddItemModal.addEventListener('click', hideAddItemModal);
  }

  if (cancelAddItem) {
    cancelAddItem.addEventListener('click', hideAddItemModal);
  }

  if (addItemForm) {
    addItemForm.addEventListener('submit', handleAddItem);
  }

  // Item Detail Modal
  const itemDetailModal = document.getElementById('itemDetailModal');
  const closeItemDetailModal = document.getElementById('closeItemDetailModal');

  if (closeItemDetailModal) {
    closeItemDetailModal.addEventListener('click', hideItemDetailModal);
  }

  // Close modals when clicking outside
  [addItemModal, itemDetailModal].forEach((modal) => {
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === this) {
          this.classList.remove('show');
        }
      });
    }
  });

  // Refresh button functionality
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async function () {
      this.style.transform = 'rotate(360deg)';
      await loadInventoryItems();
      await loadInventoryStats();
      setTimeout(() => {
        this.style.transform = 'rotate(0deg)';
      }, 500);
    });
  }

  // Load lists into selectors on page load
  loadListsIntoSelectors();
});

// Handle Add Item form submission
async function handleAddItem(event) {
  event.preventDefault();

  const form = event.target;
  const submitBtn = form.querySelector('.btn-primary');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');

  // Show loading state
  btnText.style.display = 'none';
  btnLoader.style.display = 'block';

  try {
    const formData = new FormData(form);

    // Check if maintenance is being used
    const hasMaintenance =
      formData.get('maintenanceDate') ||
      formData.get('maintenanceDue') ||
      formData.get('maintenanceInterval');

    // If maintenance is not used, remove its fields entirely
    if (!hasMaintenance) {
      formData.delete('maintenanceDate');
      formData.delete('maintenanceDue');
      formData.delete('maintenanceInterval');
      formData.delete('maintenanceIntervalType');
    }

    // Ensure calibrationType has a default
    if (!formData.get('calibrationType')) {
      formData.set('calibrationType', 'in_house');
    }

    // Check if a list is selected, if not, show the create list modal
    const selectedListId = formData.get('listId');
    if (!selectedListId) {
      showToast('Please select a list or create a new one', 'error');
      return;
    }

    // Note: Do NOT append inputs again. FormData(form) already contains all fields and files.

    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      showToast('Item added successfully!', 'success');
      hideAddItemModal();

      // Clear the cache and refresh inventory list
      _itemsCache = [];
      await loadInventoryItems();
      await loadInventoryStats();
      await loadInventoryStats();

      // Show success message with QR code info
      setTimeout(() => {
        showToast(`Item created! QR code available at: ${result.qrCodePath}`, 'success');
      }, 1000);
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to add item', 'error');
    }
  } catch (error) {
    console.error('Error adding item:', error);
    showToast('Network error. Please try again.', 'error');
  } finally {
    // Reset button state
    btnText.style.display = 'block';
    btnLoader.style.display = 'none';
  }
}

// Helper functions for managing hidden lists in localStorage
function loadHiddenLists() {
  try {
    return JSON.parse(localStorage.getItem('hiddenLists') || '[]');
  } catch (e) {
    return [];
  }
}

function saveHiddenLists(hidden) {
  try {
    localStorage.setItem('hiddenLists', JSON.stringify(hidden));
  } catch (e) {
    console.error('Failed to save hidden lists:', e);
  }
}

// Helper functions for deleting lists
async function deleteListWithItems(listId) {
  try {
    const resp = await fetch(`/api/inventory/lists/${listId}?deleteItems=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (resp.ok) {
      const hiddenNow = loadHiddenLists();
      const idx = hiddenNow.indexOf(listId);
      if (idx >= 0) {
        hiddenNow.splice(idx, 1);
        saveHiddenLists(hiddenNow);
      }
      await loadListsIntoSelectors();
      await loadInventoryItems();
      showToast('List and all items deleted successfully', 'success');
    } else {
      const err = await resp.json().catch(() => ({}));
      showToast(err.error || 'Failed to delete list', 'error');
    }
  } catch (e) {
    console.error('Delete list error:', e);
    showToast('Network error deleting list', 'error');
  }
}

async function deleteListKeepItems(listId) {
  try {
    const resp = await fetch(`/api/inventory/lists/${listId}?deleteItems=false`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (resp.ok) {
      const hiddenNow = loadHiddenLists();
      const idx = hiddenNow.indexOf(listId);
      if (idx >= 0) {
        hiddenNow.splice(idx, 1);
        saveHiddenLists(hiddenNow);
      }
      await loadListsIntoSelectors();
      await loadInventoryItems();
      showToast('List deleted; items moved to Unassigned', 'success');
    } else {
      const err = await resp.json().catch(() => ({}));
      showToast(err.error || 'Failed to delete list', 'error');
    }
  } catch (e) {
    console.error('Delete list error:', e);
    showToast('Network error deleting list', 'error');
  }
}

// Load lists from API and populate the Add Item form select and lists show/hide menu
async function loadListsIntoSelectors(selectAfterName) {
  try {
    console.log('Loading lists...');
    const resp = await fetch('/api/inventory/lists', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!resp.ok) {
      console.error('Failed to load lists:', resp.status, resp.statusText);
      return;
    }
    const data = await resp.json();
    console.log('Lists response:', data);
    const listsRaw = data.lists !== undefined ? data.lists : data; // handle {lists:[...]} or [...] just in case
    const lists = Array.isArray(listsRaw) ? listsRaw : [];
    console.log('Lists parsed length:', lists.length);

    // Store lists globally for color access
    window.loadedLists = lists;
    // Ensure every list has a valid color and textColor
    window.loadedLists.forEach((l) => {
      if (!l.color) l.color = '#6b7280';
      if (!l.textColor) l.textColor = '#ffffff';
    });

    const listSelect = document.getElementById('listId');
    if (listSelect) {
      const current = listSelect.value;
      listSelect.innerHTML =
        lists.length === 0
          ? '<option value="">No lists available</option>'
          : lists.map((l) => `<option value="${l.id}">${l.name}</option>`).join('');
      if (selectAfterName) {
        const created = (lists || []).find((l) => l.name === selectAfterName);
        if (created) {
          listSelect.value = created.id;
          // If this was created from the form, show a success message
          const modal = document.getElementById('createListModal');
          if (modal && modal.getAttribute('data-create-from-form') === 'true') {
            showToast(
              `List "${created.name}" created and selected! You can now submit your item.`,
              'success',
            );
          }
        }
      } else if (current) {
        listSelect.value = current;
      }
    }

    // Show/hide the "Create New List" button in the Add Item form
    const createListFromFormBtn = document.getElementById('createListFromForm');
    if (createListFromFormBtn) {
      createListFromFormBtn.style.display = lists.length === 0 ? 'inline-block' : 'none';
    }
    const listOptions = document.getElementById('listOptions');
    if (listOptions) {
      console.log('Populating listOptions with', lists.length, 'lists');
      const hidden = loadHiddenLists();
      const withVirtual = [{ id: '', name: 'Unassigned' }, ...lists];
      listOptions.innerHTML = '';
      listOptions.style.display = 'block';
      if (withVirtual.length === 0) {
        const empty = document.createElement('div');
        empty.style.color = 'var(--text-secondary)';
        empty.style.padding = '8px 0';
        empty.textContent = 'No lists yet. Click "+ Add List" to create one.';
        listOptions.appendChild(empty);
      } else {
        withVirtual.forEach((l) => {
          const row = document.createElement('div');
          row.className = 'list-row';
          const label = document.createElement('label');
          label.className = 'column-option';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.setAttribute('data-list-id', l.id);
          cb.checked = !hidden.includes(l.id);
          const text = document.createTextNode(' ' + l.name);
          label.appendChild(cb);
          label.appendChild(text);
          row.appendChild(label);
          if (l.id) {
            // Create connected button group
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'list-button-group';

            // Edit button
            const edit = document.createElement('button');
            edit.className = 'edit-btn';
            edit.setAttribute('data-edit-id', l.id);
            edit.setAttribute('data-edit-name', l.name);
            edit.setAttribute('data-edit-color', l.color);
            edit.setAttribute('data-edit-text-color', l.textColor);
            edit.title = 'Edit list';
            edit.textContent = '✎';
            buttonGroup.appendChild(edit);
            edit.addEventListener('click', async (e) => {
              e.stopPropagation();
              showEditListModal(l.id, l.name, l.color, l.textColor);
            });

            // Delete button
            const del = document.createElement('button');
            del.className = 'delete-btn';
            del.setAttribute('data-delete-id', l.id);
            del.title = 'Delete list';
            del.textContent = '✕';
            buttonGroup.appendChild(del);
            del.addEventListener('click', async (e) => {
              e.stopPropagation();

              // Create a custom confirmation dialog
              const dialog = document.createElement('div');
              dialog.className = 'modal-overlay';
              dialog.style.display = 'flex';
              dialog.innerHTML = `
                                <div class="modal-content" style="max-width: 500px;">
                                    <div class="modal-header">
                                        <h2>Delete List: ${l.name}</h2>
                                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                                    </div>
                                    <div style="padding: 24px;">
                                        <p style="margin-bottom: 20px; color: var(--text-secondary);">
                                            What would you like to do with the items in this list?
                                        </p>
                                        <div style="display: flex; flex-direction: column; gap: 12px;">
                                            <button class="btn-primary" onclick="this.closest('.modal-overlay').remove(); deleteListWithItems('${l.id}')">
                                                <i class="fas fa-trash"></i> Delete List & All Items
                                            </button>
                                            <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove(); deleteListKeepItems('${l.id}')">
                                                <i class="fas fa-arrow-right"></i> Delete List, Move Items to Unassigned
                                            </button>
                                            <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                                                <i class="fas fa-times"></i> Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;

              document.body.appendChild(dialog);
            });

            // Add the button group to the row
            row.appendChild(buttonGroup);
          }
          listOptions.appendChild(row);
          cb.addEventListener('change', async function () {
            const id = this.getAttribute('data-list-id');
            const hidden = loadHiddenLists();
            if (this.checked) {
              const i = hidden.indexOf(id);
              if (i >= 0) hidden.splice(i, 1);
            } else {
              if (!hidden.includes(id)) hidden.push(id);
            }
            saveHiddenLists(hidden);
            await loadInventoryItems();
          });
        }); // Close forEach loop

        // Debug: verify children rendered
        console.log(
          'Rendered list rows:',
          withVirtual.length,
          'children in listOptions:',
          listOptions.children.length,
        );
        if (listOptions.children.length === 0) {
          const dbg = document.createElement('div');
          dbg.style.color = 'var(--text-secondary)';
          dbg.textContent = '(Debug) Lists loaded but nothing rendered';
          listOptions.appendChild(dbg);
        }
      }
    }

    // Show "Create First List" button if no lists exist
    showCreateFirstListButton(lists.length === 0);

    // Show migrate button if there are items but no lists
    showMigrateButton(lists.length === 0);

    // Update the legend
    updateInventoryLegend();
  } catch (e) {
    // ignore
  }
}

// Show or hide the "Create First List" button
function showCreateFirstListButton(show) {
  const inventorySection = document.getElementById('inventorySection');
  if (!inventorySection) return;

  let createFirstBtn = document.getElementById('createFirstListBtn');

  if (show) {
    if (!createFirstBtn) {
      createFirstBtn = document.createElement('div');
      createFirstBtn.id = 'createFirstListBtn';
      createFirstBtn.className = 'create-first-list-section';
      createFirstBtn.innerHTML = `
                <div class="create-first-list-content">
                    <h3>No Lists Created Yet</h3>
                    <p>Create your first list to start organizing your inventory items.</p>
                    <button class="btn btn-primary" onclick="showCreateListModal()">
                        <i class="fas fa-plus"></i> Create First List
                    </button>
                </div>
            `;
      inventorySection.appendChild(createFirstBtn);
    }
    createFirstBtn.style.display = 'block';
  } else if (createFirstBtn) {
    createFirstBtn.style.display = 'none';
  }
}

// Calendar view: monthly grid with month navigation, ICS export
async function loadCalendarView() {
  const calSection = document.getElementById('calendarSection');
  if (!calSection) return;
  calSection.innerHTML = `
        <div class="section-header">
            <h2>Calendar</h2>
            <div class="list-controls">
                <button class="refresh-btn" id="prevMonthBtn" title="Previous Month"><i class="fas fa-chevron-left"></i></button>
                <span id="calendarMonthLabel" style="min-width:160px;text-align:center"></span>
                <button class="refresh-btn" id="nextMonthBtn" title="Next Month"><i class="fas fa-chevron-right"></i></button>
                <button class="refresh-btn" id="exportIcsBtn" title="Export ICS"><i class="fas fa-download"></i></button>
            </div>
        </div>
        <div id="calendarGrid" class="calendar-grid"></div>
    `;
  try {
    // Reuse inventory endpoint to get items
    const resp = await fetch(`/api/inventory`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await resp.json();
    const events = [];
    (data.items || []).forEach((item) => {
      if (item.nextCalibrationDue) {
        events.push({
          date: item.nextCalibrationDue.split('T')[0],
          title: `${item.itemType} ${item.nickname || ''} - Calibration Due`,
          itemId: item.id,
        });
      }
      if (item.maintenanceDue) {
        events.push({
          date: item.maintenanceDue.split('T')[0],
          title: `${item.itemType} ${item.nickname || ''} - Maintenance Due`,
          itemId: item.id,
        });
      }
    });
    events.sort((a, b) => a.date.localeCompare(b.date));
    setupCalendarGrid(events);
    const exportBtn = document.getElementById('exportIcsBtn');
    if (exportBtn) exportBtn.addEventListener('click', () => exportEventsAsIcs(events));
  } catch (e) {
    showToast('Failed to load calendar', 'error');
  }
}

let calendarCurrent = new Date();
function setupCalendarGrid(events) {
  const grid = document.getElementById('calendarGrid');
  const label = document.getElementById('calendarMonthLabel');
  const prevBtn = document.getElementById('prevMonthBtn');
  const nextBtn = document.getElementById('nextMonthBtn');
  if (!grid || !label) return;

  function render(monthDate) {
    label.textContent = monthDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    grid.innerHTML = '';
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const startDay = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
    const map = new Map();
    (events || []).forEach((ev) => {
      const d = new Date(ev.date);
      const key = d.toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      const dayNum = i - startDay + 1;
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
      const dateStr = inMonth
        ? new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNum)
            .toISOString()
            .split('T')[0]
        : null;
      cell.innerHTML = `
                <div class="cal-cell-header ${inMonth ? '' : 'muted'}">${inMonth ? dayNum : ''}</div>
                <div class="cal-cell-body"></div>
            `;
      if (inMonth && dateStr && map.has(dateStr)) {
        const body = cell.querySelector('.cal-cell-body');
        map
          .get(dateStr)
          .slice(0, 3)
          .forEach((ev) => {
            const a = document.createElement('a');
            a.href = '#';
            a.className = 'cal-event';
            a.textContent = ev.title;
            a.onclick = (e) => {
              e.preventDefault();
              showItemDetailModal(ev.itemId);
            };
            body.appendChild(a);
          });
        if (map.get(dateStr).length > 3) {
          const more = document.createElement('div');
          more.className = 'cal-more';
          more.textContent = `+${map.get(dateStr).length - 3} more`;
          body.appendChild(more);
        }
      }
      grid.appendChild(cell);
    }
  }
  render(calendarCurrent);
  prevBtn &&
    (prevBtn.onclick = () => {
      calendarCurrent.setMonth(calendarCurrent.getMonth() - 1);
      render(calendarCurrent);
    });
  nextBtn &&
    (nextBtn.onclick = () => {
      calendarCurrent.setMonth(calendarCurrent.getMonth() + 1);
      render(calendarCurrent);
    });
}

function exportEventsAsIcs(events) {
  const pad = (n) => (n < 10 ? '0' + n : n);
  const toUtcDt = (d) => {
    const dt = new Date(d + 'T09:00:00'); // 9 AM local as placeholder
    return (
      dt.getUTCFullYear().toString() +
      pad(dt.getUTCMonth() + 1) +
      pad(dt.getUTCDate()) +
      'T' +
      pad(dt.getUTCHours()) +
      pad(dt.getUTCMinutes()) +
      '00Z'
    );
  };
  const icsLines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Inventory Manager//EN'];
  (events || []).forEach((ev, idx) => {
    const uid = `${Date.now()}-${idx}@inv-manager`;
    const dtstart = toUtcDt(ev.date);
    icsLines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${toUtcDt(new Date().toISOString().split('T')[0])}`,
      `DTSTART:${dtstart}`,
      `SUMMARY:${ev.title}`,
      'END:VEVENT',
    );
  });
  icsLines.push('END:VCALENDAR');
  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inventory-events.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Load item details for the detail modal
async function loadItemDetails(itemId) {
  try {
    const response = await fetch(`/api/inventory/${itemId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      displayItemDetails(data);
    } else {
      showToast('Failed to load item details', 'error');
    }
  } catch (error) {
    console.error('Error loading item details:', error);
    showToast('Network error. Please try again.', 'error');
  }
}

// Create Service Log section for item details
function createServiceLogSection(item) {
  // For now, create mock service log entries from existing OOS data
  // TODO: Replace with actual service log data from backend
  const serviceEvents = [];
  
  // Add OOS event if item is currently out of service
  if (item.isOutOfService) {
    serviceEvents.push({
      type: 'out_of_service',
      date: item.outOfServiceDate || new Date().toISOString().split('T')[0],
      reason: item.outOfServiceReason || 'Out of service',
      reportedBy: item.outOfServiceReportedBy || 'Unknown',
      notes: item.outOfServiceNotes || '',
      timestamp: item.outOfServiceDate || new Date().toISOString()
    });
  }
  
  // Add RTS event if item was previously OOS (mock data for now)
  // TODO: Get actual service log from database
  
  // Sort events chronologically (newest first)
  serviceEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  const formatServiceEvent = (event) => {
    const date = new Date(event.date).toLocaleDateString();
    const eventIcon = event.type === 'out_of_service' ? '⛔' : '✅';
    const eventTitle = event.type === 'out_of_service' ? 'Marked Out of Service' : 'Returned to Service';
    
    let details = `<strong>${eventTitle}</strong><br/>`;
    details += `<span style="color: var(--text-secondary); font-size: 0.9rem;">`;
    
    if (event.type === 'out_of_service') {
      details += `Reason: ${event.reason}<br/>`;
      details += `Reported by: ${event.reportedBy}`;
    } else {
      details += `Resolved by: ${event.resolvedBy}<br/>`;
      details += `Verified by: ${event.verifiedBy}`;
    }
    
    if (event.notes) {
      details += `<br/>Notes: ${event.notes}`;
    }
    details += `</span>`;
    
    return `
      <div class="service-log-entry">
        <div class="service-log-icon">${eventIcon}</div>
        <div class="service-log-content">
          <div class="service-log-date">${date}</div>
          <div class="service-log-details">${details}</div>
        </div>
      </div>
    `;
  };
  
  return `
    <div class="item-detail-section" style="margin-top:24px;">
      <h3>Service Log (${serviceEvents.length})</h3>
      ${serviceEvents.length > 0 
        ? serviceEvents.map(formatServiceEvent).join('')
        : '<p style="color: var(--text-secondary);">No service events recorded yet</p>'
      }
    </div>
  `;
}

// Display item details in the modal
function displayItemDetails(data) {
  const { item, calibrationRecords, maintenanceRecords, changelog } = data;
  const content = document.getElementById('itemDetailContent');
  const title = document.getElementById('itemDetailTitle');

  // Debug: Log the item data to see what file fields we have
  console.log('Item data received:', item);
  console.log('File fields:', {
    calibrationTemplate: item.calibrationTemplate,
    calibrationInstructions: item.calibrationInstructions,
    maintenanceTemplate: item.maintenanceTemplate,
    maintenanceInstructions: item.maintenanceInstructions,
  });

  // Store current item details globally for use in upload modal
  window.currentItemDetails = item;

  title.textContent = `${item.itemType || 'Unknown Type'} - ${item.nickname || item.make || ''} ${item.model || ''}`;

  const showMaintenance = !!(
    item.maintenanceDate ||
    item.maintenanceDue ||
    item.maintenanceInterval ||
    item.maintenanceIntervalType
  );

  // Helper function to safely format dates
  const safeDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  let topGridHtml = `<div class="item-detail-grid">
            <div class="item-detail-section">
                <h3>Basics</h3>
                <div class="item-detail-row"><span class="item-detail-label">Type:</span><span class="item-detail-value">${item.itemType || 'N/A'}</span></div>
                <div class="item-detail-row"><span class="item-detail-label">Nickname:</span><span class="item-detail-value">${item.nickname || 'N/A'}</span></div>
                <div class="item-detail-row"><span class="item-detail-label">Lab ID:</span><span class="item-detail-value">${item.labId || 'N/A'}</span></div>
                <div class="item-detail-row"><span class="item-detail-label">Make/Model:</span><span class="item-detail-value">${item.make || ''} ${item.model || ''}</span></div>
                <div class="item-detail-row"><span class="item-detail-label">Serial #:</span><span class="item-detail-value">${item.serialNumber || 'N/A'}</span></div>
                <div class="item-detail-row"><span class="item-detail-label">Received/In Service:</span><span class="item-detail-value">${safeDate(item.dateReceived)} • ${safeDate(item.datePlacedInService)}</span></div>
                <div class="item-detail-row"><span class="item-detail-label">Location:</span><span class="item-detail-value">${item.location || 'N/A'}</span></div>
            </div>
            <div class="item-detail-section">
                <h3>Calibration</h3>
                <div class="item-detail-row"><span class="item-detail-label">Type:</span><span class="item-detail-value">${item.isOutsourced === 1 || item.isOutsourced === true ? 'Outsourced' : 'In-House'}</span></div>
                <div class="item-detail-row"><span class="item-detail-label">Last • Next:</span><span class="item-detail-value">${safeDate(item.calibrationDate)} • ${safeDate(item.nextCalibrationDue)}</span></div>
                <div class="item-detail-row"><span class="item-detail-label">Interval:</span><span class="item-detail-value">${item.calibrationInterval || 'N/A'} ${item.calibrationIntervalType || ''}</span></div>
                <div class="item-detail-row"><span class="item-detail-label">Method/Company:</span><span class="item-detail-value">${item.calibrationMethod || 'N/A'}</span></div>
                <div class="item-detail-row">
                    <span class="item-detail-label">Files:</span>
                    <span class="item-detail-value">
                        ${item.calibrationTemplate ? `<a href="#" onclick="downloadFile('${item.calibrationTemplate}', 'calibration-template')" class="file-link">Template</a>` : '—'} •
                        ${item.calibrationInstructions ? `<a href="#" onclick="downloadFile('${item.calibrationInstructions}', 'calibration-instructions')" class="file-link">Instructions</a>` : '—'}
                    </span>
                </div>
            </div>`;

  if (showMaintenance) {
    topGridHtml += `
            <div class="item-detail-section">
                <h3>Maintenance</h3>
                <div class="item-detail-row"><span class="item-detail-label">Last • Next:</span><span class="item-detail-value">${safeDate(item.maintenanceDate)} • ${safeDate(item.maintenanceDue)}</span></div>
                <div class="item-detail-row"><span class="item-detail-label">Interval:</span><span class="item-detail-value">${item.maintenanceInterval || '—'} ${item.maintenanceIntervalType || ''}</span></div>
                <div class="item-detail-row">
                    <span class="item-detail-label">Files:</span>
                    <span class="item-detail-value">
                        ${item.maintenanceTemplate ? `<a href="#" onclick="downloadFile('${item.maintenanceTemplate}', 'maintenance-template')" class="file-link">Template</a>` : '—'} •
                        ${item.maintenanceInstructions ? `<a href="#" onclick="downloadFile('${item.maintenanceInstructions}', 'maintenance-instructions')" class="file-link">Instructions</a>` : '—'}
                    </span>
                </div>
            </div>
            <div class="item-detail-section">
                <h3>Calibration Records (${calibrationRecords.length})</h3>
                ${
                  calibrationRecords.length > 0
                    ? calibrationRecords
                        .map((record) => {
                          const displayDate = safeDate(record.calibrationDate);
                          const isExisting = record.method === 'Existing Document Upload';
                          const recordType = isExisting
                            ? 'Existing Calibration'
                            : 'New Calibration';
                          return `
                        <div class="item-detail-row">
                            <span class="item-detail-label">${displayDate}</span>
                            <span class="item-detail-value">
                                ${recordType} • <a href="/uploads/docs/${record.filePath}" target="_blank" download>Download</a>
                            </span>
                            <button class="icon-button" title="Remove" onclick="deleteRecord('${record.id}','calibration','${item.id}')">✕</button>
                        </div>
                    `;
                        })
                        .join('')
                    : '<p style="color: var(--text-secondary);">No calibration records yet</p>'
                }
                <div class="upload-section">
                    <button class="btn btn-secondary btn-sm" onclick="showUploadModal('calibration', '${item.id}')">
                        <i class="fas fa-upload"></i> Add Record
                    </button>
                </div>
            </div>`;
  }

  topGridHtml += `</div>`;

  const secondaryLeft = showMaintenance
    ? `
            <div class="item-detail-section">
                <h3>Maintenance Records (${maintenanceRecords.length})</h3>
                ${
                  maintenanceRecords.length > 0
                    ? maintenanceRecords
                        .map((record) => {
                          const displayDate = safeDate(record.maintenanceDate);
                          const isExisting = record.type === 'Existing Document Upload';
                          const recordType = isExisting
                            ? 'Existing Maintenance'
                            : 'New Maintenance';
                          return `
                        <div class="item-detail-row">
                            <span class="item-detail-label">${displayDate}</span>
                            <span class="item-detail-value">
                                ${recordType} • <a href="/uploads/docs/${record.filePath}" target="_blank" download>Download</a>
                            </span>
                            <button class="icon-button" title="Remove" onclick="deleteRecord('${record.id}','maintenance','${item.id}')">✕</button>
                        </div>
                    `;
                        })
                        .join('')
                    : '<p style="color: var(--text-secondary);">No maintenance records yet</p>'
                }
                <div class="upload-section">
                    <button class="btn btn-secondary btn-sm" onclick="showUploadModal('maintenance', '${item.id}')">
                        <i class="fas fa-upload"></i> Add Record
                    </button>
                </div>
            </div>`
    : `
            <div class="item-detail-section">
                <h3>Calibration Records (${calibrationRecords.length})</h3>
                ${
                  calibrationRecords.length > 0
                    ? calibrationRecords
                        .map((record) => {
                          const displayDate = safeDate(record.calibrationDate);
                          const isExisting = record.method === 'Existing Document Upload';
                          const recordType = isExisting
                            ? 'Existing Calibration'
                            : 'New Calibration';
                          return `
                        <div class="item-detail-row">
                            <span class="item-detail-label">${displayDate}</span>
                            <span class="item-detail-value">
                                ${recordType} • <a href="/uploads/docs/${record.filePath}" target="_blank" download>Download</a>
                            </span>
                            <button class="icon-button" title="Remove" onclick="deleteRecord('${record.id}','calibration','${item.id}')">✕</button>
                        </div>
                    `;
                        })
                        .join('')
                    : '<p style="color: var(--text-secondary);">No calibration records yet</p>'
                }
                <div class="upload-section">
                    <button class="btn btn-secondary btn-sm" onclick="showUploadModal('calibration', '${item.id}')">
                        <i class="fas fa-upload"></i> Add Record
                    </button>
                </div>
            </div>`;

  const secondaryRight = `
            <div class="qr-code-section">
                <h4>QR Code</h4>
                <img src="/uploads/qr-codes/${item.id}.png" alt="QR Code for ${item.itemType}" onerror="this.style.display='none'">
                <p>Scan this QR code to access this item's page</p>
                <p><small>QR Code: ${item.id}</small></p>
                <div class="qr-code-actions">
                    <button class="btn btn-secondary btn-sm" onclick="downloadQRCode('${item.id}', '${item.itemType}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="shareQRCode('${item.id}', '${item.itemType}')">
                        <i class="fas fa-share"></i> Share
                    </button>
                </div>
            </div>
            </div>`;

  const changelogSection = `
        <div class="item-detail-section" style="margin-top:24px;">
            <h3>Changelog (${changelog.length})</h3>
            ${
              changelog.length > 0
                ? changelog
                    .map(
                      (entry) => `
                    <div class="item-detail-row">
                        <span class="item-detail-label">${new Date(entry.timestamp).toLocaleDateString()}</span>
                        <span class="item-detail-value">${entry.action} by ${entry.first_name} ${entry.last_name}</span>
                    </div>
                `,
                    )
                    .join('')
                : '<p style="color: var(--text-secondary);">No changes recorded yet</p>'
            }
        </div>`;

  const notesSection = `
        <div class="item-detail-section" style="margin-top:24px;">
            <h3>Notes</h3>
            ${
              item.notes
                ? `<div class="item-detail-row">
                    <span class="item-detail-value">${item.notes}</span>
                </div>`
                : '<p style="color: var(--text-secondary);">No notes added yet</p>'
            }
        </div>`;

  // Create Service Log section
  const serviceLogSection = createServiceLogSection(item);

  content.innerHTML = `
        ${topGridHtml}
        <div class="item-secondary-grid">
            ${secondaryLeft}
            ${secondaryRight}
        </div>
        ${notesSection}
        ${serviceLogSection}
        ${changelogSection}
    `;
}

// Show upload modal for calibration or maintenance records
function showUploadModal(type, itemId) {
  // Get the current item to display file links
  const currentItem = window.currentItemDetails;

  const modalHtml = `
        <div class="modal-overlay" id="uploadModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Add ${type === 'calibration' ? 'Calibration' : 'Maintenance'} Record</h2>
                    <button class="modal-close" onclick="hideUploadModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <form class="upload-form" id="uploadForm">
                    <div class="form-section">
                        <div class="form-group">
                            <label class="radio-label">
                                <input type="radio" name="recordType" value="new" checked>
                                <span class="radio-checkmark"></span>
                                New ${type === 'calibration' ? 'Calibration' : 'Maintenance'} Record
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="recordType" value="existing">
                                <span class="radio-checkmark"></span>
                                Upload Existing/Past ${type === 'calibration' ? 'Calibration' : 'Maintenance'} Document
                            </label>
                        </div>
                        
                        <div id="newRecordFields">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="recordDate">${type === 'calibration' ? 'Calibration' : 'Maintenance'} Date *</label>
                                    <input type="date" id="recordDate" name="recordDate" required>
                                </div>
                                <div class="form-group">
                                    <label for="nextDue">Next Due Date *</label>
                                    <input type="date" id="nextDue" name="nextDue" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="method">${type === 'calibration' ? 'Calibration Method' : 'Maintenance Type'} *</label>
                                <input type="text" id="method" name="method" required placeholder="Enter ${type === 'calibration' ? 'calibration method' : 'maintenance type'}">
                            </div>
                        </div>
                        
                        <div class="form-group" id="existingRecordFields" style="display: none;">
                            <label for="existingRecordDate">Document Date (Optional)</label>
                            <input type="date" id="existingRecordDate" name="existingRecordDate">
                            <small>This date will be used for display purposes only and won't affect the item's due dates</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="notes">Notes</label>
                            <textarea id="notes" name="notes" rows="3" placeholder="Additional details about this ${type}..."></textarea>
                        </div>
                        
                        <div class="file-upload-section">
                            <label>${type === 'calibration' ? 'Calibration' : 'Maintenance'} Report</label>
                            <div class="file-upload-options">
                                <div class="upload-option">
                                    <label class="radio-label">
                                        <input type="radio" name="uploadMethod" value="file" checked>
                                        <span class="radio-checkmark"></span>
                                        Upload File
                                    </label>
                                    <div class="file-upload" id="fileUploadSection">
                                        <input type="file" id="recordFile" name="recordFile" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png">
                                        <span class="file-info">Upload ${type} report/document or image</span>
                                    </div>
                                </div>
                                
                                <div class="upload-option">
                                    <label class="radio-label">
                                        <input type="radio" name="uploadMethod" value="camera">
                                        <span class="radio-checkmark"></span>
                                        Take Picture
                                    </label>
                                    <div class="camera-section" id="cameraSection" style="display: none;">
                                        <div class="camera-preview">
                                            <video id="cameraVideo" autoplay muted playsinline style="display: none;"></video>
                                            <canvas id="cameraCanvas" style="display: none;"></canvas>
                                            <div id="cameraPlaceholder" class="camera-placeholder">
                                                <i class="fas fa-camera"></i>
                                                <p>Click to start camera</p>
                                            </div>
                                        </div>
                                        <div class="camera-controls">
                                            <button type="button" class="btn btn-secondary btn-sm" id="startCameraBtn">
                                                <i class="fas fa-camera"></i> Start Camera
                                            </button>
                                            <button type="button" class="btn btn-primary btn-sm" id="captureBtn" style="display: none;">
                                                <i class="fas fa-camera"></i> Capture Photo
                                            </button>
                                            <button type="button" class="btn btn-secondary btn-sm" id="retakeBtn" style="display: none;">
                                                <i class="fas fa-redo"></i> Retake
                                            </button>
                                        </div>
                                        <input type="hidden" id="capturedImage" name="capturedImage">
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        ${
                          currentItem
                            ? `
                        <div class="template-links-section">
                            <h4>Available Templates & Instructions</h4>
                            <div class="template-links">
                                ${
                                  type === 'calibration'
                                    ? `
                                    ${
                                      currentItem.calibrationTemplate
                                        ? `<div class="template-link"><i class="fas fa-file-alt"></i> <a href="/uploads/docs/${currentItem.calibrationTemplate}" target="_blank" download>Calibration Template</a></div>`
                                        : '<div class="template-link disabled"><i class="fas fa-file-alt"></i> No calibration template available</div>'
                                    }
                                    ${
                                      currentItem.calibrationInstructions
                                        ? `<div class="template-link"><i class="fas fa-file-alt"></i> <a href="/uploads/docs/${currentItem.calibrationInstructions}" target="_blank" download>Calibration Instructions</a></div>`
                                        : '<div class="template-link disabled"><i class="fas fa-file-alt"></i> No calibration instructions available</div>'
                                    }
                                `
                                    : `
                                    ${
                                      currentItem.maintenanceTemplate
                                        ? `<div class="template-link"><i class="fas fa-file-alt"></i> <a href="/uploads/docs/${currentItem.maintenanceTemplate}" target="_blank" download>Maintenance Template</a></div>`
                                        : '<div class="template-link disabled"><i class="fas fa-file-alt"></i> No maintenance template available</div>'
                                    }
                                    ${
                                      currentItem.maintenanceInstructions
                                        ? `<div class="template-link"><i class="fas fa-file-alt"></i> <a href="/uploads/docs/${currentItem.maintenanceInstructions}" target="_blank" download>Maintenance Instructions</a></div>`
                                        : '<div class="template-link disabled"><i class="fas fa-file-alt"></i> No maintenance instructions available</div>'
                                    }
                                `
                                }
                            </div>
                        </div>
                        `
                            : ''
                        }
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="hideUploadModal()">Cancel</button>
                        <button type="submit" class="btn-primary">
                            <span class="btn-text">Add Record</span>
                            <div class="btn-loader" style="display: none;">
                                <div class="spinner"></div>
                            </div>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

  // Remove existing modal if any
  const existingModal = document.getElementById('uploadModal');
  if (existingModal) {
    existingModal.remove();
  }

  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Show modal
  const modal = document.getElementById('uploadModal');
  modal.classList.add('show');

  // Setup form submission
  const form = document.getElementById('uploadForm');
  form.addEventListener('submit', (e) => handleRecordUpload(e, type, itemId));

  // Setup radio button toggle for record type
  const recordTypeRadios = form.querySelectorAll('input[name="recordType"]');
  const newRecordFields = document.getElementById('newRecordFields');
  const existingRecordFields = document.getElementById('existingRecordFields');
  const recordDateInput = document.getElementById('recordDate');
  const nextDueInput = document.getElementById('nextDue');
  const methodInput = document.getElementById('method');
  const existingRecordDateInput = document.getElementById('existingRecordDate');

  recordTypeRadios.forEach((radio) => {
    radio.addEventListener('change', function () {
      console.log('Record type changed to:', this.value);
      console.log('Elements found:', {
        newRecordFields: !!newRecordFields,
        existingRecordFields: !!existingRecordFields,
        recordDateInput: !!recordDateInput,
        nextDueInput: !!nextDueInput,
        methodInput: !!methodInput,
        existingRecordDateInput: !!existingRecordDateInput,
      });

      if (this.value === 'new') {
        newRecordFields.style.display = 'block';
        existingRecordFields.style.display = 'none';
        recordDateInput.required = true;
        nextDueInput.required = true;
        methodInput.required = true;
        existingRecordDateInput.required = false;
        console.log('Showing new record fields');
      } else {
        newRecordFields.style.display = 'none';
        existingRecordFields.style.display = 'block';
        recordDateInput.required = false;
        nextDueInput.required = false;
        methodInput.required = false;
        existingRecordDateInput.required = false;
        console.log('Showing existing record fields');
      }
    });
  });

  // Initialize form state based on default selection
  const defaultRecordType = form.querySelector('input[name="recordType"]:checked');
  if (defaultRecordType) {
    defaultRecordType.dispatchEvent(new Event('change'));
  }

  // Setup radio button toggle for upload method
  const uploadMethodRadios = form.querySelectorAll('input[name="uploadMethod"]');
  const fileUploadSection = document.getElementById('fileUploadSection');
  const cameraSection = document.getElementById('cameraSection');
  const recordFileInput = document.getElementById('recordFile');

  uploadMethodRadios.forEach((radio) => {
    radio.addEventListener('change', function () {
      if (this.value === 'file') {
        fileUploadSection.style.display = 'block';
        cameraSection.style.display = 'none';
        recordFileInput.required = true;
        document.getElementById('capturedImage').required = false;
      } else {
        fileUploadSection.style.display = 'none';
        cameraSection.style.display = 'block';
        recordFileInput.required = false;
        document.getElementById('capturedImage').required = true;
      }
    });
  });

  // Setup camera functionality
  setupCameraFunctionality();
}

// Hide upload modal
function hideUploadModal() {
  // Clean up camera before closing
  cleanupCamera();

  const modal = document.getElementById('uploadModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
}

// Handle record upload
async function handleRecordUpload(event, type, itemId) {
  event.preventDefault();

  const form = event.target;
  const submitBtn = form.querySelector('.btn-primary');

  if (!submitBtn) {
    console.error('Submit button not found');
    showToast('Form error. Please try again.', 'error');
    return;
  }

  // Find button elements within the submit button
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');

  console.log('Button elements found:', {
    submitBtn: !!submitBtn,
    btnText: !!btnText,
    btnLoader: !!btnLoader,
  });

  if (!btnText || !btnLoader) {
    console.error('Button elements not found:', {
      btnText: btnText,
      btnLoader: btnLoader,
    });
    // Continue without button state management rather than failing
    console.log('Continuing without button state management');
  }

  // Validate form before submission
  const recordType = form.querySelector('input[name="recordType"]:checked').value;
  const recordDateInput = document.getElementById('recordDate');
  const nextDueInput = document.getElementById('nextDue');
  const methodInput = document.getElementById('method');
  const existingRecordDateInput = document.getElementById('existingRecordDate');

  console.log('Form validation:', {
    recordType,
    recordDate: recordDateInput.value,
    nextDue: nextDueInput.value,
    method: methodInput.value,
    existingRecordDate: existingRecordDateInput.value,
    recordDateRequired: recordDateInput.required,
    nextDueRequired: nextDueInput.required,
    methodRequired: methodInput.required,
  });

  // Ensure proper validation based on record type
  if (recordType === 'new') {
    if (!recordDateInput.value || !nextDueInput.value || !methodInput.value) {
      showToast('Please fill in all required fields for new record', 'error');
      return;
    }
  } else {
    // For existing records, no fields are required except the file
    // Validation will be handled by the backend
  }

  // Show loading state if button elements are available
  if (btnText && btnLoader) {
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';
  }

  try {
    const formData = new FormData(form);
    formData.append('type', type);
    formData.append('itemId', itemId);

    // Debug: Log form data
    console.log('Form data being sent:');
    for (let [key, value] of formData.entries()) {
      console.log(`${key}: ${value}`);
    }

    // Check if this is a new record or existing document
    const recordType = formData.get('recordType');
    if (recordType === 'existing') {
      // For existing documents, we only need the existingRecordDate (if provided)
      // Remove new record fields but keep existingRecordDate
      formData.delete('recordDate');
      formData.delete('nextDue');
      formData.delete('method');
      // Keep existingRecordDate - don't delete it!

      console.log('Existing document - keeping existingRecordDate, removed new record fields');
    } else {
      // For new records, ensure all required fields are present
      console.log('New record - keeping all required fields');
    }

    // Handle captured image if using camera
    const uploadMethod = formData.get('uploadMethod');
    if (uploadMethod === 'camera') {
      const capturedImage = formData.get('capturedImage');
      if (capturedImage) {
        // Convert base64 to blob
        const base64Data = capturedImage.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });

        // Create file from blob
        const file = new File([blob], `captured_${type}_${Date.now()}.jpg`, { type: 'image/jpeg' });
        formData.delete('capturedImage');
        formData.append('recordFile', file);
      }
    }

    const response = await fetch('/api/inventory/upload-record', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    if (response.ok) {
      const message =
        recordType === 'new'
          ? `${type === 'calibration' ? 'Calibration' : 'Maintenance'} record added successfully!`
          : `${type === 'calibration' ? 'Calibration' : 'Maintenance'} document uploaded successfully!`;
      showToast(message, 'success');
      hideUploadModal();

      // Refresh item details and inventory list
      await loadItemDetails(itemId);
      await loadInventoryItems();
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to add record', 'error');
    }
  } catch (error) {
    console.error('Error adding record:', error);
    showToast('Network error. Please try again.', 'error');
  } finally {
    // Reset button state if button elements are available
    if (btnText && btnLoader) {
      btnText.style.display = 'block';
      btnLoader.style.display = 'none';
    }
  }
}

// Show quick add record selection modal
function showQuickAddRecord(itemId) {
  const modalHtml = `
        <div class="modal-overlay" id="quickAddModal">
            <div class="modal-content small">
                <div class="modal-header">
                    <h2>Add Record</h2>
                    <button class="modal-close" onclick="hideQuickAddModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="quick-add-options">
                    <button class="quick-add-btn" onclick="showUploadModal('calibration', '${itemId}'); hideQuickAddModal();">
                        <i class="fas fa-tachometer-alt"></i>
                        <span>Calibration Record</span>
                    </button>
                    <button class="quick-add-btn" onclick="showUploadModal('maintenance', '${itemId}'); hideQuickAddModal();">
                        <i class="fas fa-tools"></i>
                        <span>Maintenance Record</span>
                    </button>
                </div>
            </div>
        </div>
    `;

  // Remove existing modal if any
  const existingModal = document.getElementById('quickAddModal');
  if (existingModal) {
    existingModal.remove();
  }

  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Show modal
  const modal = document.getElementById('quickAddModal');
  modal.classList.add('show');
}

// Hide quick add modal
function hideQuickAddModal() {
  const modal = document.getElementById('quickAddModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
}

// Column visibility functions
function toggleColumnVisibility(columnName, isVisible) {
  const table = document.getElementById('inventoryTable');
  const headerCells = table.querySelectorAll(`th[data-sort="${columnName}"]`);
  const dataCells = table.querySelectorAll(`.column-${columnName}`);

  headerCells.forEach((cell) => {
    cell.style.display = isVisible ? '' : 'none';
  });

  dataCells.forEach((cell) => {
    cell.style.display = isVisible ? '' : 'none';
  });

  // Save preference
  saveColumnPreferences();

  // Adjust table layout
  adjustTableLayout();
}

function saveColumnPreferences() {
  const preferences = {};
  const columnOptions = document.querySelectorAll('.column-option input');

  columnOptions.forEach((checkbox) => {
    preferences[checkbox.dataset.column] = checkbox.checked;
  });

  localStorage.setItem('inventoryColumnPreferences', JSON.stringify(preferences));
}

function loadColumnPreferences() {
  const saved = localStorage.getItem('inventoryColumnPreferences');
  if (saved) {
    const preferences = JSON.parse(saved);

    // Apply saved preferences
    Object.entries(preferences).forEach(([column, isVisible]) => {
      toggleColumnVisibility(column, isVisible);

      // Update checkbox state
      const checkbox = document.querySelector(`.column-option input[data-column="${column}"]`);
      if (checkbox) {
        checkbox.checked = isVisible;
      }
    });
  }
}

function resetColumnVisibility() {
  // Reset all checkboxes to checked
  const columnOptions = document.querySelectorAll('.column-option input');
  columnOptions.forEach((checkbox) => {
    checkbox.checked = true;
    toggleColumnVisibility(checkbox.dataset.column, true);
  });

  // Clear saved preferences
  localStorage.removeItem('inventoryColumnPreferences');
}

function adjustTableLayout() {
  const table = document.getElementById('inventoryTable');
  const visibleColumns = document.querySelectorAll('.column-option input:checked').length;

  // Add compact mode when fewer columns are visible
  if (visibleColumns <= 8) {
    table.classList.add('compact');
  } else {
    table.classList.remove('compact');
  }

  // Adjust table minimum width based on visible columns
  // Always add extra space for the Actions column to prevent cutoff
  const minWidth = Math.max(800, visibleColumns * 120 + 250);
  table.style.minWidth = `${minWidth}px`;
}

// Error boundary
window.addEventListener('error', function (e) {
  console.error('Global error:', e.error);
  showToast('An unexpected error occurred. Please refresh the page.', 'error');
});

// Unhandled promise rejection
window.addEventListener('unhandledrejection', function (e) {
  console.error('Unhandled promise rejection:', e.reason);
  showToast('A network error occurred. Please check your connection.', 'error');
});

// Update the inventory legend with current lists
function updateInventoryLegend() {
  const legendLists = document.getElementById('legendLists');
  if (!legendLists || !window.loadedLists) return;

  legendLists.innerHTML = '';

  window.loadedLists.forEach((list) => {
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-list-item';
    legendItem.innerHTML = `
            <div class="legend-list-color" style="background-color: ${list.color}"></div>
            <span>${list.name}</span>
        `;
    legendLists.appendChild(legendItem);
  });
}

// Migrate items to field list before removing default list
async function migrateItemsToFieldList() {
  try {
    const resp = await fetch('/api/inventory/lists/migrate-to-field', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!resp.ok) {
      throw new Error('Failed to migrate items');
    }

    const result = await resp.json();
    showToast('Items migrated to Field list successfully', 'success');

    // Refresh lists and inventory
    await loadListsIntoSelectors();
    await loadInventoryItems();

    return result;
  } catch (error) {
    console.error('Error migrating items:', error);
    showToast('Failed to migrate items to Field list', 'error');
    throw error;
  }
}

// Show or hide the migrate button
function showMigrateButton(show) {
  const migrateBtn = document.getElementById('migrateToFieldBtn');
  if (migrateBtn) {
    migrateBtn.style.display = show ? 'inline-flex' : 'none';
  }
}

// Show create list modal
function showCreateListModal() {
  console.log('Showing create list modal...');
  const modal = document.getElementById('createListModal');
  console.log('Modal element found:', !!modal);
  if (modal) {
    modal.classList.add('show');
    console.log('Modal shown, setting up color selection...');
    setupColorSelection();
  } else {
    console.error('Create list modal not found!');
  }
}

// Show create first list modal (from welcome screen)
function showCreateFirstListModal() {
  console.log('Showing create first list modal...');
  const modal = document.getElementById('createListModal');
  if (modal) {
    modal.classList.add('show');
    setupColorSelection();
    // Set a special flag to hide the button after creation
    modal.setAttribute('data-create-first', 'true');
  } else {
    console.error('Create list modal not found!');
  }
}

// Show create list modal from Add Item form
function showCreateListFromFormModal() {
  console.log('Showing create list modal from form...');
  const modal = document.getElementById('createListModal');
  if (modal) {
    modal.classList.add('show');
    setupColorSelection();
    // Set a special flag to handle form submission after creation
    modal.setAttribute('data-create-from-form', 'true');
  } else {
    console.error('Create list modal not found!');
  }
}

// Hide create list modal
function hideCreateListModal() {
  const modal = document.getElementById('createListModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Color themes for different visual styles
const colorThemes = {
  dark: [
    { bg: '#1f2937' }, // Dark grey
    { bg: '#374151' }, // Medium grey
    { bg: '#4b5563' }, // Light grey
    { bg: '#6b7280' }, // Lighter grey
    { bg: '#9ca3af' }, // Very light grey
    { bg: '#d1d5db' }, // Almost white
    { bg: '#111827' }, // Very dark grey
    { bg: '#1f2937' }, // Dark grey
    { bg: '#374151' }, // Medium grey
  ],
  light: [
    { bg: '#ef4444' }, // Red
    { bg: '#f97316' }, // Orange
    { bg: '#eab308' }, // Yellow
    { bg: '#22c55e' }, // Green
    { bg: '#06b6d4' }, // Cyan
    { bg: '#3b82f6' }, // Blue
    { bg: '#8b5cf6' }, // Purple
    { bg: '#ec4899' }, // Pink
    { bg: '#6b7280' }, // Grey
  ],
  purple: [
    { bg: '#1e1b4b' }, // Dark purple
    { bg: '#312e81' }, // Medium dark purple
    { bg: '#4338ca' }, // Purple
    { bg: '#3730a3' }, // Darker purple
    { bg: '#5b21b6' }, // Deep purple
    { bg: '#7c3aed' }, // Medium purple
    { bg: '#8b5cf6' }, // Light purple
    { bg: '#a855f7' }, // Lighter purple
    { bg: '#c084fc' }, // Very light purple
  ],
};

// Function to automatically determine text color based on background brightness
function getContrastTextColor(backgroundColor) {
  // Convert hex to RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate luminance (perceived brightness)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Function to get colors with automatic text color
function getThemeColors(theme) {
  const colors = colorThemes[theme] || colorThemes.purple;
  return colors.map((color) => ({
    bg: color.bg,
    text: getContrastTextColor(color.bg),
  }));
}

// Setup color selection in create list modal
function setupColorSelection() {
  console.log('Setting up color selection...');

  // Populate color grid based on current theme
  console.log('Calling populateColorGrid with light theme');
  populateColorGrid('colorGrid', 'light'); // Default to light theme

  const customColorInput = document.getElementById('customColor');
  const customTextColorInput = document.getElementById('customTextColor');

  console.log('Found elements:', {
    customColorInput: !!customColorInput,
    customTextColorInput: !!customTextColorInput,
  });

  // Handle custom color changes
  customColorInput.addEventListener('change', function () {
    console.log('Custom color changed:', this.value);
    // Remove selection from preset colors when custom colors are used
    const colorOptions = document.querySelectorAll('#colorGrid .color-option');
    colorOptions.forEach((opt) => opt.classList.remove('selected'));

    // Automatically set text color for optimal contrast
    const autoTextColor = getContrastTextColor(this.value);
    customTextColorInput.value = autoTextColor;
    console.log('Auto-set text color to:', autoTextColor);
  });

  customTextColorInput.addEventListener('change', function () {
    console.log('Custom text color changed:', this.value);
    // Remove selection from preset colors when custom colors are used
    const colorOptions = document.querySelectorAll('#colorGrid .color-option');
    colorOptions.forEach((opt) => opt.classList.remove('selected'));
  });

  // Setup form submission
  const form = document.getElementById('createListForm');
  console.log('Form found:', !!form);
  if (form) {
    form.onsubmit = handleCreateList;
    console.log('Form submission handler set');
  } else {
    console.error('Create list form not found!');
  }
}

// Populate color grid based on selected theme
function populateColorGrid(gridId, theme, selectedColor = null) {
  console.log('populateColorGrid called with:', { gridId, theme, selectedColor });

  const grid = document.getElementById(gridId);
  if (!grid) {
    console.error('Grid element not found:', gridId);
    return;
  }

  console.log('Found grid element:', grid);
  grid.innerHTML = '';

  // Use getThemeColors to get colors with automatic text color contrast
  const colors = getThemeColors(theme);
  console.log('Using colors from theme:', theme, colors);

  colors.forEach((color) => {
    const option = document.createElement('div');
    option.className = 'color-option';
    option.setAttribute('data-color', color.bg);
    option.setAttribute('data-text-color', color.text);
    option.style.background = color.bg;
    option.style.cursor = 'pointer';

    // Check if this color should be selected
    if (selectedColor && selectedColor.bg === color.bg && selectedColor.text === color.text) {
      option.classList.add('selected');
    }

    // Add click event listener
    option.addEventListener('click', function () {
      console.log('Color option clicked:', color);

      // Remove selection from all options
      grid.querySelectorAll('.color-option').forEach((opt) => opt.classList.remove('selected'));
      // Add selection to clicked option
      this.classList.add('selected');

      // Update custom color inputs based on which modal we're in
      let customColorInput, customTextColorInput;
      if (gridId === 'colorGrid') {
        // Create list modal
        customColorInput = document.getElementById('customColor');
        customTextColorInput = document.getElementById('customTextColor');
      } else if (gridId === 'editColorGrid') {
        // Edit list modal
        customColorInput = document.getElementById('editCustomColor');
        customTextColorInput = document.getElementById('editCustomTextColor');
      }

      console.log('Found inputs:', {
        customColorInput: !!customColorInput,
        customTextColorInput: !!customTextColorInput,
      });

      if (customColorInput) {
        customColorInput.value = color.bg;
        console.log('Set background color to:', color.bg);
      }
      if (customTextColorInput) {
        // Automatically set text color for optimal contrast
        const autoTextColor = getContrastTextColor(color.bg);
        customTextColorInput.value = autoTextColor;
        console.log('Set text color to:', autoTextColor);
      }
    });

    grid.appendChild(option);
  });
}

// Switch color theme in create list modal
function switchColorTheme() {
  const themeSelect = document.getElementById('colorTheme');
  const selectedTheme = themeSelect.value;

  console.log('switchColorTheme called, selected theme:', selectedTheme);

  // Get current color selection to maintain it
  const customColorInput = document.getElementById('customColor');
  const customTextColorInput = document.getElementById('customTextColor');
  let selectedColor = null;

  if (customColorInput && customColorInput.value) {
    // Only need to maintain background color, text color is auto-generated
    selectedColor = {
      bg: customColorInput.value,
      text: getContrastTextColor(customColorInput.value),
    };
    console.log('Maintaining current color selection:', selectedColor);
  }

  console.log('Calling populateColorGrid with:', {
    gridId: 'colorGrid',
    theme: selectedTheme,
    selectedColor,
  });
  populateColorGrid('colorGrid', selectedTheme, selectedColor);
}

// Switch color theme in edit list modal
function switchEditColorTheme() {
  const themeSelect = document.getElementById('editColorTheme');
  const selectedTheme = themeSelect.value;

  console.log('switchEditColorTheme called, selected theme:', selectedTheme);

  // Get current color selection to maintain it
  const customColorInput = document.getElementById('editCustomColor');
  const customTextColorInput = document.getElementById('editCustomTextColor');
  let selectedColor = null;

  if (customColorInput && customColorInput.value) {
    // Only need to maintain background color, text color is auto-generated
    selectedColor = {
      bg: customColorInput.value,
      text: getContrastTextColor(customColorInput.value),
    };
    console.log('Maintaining current color selection:', selectedColor);
  }

  console.log('Calling populateColorGrid with:', {
    gridId: 'editColorGrid',
    theme: selectedTheme,
    selectedColor,
  });
  populateColorGrid('editColorGrid', selectedTheme, selectedColor);
}

// Handle create list form submission
async function handleCreateList(e) {
  e.preventDefault();

  console.log('Form submission started');

  const formData = new FormData(e.target);
  const name = formData.get('listName');
  const color = formData.get('customColor');
  const textColor = formData.get('customTextColor');

  console.log('Form data:', { name, color, textColor });

  if (!name || !name.trim()) {
    showToast('List name is required', 'error');
    return;
  }

  try {
    console.log('Sending request to create list...');
    const resp = await fetch('/api/inventory/lists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ name: name.trim(), color, textColor }),
    });

    console.log('Response status:', resp.status);

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('Response error:', errorText);
      throw new Error(`Failed to create list: ${resp.status} ${resp.statusText}`);
    }

    const result = await resp.json();
    console.log('List created successfully:', result);
    showToast('List created successfully', 'success');

    // Hide modal and refresh
    hideCreateListModal();
    await loadListsIntoSelectors(result.name);
    await loadInventoryItems();

    // Handle special cases
    const modal = document.getElementById('createListModal');
    if (modal) {
      // If this was the first list creation, hide the button
      if (modal.getAttribute('data-create-first') === 'true') {
        const createFirstListBtn = document.getElementById('createFirstListBtn');
        if (createFirstListBtn) {
          createFirstListBtn.style.display = 'none';
        }
        // Update welcome message
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) {
          welcomeMessage.querySelector('p').textContent = 'Great! Now you can add your first item.';
        }
        modal.removeAttribute('data-create-first');
      }

      // If this was from the Add Item form, handle form submission
      if (modal.getAttribute('data-create-from-form') === 'true') {
        // The list is now created, so we can proceed with item creation
        // The form will be submitted normally with the new list ID
        modal.removeAttribute('data-create-from-form');
      }
    }

    // Reset form
    e.target.reset();
  } catch (error) {
    console.error('Error creating list:', error);
    showToast(`Failed to create list: ${error.message}`, 'error');
  }
}

// Show edit list modal
function showEditListModal(listId, name, color, textColor) {
  console.log('Showing edit list modal with:', { listId, name, color, textColor });

  const modal = document.getElementById('editListModal');
  if (modal) {
    // Set form values
    document.getElementById('editListId').value = listId;
    document.getElementById('editListName').value = name;
    document.getElementById('editCustomColor').value = color;
    document.getElementById('editCustomTextColor').value = textColor;

    console.log('Form values set, showing modal...');
    modal.classList.add('show');

    console.log('Modal shown, setting up edit color selection...');
    setupEditColorSelection();

    // The matching preset color will be selected automatically by setupEditColorSelection
    // based on the detected theme
  } else {
    console.error('Edit list modal not found!');
  }
}

// Hide edit list modal
function hideEditListModal() {
  const modal = document.getElementById('editListModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Setup color selection in edit list modal
function setupEditColorSelection() {
  console.log('Setting up edit color selection...');

  // Get current colors to determine which theme they belong to
  const customColorInput = document.getElementById('editCustomColor');
  const customTextColorInput = document.getElementById('editCustomTextColor');

  console.log('Found edit color inputs:', {
    customColorInput: !!customColorInput,
    customTextColorInput: !!customTextColorInput,
  });

  if (customColorInput && customTextColorInput) {
    const currentColor = customColorInput.value;
    const currentTextColor = customTextColorInput.value;

    console.log('Current colors:', { currentColor, currentTextColor });

    // Determine which theme the background color belongs to
    const detectedTheme = detectColorTheme(currentColor);
    console.log('Detected theme:', detectedTheme);

    // Set the theme dropdown to match the detected theme
    const themeSelect = document.getElementById('editColorTheme');
    if (themeSelect) {
      themeSelect.value = detectedTheme;
      console.log('Set theme dropdown to:', detectedTheme);
    }

    // Populate color grid based on detected theme
    console.log('Calling populateColorGrid for edit modal');
    populateColorGrid('editColorGrid', detectedTheme, { bg: currentColor, text: currentTextColor });
  } else {
    // Fallback to light theme if inputs not found
    console.log('Inputs not found, falling back to light theme');
    populateColorGrid('editColorGrid', 'light');
  }

  // Handle custom color changes
  customColorInput.addEventListener('change', function () {
    // Remove selection from preset colors when custom colors are used
    const colorOptions = document.querySelectorAll('#editColorGrid .color-option');
    colorOptions.forEach((opt) => opt.classList.remove('selected'));

    // Automatically set text color for optimal contrast
    const autoTextColor = getContrastTextColor(this.value);
    customTextColorInput.value = autoTextColor;
    console.log('Auto-set text color to:', autoTextColor);
  });

  customTextColorInput.addEventListener('change', function () {
    // Remove selection from preset colors when custom colors are used
    const colorOptions = document.querySelectorAll('#editColorGrid .color-option');
    colorOptions.forEach((opt) => opt.classList.remove('selected'));
  });

  // Setup form submission
  const form = document.getElementById('editListForm');
  if (form) {
    form.onsubmit = handleEditList;
  }
}

// Handle edit list form submission
async function handleEditList(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const listId = formData.get('editListId');
  const name = formData.get('editListName');
  const color = formData.get('editCustomColor');
  const textColor = formData.get('editCustomTextColor');

  if (!name || !name.trim()) {
    showToast('List name is required', 'error');
    return;
  }

  try {
    const resp = await fetch(`/api/inventory/lists/${listId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ name: name.trim(), color, textColor }),
    });

    if (!resp.ok) {
      throw new Error('Failed to update list');
    }

    const result = await resp.json();
    showToast('List updated successfully', 'success');

    // Hide modal and refresh
    hideEditListModal();
    await loadListsIntoSelectors();
    await loadInventoryItems();
  } catch (error) {
    console.error('Error updating list:', error);
    showToast('Failed to update list', 'error');
  }
}

// Detect which theme a color combination belongs to
function detectColorTheme(bgColor, textColor) {
  console.log('detectColorTheme called with:', { bgColor, textColor });

  // Check each theme to see if the background color matches
  for (const [themeName, colors] of Object.entries(colorThemes)) {
    const match = colors.find((color) => color.bg === bgColor);
    if (match) {
      console.log('Found match in theme:', themeName);
      return themeName;
    }
  }

  console.log('No exact match found, returning default theme: light');
  // If no exact match found, return 'light' as default
  return 'light';
}

// QR Code Download and Share Functions
async function downloadQRCode(itemId, itemType) {
  try {
    // Fetch the QR code image
    const response = await fetch(`/uploads/qr-codes/${itemId}.png`);
    if (!response.ok) {
      throw new Error('Failed to fetch QR code');
    }

    // Convert to blob
    const blob = await response.blob();

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_Code_${itemType}_${itemId}.png`;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showToast('QR Code downloaded successfully', 'success');
  } catch (error) {
    console.error('Error downloading QR code:', error);
    showToast('Failed to download QR code', 'error');
  }
}

async function shareQRCode(itemId, itemType) {
  try {
    // Check if Web Share API is supported
    if (navigator.share) {
      // Fetch the QR code image
      const response = await fetch(`/uploads/qr-codes/${itemId}.png`);
      if (!response.ok) {
        throw new Error('Failed to fetch QR code');
      }

      const blob = await response.blob();
      const file = new File([blob], `QR_Code_${itemType}_${itemId}.png`, { type: 'image/png' });

      // Share the file
      await navigator.share({
        title: `QR Code for ${itemType}`,
        text: `QR Code for ${itemType} (ID: ${itemId})`,
        files: [file],
      });
    } else {
      // Fallback: copy item URL to clipboard
      const itemUrl = `${window.location.origin}/item/${itemId}`;
      await navigator.clipboard.writeText(itemUrl);
      showToast('Item URL copied to clipboard', 'success');
    }
  } catch (error) {
    console.error('Error sharing QR code:', error);

    // Fallback: try to copy URL to clipboard
    try {
      const itemUrl = `${window.location.origin}/item/${itemId}`;
      await navigator.clipboard.writeText(itemUrl);
      showToast('Item URL copied to clipboard', 'success');
    } catch (clipboardError) {
      console.error('Clipboard fallback failed:', clipboardError);
      showToast('Failed to share QR code', 'error');
    }
  }
}

// Camera functionality for record uploads
let cameraStream = null;

function setupCameraFunctionality() {
  const startCameraBtn = document.getElementById('startCameraBtn');
  const captureBtn = document.getElementById('captureBtn');
  const retakeBtn = document.getElementById('retakeBtn');
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('cameraCanvas');
  const placeholder = document.getElementById('cameraPlaceholder');
  const capturedImageInput = document.getElementById('capturedImage');

  if (startCameraBtn) {
    startCameraBtn.addEventListener('click', startCamera);
  }

  if (captureBtn) {
    captureBtn.addEventListener('click', capturePhoto);
  }

  if (retakeBtn) {
    retakeBtn.addEventListener('click', retakePhoto);
  }
}

async function startCamera() {
  try {
    const video = document.getElementById('cameraVideo');
    const placeholder = document.getElementById('cameraPlaceholder');
    const startCameraBtn = document.getElementById('startCameraBtn');
    const captureBtn = document.getElementById('captureBtn');

    // Request camera access
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment', // Use back camera if available
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    // Show video stream
    video.srcObject = cameraStream;
    video.style.display = 'block';
    placeholder.style.display = 'none';
    startCameraBtn.style.display = 'none';
    captureBtn.style.display = 'inline-flex';
  } catch (error) {
    console.error('Error accessing camera:', error);
    showToast('Failed to access camera. Please check permissions.', 'error');
  }
}

function capturePhoto() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('cameraCanvas');
  const retakeBtn = document.getElementById('retakeBtn');
  const captureBtn = document.getElementById('captureBtn');
  const capturedImageInput = document.getElementById('capturedImage');

  // Set canvas dimensions to match video
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw video frame to canvas
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convert canvas to base64 data URL
  const imageData = canvas.toDataURL('image/jpeg', 0.8);
  capturedImageInput.value = imageData;

  // Show captured image
  canvas.style.display = 'block';
  video.style.display = 'none';
  captureBtn.style.display = 'none';
  retakeBtn.style.display = 'inline-flex';

  // Stop camera stream
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  showToast('Photo captured successfully!', 'success');
}

function retakePhoto() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('cameraCanvas');
  const placeholder = document.getElementById('cameraPlaceholder');
  const startCameraBtn = document.getElementById('startCameraBtn');
  const captureBtn = document.getElementById('captureBtn');
  const retakeBtn = document.getElementById('retakeBtn');
  const capturedImageInput = document.getElementById('capturedImage');

  // Reset to initial state
  canvas.style.display = 'none';
  video.style.display = 'none';
  placeholder.style.display = 'block';
  startCameraBtn.style.display = 'inline-flex';
  captureBtn.style.display = 'none';
  retakeBtn.style.display = 'none';

  // Clear captured image
  capturedImageInput.value = '';

  // Reset video source
  video.srcObject = null;
}

// Clean up camera when modal is closed
function cleanupCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
}

// Smart positioning for column customizer menu
function positionColumnCustomizerMenu() {
  const menu = document.getElementById('columnCustomizerMenu');
  const button = document.getElementById('columnCustomizerBtn');

  if (!menu || !button) return;

  // Get button position relative to viewport
  const buttonRect = button.getBoundingClientRect();

  // Temporarily show menu off-screen to measure its actual dimensions
  const originalDisplay = menu.style.display;
  const originalVisibility = menu.style.visibility;
  const originalLeft = menu.style.left;
  const originalTop = menu.style.top;

  menu.style.visibility = 'hidden';
  menu.style.display = 'block';
  menu.style.left = '-9999px';
  menu.style.top = '-9999px';

  // Get actual menu dimensions
  const menuRect = menu.getBoundingClientRect();
  const menuWidth = menuRect.width;
  const menuHeight = menuRect.height;

  // Restore original state temporarily
  menu.style.display = originalDisplay;
  menu.style.visibility = originalVisibility;
  menu.style.left = originalLeft;
  menu.style.top = originalTop;

  // Calculate optimal position (start with default: below and to the right)
  let left = buttonRect.right + 10; // 10px offset from button
  let top = buttonRect.bottom + 10; // 10px offset from button

  // Check if menu would extend beyond right edge of viewport
  if (left + menuWidth > window.innerWidth - 20) {
    // Position menu to the left of the button
    left = buttonRect.left - menuWidth - 10;
  }

  // Check if menu would extend beyond bottom edge of viewport
  if (top + menuHeight > window.innerHeight - 20) {
    // Position menu above the button
    top = buttonRect.top - menuHeight - 10;
  }

  // Final safety checks to ensure menu stays within viewport

  // Ensure menu doesn't go off the left edge
  if (left < 20) {
    left = 20;
  }

  // Ensure menu doesn't go off the right edge
  if (left + menuWidth > window.innerWidth - 20) {
    left = window.innerWidth - menuWidth - 20;
  }

  // Ensure menu doesn't go off the top edge
  if (top < 20) {
    top = 20;
  }

  // Ensure menu doesn't go off the bottom edge (final check)
  if (top + menuHeight > window.innerHeight - 20) {
    top = window.innerHeight - menuHeight - 20;

    // If still not fitting, limit the menu height and add scroll
    if (top < 20) {
      top = 20;
      const maxHeight = window.innerHeight - 40; // 20px margin top and bottom
      menu.style.maxHeight = maxHeight + 'px';
      menu.style.overflowY = 'auto';
    }
  }

  // Apply final positioning (don't force display here - let the toggle handle that)
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.style.right = 'auto';
  menu.style.bottom = 'auto';
}

// Function to download files from storage
async function downloadFile(fileName, fileType) {
  try {
    // Use query parameter approach for better handling of filenames with spaces and special characters
    // URL encode the filename to handle spaces, #, +, and other special characters safely
    const encodedFileName = encodeURIComponent(fileName);
    const downloadUrl = `/api/storage/download?file=${encodedFileName}`;

    console.log('Downloading file:', { fileName, encodedFileName, downloadUrl });

    // Get the file from storage
    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Download response not ok:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });

      if (response.status === 404) {
        throw new Error('File not found on server');
      } else if (response.status === 400) {
        throw new Error('Invalid file path');
      } else {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }
    }

    // Create blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName; // Use original filename for download
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showToast('File downloaded successfully', 'success');
  } catch (error) {
    console.error('Error downloading file:', error);
    showToast(`Failed to download file: ${error.message}`, 'error');
  }
}

// ===== OUT OF SERVICE API FUNCTIONS =====
// These functions provide the interface between the frontend and backend OOS functionality

/**
 * Mark an item as out of service
 * @param {string} id - Item ID
 * @param {Object} params - Parameters
 * @param {string} params.reason - Required reason for marking OOS
 * @param {string} [params.notes] - Optional notes
 * @param {string} [params.at] - Optional date (defaults to today)
 * @returns {Promise<Object>} Updated item
 */
async function apiMarkOutOfService(id, { reason, notes, at }) {
  if (!reason || !reason.trim()) {
    throw new Error('Reason is required');
  }

  const response = await fetch(`/api/inventory/${id}/out-of-service`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ reason: reason.trim(), notes, at })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to mark item out of service`);
  }

  return await response.json();
}

/**
 * Return an item to service
 * @param {string} id - Item ID
 * @param {Object} params - Parameters
 * @param {boolean} [params.verified] - Whether the return is verified
 * @param {string} [params.verifiedBy] - Who verified the return
 * @param {string} [params.notes] - Optional notes
 * @param {string} [params.at] - Optional date (defaults to now)
 * @returns {Promise<Object>} Updated item
 */
async function apiReturnToService(id, { verified, verifiedBy, notes, at }) {
  const response = await fetch(`/api/inventory/${id}/return-to-service`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ verified, verifiedBy, notes, at })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to return item to service`);
  }

  return await response.json();
}

/**
 * Fetch inventory items with optional OOS filtering
 * @param {Object} [options] - Options
 * @param {boolean} [options.includeOOS] - Whether to include out-of-service items (default: true)
 * @param {string} [options.listId] - Optional list filter
 * @returns {Promise<Object>} Items response
 */
async function apiFetchItems({ includeOOS, listId } = {}) {
  const params = new URLSearchParams();
  
  if (includeOOS !== undefined) {
    params.append('includeOOS', includeOOS.toString());
  }
  
  if (listId && listId !== 'all') {
    params.append('listId', listId);
  }

  const url = `/api/inventory${params.toString() ? '?' + params.toString() : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch items`);
  }

  return await response.json();
}

/**
 * Fetch summary statistics
 * @returns {Promise<Object>} Stats response with totalItems, activeItems, dueThisMonth, maintenanceDue
 */
async function apiFetchSummary() {
  const response = await fetch('/api/inventory/stats/overview', {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch summary`);
  }

  return await response.json();
}

// ===== OOS FRONTEND FUNCTIONALITY =====

// --- OOS visibility preference (default true)
const OOS_KEY = 'inv.showOOS';
function getShowOOS() {
  const v = localStorage.getItem(OOS_KEY);
  const result = v === null ? true : v === 'true';
  logStep('getShowOOS', { stored: v, result });
  return result;
}
function setShowOOS(val) {
  const boolVal = !!val;
  localStorage.setItem(OOS_KEY, String(boolVal));
  logStep('setShowOOS', { val, stored: boolVal });
}

// --- Small helpers for modals
function openModal(id) { 
  document.getElementById(id)?.classList.remove('hidden'); 
}
function closeModal(id) { 
  document.getElementById(id)?.classList.add('hidden'); 
}

// --- Updated API wrappers to match our backend endpoints
async function apiMarkOutOfServiceFixed(id, payload) {
  const res = await fetch(`/api/inventory/${id}/out-of-service`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to mark OOS');
  }
  return res.json();
}

async function apiReturnToServiceFixed(id, payload) {
  const res = await fetch(`/api/inventory/${id}/return-to-service`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to return to service');
  }
  return res.json();
}

async function apiFetchItemsFixed(options = {}) {
  const params = new URLSearchParams();
  
  if (options.includeOOS !== undefined) {
    params.append('includeOOS', options.includeOOS.toString());
  }
  
  if (options.listId && options.listId !== 'all') {
    params.append('listId', options.listId);
  }

  const url = `/api/inventory${params.toString() ? '?' + params.toString() : ''}`;
  
  const res = await fetch(url, {
    headers: { 
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch items');
  }
  return res.json();
}

async function apiFetchSummaryFixed() {
  const res = await fetch('/api/inventory/stats/overview', {
    headers: { 
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch summary');
  }
  return res.json();
}

// --- Global cache for items
let _itemsCache = [];

// --- Authentication helper
function getAuthToken() {
  return authToken;
}

// --- Utility function to truncate file names
function truncateFileName(fileName, maxLength = 50) {
  if (!fileName || fileName.length <= maxLength) return fileName;
  
  const extension = fileName.split('.').pop();
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
  const maxNameLength = maxLength - extension.length - 4; // Account for "..." and "."
  
  if (nameWithoutExt.length <= maxNameLength) return fileName;
  
  return nameWithoutExt.substring(0, maxNameLength) + '...' + '.' + extension;
}

// --- Render nickname cell with OOS chip
function renderNicknameCell(item) {
  const name = (item?.nickname ?? item?.name ?? '').trim() || '—';
  const safeName = typeof escapeHtml === 'function' ? escapeHtml(name) : name.replace(/[<>&"']/g, (m) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
  }[m]));
  
  const chips = [];
  
  // Add OOS chip if out of service
  if (item?.isOutOfService) {
    chips.push('<span class="chip chip-oos">OOS</span>');
  }
  
  // Add Outsourced chip if outsourced
  if (item?.isOutsourced === 1 || item?.isOutsourced === true) {
    chips.push('<span class="chip chip-outsourced">Outsourced</span>');
  }
  
  if (chips.length > 0) {
    return `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>${safeName}</span>
        ${chips.join('')}
      </div>
    `;
  }
  
  return `<span>${safeName}</span>`;
}

// --- Build actions menu HTML with OOS options (ChatGPT's approach)
function buildActionsMenuHTML(item) {
  const edit = `<button class="menu-item" data-action="edit" data-id="${item.id}">✏️ Edit</button>`;
  const oos  = `<button class="menu-item" data-action="oos" data-id="${item.id}">⛔ Mark Out of Service</button>`;
  const rts  = `<button class="menu-item" data-action="rts" data-id="${item.id}">↩️ Return to Service</button>`;
  const del  = `<button class="menu-item" data-action="delete" data-id="${item.id}" style="color:#ff6b6b">🗑️ Delete</button>`;

  return `
    <div class="action-menu" data-id="${item.id}">
      ${edit}
      ${item.isOutOfService ? rts : oos}
      ${del}
    </div>
  `;
}

// --- Render complete actions cell (ChatGPT's single renderer)
function renderActionsCell(item) {
  return `
    <div class="actions-cell" data-id="${item.id}">
      <button class="action-btn" data-action="view" data-id="${item.id}">
        <i class="fas fa-eye"></i> View
      </button>
      <button class="action-btn action-btn-plus" data-action="quick-add" data-id="${item.id}" title="Add Calibration/Maintenance Record">
        <i class="fas fa-plus"></i>
      </button>
      <button class="action-menu-button" data-action="more" data-id="${item.id}" title="More actions">
        <i class="fas fa-ellipsis-v"></i>
      </button>
      ${buildActionsMenuHTML(item)}
    </div>
  `;
}

// Make functions globally available for ChatGPT's frontend code
window.apiMarkOutOfService = apiMarkOutOfService;
window.apiReturnToService = apiReturnToService;
window.apiFetchItems = apiFetchItems;
window.apiFetchSummary = apiFetchSummary;

// Also make the fixed versions available
window.apiMarkOutOfServiceFixed = apiMarkOutOfServiceFixed;
window.apiReturnToServiceFixed = apiReturnToServiceFixed;
window.apiFetchItemsFixed = apiFetchItemsFixed;
window.apiFetchSummaryFixed = apiFetchSummaryFixed;

// ===== OOS EVENT HANDLERS =====

// OOS form handlers (called from setupEventListeners)
function setupOOSFormHandlers() {
  // OOS form submit
  const formOOS = document.getElementById('form-oos');
  if (formOOS) {
    formOOS.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('oos-item-id').value;
      const date = document.getElementById('oos-date').value;
      const reason = document.getElementById('oos-reason').value.trim();
      const reportedBy = document.getElementById('oos-reported-by').value.trim();
      const notes = document.getElementById('oos-notes').value.trim() || undefined;
      
      if (!date) return alert('Date is required');
      if (!reason) return alert('Reason is required');
      if (!reportedBy) return alert('Reported By is required');
      
      try {
        await apiMarkOutOfServiceFixed(id, { date, reason, reportedBy, notes });
        closeModal('modal-oos');
        await refreshData();
        showToast('Item marked out of service', 'success');
      } catch (err) {
        console.error('Error marking OOS:', err);
        showToast(err.message || 'Failed to mark out of service', 'error');
      }
    });
  }

  // Return-to-service form submit
  const formRTS = document.getElementById('form-rts');
  if (formRTS) {
    formRTS.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('rts-item-id').value;
      const date = document.getElementById('rts-date').value;
      const resolvedBy = document.getElementById('rts-resolved-by').value.trim();
      const verifiedBy = document.getElementById('rts-verified-by').value.trim();
      const notes = document.getElementById('rts-notes').value.trim() || undefined;
      
      if (!date) return alert('Date is required');
      if (!resolvedBy) return alert('Issue Resolved By is required');
      if (!verifiedBy) return alert('Verified By is required');
      
      try {
        await apiReturnToServiceFixed(id, { date, resolvedBy, verifiedBy, notes });
        closeModal('modal-rts');
        await refreshData();
        showToast('Item returned to service', 'success');
        
        // Show post-return options modal
        showPostReturnModal(id);
      } catch (err) {
        console.error('Error returning to service:', err);
        showToast(err.message || 'Failed to return to service', 'error');
      }
    });
  }
}

// Show post-return modal for calibration/maintenance options
function showPostReturnModal(itemId) {
  const modal = document.getElementById('modal-post-return');
  if (!modal) return;
  
  modal.classList.remove('hidden');
  
  // Set up event listeners for the buttons
  const btnCalibration = document.getElementById('btn-add-calibration');
  const btnBoth = document.getElementById('btn-add-both-records');
  const btnNotNow = document.getElementById('btn-not-now');
  
  // Remove any existing listeners
  btnCalibration.replaceWith(btnCalibration.cloneNode(true));
  btnBoth.replaceWith(btnBoth.cloneNode(true));
  btnNotNow.replaceWith(btnNotNow.cloneNode(true));
  
  // Get fresh references
  const newBtnCalibration = document.getElementById('btn-add-calibration');
  const newBtnBoth = document.getElementById('btn-add-both-records');
  const newBtnNotNow = document.getElementById('btn-not-now');
  
  newBtnCalibration.addEventListener('click', () => {
    closeModal('modal-post-return');
    showUploadModal('calibration', itemId);
  });
  
  newBtnBoth.addEventListener('click', async () => {
    closeModal('modal-post-return');
    // First show calibration modal, then maintenance after it's saved
    showUploadModal('calibration', itemId);
    // TODO: Add logic to automatically show maintenance modal after calibration is saved
  });
  
  newBtnNotNow.addEventListener('click', () => {
    closeModal('modal-post-return');
  });
}

// Add default dates when opening OOS/RTS modals
function openModal(modalId, itemId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  modal.classList.remove('hidden');
  
  // Set default dates to today
  const today = new Date().toISOString().split('T')[0];
  
  if (modalId === 'modal-oos') {
    document.getElementById('oos-item-id').value = itemId;
    document.getElementById('oos-date').value = today;
    // Clear other fields
    document.getElementById('oos-reason').value = '';
    document.getElementById('oos-reported-by').value = '';
    document.getElementById('oos-notes').value = '';
  } else if (modalId === 'modal-rts') {
    document.getElementById('rts-item-id').value = itemId;
    document.getElementById('rts-date').value = today;
    // Clear other fields
    document.getElementById('rts-resolved-by').value = '';
    document.getElementById('rts-verified-by').value = '';
    document.getElementById('rts-notes').value = '';
  }
}

// ChatGPT's robust action delegation system with dynamic positioning
function toggleActionMenuForCell(cellEl) {
  document.querySelectorAll('.actions-cell .action-menu.open')
    .forEach(m => { if (!cellEl.contains(m)) m.classList.remove('open'); });

  const menu = cellEl.querySelector('.action-menu');
  if (menu) {
    if (menu.classList.contains('open')) {
      menu.classList.remove('open');
    } else {
      // Calculate position relative to the button
      const button = cellEl.querySelector('[data-action="more"]');
      const rect = button.getBoundingClientRect();
      
      // Position menu below and to the right of the button
      menu.style.top = (rect.bottom + 5) + 'px';
      menu.style.right = (window.innerWidth - rect.right) + 'px';
      
      menu.classList.add('open');
    }
  }
}

// Delegation for the three dark buttons + menu items
document.addEventListener('click', (e) => {
  const moreBtn = e.target.closest('.actions-cell [data-action="more"]');
  if (moreBtn) {
    const cell = moreBtn.closest('.actions-cell');
    toggleActionMenuForCell(cell);
    return;
  }

  const viewBtn = e.target.closest('.actions-cell [data-action="view"]');
  if (viewBtn) {
    viewItem(viewBtn.dataset.id);
    return;
  }

  const qaBtn = e.target.closest('.actions-cell [data-action="quick-add"]');
  if (qaBtn) {
    showQuickAddRecord(qaBtn.dataset.id);
    return;
  }

  const menuItem = e.target.closest('.actions-cell .action-menu .menu-item');
  if (menuItem) {
    const { action, id } = menuItem.dataset;
    if (action === 'edit') {
      editItem(id);
    } else if (action === 'oos') {
      openModal('modal-oos', id);
    } else if (action === 'rts') {
      openModal('modal-rts', id);
    } else if (action === 'delete') {
      deleteItem(id);
    }

    // close menu after any menu action
    const menu = menuItem.closest('.action-menu');
    menu?.classList.remove('open');
    return;
  }

  // Click-away: close menus when clicking outside any actions cell
  if (!e.target.closest('.actions-cell')) {
    document.querySelectorAll('.actions-cell .action-menu.open')
      .forEach(m => m.classList.remove('open'));
  }
});

// TEMP robust logging
function logStep(step, extra) {
  console.log(`[INV] ${step}`, extra ?? '');
}

// Refresh data function for OOS operations
async function refreshData() {
  logStep('refreshData:start');
  let items, summary;
  try {
    const [itemsRes, summaryRes] = await Promise.all([apiFetchItemsFixed(), apiFetchSummaryFixed()]);
    items = itemsRes?.items || itemsRes; // Handle both {items: []} and [] formats
    summary = summaryRes;
  } catch (e) {
    console.error('[INV] fetch failed', e);
    items = []; 
    summary = null;
  }
  logStep('refreshData:fetched', { count: Array.isArray(items) ? items.length : 'n/a', sample: items?.[0] });

  _itemsCache = Array.isArray(items) ? items : [];
  try {
    if (summary && typeof renderSummary === 'function') {
      renderSummary(summary);
    } else {
      loadStats(); // fallback to existing stats loading
    }
  } catch (e) {
    console.warn('[INV] renderSummary error', e);
  }
  loadInventoryItems();
}
