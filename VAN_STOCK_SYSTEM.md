# Van Stock Management System

## Overview
The van stock system has been simplified to focus purely on quantity tracking and reconciliation, removing all price/monetary calculations to streamline the process.

## How It Works

### 1. Morning Stock Load
- **Van Stock Page**: `/admin/van-stock`
- Record the quantity of each item loaded into the van
- No prices needed - just quantities
- Save the daily load for each user

### 2. During the Day
- Sales are recorded normally through the sales system
- Each sale includes item name, quantity, and pricing
- Van stock system doesn't track prices - only quantities

### 3. End of Day Returns
- Update the "Returned" quantity for each item
- This represents unsold stock brought back

### 4. Reconciliation
- **Expected Sold** = Loaded - Returned
- **Actual Sold** = Sum of quantities from sales records
- **Difference** = Expected - Actual

## Key Features

### Simplified Data Model
```typescript
interface VanLoad {
  itemName: string;
  loaded: number;      // Quantity loaded in morning
  returned: number;    // Quantity returned at end of day
  // No unitPrice field - removed for simplicity
}
```

### Reconciliation Logic
```
Expected Sales = Loaded Quantity - Returned Quantity
Actual Sales = Sum of all sale quantities for the day
Difference = Expected Sales - Actual Sales
```

### Status Indicators
- **✓ (Green)**: Perfect match (difference = 0)
- **−X (Red)**: Missing stock (positive difference = potential loss)
- **+X (Blue)**: Extra sales recorded (negative difference = data entry error)

## User Interface

### Van Stock Management
- Select user and date
- Add items with loaded/returned quantities
- Real-time reconciliation table
- Visual indicators for discrepancies

### Stock Reconciliation Reports
- Generate detailed reconciliation reports
- Compare expected vs actual sales
- Identify quantity discrepancies
- Export capabilities for record keeping

## Benefits

### Simplified Workflow
1. **No Price Tracking**: Focus only on quantities
2. **Easy Data Entry**: Just loaded and returned numbers
3. **Clear Reconciliation**: Simple quantity matching
4. **Quick Identification**: Spot discrepancies immediately

### Accurate Tracking
- **Quantity Focus**: Eliminates price confusion
- **Direct Comparison**: Stock vs sales quantities
- **Loss Detection**: Identify missing inventory
- **Data Validation**: Catch recording errors

## Example Workflow

### Morning (8:00 AM)
```
User: John
Date: 2024-04-26
Items:
- NP-250ml: Loaded 50, Returned 0
- NP-600ml: Loaded 30, Returned 0
- Joiner: Loaded 100, Returned 0
```

### End of Day (6:00 PM)
```
Update returns:
- NP-250ml: Loaded 50, Returned 5
- NP-600ml: Loaded 30, Returned 3
- Joiner: Loaded 100, Returned 20
```

### Reconciliation
```
Expected Sales:
- NP-250ml: 50 - 5 = 45
- NP-600ml: 30 - 3 = 27
- Joiner: 100 - 20 = 80

Actual Sales (from sales records):
- NP-250ml: 43 (2 missing)
- NP-600ml: 27 (perfect match)
- Joiner: 82 (+2 extra recorded)

Result: Need to investigate 2 missing NP-250ml and 2 extra joiners
```

## API Endpoints

### Van Load Management
- `GET /api/van-load?userId=X&date=Y` - Get loads for user/date
- `POST /api/van-load` - Save daily loads (no unitPrice)
- `PUT /api/van-load` - Update return quantities

### Stock Reconciliation
- `GET /api/stock-reconciliation?userId=X&date=Y` - Generate reconciliation report

## Database Changes
- Removed `unitPrice` field from `VanLoad` model
- Simplified data structure focuses on quantities only
- Existing sales data unchanged (still includes pricing)

This simplified system makes van stock management more straightforward while maintaining accurate tracking and reconciliation capabilities.