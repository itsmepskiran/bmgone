# Questions Management System - Architecture Guide

## Overview

The health insurance comparison tool now uses a **database-driven questions management system**. Questions are no longer hardcoded - they're stored in the database and managed through a dedicated admin interface.

---

## Architecture

### **1. Admin Page** (`questions-admin.html`)
**Purpose:** Manage all 47 questions and their responses for each provider

**Access:** Only managers/admin users (manager+)

**Features:**
- ✅ View all questions (active and hidden)
- ✅ Add new questions
- ✅ Edit existing questions
- ✅ Hide/Show questions (no permanent delete)
- ✅ Display Y/N/E responses for all 5 providers (AB, ICICI, Star, Care, Tata)

**UI:**
- Table view with all questions
- Modal form for add/edit
- Provider response grid (5 columns)
- Status badge (Active/Hidden)

---

### **2. Comparison Page** (`compare.html`)
**Purpose:** Staff uses this to create client-specific comparisons

**Access:** All staff members

**Changes from before:**
- ❌ REMOVED "Fill Data" button (no longer managing questions here)
- ❌ REMOVED "Save/Load" button (data persists in database)
- ✅ KEPT "Quick Fill" (for client details)
- ✅ KEPT "Select Providers" (for filtering providers)
- ✅ KEPT "Print/PDF" (for exporting)
- ✅ KEPT "Exit" (to go back)

**Data Flow:**
1. Staff fills in Quick Fill (client name, age, members, PEDs, premiums)
2. Table displays ONLY active questions from database
3. Staff fills in client-specific answers (Y/N/E)
4. Staff saves comparison to database
5. Data persists automatically

---

### **3. Database Schema**

**Tables Used:**

#### `comparison_features` (Questions)
```
- feature_id (TEXT, PK)
- feature_label (TEXT) - The question text
- section_id (TEXT, FK) - Which section/tier
- is_active (BOOLEAN) - Show/Hide flag
- sort_order (INTEGER)
- created_at, updated_at (TIMESTAMP)
```

#### `comparison_values` (Y/N/E Responses)
```
- feature_id (TEXT, FK) - Links to comparison_features
- brand_id (TEXT, FK) - 'ab', 'ic', 'star', 'care', 'tata'
- value_type (TEXT) - 'Y', 'N', or 'E'
- notes (TEXT) - Extra details like 'Add-on', 'Upto SI'
- UNIQUE(feature_id, brand_id)
```

#### `comparison_brands` (Providers)
```
- brand_id (TEXT, PK) - 'ab', 'ic', 'star', 'care', 'tata'
- brand_name (TEXT) - 'Aditya Birla', 'ICICI Lombard', etc.
- plan_name (TEXT) - 'Activ One Max', 'Elevate', etc.
- is_active (BOOLEAN) - Can show/hide providers
- sort_order (INTEGER)
```

---

## API Endpoints

### **Admin - Questions Management**

#### `GET /api/comparison/questions/all`
**Purpose:** Get ALL questions (active + hidden) with their provider responses
**Access:** Manager+ only
**Response:**
```json
{
  "success": true,
  "questions": [
    {
      "feature_id": "inpatient",
      "feature_label": "In-patient Treatment",
      "section_id": "tier1",
      "is_active": 1,
      "sort_order": 1,
      "values": {
        "ab": "Y",
        "ic": "Y",
        "star": "Y",
        "care": "Y",
        "tata": "Y"
      }
    }
  ]
}
```

#### `POST /api/comparison/questions`
**Purpose:** Add or update a question
**Access:** Manager+ only
**Request Body:**
```json
{
  "feature_id": "roomrent",  // Optional - if omitted, creates new
  "feature_label": "No Room Rent Capping",
  "section_id": "tier1",
  "values": {
    "ab": "Y",
    "ic": "N",
    "star": "Y",
    "care": "E",
    "tata": "Y"
  }
}
```

#### `POST /api/comparison/questions/toggle`
**Purpose:** Hide or show a question
**Access:** Manager+ only
**Request Body:**
```json
{
  "feature_id": "inpatient",
  "is_active": false  // true = show, false = hide
}
```

---

## Workflow Example

### **Manager: Adding a New Question**
1. Log in as manager/admin
2. Go to `questions-admin.html`
3. Click "➕ Add New Question"
4. Fill in:
   - Question: "Worldwide Coverage Option"
   - Section: "TIER 6 — SPECIAL / UNIQUE"
   - Provider responses: AB=N, ICICI=Y, Star=N, Care=N, Tata=N
5. Click "Save Question"
6. Automatically saved to database
7. Appears in compare.html immediately

### **Manager: Hiding a Question**
1. On admin page, find the question
2. Click "Hide" button
3. Question disappears from compare.html (but not deleted)

### **Manager: Showing a Hidden Question**
1. Hidden questions still appear in admin page with "Hidden" badge
2. Click "Show" button
3. Question appears back in compare.html

### **Staff: Using Compare Tool**
1. Log in as staff
2. Go to `compare.html`
3. Enter Quick Fill data (client details)
4. See only ACTIVE questions in the table
5. Answer for each provider (Y/N/E)
6. Add comments if needed
7. Click "Apply & Update Instantly"
8. Data auto-syncs to table
9. Can print/export as PDF
10. Can select specific providers to show

---

## Key Differences from Old System

| Aspect | Old System | New System |
|--------|-----------|-----------|
| Questions stored | Hardcoded in HTML | Database table |
| Adding questions | Edit HTML code | Admin UI form |
| Question management | Reload page manually | Real-time updates |
| Hiding questions | Delete from code | Soft-delete toggle (is_active flag) |
| Compare page | Had "Fill Data" section | No "Fill Data" - cleaner UI |
| Save/Load | Export/Import code | Database persistence |
| Provider responses | Hardcoded in code | Managed in admin page |

---

## Security & Access Control

- **Admin page:** Manager+ only (role check in backend)
- **Endpoints:** Authentication required, role-based access
- **Data:** Only authenticated users can access
- **No permanent deletion:** Questions are hidden, not deleted (audit trail intact)

---

## Next Steps

1. **Test the admin page** - Add/edit/hide questions
2. **Test compare.html** - Verify it shows only active questions
3. **Test API endpoints** - Verify authentication and data flow
4. **Deploy to production** - Update DNS/infrastructure as needed
5. **Train managers** - Show how to use the admin interface

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Check backend logs at Cloudflare Workers
3. Verify database has comparison_features table
4. Verify user has correct role (manager+)
5. Check localStorage for authentication token

---

*Last Updated: 2026-06-15*
