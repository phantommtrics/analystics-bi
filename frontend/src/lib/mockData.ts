export const dashboardKpis = [
  {
    id: '1',
    label: 'Total System Float',
    value: 45250000.0,
    trend: 2.4,
    isCurrency: true,
    icon: 'ti-building-bank',
  },
  {
    id: '2',
    label: 'Daily Transaction Volume',
    value: 12450,
    trend: 5.2,
    isCurrency: false,
    icon: 'ti-activity',
  },
  {
    id: '3',
    label: 'Fee Revenue (Today)',
    value: 345000.5,
    trend: -1.2,
    isCurrency: true,
    icon: 'ti-receipt',
  },
  {
    id: '4',
    label: 'Active Agents',
    value: 1240,
    trend: 0.5,
    isCurrency: false,
    icon: 'ti-users',
  },
]

export const dailyTransactionsChart = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  series: [
    { name: 'Send Money', data: [4500, 5200, 4800, 6100, 5900, 7200, 6800] },
    { name: 'Cash In', data: [3200, 3100, 3500, 3800, 4100, 4500, 4200] },
    { name: 'Cash Out', data: [2800, 2900, 3100, 3400, 3600, 4100, 3900] },
  ],
}

export const feeRevenuePie = [
  { name: 'Send Money Fees', value: 450000 },
  { name: 'Remittance Comm.', value: 320000 },
  { name: 'Cash Out Fees', value: 180000 },
  { name: 'Merchant Fees', value: 95000 },
]

export const topAgents = [
  {
    id: 'A001',
    name: 'Modou Jallow',
    location: 'Serekunda',
    volume: 1250000,
    txCount: 450,
    status: 'active',
  },
  {
    id: 'A002',
    name: 'Fatoumatta Ceesay',
    location: 'Banjul',
    volume: 980000,
    txCount: 380,
    status: 'active',
  },
  {
    id: 'A003',
    name: 'Brikama Superstore',
    location: 'Brikama',
    volume: 850000,
    txCount: 310,
    status: 'active',
  },
  {
    id: 'A004',
    name: 'Alieu Bah',
    location: 'Bakau',
    volume: 720000,
    txCount: 290,
    status: 'warning',
  },
  {
    id: 'A005',
    name: 'Kairaba Enterprise',
    location: 'Fajara',
    volume: 650000,
    txCount: 210,
    status: 'active',
  },
]

export const reportsCatalog = [
  {
    id: 'r1',
    title: 'Daily Transaction Summary',
    category: 'Financial',
    role: 'Finance Admin',
    frequency: 'Daily',
    format: 'Excel',
    color: 'blue',
  },
  {
    id: 'r2',
    title: 'Agent Performance Matrix',
    category: 'Agent',
    role: 'Master Agent',
    frequency: 'Weekly',
    format: 'PDF',
    color: 'purple',
  },
  {
    id: 'r3',
    title: 'AML Alert Report',
    category: 'Compliance',
    role: 'Compliance',
    frequency: 'Real-time',
    format: 'CSV',
    color: 'green',
  },
  {
    id: 'r4',
    title: 'System Cumulative Balance',
    category: 'Financial',
    role: 'Super Admin',
    frequency: 'Live',
    format: 'Excel',
    color: 'blue',
  },
  {
    id: 'r5',
    title: 'Remittance Corridor Volume',
    category: 'Operational',
    role: 'Finance Admin',
    frequency: 'Monthly',
    format: 'PDF',
    color: 'gold',
  },
  {
    id: 'r6',
    title: 'Merchant Settlement',
    category: 'Financial',
    role: 'Finance Admin',
    frequency: 'Daily',
    format: 'CSV',
    color: 'blue',
  },
  {
    id: 'r7',
    title: 'Inactive Customers',
    category: 'Operational',
    role: 'Agent',
    frequency: 'Monthly',
    format: 'Excel',
    color: 'gold',
  },
  {
    id: 'r8',
    title: 'Suspicious Velocity',
    category: 'Compliance',
    role: 'Compliance',
    frequency: 'Daily',
    format: 'PDF',
    color: 'green',
  },
]

interface StatementRow {
  id: string
  label: string
  current?: number
  previous?: number
  variance?: number
  isHeader?: boolean
  isSubtotal?: boolean
  isTotal?: boolean
}

export const plStatement: StatementRow[] = [
  { id: 'inc', label: 'INCOME', isHeader: true },
  {
    id: 'i1',
    label: 'Send Money Fees',
    current: 1250000,
    previous: 1100000,
    variance: 13.6,
  },
  {
    id: 'i2',
    label: 'International Remittance Commission',
    current: 850000,
    previous: 820000,
    variance: 3.6,
  },
  {
    id: 'i3',
    label: 'Bank2Wallet Fees',
    current: 320000,
    previous: 280000,
    variance: 14.2,
  },
  {
    id: 'i4',
    label: 'Wallet2Bank Fees',
    current: 410000,
    previous: 450000,
    variance: -8.8,
  },
  {
    id: 'i5',
    label: 'Merchant Charge Fees',
    current: 180000,
    previous: 150000,
    variance: 20.0,
  },
  {
    id: 't_inc',
    label: 'Total Income',
    current: 3010000,
    previous: 2800000,
    variance: 7.5,
    isSubtotal: true,
  },
  { id: 'exp', label: 'EXPENSES', isHeader: true },
  {
    id: 'e1',
    label: 'Agent Commissions',
    current: 850000,
    previous: 780000,
    variance: 8.9,
  },
  {
    id: 'e2',
    label: 'Airtime Cashback (1%)',
    current: 120000,
    previous: 115000,
    variance: 4.3,
  },
  {
    id: 'e3',
    label: 'Customer Referral Bonuses',
    current: 45000,
    previous: 60000,
    variance: -25.0,
  },
  {
    id: 'e4',
    label: 'SMS Gateway Fees',
    current: 85000,
    previous: 82000,
    variance: 3.6,
  },
  {
    id: 't_exp',
    label: 'Total Expenses',
    current: 1100000,
    previous: 1037000,
    variance: 6.0,
    isSubtotal: true,
  },
  {
    id: 'net',
    label: 'NET PROFIT',
    current: 1910000,
    previous: 1763000,
    variance: 8.3,
    isTotal: true,
  },
]

export const systemBalanceData = [
  {
    label: 'Customer Float',
    value: 28500000,
    percentage: 63,
    color: 'brand-blue',
  },
  {
    label: 'Agent Float',
    value: 12400000,
    percentage: 27,
    color: 'brand-gold',
  },
  {
    label: 'Trust Account',
    value: 4350000,
    percentage: 10,
    color: 'semantic-green',
  },
]

export const balanceTrendChart = {
  labels: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
  series: [
    {
      name: 'Total Float',
      data: [44.1, 44.3, 44.8, 45.1, 45.0, 45.2, 45.25],
    },
  ],
}
