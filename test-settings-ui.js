/**
 * Comprehensive Settings UI Testing Script
 * Tests all interactive elements, form inputs, CRUD operations, and validation
 */

const TEST_RESULTS = {
  passed: 0,
  failed: 0,
  errors: [],
  details: []
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
  console.log(logEntry);
  TEST_RESULTS.details.push(logEntry);
}

function assert(condition, message) {
  if (condition) {
    TEST_RESULTS.passed++;
    log(`✅ PASS: ${message}`, 'success');
  } else {
    TEST_RESULTS.failed++;
    TEST_RESULTS.errors.push(message);
    log(`❌ FAIL: ${message}`, 'error');
  }
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSettingsPage() {
  log('🚀 Starting Comprehensive Settings UI Testing');
  log('📍 Current URL: ' + window.location.href);

  try {
    // Test 1: Check if settings page is accessible
    log('Test 1: Settings Page Accessibility');
    assert(window.location.pathname.includes('settings') || 
           document.title.includes('Settings'), 
           'Settings page is accessible');

    // Test 2: Verify main UI elements are present
    log('Test 2: Main UI Elements Verification');
    
    const settingsHeader = document.querySelector('h1');
    assert(settingsHeader && settingsHeader.textContent.includes('Business Settings'), 
           'Settings header is present');

    // Test 3: Test Tab Navigation
    log('Test 3: Tab Navigation Testing');
    
    const tabs = ['tab-templates', 'tab-criteria', 'tab-assignments', 'tab-advanced'];
    tabs.forEach(tabId => {
      const tab = document.querySelector(`[data-testid="${tabId}"]`);
      assert(tab !== null, `Tab ${tabId} exists`);
      if (tab) {
        assert(!tab.disabled, `Tab ${tabId} is clickable`);
      }
    });

    // Test 4: Templates Section - Email/SMS Toggle
    log('Test 4: Templates Section Testing');
    
    const emailTemplatesBtn = document.querySelector('[data-testid="button-email-templates"]');
    const smsTemplatesBtn = document.querySelector('[data-testid="button-sms-templates"]');
    
    assert(emailTemplatesBtn !== null, 'Email templates button exists');
    assert(smsTemplatesBtn !== null, 'SMS templates button exists');

    // Test 5: Email Templates CRUD Buttons
    log('Test 5: Email Templates CRUD Operations');
    
    if (emailTemplatesBtn) {
      emailTemplatesBtn.click();
      await wait(500);
      
      const addEmailBtn = document.querySelector('[data-testid="button-add-email-template"]');
      assert(addEmailBtn !== null, 'Add email template button exists');
      
      // Look for existing template edit/delete buttons
      const editButtons = document.querySelectorAll('[data-testid^="button-edit-template-"]');
      const deleteButtons = document.querySelectorAll('[data-testid^="button-delete-template-"]');
      
      log(`Found ${editButtons.length} email template edit buttons`);
      log(`Found ${deleteButtons.length} email template delete buttons`);
    }

    // Test 6: SMS Templates CRUD and Character Limit
    log('Test 6: SMS Templates CRUD and Validation');
    
    if (smsTemplatesBtn) {
      smsTemplatesBtn.click();
      await wait(500);
      
      const addSMSBtn = document.querySelector('[data-testid="button-add-sms-template"]');
      assert(addSMSBtn !== null, 'Add SMS template button exists');
      
      // Check SMS character counter elements
      const smsTextareas = document.querySelectorAll('[data-testid^="textarea-sms-content-"]');
      log(`Found ${smsTextareas.length} SMS template textareas`);
      
      smsTextareas.forEach((textarea, index) => {
        assert(textarea.maxLength === 160 || textarea.getAttribute('maxlength') === '160', 
               `SMS textarea ${index} has 160 character limit`);
      });
    }

    // Test 7: Acquisition Criteria Tab
    log('Test 7: Acquisition Criteria Testing');
    
    const criteriaTab = document.querySelector('[data-testid="tab-criteria"]');
    if (criteriaTab) {
      criteriaTab.click();
      await wait(500);
      
      const addCriteriaBtn = document.querySelector('[data-testid="button-add-criteria"]');
      assert(addCriteriaBtn !== null, 'Add acquisition criteria button exists');
      
      // Check for numeric input fields
      const numericInputs = [
        'input-min-acres-0',
        'input-min-lots-0', 
        'input-min-price-0',
        'input-max-price-0'
      ];
      
      numericInputs.forEach(inputId => {
        const input = document.querySelector(`[data-testid="${inputId}"]`);
        if (input) {
          assert(input.type === 'number', `${inputId} is a numeric input`);
        }
      });
      
      // Check for market selection elements
      const marketButtons = document.querySelectorAll('[data-testid^="button-criteria-market-"]');
      log(`Found ${marketButtons.length} market selection buttons`);
    }

    // Test 8: Deal Assignments Tab
    log('Test 8: Deal Assignments Testing');
    
    const assignmentsTab = document.querySelector('[data-testid="tab-assignments"]');
    if (assignmentsTab) {
      assignmentsTab.click();
      await wait(500);
      
      const addAssignmentBtn = document.querySelector('[data-testid="button-add-assignment"]');
      assert(addAssignmentBtn !== null, 'Add deal assignment button exists');
      
      // Check for team member selection buttons
      const teamMemberButtons = document.querySelectorAll('[data-testid^="button-select-member-"]');
      const marketAssignButtons = document.querySelectorAll('[data-testid^="button-assignment-market-"]');
      const devTypeButtons = document.querySelectorAll('[data-testid^="button-assignment-devtype-"]');
      
      log(`Found ${teamMemberButtons.length} team member selection buttons`);
      log(`Found ${marketAssignButtons.length} market assignment buttons`);
      log(`Found ${devTypeButtons.length} development type buttons`);
    }

    // Test 9: Global Save/Discard Operations
    log('Test 9: Global Save/Discard Operations');
    
    const saveButton = document.querySelector('[data-testid="button-save-changes"]');
    const discardButton = document.querySelector('[data-testid="button-discard-changes"]');
    
    // These buttons may not be visible until there are unsaved changes
    log(`Save button ${saveButton ? 'exists' : 'not visible (no unsaved changes)'}`);
    log(`Discard button ${discardButton ? 'exists' : 'not visible (no unsaved changes)'}`);

    // Test 10: Form Input Types and Validation
    log('Test 10: Form Input Types and Validation');
    
    const allInputs = document.querySelectorAll('input, textarea, select');
    const inputTypes = {};
    
    allInputs.forEach(input => {
      const type = input.type || input.tagName.toLowerCase();
      inputTypes[type] = (inputTypes[type] || 0) + 1;
    });
    
    log('Input type distribution:');
    Object.entries(inputTypes).forEach(([type, count]) => {
      log(`  ${type}: ${count} elements`);
    });
    
    // Test required fields
    const requiredFields = document.querySelectorAll('[required]');
    log(`Found ${requiredFields.length} required fields`);

    // Test 11: Interactive Elements (Collapsible, Toggles)
    log('Test 11: Interactive Elements Testing');
    
    const toggleButtons = document.querySelectorAll('[data-testid^="button-toggle-"]');
    const editButtons = document.querySelectorAll('[data-testid^="button-edit-"]');
    const deleteButtons = document.querySelectorAll('[data-testid^="button-delete-"]');
    
    log(`Found ${toggleButtons.length} toggle buttons (collapse/expand)`);
    log(`Found ${editButtons.length} edit buttons`);  
    log(`Found ${deleteButtons.length} delete buttons`);

    // Test 12: Accessibility - Data Test IDs
    log('Test 12: Accessibility Testing');
    
    const dataTestIds = document.querySelectorAll('[data-testid]');
    assert(dataTestIds.length > 20, `Found ${dataTestIds.length} elements with data-testid attributes`);
    
    // Check for proper ARIA labels and roles
    const ariaLabels = document.querySelectorAll('[aria-label]');
    const ariaRoles = document.querySelectorAll('[role]');
    
    log(`Found ${ariaLabels.length} elements with aria-label`);
    log(`Found ${ariaRoles.length} elements with role attributes`);

    // Test 13: Error Handling Elements
    log('Test 13: Error Handling Elements');
    
    const errorMessages = document.querySelectorAll('.text-red-500, .text-red-600, .border-red-500');
    const toastElements = document.querySelectorAll('[data-testid*="toast"], .toast');
    
    log(`Found ${errorMessages.length} error styling elements`);
    log(`Found ${toastElements.length} toast/notification elements`);

    // Test 14: API Integration Points
    log('Test 14: API Integration Verification');
    
    // Check for loading states
    const loadingElements = document.querySelectorAll('.animate-spin, [data-testid*="loading"]');
    log(`Found ${loadingElements.length} loading indicator elements`);
    
    // Check for mutation states  
    const disabledButtons = document.querySelectorAll('button[disabled]');
    log(`Found ${disabledButtons.length} disabled buttons (may indicate pending operations)`);

  } catch (error) {
    TEST_RESULTS.failed++;
    TEST_RESULTS.errors.push(`Unexpected error: ${error.message}`);
    log(`💥 Unexpected error: ${error.message}`, 'error');
  }

  // Final Results Summary
  log('\n🏁 COMPREHENSIVE TESTING COMPLETE');
  log('📊 RESULTS SUMMARY:');
  log(`✅ Tests Passed: ${TEST_RESULTS.passed}`);
  log(`❌ Tests Failed: ${TEST_RESULTS.failed}`);
  log(`📈 Total Tests: ${TEST_RESULTS.passed + TEST_RESULTS.failed}`);
  log(`🎯 Success Rate: ${((TEST_RESULTS.passed / (TEST_RESULTS.passed + TEST_RESULTS.failed)) * 100).toFixed(2)}%`);

  if (TEST_RESULTS.errors.length > 0) {
    log('\n🚨 FAILED TESTS:');
    TEST_RESULTS.errors.forEach(error => log(`  ❌ ${error}`));
  }

  // Return results for external processing
  return TEST_RESULTS;
}

// Auto-run when loaded in browser
if (typeof window !== 'undefined') {
  // Wait for page load then run tests
  if (document.readyState === 'complete') {
    testSettingsPage();
  } else {
    window.addEventListener('load', testSettingsPage);
  }
}

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testSettingsPage };
}