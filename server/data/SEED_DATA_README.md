# Bulk Data Import Guide

This guide explains how to bulk import rejection reasons and MSA markets into your production database.

## 📋 **Overview**

Instead of manually adding 25 rejection reasons and 232 MSA markets one-by-one, you can:
1. Edit JSON seed files with all your data
2. Call a single API endpoint to import everything

---

## 🚀 **Quick Start**

### **Option 1: Import Everything at Once**

```bash
curl -X POST https://landlinq.ai/api/seed/all \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json"
```

**This imports:**
- ✅ All 25 rejection reasons
- ✅ All MSA markets

---

### **Option 2: Import Separately**

**Import just rejection reasons:**
```bash
curl -X POST https://landlinq.ai/api/seed/rejection-reasons \
  -H "Cookie: your-session-cookie"
```

**Import just MSA markets:**
```bash
curl -X POST https://landlinq.ai/api/seed/msa-markets \
  -H "Cookie: your-session-cookie"
```

---

## 📁 **Seed Data Files**

### **1. Rejection Reasons** (`rejection-reasons-seed.json`)

Current structure:
```json
[
  {
    "category": "Size & Density",
    "reason": "Property too small (under 4 acres)",
    "isActive": true,
    "sortOrder": 1
  }
]
```

**Categories:**
- Size & Density
- Location
- Financial
- Site Conditions
- Zoning & Entitlements
- Infrastructure
- Other

**To add more:**
1. Open `server/data/rejection-reasons-seed.json`
2. Add new entries with the same structure
3. Run the import endpoint

---

### **2. MSA Markets** (`msa-markets-seed.json`)

Current structure:
```json
[
  {
    "msaName": "Charlotte-Concord-Gastonia, NC-SC",
    "county": "Mecklenburg",
    "state": "NC",
    "productTypes": ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"]
  }
]
```

**Product Types:**
- Active Adult
- BTR
- Conventional Apartments
- Lot Development
- Affordable

**To add all 232 markets:**
1. Open `server/data/msa-markets-seed.json`
2. Add all your markets following the structure above
3. Each county needs its own entry
4. Run the import endpoint

**Example - Multiple Counties in Same MSA:**
```json
[
  {
    "msaName": "Charlotte-Concord-Gastonia, NC-SC",
    "county": "Mecklenburg",
    "state": "NC",
    "productTypes": ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"]
  },
  {
    "msaName": "Charlotte-Concord-Gastonia, NC-SC",
    "county": "Cabarrus",
    "state": "NC",
    "productTypes": ["Active Adult", "BTR", "Lot Development"]
  },
  {
    "msaName": "Charlotte-Concord-Gastonia, NC-SC",
    "county": "Union",
    "state": "NC",
    "productTypes": ["BTR", "Lot Development"]
  }
]
```

---

## 🔒 **Security**

- **SUPER_ADMIN only** - Only your account (jack@catalystcp.com) can run these imports
- **Safe to re-run** - Duplicate MSAs will be skipped
- **Rejection reasons override** - Each import replaces the previous rejection reasons list

---

## ✅ **Check Status**

Before importing, check what data already exists:

```bash
curl https://landlinq.ai/api/seed/status \
  -H "Cookie: your-session-cookie"
```

**Response:**
```json
{
  "success": true,
  "status": {
    "rejectionReasons": {
      "exists": true,
      "count": 25
    },
    "msaMarkets": {
      "exists": true,
      "count": 10
    }
  }
}
```

---

## 📝 **Example Workflow**

### **Step 1: Edit the seed files**

Add all 232 MSA markets to `msa-markets-seed.json`:

```json
[
  {"msaName": "Charlotte-Concord-Gastonia, NC-SC", "county": "Mecklenburg", "state": "NC", "productTypes": ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"]},
  {"msaName": "Dallas-Fort Worth-Arlington, TX", "county": "Dallas", "state": "TX", "productTypes": ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"]},
  {"msaName": "Atlanta-Sandy Springs-Roswell, GA", "county": "Fulton", "state": "GA", "productTypes": ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"]},
  ... (add all 232)
]
```

### **Step 2: Commit and publish**

```bash
# Your seed files are in the codebase, so they deploy with the app
Click "Publish" in Replit
```

### **Step 3: Run the import**

After publishing, open your browser:
1. Go to https://landlinq.ai
2. Log in as jack@catalystcp.com
3. Open Developer Console (F12)
4. Run:

```javascript
fetch('/api/seed/all', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

**OR** use curl with your session cookie.

---

## 🎯 **Result**

```json
{
  "success": true,
  "message": "All data imported successfully",
  "results": {
    "rejectionReasons": {
      "success": true,
      "count": 25
    },
    "msaMarkets": {
      "success": true,
      "imported": 232,
      "skipped": 0
    }
  }
}
```

**Now you can:**
- ✅ Use rejection reasons in the Outreach Management tab
- ✅ Search MSAs on the public criteria page
- ✅ Auto-classify deals based on target markets

---

## 💡 **Tips**

1. **No duplicates** - If you run the import twice, existing MSAs are skipped
2. **Update anytime** - Edit the JSON files and re-run the import
3. **Backup first** - Check `/api/seed/status` before importing to see existing data
4. **Test locally** - Run imports in development before production

---

## 🆘 **Need Help?**

- **Can't authenticate?** Make sure you're logged in as SUPER_ADMIN (jack@catalystcp.com)
- **Import failed?** Check the logs in Replit Deployments → Logs
- **Data not showing?** Refresh the page and clear cache
