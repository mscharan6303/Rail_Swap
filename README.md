# 🚆 RailSwap — Train Companion & Seat Swap Hub

[![Live Demo](https://img.shields.io/badge/Live%20Demo-rail--swap.vercel.app-brightgreen?style=for-the-badge&logo=vercel)](https://rail-swap.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue?style=for-the-badge&logo=github)](https://github.com/mscharan6303/Rail_Swap)

**Live Application URL**: [https://rail-swap.vercel.app/](https://rail-swap.vercel.app/)

RailSwap is a secure, AI-powered platform for verifying IRCTC train tickets (via OCR image/PDF parsing and live 10-digit PNR API fetching) and facilitating confirmed-ticket seat swaps between travelers on Indian Railways in real time.

---

## 🌟 Key Features
- 🎟️ **OCR & PDF Ticket Parsing**: Upload your IRCTC ticket (PDF or image) to automatically extract PNR, Train Number, Boarding/Destination stations, Coach, Seat, Berth, and timings.
- 📡 **Live RailRadar PNR Status API**: Lookup any 10-digit PNR to retrieve live journey details and confirm ticket status automatically.
- 🔐 **Direct Database Authentication**: Fast user registration and login saving credentials directly into Supabase database `profiles` for instant access without email verification loops.
- 💬 **Real-Time Passenger Chat**: WebSockets messaging powered by Supabase for real-time negotiation between passengers swapping seats.
- 🎯 **Confirmed Tickets Only**: Strict validation ensures that only confirmed (CNF) upcoming journeys are eligible for seat swapping.

---

## 📸 Screenshots

### 1. User Dashboard
![Dashboard](screenshots/dashboard_v3.png)
*The main dashboard where users can view their verified tickets and explore available seat swap requests.*

### 2. Ticket Upload & Verification
![Ticket Upload](screenshots/upload_verification_v3.png)
*Users upload their IRCTC ticket (PDF/Image) or fetch live PNR details.*

### 3. Swap Request Details
![Swap Details](screenshots/swap_details_v3.png)
*Detailed view of a seat swap request displaying coach, seat numbers, journey date, and route.*

### 4. Real-Time Chat Interface
![Live Chat](screenshots/realtime_chat_v3.png)
*Passengers securely chat in real-time to coordinate seat swaps prior to boarding.*

---

## 🚀 Live Demo & How to Run

- **Live URL**: [https://rail-swap.vercel.app/](https://rail-swap.vercel.app/)
- **GitHub Repository**: [https://github.com/mscharan6303/Rail_Swap](https://github.com/mscharan6303/Rail_Swap)

### Local Setup
```bash
git clone https://github.com/mscharan6303/Rail_Swap.git
cd Rail_Swap
npm install
npm run dev
```

---

## 🛠️ Tech Stack
- **Frontend**: React 19, TypeScript, TanStack Router & Start, Tailwind CSS v4, Radix UI
- **Backend & Database**: Supabase PostgreSQL, WebSockets Realtime
- **API Services**: RailRadar PNR Status API
- **OCR Engine**: Tesseract.js & PDF.js
- **Deployment**: Vercel

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
