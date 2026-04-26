# Export Features Documentation

## Overview
The Sales Tracker now includes comprehensive export functionality for bills and sales data. Admins can export data in multiple formats with various filtering options.

## Export Formats

### 1. Excel Export (.xlsx)
- **Multiple Worksheets**: Summary, Detailed Sales, Bills Summary
- **Formatted Data**: Currency formatting, auto-sized columns
- **Summary Statistics**: Total revenue, payment method breakdowns, user statistics
- **Professional Layout**: Headers, styling, and organized data presentation

### 2. CSV Export (.csv)
- **Simple Format**: Raw data in comma-separated values
- **Universal Compatibility**: Can be opened in any spreadsheet application
- **All Fields Included**: Complete sales data with timestamps
- **Lightweight**: Smaller file size for large datasets

### 3. PDF Reports (.pdf)
Three different report types:
- **Summary Report**: User-wise sales summary with totals
- **Detailed Report**: Complete transaction-level data
- **Bills Summary**: Grouped by bill number with item counts

## Access Points

### 1. Admin Dashboard
- **Quick Export Dropdown**: Located in the bills section header
- **One-Click Export**: Instant download of current view data
- **Multiple Formats**: Excel, CSV, and PDF options available

### 2. Dedicated Export Page
- **Advanced Filtering**: Date range, user selection
- **Multiple Report Types**: Choose specific PDF report formats
- **Batch Operations**: Export large datasets with custom filters

## API Endpoints

### Excel/CSV Export
```
GET /api/export/bills?format=excel&startDate=2024-01-01&endDate=2024-12-31&userId=123
```

### PDF Export
```
GET /api/export/bills-pdf?type=summary&startDate=2024-01-01&endDate=2024-12-31&userId=123
```

## Features

### Data Included
- Bill numbers and dates
- User information (username, name)
- Item details (name, quantity, unit price, total)
- Payment methods
- Timestamps (creation date/time)
- Summary statistics

### Filtering Options
- **Date Range**: Start and end date filtering
- **User Selection**: Export data for specific users
- **Payment Method**: Filter by cash, cheque, or credit (in UI filters)

### File Naming
- **Automatic Naming**: Files include export date
- **Format Indicators**: Clear file extensions
- **Descriptive Names**: Include report type and date

## Usage Examples

### Quick Export from Dashboard
1. Navigate to Admin Dashboard
2. Use search/filter to narrow down data
3. Click "Quick Export" dropdown
4. Select desired format
5. File downloads automatically

### Advanced Export with Filters
1. Go to Admin → Export Reports
2. Set date range (optional)
3. Select specific user (optional)
4. Choose export format
5. Click download button
6. File generates and downloads

### PDF Report Types
- **Summary**: Best for management overview
- **Detailed**: Complete audit trail
- **Bills**: Customer-focused bill summaries

## Technical Details

### Dependencies
- **ExcelJS**: Excel file generation
- **jsPDF**: PDF creation
- **jsPDF-AutoTable**: PDF table formatting

### Performance
- **Streaming**: Large datasets handled efficiently
- **Memory Management**: Optimized for server resources
- **Client-Side Processing**: File generation on server, download on client

### Security
- **Admin Only**: Export functionality restricted to admin users
- **Session Validation**: Proper authentication required
- **Data Sanitization**: All exported data is properly formatted

## File Structure
```
src/
├── app/
│   ├── api/
│   │   └── export/
│   │       ├── bills/route.ts          # Excel/CSV export
│   │       └── bills-pdf/route.ts      # PDF export
│   └── admin/
│       └── export/page.tsx             # Export interface
└── components/
    └── quick-export-dropdown.tsx       # Quick export component
```

## Future Enhancements
- Email export functionality
- Scheduled exports
- Custom report templates
- Data visualization exports
- Integration with external systems