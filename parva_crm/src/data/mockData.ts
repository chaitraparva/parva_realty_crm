import type { Employee, Lead, PayrollRecord, AttendanceRecord, LeaveRequest, Flag, Notification, Activity, Message, Project, Unit, SiteVisit, CallLog, InternalEmail, Group, GroupMessage, AuditEntry, EscalationRequest, CalendarEvent } from '../types'

export const employees: Employee[] = [
  // Super Admin / Director
  {
    id: 'emp-chaitra',
    name: 'Chaitra',
    role: 'admin',
    office: 'Bangalore',
    email: 'chaitra@parvarealty.ae',
    phone: '',
    team: 'Leadership',
    joinDate: '2023-01-01',
    status: 'active',
    department: 'Executive',
    leadsAssigned: 0,
    conversions: 0,
    baseSalary: 0,
    responseTime: 'N/A',
    capacityLimit: 999,
  },
  // Bangalore — Marketing & Business Development Associates (report to Chaitra)
  {
    id: 'emp-nagesh',
    name: 'Nagesh N',
    role: 'manager',
    office: 'Bangalore',
    email: 'nagesh@parvarealty.ae',
    phone: '7892347497',
    team: 'India Sales',
    managerId: 'emp-chaitra',
    joinDate: '2023-01-01',
    status: 'active',
    department: 'Marketing & Business Development',
    leadsAssigned: 0,
    conversions: 0,
    baseSalary: 0,
    responseTime: 'N/A',
    capacityLimit: 999,
    employeeId: 'PA230018',
  },
  {
    id: 'emp-deekshitha',
    name: 'Deekshitha M V',
    role: 'manager',
    office: 'Bangalore',
    email: 'deekshitha@parvarealty.ae',
    phone: '9880988655',
    team: 'India Sales',
    managerId: 'emp-chaitra',
    joinDate: '2023-01-01',
    status: 'active',
    department: 'Software Development',
    leadsAssigned: 0,
    conversions: 0,
    baseSalary: 0,
    responseTime: 'N/A',
    capacityLimit: 999,
  },
  {
    id: 'emp-vaishnavi',
    name: 'Vijaya Vaishnavi A',
    role: 'manager',
    office: 'Bangalore',
    email: 'vaishnavi@parvarealty.ae',
    phone: '8095565535',
    team: 'India Sales',
    managerId: 'emp-chaitra',
    joinDate: '2023-01-01',
    status: 'active',
    department: 'Marketing & Business Development',
    leadsAssigned: 0,
    conversions: 0,
    baseSalary: 0,
    responseTime: 'N/A',
    capacityLimit: 999,
    employeeId: 'PA230041',
  },
  // Dubai — Sales Managers (report to Chaitra)
  {
    id: 'emp-ajoy',
    name: 'Ajoy',
    role: 'manager',
    office: 'Dubai',
    email: 'ajoy@parvarealty.ae',
    phone: '971564227854',
    team: 'Dubai Sales',
    managerId: 'emp-chaitra',
    joinDate: '2023-01-01',
    status: 'active',
    department: 'Sales',
    leadsAssigned: 0,
    conversions: 0,
    baseSalary: 0,
    responseTime: 'N/A',
    capacityLimit: 999,
  },
  {
    id: 'emp-ankitha',
    name: 'Ankitha',
    role: 'manager',
    office: 'Dubai',
    email: 'ankita@parvarealty.ae',
    phone: '971564227855',
    team: 'Dubai Sales',
    managerId: 'emp-chaitra',
    joinDate: '2023-01-01',
    status: 'active',
    department: 'Sales',
    leadsAssigned: 0,
    conversions: 0,
    baseSalary: 0,
    responseTime: 'N/A',
    capacityLimit: 999,
  },
]

export const leads: Lead[] = []

export const payrollRecords: PayrollRecord[] = []

export const attendanceRecords: AttendanceRecord[] = []

export const leaveRequests: LeaveRequest[] = []

export const flags: Flag[] = []

export const messages: Message[] = []

export const notifications: Notification[] = []

