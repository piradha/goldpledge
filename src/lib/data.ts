
import type { LucideIcon } from 'lucide-react';
import { Scale, Banknote, CalendarPlus, ClipboardList, TriangleAlert } from 'lucide-react';
import type { Pledge, Customer } from './types';

export type Metric = {
  icon: LucideIcon;
  label: string;
  value: string;
  change?: string;
};

export const dashboardMetrics: Metric[] = [
  { icon: Scale, label: 'Total Gold Pledged', value: '45.87 Grams' },
  { icon: Banknote, label: 'Total Pledge Amount', value: '₹14,56,000', change: '+5.2% from last month' },
  { icon: CalendarPlus, label: 'Today\'s New Pledges', value: '12' },
  { icon: ClipboardList, label: 'Pending Releases', value: '6' },
  { icon: TriangleAlert, label: 'Overdue Accounts', value: '3' },
];

export const monthlyRevenue = [
  { month: 'Jan', revenue: 180000 },
  { month: 'Feb', revenue: 210000 },
  { month: 'Mar', revenue: 250000 },
  { month: 'Apr', revenue: 230000 },
  { month: 'May', revenue: 290000 },
  { month: 'Jun', revenue: 320000 },
];

export const pledgeReleaseTrends = [
  { date: 'Jan', pledges: 24, releases: 10 },
  { date: 'Feb', pledges: 18, releases: 12 },
  { date: 'Mar', pledges: 32, releases: 15 },
  { date: 'Apr', pledges: 28, releases: 20 },
  { date: 'May', pledges: 45, releases: 25 },
  { date: 'Jun', pledges: 38, releases: 18 },
];

export const customers: Omit<Customer, 'id'>[] = [
    { name: 'Arjun Sharma', fatherName: 'Rajesh Sharma', mobileNumber: '+91 9876543210', aadharNumber: '1234 5678 9012', address: "123 MG Road, Bangalore", photoUrl: 'https://picsum.photos/seed/cust1/100/100', notes: '' },
    { name: 'Priya Patel', fatherName: 'Mahesh Patel', mobileNumber: '+91 9876543211', aadharNumber: '2345 6789 0123', address: "456 Park Street, Mumbai", photoUrl: 'https://picsum.photos/seed/cust2/100/100', notes: '' },
    { name: 'Rohan Mehta', fatherName: 'Suresh Mehta', mobileNumber: '+91 9876543212', aadharNumber: '3456 7890 1234', address: "789 Gandhi Nagar, Delhi", photoUrl: 'https://picsum.photos/seed/cust3/100/100', notes: '' },
    { name: 'Sneha Reddy', fatherName: 'Anil Reddy', mobileNumber: '+91 9876543213', aadharNumber: '4567 8901 2345', address: "101 Jubilee Hills, Hyderabad", photoUrl: 'https://picsum.photos/seed/cust4/100/100', notes: '' },
];

export const pledges: Pledge[] = [];

    
