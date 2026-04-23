# TapTime - Enterprise Attendance Monitoring System

TapTime is a professional, real-time attendance monitoring solution designed for modern workplaces. Built with a focus on accuracy, compliance, and user experience, it streamlines the workforce management process through automated shift scheduling, real-time tracking, and comprehensive audit logging.

## 🚀 Features

### For Employees
- **PWA Support:** Installable as a Progressive Web App for quick access on mobile and desktop.
- **Real-time Attendance Tracking:** High-precision clock-in/out system with visual status indicators.
- **Smart Break Management:** Dedicated trackers for Morning, Lunch, and Afternoon breaks with automated countdowns and enforcement.
- **Automated Compliance:** Integrated grace periods (5 minutes) and automatic clock-out deadlines to ensure data accuracy.
- **Overtime Support:** Simple workflow to record and track additional working hours.
- **Personal Dashboard:** Comprehensive view of weekly shifts, attendance history, and real-time notifications.

### For Administrators
- **Real-time Overview:** Live monitoring of employee attendance and active break statuses.
- **Employee Management:** Full CRUD capabilities for managing staff profiles and system access.
- **Flexible Shift Scheduling:** Assign and manage weekly shifts with support for varying schedules.
- **Comprehensive Audit Trail:** Detailed logs of all system activities for accountability and security.
- **Data Insights & Export:** Generate attendance reports and export data to Excel (XLSX) for payroll processing.

## 🛠️ Tech Stack

- **Frontend:** [React 19](https://react.dev/) with [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) & [Lucide React](https://lucide.dev/) for iconography
- **Backend-as-a-Service:** [Supabase](https://supabase.com/)
  - **Auth:** Secure role-based authentication
  - **Database:** PostgreSQL for reliable data storage
  - **Realtime:** Live attendance updates and system notifications
  - **Storage:** Profile avatar management
- **Components:** [Radix UI](https://www.radix-ui.com/) for accessible primitives
- **Utilities:** `date-fns` for time calculations, `react-toastify` for notifications, and `xlsx` for report generation

## 📦 Project Structure

```text
src/
├── components/       # Reusable UI and layout components
├── context/          # Global state (Auth, Loading, Notifications)
├── pages/
│   ├── admin/        # Admin-specific dashboards and management tabs
│   └── user/         # Employee portals and attendance logs
├── utils/            # Business logic, API wrappers, and shift calculations
└── lib/              # Shared libraries and configurations
```

## ⚙️ Getting Started

### Prerequisites
- Node.js (Latest LTS recommended)
- Supabase Account and Project

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/taptime-sys.git
   cd taptime-sys
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## 🔒 Security & Compliance
TapTime implements strict role-based access control (RBAC). Employees only have access to their own data and attendance tools, while administrative actions are protected and recorded in the system's tamper-evident audit trail.

---
*Developed with focus on efficiency and reliability.*