export const projects: Project[] = [
  {
    id: 'proj-1',
    name: 'SAMANA South Haven',
    developer: 'SAMANA Developers',
    location: 'Dubai South',
    reraNumber: 'TBC',
    reraStatus: 'Registered',
    possessionDate: 'Q3 2027',
    totalUnits: 298,
    zone: 'Dubai South',
    propertyType: 'Apartment',
    unitTypes: 'Studio / 1BR',
    tier: 'Entry / Value',
    tagLabel: 'ENTRY',
    priceINR: '₹1.56 Cr',
    priceAED: 'From AED 599K',
    rentalYield: 8.4,
    appreciation: 7.8,
    minDeposit: '₹10L (AED 40K)',
    areaRange: '450 – 680 sq ft',
    completionQ: 'Q3 2027',
    floors: 22,
    bedrooms: 1,
    handoverQ: 'Q3 2027',
    views: 2143,
    standout: "Lower entry point in Dubai South — the Al Maktoum Airport growth corridor — with SAMANA's signature private-pool studios and flexible 1% monthly payment plan.",
    fullDescription: "SAMANA South Haven sits at the heart of Dubai South, the emirate's fastest-growing master-planned district anchored by Al Maktoum International Airport (set to become the world's largest). Designed with resort-inspired architecture, the development offers private-pool studios and 1BR apartments at one of the most accessible price points in Dubai.",
    amenities: ['Private Pool Studios', 'Rooftop Infinity Pool', 'Gym & Fitness Centre', 'Padel Court', "Children's Play Area", 'Retail Promenade', 'Smart Home Automation', 'Covered Parking', '24/7 Security', 'Concierge Service'],
    paymentPlan: [
      { label: 'On Booking', pct: '10' },
      { label: 'During Construction', pct: '60' },
      { label: 'On Handover', pct: '30' },
    ],
  },
  {
    id: 'proj-2',
    name: 'Auresta Tower',
    developer: 'Tiger Properties',
    location: 'Jumeirah Village Circle',
    reraNumber: 'TBC',
    reraStatus: 'Registered',
    possessionDate: 'Q2 2027',
    totalUnits: 212,
    zone: 'JVC',
    propertyType: 'Apartment',
    unitTypes: 'Studio / 1BR',
    tier: 'Entry / Value',
    tagLabel: 'HIGH YIELD',
    priceINR: '₹2.22 Cr',
    priceAED: '~AED 850K',
    rentalYield: 9.1,
    appreciation: 7.2,
    minDeposit: '₹10L (AED 40K)',
    areaRange: '480 – 750 sq ft',
    completionQ: 'Q2 2027',
    floors: 28,
    bedrooms: 1,
    handoverQ: 'Q2 2027',
    views: 1876,
    standout: "JVC delivers Dubai's consistently highest studio rental yields (9–10%). Tiger Properties brings a credible track record, and Auresta's price point keeps entry under ₹2.5 Cr.",
    fullDescription: "Auresta Tower by Tiger Properties occupies a premium corner in Jumeirah Village Circle — one of Dubai's most liquid rental markets. JVC's central location, proximity to Sheikh Mohammed Bin Zayed Road, and proven rental demand from young professionals and couples make it a natural choice for yield-focused investors.",
    amenities: ['Rooftop Pool & Terrace', 'Fully Equipped Gym', 'Co-working Lounge', "Kids' Pool", 'BBQ Area', 'Multipurpose Hall', 'Smart Access System', 'EV Charging Points', '24/7 Concierge', 'Retail on Ground Floor'],
    paymentPlan: [
      { label: 'On Booking', pct: '20' },
      { label: 'During Construction', pct: '40' },
      { label: 'On Handover', pct: '40' },
    ],
  },
  {
    id: 'proj-3',
    name: 'Serenz',
    developer: 'Danube Properties',
    location: 'Jumeirah Village Circle',
    reraNumber: 'TBC',
    reraStatus: 'Registered',
    possessionDate: 'Q4 2027',
    totalUnits: 340,
    zone: 'JVC',
    propertyType: 'Apartment',
    unitTypes: 'Studio / 1BR / 2BR',
    tier: 'Entry / Value',
    tagLabel: 'OFF-PLAN',
    priceINR: '₹2.87 Cr',
    priceAED: '~AED 1.10M',
    rentalYield: 8.8,
    appreciation: 7.5,
    minDeposit: '₹10L (AED 40K)',
    areaRange: '500 – 1,100 sq ft',
    completionQ: 'Q4 2027',
    floors: 25,
    bedrooms: 1,
    handoverQ: 'Q4 2027',
    views: 1654,
    standout: "Danube's brand carries genuine resale premium in Dubai — Serenz in JVC combines that developer credibility with flexible 1% payment plan and a strong yield story.",
    fullDescription: "Danube Properties has established itself as Dubai's most prolific off-plan developer, with a consistent track record of on-time delivery. Serenz continues that legacy in JVC with a thoughtfully designed residential tower offering studios through 2BRs.",
    amenities: ['Temperature-Controlled Pool', 'Yoga Deck', 'Jogging Track', 'Sports Court', "Kids' Play Zone", 'Business Centre', 'Supermarket Access', 'Valet Parking', 'Smart Home System', 'Community Gardens'],
    paymentPlan: [],
  },
]

export const units: Unit[] = [
  { id: 'unit-1', projectId: 'proj-1', unitNumber: 'Studio-01', bhk: 'Studio', floor: 'Various', areaSqft: 450, price: 5990000, facing: 'Pool View', status: 'Available' },
  { id: 'unit-2', projectId: 'proj-1', unitNumber: '1BR-01', bhk: '1 BHK', floor: 'Various', areaSqft: 680, price: 7500000, facing: 'Airport View', status: 'Available' },
  { id: 'unit-3', projectId: 'proj-2', unitNumber: 'Studio-01', bhk: 'Studio', floor: 'Various', areaSqft: 480, price: 8500000, facing: 'City View', status: 'Available' },
  { id: 'unit-4', projectId: 'proj-2', unitNumber: '1BR-01', bhk: '1 BHK', floor: 'Various', areaSqft: 750, price: 9500000, facing: 'Pool View', status: 'Available' },
  { id: 'unit-5', projectId: 'proj-3', unitNumber: 'Studio-01', bhk: 'Studio', floor: 'Various', areaSqft: 500, price: 8500000, facing: 'City View', status: 'Available' },
  { id: 'unit-6', projectId: 'proj-3', unitNumber: '1BR-01', bhk: '1 BHK', floor: 'Various', areaSqft: 750, price: 11000000, facing: 'Garden View', status: 'Available' },
  { id: 'unit-7', projectId: 'proj-3', unitNumber: '2BR-01', bhk: '2 BHK', floor: 'Various', areaSqft: 1100, price: 15000000, facing: 'Pool View', status: 'Available' },
]
export const siteVisits: SiteVisit[] = []

export const callLogs: CallLog[] = []

export const internalEmails: InternalEmail[] = []

export const groups: Group[] = []

export const groupMessages: GroupMessage[] = []

export const auditLog: AuditEntry[] = []

export const escalationRequests: EscalationRequest[] = []

export const calendarEvents: CalendarEvent[] = []
