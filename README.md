# Gaia Protocol Dashboard

Welcome to the **Gaia Protocol** dashboard! This is the command center for a decentralized node network featuring low-cost distributed compute, real-time sensor grids, and ZKP security.

## Features

- **Real-Time Network Visualization**: An interactive, dynamic view of active decentralized nodes securely operating across the globe.
- **Node Management & Analytics**: Monitor hash rates, network security, and latency in real-time.
- **AI Voice Assistant**: An integrated AI (powered by Google Gemini 2.5 Flash), providing conversational assistance in over 100 languages. Enables natural text-to-speech feedback.
- **Investor / Client Pitch Deck Generator**: AI-powered dynamic email/pitch generator specifically tailored for diverse end-user targets, ranging from VC investors, Enterprise AI, and government operations.

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Motion (Framer Motion), Lucide Icons, Shadcn UI
- **Backend / Integration**: Express, \`tsx\`, Google Gen AI SDK (\`@google/genai\`), Google Maps API
- **Data & Charts**: Recharts, Better SQLite3

## Prerequisites

To run this application locally, you will need:
- Node.js (v20+)
- npm or pnpm
- Valid API Keys:
  - **Google Gemini API Key** (for AI chatbot and pitch generation)
  - **Google Maps API Key** (for node map visualizations)

## Installation

1. **Clone the repository:**
   \`\`\`bash
   git clone https://github.com/Meyer4/gaia-protocol.git
   cd gaia-protocol
   \`\`\`

2. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

3. **Configure Environment Variables:**
   Create a \`.env\` file in the root of the project and add your keys:
   \`\`\`env
   GEMINI_API_KEY=your_gemini_api_key_here
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   \`\`\`

4. **Start the Development Server:**
   \`\`\`bash
   npm run dev
   \`\`\`
   The server will start at [http://localhost:3000](http://localhost:3000).

## Building for Production

To create a production build and run it:
\`\`\`bash
npm run build
npm run start
\`\`\`

## Contact

Created by [George Meya](https://github.com/Meyer4).
Email: gmeya2041@gmail.com
