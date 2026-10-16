# 🚀 TeamStowave Backend API (`TeamStowaveB`)

> **Enterprise-Grade Team Management, Strategic Operations, AI Intelligence & Omnichannel Automation Backend API.**

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.21.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Cloud_API-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://business.whatsapp.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Media_Engine-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)](https://cloudinary.com/)

---

## 🌟 Overview

**TeamStowave Backend (`TeamStowaveB`)** is the robust core API powering the **Stowave Team Management System**. It handles user authentication, task delegation, team collaboration, daily standups, omnichannel social media workflows, market scraping via Apify, and automated multi-channel notifications via WhatsApp Cloud API and Gmail SMTP.

Built on **Express.js** and **Supabase (PostgreSQL)**, it features automated database fallbacks, resilient error handling, and high-performance endpoints.

---

## ⚡ Core Features & Services

### 👥 1. Team & Workspace Management
- **Role-Based Access Control (RBAC)**: Supports `admin`, `manager`, `team_lead`, and `member` roles.
- **Department & Profile Tracking**: Track departments, skills, contact points, and gamified recognition points.
- **Audit Logging**: Full workspace activity trail for accountability and compliance.

### 📋 2. Task Lifecycle Engine
- **Task Management**: Create, assign, update, prioritize, and delete tasks.
- **Workflows**: Real-time status progression (`todo` ➡️ `in-progress` ➡️ `review` ➡️ `completed`).
- **Granular Details**: Deadlines, subtasks, priority levels (`urgent`, `high`, `medium`, `low`), and assignees.

### ☕ 3. Daily Standups & Surveys
- **Standup Submissions**: What did you do yesterday, today's plans, and blockers.
- **Pulse Surveys & Reviews**: Periodic surveys, anonymous feedback, and peer recognition shoutouts.

### 🌐 4. Social Command Center (`/api/social`)
- **Omnichannel Hub**: Unified social account management across platforms.
- **Post Scheduling & Unified Inbox**: Manage scheduled posts, messages, and social engagement metrics.
- **AI-Powered Insights**: Strategy recommendations driven by Groq LLM integration.

### 🕷️ 5. Apify Web Automation & Scraping (`/api/apify`)
- **Automated Scraping Runs**: Trigger and track custom Apify web scrapers for market intelligence and monitoring.
- **Execution Tracking**: Scrape logs and run results persisted directly into Supabase.

### 🔔 6. Automated Multi-Channel Notifications
- **WhatsApp Cloud API Service**: Instant WhatsApp messages sent to admins and assignees for urgent tasks and updates.
- **Gmail / Nodemailer Dispatcher**: Rich HTML email notifications for task assignments and team updates.
- **Cloudinary Storage**: High-speed cloud asset storage for user avatars, post attachments, and documents.

---

## 🏗️ Project Architecture & Structure

```
backend/
├── routes/
│   ├── apify.js                # Apify web scraping & crawler endpoints
│   ├── notifications.js        # Multi-channel notification routes
│   └── social.js               # Omnichannel social media routes
├── services/
│   ├── cloudinaryService.js    # Cloudinary media upload & CDN helper
│   ├── emailService.js         # Gmail SMTP / Nodemailer email dispatcher
│   ├── supabaseService.js      # Supabase client & query utilities
│   └── whatsappService.js     # Meta WhatsApp Cloud API dispatcher
├── database.json               # Resilient local JSON data store fallback
├── db.js                       # Database interface with PostgreSQL & JSON fallback
├── package.json                # Dependencies and startup scripts
├── server.js                   # Main Express application & API router
├── .env.example                # Template for environment variables
└── README.md                   # Comprehensive documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 18.x
- **npm** >= 9.x
- A **Supabase** project (or local PostgreSQL database)

---

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/zohaib-cod/TeamStowaveB.git
   cd TeamStowaveB
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Fill in your API credentials in `.env`:
   ```ini
   PORT=5001
   JWT_SECRET=your_jwt_secret_here

   # Supabase Database
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   DATABASE_URL=postgresql://postgres:password@aws-0-pooler.supabase.com:6543/postgres

   # AI Engines
   GROQ_API_KEY=your_groq_api_key

   # External Integrations
   APIFY_API_KEY=your_apify_api_key
   CLOUDINARY_CLOUD_NAME=your_cloudinary_name
   CLOUDINARY_API_KEY=your_cloudinary_key
   CLOUDINARY_API_SECRET=your_cloudinary_secret

   # Notifications
   GMAIL_USER=your_email@gmail.com
   GMAIL_APP_PASSWORD=your_gmail_app_password
   WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
   WHATSAPP_TOKEN=your_whatsapp_token
   ADMIN_WHATSAPP_NUMBER=923000000000
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Server will start at `http://localhost:5001`.

5. **Run in Production:**
   ```bash
   npm start
   ```

---

## 📡 Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status check |
| `GET` | `/api/users` | List all team members |
| `POST` | `/api/tasks` | Create a new task |
| `GET` | `/api/tasks` | Fetch tasks list with filters |
| `PUT` | `/api/tasks/:id` | Update task status or details |
| `GET` | `/api/standups` | Get daily standup records |
| `POST` | `/api/standups` | Submit daily standup report |
| `GET` | `/api/surveys` | Fetch active team surveys |
| `GET` | `/api/social/accounts` | Get connected social accounts |
| `POST` | `/api/social/posts` | Schedule/create social post |
| `GET` | `/api/apify/profile` | Check Apify connection status |
| `POST` | `/api/apify/run` | Trigger Apify scraping task |
| `POST` | `/api/notifications/whatsapp` | Dispatch direct WhatsApp notification |
| `POST` | `/api/notifications/email` | Dispatch formatted email notification |

---

## 🛡️ Security Best Practices
- Sensitive keys and API tokens are never committed to version control.
- Rate limiting and CORS headers prevent unauthorized cross-origin requests.
- All secrets are loaded through environment variables using `dotenv`.

---

## 👥 Authors & Credits
Developed by **Zohaib & The Stowave Engineering Team**.  
Frontend repository: [TeamStowaveF](https://github.com/zohaib-cod/TeamStowaveF)

---

## 📄 License
This project is licensed under the **ISC License**.
