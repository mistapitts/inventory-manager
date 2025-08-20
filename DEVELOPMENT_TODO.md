# 🚀 Inventory Manager Development To-Do List

## 📋 **Phase 1: UI/UX Fixes & Improvements**

### 1. 🔧 Fix "Edit Lists and Columns" Container Positioning
- **Issue**: Container gets cut off by bottom of page instead of repositioning
- **Solution**: Implement smart positioning logic to ensure container is always fully visible
- **Priority**: HIGH
- **Status**: 🔴 PENDING

### 2. 📏 Adjust Padding in "Edit Lists and Columns" Container
- **Issue**: Reduce padding between checkbox list and "Add List" button
- **Solution**: Move padding to be beneath "Add List" button, creating space from "Visible Columns" title
- **Priority**: MEDIUM
- **Status**: 🔴 PENDING

### 3. 🔒 Lock "Edit Lists and Columns" Button Position
- **Issue**: Button moves when scrolling
- **Solution**: Fix button position to prevent movement during scroll
- **Priority**: MEDIUM
- **Status**: 🔴 PENDING
- **Notes**: 
  - Attempted sticky positioning but button still moves during scroll
  - Need to also lock "Inventory" text position along with the button
  - Both elements should be fixed in place relative to the table container

## 📝 **Phase 2: Form Functionality & Data Management**

### 4. 🛠️ Fix "Add Record" Form (Calibration & Maintenance)
- **Issue**: Storage bucket creation error - row-level security policy violation
- **Error**: `StorageApiError: new row violates row-level security policy`
- **Solution**: Fix Supabase storage permissions and RLS policies
- **Priority**: CRITICAL
- **Status**: 🔴 PENDING
- **Notes**: 
  - Attempted fixes but storage errors still occurring
  - Need to investigate RLS policies and bucket creation further

### 5. ✏️ Enhance "Edit Item" Form
- **Issue 1**: Calibration Type not auto-selected with existing value
- **Issue 2**: File areas need better UX for uploaded documents
- **Solution**: 
  - Auto-populate Calibration Type field
  - Show uploaded file indicators (not just upload buttons)
  - Implement file replacement logic (delete old, upload new)
  - Ensure changes only apply to Edit form, not Add form
- **Priority**: HIGH
- **Status**: 🔴 PENDING
- **Notes**: 
  - Calibration Type auto-selection implemented but needs testing
  - File detection enhanced but may need further refinement

## 🚫 **Phase 3: Out-of-Service Functionality**

### 6. 🚫 Implement Out-of-Service System
- **Requirements**:
  - Create "Out of Service" list automatically on first out-of-service item
  - Pop-up window for date and reason input
  - Store info in item notes
  - Set calibration/maintenance dates to "N/A"
- **Priority**: HIGH
- **Status**: 🔴 PENDING

## 📊 **Phase 4: Data Export & Management**

### 7. 📈 Excel Export Functionality
- **Requirements**:
  - Export entire inventory to XLSX format
  - Option to choose which lists to include (all selected by default)
  - Bold column headers/row 1
  - Columns auto-fit to text content
  - Aesthetically pleasing template (if possible)
- **Priority**: MEDIUM
- **Status**: 🔴 PENDING

### 8. 🔄 Item Duplication System
- **Requirements**:
  - Duplicate button in action column ellipsis menu
  - Pre-fill "Add Item" form with existing item data
  - Duplicate calibration & maintenance instructions/templates
  - Do NOT duplicate calibration/maintenance records
  - Include "Duplicate?" checkbox on Add Item form
  - Chain duplication capability (duplicate from duplicate form)
- **Priority**: MEDIUM
- **Status**: 🔴 PENDING

## 🔍 **Phase 5: Search & Filtering**

### 9. 🔍 Implement Real-Time Search Functionality
- **Requirements**:
  - Filter inventory items based on search input
  - Real-time updates as user types (no need to hit enter)
  - Search across relevant fields
- **Priority**: MEDIUM
- **Status**: 🔴 PENDING

## 🧪 **Phase 6: Testing & Business Model**

### 10. 🧪 Comprehensive Testing
- **Requirements**:
  - Stress test all functionalities
  - Ensure application is fully usable for laboratory operations
  - Fix any bugs or issues discovered
- **Priority**: HIGH
- **Status**: 🔴 PENDING

### 11. 💼 Business Model Development
- **Requirements**:
  - Develop business model for selling the application
  - Pricing strategy
  - Marketing materials
  - Sales process
- **Priority**: LOW
- **Status**: 🔴 PENDING

---

## 🎯 **Current Focus**
Starting with **Phase 1** - fixing the UI/UX issues to ensure a solid foundation before building new features.

## 📊 **Progress Tracking**
- **Total Tasks**: 14
- **Completed**: 0
- **In Progress**: 0
- **Pending**: 13
- **Aborted**: 1
- **Completion**: 0%

---

## 🚨 **Phase 7: Critical Issues Discovered During Testing**

### 12. 🗄️ Fix Database Schema Mismatch (PGRST204 Error)
- **Issue**: `calibrationDate` column not found in `inventory_items` table schema
- **Error**: `"Could not find the 'calibrationDate' column of 'inventory_items' in the schema cache"`
- **Impact**: Prevents updating items from in-house to outsourced calibration
- **Solution**: Align database schema with application data model
- **Priority**: CRITICAL
- **Status**: 🔴 PENDING

### 13. 🔄 Fix Save Button Behavior After Errors
- **Issue**: "Save item" button changes to "Add item" button after update errors
- **Impact**: Creates duplicate items instead of updating existing ones
- **Solution**: Maintain button state and prevent duplicate item creation
- **Priority**: HIGH
- **Status**: 🔴 PENDING

### 14. 🟠 Orange Outsourced Tab Positioning (ABORTED)
- **Issue**: Orange tab on outsourced items should be fixed during scroll
- **Status**: ❌ ABORTED
- **Reason**: Unnecessary complexity - current border-left styling is sufficient
- **Notes**: User decided to keep simple border-left approach instead of complex positioning

---

*Last Updated: 2025-08-20*
*Next Review: After Phase 1 completion*
