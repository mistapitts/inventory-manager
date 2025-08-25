// Signup page JavaScript
class SignupManager {
  constructor() {
    this.inviteCode = null;
    this.inviteData = null;
    this.passwordValid = false;
    this.confirmPasswordValid = false;
    
    this.init();
  }

  init() {
    // Get invite code from URL
    this.inviteCode = this.getInviteCodeFromUrl();
    
    if (!this.inviteCode) {
      this.showError('No invitation code provided');
      return;
    }

    // Load invite data
    this.loadInviteData();
    
    // Setup form event listeners
    this.setupEventListeners();
  }

  getInviteCodeFromUrl() {
    // Extract code from URL path like /signup/abc123
    const path = window.location.pathname;
    const matches = path.match(/\/signup\/([^\/]+)/);
    return matches ? matches[1] : null;
  }

  async loadInviteData() {
    try {
      const response = await fetch(`/api/auth/invite/${this.inviteCode}`);
      
      if (!response.ok) {
        const error = await response.json();
        this.showError(error.error || 'Invalid invitation');
        return;
      }

      this.inviteData = await response.json();
      this.populateInviteInfo();
      this.showSignupForm();
      
    } catch (error) {
      console.error('Error loading invite data:', error);
      this.showError('Failed to load invitation details');
    }
  }

  populateInviteInfo() {
    const { invite, company } = this.inviteData;
    
    // Company info
    document.getElementById('company-name').textContent = company.name;
    
    // User info
    document.getElementById('user-full-name').textContent = `${invite.firstName} ${invite.lastName}`;
    document.getElementById('user-email').textContent = invite.email;
    
    // Employee ID (optional)
    if (invite.employeeId) {
      document.getElementById('user-employee-id').textContent = invite.employeeId;
      document.getElementById('employee-id-row').style.display = 'flex';
    }
    
    // Role badge
    const roleBadge = document.getElementById('user-role-badge');
    roleBadge.textContent = this.formatRole(invite.role);
    roleBadge.className = `role-badge ${this.getRoleBadgeClass(invite.role)}`;
  }

  formatRole(role) {
    const roleMap = {
      'company_owner': 'Company Owner',
      'company_admin': 'Company Admin',
      'manager': 'Manager',
      'user': 'User',
      'viewer': 'Viewer'
    };
    return roleMap[role] || role.replace('_', ' ');
  }

  getRoleBadgeClass(role) {
    const classMap = {
      'company_owner': 'role-owner',
      'company_admin': 'role-admin',
      'manager': 'role-manager',
      'user': 'role-user',
      'viewer': 'role-viewer'
    };
    return classMap[role] || 'role-default';
  }

  setupEventListeners() {
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const form = document.getElementById('password-form');

    // Password validation
    passwordInput.addEventListener('input', () => this.validatePassword());
    confirmPasswordInput.addEventListener('input', () => this.validatePasswordMatch());
    
    // Form submission
    form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  validatePassword() {
    const password = document.getElementById('password').value;
    
    // Length requirement
    const lengthValid = password.length >= 8;
    this.updateRequirement('req-length', lengthValid);
    
    // Uppercase requirement
    const uppercaseValid = /[A-Z]/.test(password);
    this.updateRequirement('req-uppercase', uppercaseValid);
    
    // Lowercase requirement
    const lowercaseValid = /[a-z]/.test(password);
    this.updateRequirement('req-lowercase', lowercaseValid);
    
    // Number requirement
    const numberValid = /[0-9]/.test(password);
    this.updateRequirement('req-number', numberValid);
    
    this.passwordValid = lengthValid && uppercaseValid && lowercaseValid && numberValid;
    
    // Also validate password match if confirm password has content
    if (document.getElementById('confirmPassword').value) {
      this.validatePasswordMatch();
    }
    
    this.updateSubmitButton();
  }

  validatePasswordMatch() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    const passwordsMatch = password === confirmPassword && password.length > 0;
    this.updateRequirement('req-match', passwordsMatch);
    
    this.confirmPasswordValid = passwordsMatch;
    this.updateSubmitButton();
  }

  updateRequirement(elementId, isValid) {
    const element = document.getElementById(elementId);
    if (isValid) {
      element.className = 'requirement-check';
      element.innerHTML = `<i class="fas fa-check"></i> ${element.textContent.replace(/^[✓×]\s*/, '')}`;
    } else {
      element.className = 'requirement-fail';
      element.innerHTML = `<i class="fas fa-times"></i> ${element.textContent.replace(/^[✓×]\s*/, '')}`;
    }
  }

  updateSubmitButton() {
    const submitBtn = document.getElementById('submit-btn');
    const canSubmit = this.passwordValid && this.confirmPasswordValid;
    
    submitBtn.disabled = !canSubmit;
    
    if (canSubmit) {
      submitBtn.style.background = 'var(--accent-primary)';
    } else {
      submitBtn.style.background = 'var(--text-secondary)';
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    if (!this.passwordValid || !this.confirmPasswordValid) {
      return;
    }

    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    
    // Show loading state
    submitBtn.disabled = true;
    submitText.innerHTML = '<div class="loading-spinner"></div>Creating account...';

    try {
      const password = document.getElementById('password').value;
      
      const response = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteCode: this.inviteCode,
          password: password
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Account created successfully:', result);
        this.showSuccess();
      } else {
        const error = await response.json();
        this.showError(error.error || 'Failed to create account');
        
        // Reset button
        submitBtn.disabled = false;
        submitText.textContent = 'Create Account';
      }

    } catch (error) {
      console.error('Error creating account:', error);
      this.showError('Network error. Please try again.');
      
      // Reset button
      submitBtn.disabled = false;
      submitText.textContent = 'Create Account';
    }
  }

  showSignupForm() {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('error-state').classList.add('hidden');
    document.getElementById('success-state').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
  }

  showError(message) {
    document.getElementById('error-text').textContent = message;
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('success-state').classList.add('hidden');
    document.getElementById('error-state').classList.remove('hidden');
  }

  showSuccess() {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('error-state').classList.add('hidden');
    document.getElementById('success-state').classList.remove('hidden');
  }
}

// CSS classes for role badges (matching the main app)
const style = document.createElement('style');
style.textContent = `
  .role-owner { background: #dc2626; color: white; }
  .role-admin { background: #ea580c; color: white; }
  .role-manager { background: #0ea5e9; color: white; }
  .role-user { background: #10b981; color: white; }
  .role-viewer { background: #6b7280; color: white; }
  .role-default { background: var(--bg-secondary); color: var(--text-primary); }
`;
document.head.appendChild(style);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SignupManager();
});
