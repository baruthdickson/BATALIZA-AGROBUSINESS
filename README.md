# 🌾 BATALIZA AGROBUSINESS - Mfumo wa Usimamizi

Mfumo wa kibiashara wa kisasa wa usimamizi wa shamba na kampuni — sawa na **QuickBooks** lakini umelenga shughuli za kilimo.

## ✨ Vipengele Vipya

- 🌳 **Hierarchical Budget** — Master Budget → Shughuli → Sub-categories → Line Items (auto-calculate)
- 📊 **Chart of Accounts** — QuickBooks-style accounting structure
- 📒 **Journal Entries** — Double-entry bookkeeping
- 🧾 **Invoices** — Customer billing
- 🔐 **Multi-tier auth** — Admin → PM → Sub-users
- 📤 **Export**: CSV, Excel, PDF kwa kila ripoti
- 📱 **Mobile responsive**

## 📁 Muundo

```
mashamba/
├── index.html              ← Login (na logo)
├── admin.html              ← System Admin Dashboard
├── dashboard.html          ← PM Dashboard
├── budget.html             ← Bajeti Hierarchical (mpya!)
├── expenses.html           ← Matumizi
├── hr.html                 ← Wafanyakazi
├── field-activities.html   ← Shughuli za Shamba
├── payroll.html            ← Mishahara
├── inventory.html          ← Stoo
├── fleet.html              ← Magari
├── reports.html            ← Ripoti
├── users.html              ← Watumiaji (PM)
├── settings.html           ← Mipangilio
├── setup-check.html        ← Diagnostic
├── assets/logo.jpg         ← Logo ya BATALIZA
├── css/styles.css          ← Modern theme
├── js/
│   ├── config.js, supabase.js, auth.js, layout.js, utils.js
│   └── pages/ (12 modules)
└── sql/
    ├── 01_schema.sql
    ├── 02_rls_policies.sql
    ├── 03_seed_data.sql
    ├── 00_master_setup.sql (run after auth user)
    ├── 04_budget_data.sql
    └── 05_hierarchical_budget.sql (mpya - QuickBooks features)
```

## 🚀 Setup ya Update (Kama Mfumo Tayari Uko Online)

Mfumo wako tayari uko online. Ili kupata vipengele vipya, fanya hivi:

### 1. Endesha SQL ya Hierarchical Budget
Supabase → SQL Editor → endesha `sql/05_hierarchical_budget.sql`

Hii inaongeza:
- `parent_id` kwenye budget_items (kuwa hierarchical)
- `item_type` (header au leaf)
- `chart_of_accounts` table (QuickBooks-style)
- `journal_entries` + `journal_lines` tables
- `invoices` + `invoice_items` tables

### 2. Replace Local Files
Unzip mpya, replace files zote za local zako, kisha **re-deploy** kwenye Netlify (drag & drop folder mpya).
URL inabaki ile ile. ✅

### 3. Test
- Login: utaonyesha logo na **BATALIZA AGROBUSINESS**
- Nenda Bajeti: utaona tree view
- Bofya "+ Shughuli" → ongeza shughuli mpya (LSF, CCP)
- Ndani ya shughuli, bofya ➕ → ongeza Group (Bustani)
- Ndani ya Group, bofya ➕ → ongeza Line Items (Kusafisha 50,000, Kulima 100,000...)
- Jumla inahesabiwa **automatic** kutoka chini kwenda juu

## 📐 Mfano wa Muundo wa Bajeti

```
📁 LSF - Shughuli za LSF (Activity)
   📂 Bustani (Group)
      📄 Kusafisha Shamba .... 50,000
      📄 Kulima ............. 100,000
      📄 Kupanda ............ 100,000
      📄 Kuweka Mbolea ....... 50,000
      📄 Kupalilia 1 ......... 50,000
      📄 Kupalilia 2 ......... 50,000
      ════════════════════════════════
      JUMLA: 400,000 (auto)
   📂 Mauzo (Group)
      📄 Kupakia .............. 30,000
      📄 Usafirishaji ........ 70,000
      ════════════════════════════════
      JUMLA: 100,000 (auto)
   ════════════════════════════════════
   JUMLA YA LSF: 500,000 (auto)
```

## 🎨 Vipengele vya UI

- ✅ Logo ya BATALIZA AGROBUSINESS kwenye kila page
- ✅ Modern gradient buttons na cards
- ✅ Hover effects + smooth animations
- ✅ Color-coded progress bars (kijani/njano/nyekundu)
- ✅ Tree view na expand/collapse
- ✅ Professional money formatting
- ✅ Better tables na badges

## 🔍 Tatizo Lolote?

Fungua `/setup-check.html` — itakuonyesha kinacho-kosea na suluhisho.

