# Admin Analytics Features

## Overview
Added comprehensive sales analytics functionality for admins to view total sales per user and overall sales statistics.

## New Features

### 1. Analytics Dashboard (`/admin/analytics`)
A dedicated analytics page that provides:

#### Summary Cards
- **Total Revenue**: Overall revenue across all users
- **Total Sales**: Total number of individual sales items
- **Active Users**: Number of users who have made sales
- **Average per User**: Average revenue per active user

#### User Sales Analysis
- **Ranked User List**: Users sorted by total sales amount (highest first)
- **Detailed User Metrics** for each user:
  - Total sales count
  - Total revenue amount
  - Number of unique bills
  - Average bill value
  - Payment method breakdown (Cash, Cheque, Credit)
  - Recent sales history (last 5 sales)

#### Filtering & Sorting
- **Date Range Filter**: Filter sales by start and end date
- **User Search**: Search for specific users by username
- **Sort Options**: Sort by total amount, total sales, or total bills
- **Expandable Details**: Click on any user to see detailed breakdown

### 2. Enhanced Admin Dashboard
Updated the main admin dashboard (`/admin`) with:
- **Total Users Card**: Shows number of active sellers
- **"View Detailed Analytics" Button**: Quick access to the analytics page
- **"View All" Link**: In the Top Sellers section to navigate to analytics

### 3. New API Endpoint
Created `/api/admin/user-sales` that provides:
- Efficient user sales data aggregation
- Date filtering support
- Optimized database queries
- Comprehensive user statistics

## Navigation
- Added "Analytics" to the admin navigation menu
- Accessible via the TrendingUp icon in the sidebar (when enabled)
- Direct links from the main dashboard

## Key Benefits

### For Admins
1. **Performance Tracking**: See which users are top performers
2. **Revenue Analysis**: Understand revenue distribution across users
3. **Payment Method Insights**: See preferred payment methods per user
4. **Time-based Analysis**: Filter data by date ranges
5. **Quick Overview**: Summary cards provide instant insights

### Technical Benefits
1. **Optimized Performance**: Dedicated API endpoint for efficient data retrieval
2. **Scalable Design**: Handles large datasets efficiently
3. **Real-time Data**: Always shows current sales data
4. **Responsive Design**: Works on all screen sizes

## Usage

### Accessing Analytics
1. Login as an admin
2. Navigate to "Analytics" in the navigation menu
3. Or click "View Detailed Analytics" from the main dashboard

### Using Filters
1. **Date Range**: Set start and/or end dates to filter sales
2. **User Search**: Type username to find specific users
3. **Sorting**: Use dropdown to sort by amount, sales count, or bill count
4. **Clear Filters**: Reset all filters with one click

### Viewing User Details
1. Click on any user row to expand details
2. View payment method breakdown
3. See recent sales history
4. Collapse by clicking again

## Data Shown

### Per User
- Username and ranking
- Total sales amount
- Number of individual sales
- Number of unique bills
- Average bill value
- Payment method distribution
- Recent sales with details

### Overall Summary
- Total revenue across all users
- Total number of sales
- Number of active users
- Average revenue per user

## Security
- Only accessible to admin users
- Proper permission checks via middleware
- Secure API endpoints with role validation