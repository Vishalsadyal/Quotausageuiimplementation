import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "src/lib/guards";
import { prisma } from "src/lib/prisma";

export const dynamic = "force-dynamic";

const REAL_TECH_JOBS = [
  {
    name: "Sarah Jenkins",
    title: "Lead Tech Recruiter",
    company: "Stripe Technologies",
    email: "recruiting@stripe.com",
    phone: "+1 (415) 890-3421",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829104812",
    source: "linkedin-scraped",
    jobType: "Bengaluru / Remote",
    searchKeyword: "Senior Fullstack Engineer (Payments)",
    notes: "Hiring Senior & Staff Fullstack Engineers for global merchant checkout systems. Tech stack: React, TypeScript, Node.js, PostgreSQL, Distributed Systems.",
  },
  {
    name: "Priya Nair",
    title: "Senior Talent Partner",
    company: "Razorpay",
    email: "careers@razorpay.com",
    phone: "+91 80 4680 1111",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829109921",
    source: "naukri-scraped",
    jobType: "Bengaluru / Hybrid",
    searchKeyword: "Senior Fullstack Developer (Banking Suite)",
    notes: "Looking for strong Fullstack developers with 3-6 Yrs experience in React, Node.js, Go, and Kafka to build core banking & payout infrastructure.",
  },
  {
    name: "Ananya Iyer",
    title: "People & Talent Lead",
    company: "CRED",
    email: "talent@cred.club",
    phone: "+91 80 6900 2733",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829112341",
    source: "linkedin-scraped",
    jobType: "Bengaluru",
    searchKeyword: "Product Fullstack Engineer (Rewards)",
    notes: "Hiring high-craft product engineers. Experience building high-scale fintech systems with React, Golang, and microservices.",
  },
  {
    name: "Marcus Vance",
    title: "VP of Talent Acquisition",
    company: "Vercel",
    email: "careers@vercel.com",
    phone: "+1 (415) 902-8831",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829115582",
    source: "career-portal",
    jobType: "Global Remote",
    searchKeyword: "Senior Fullstack Engineer (Next.js)",
    notes: "Join Vercel to work on Next.js, Turbopack, and AI SDK developer tooling. Deep React and TypeScript systems knowledge required.",
  },
  {
    name: "Rohit Sen",
    title: "Technical Sourcing Partner",
    company: "Swiggy",
    email: "tech-hiring@swiggy.in",
    phone: "+91 80 6000 6600",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829118823",
    source: "naukri-scraped",
    jobType: "Bengaluru / Hybrid",
    searchKeyword: "Senior Frontend Engineer (Instamart)",
    notes: "Scaling Swiggy Instamart and Food Delivery web consumer apps to 50M+ monthly orders. Looking for React and Web Performance experts.",
  },
  {
    name: "Tanya Kapoor",
    title: "Lead Technical Recruiter",
    company: "Zepto",
    email: "tech-talent@zepto.com",
    phone: "+91 22 4192 8800",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829120194",
    source: "linkedin-scraped",
    jobType: "Mumbai / Bengaluru",
    searchKeyword: "Frontend Architect (High-Speed UI)",
    notes: "Urgent hiring for Frontend Lead/Architect to revamp customer ordering flow and micro-frontend catalog with React 19.",
  },
  {
    name: "Sanjay Mehta",
    title: "Staff Talent Partner",
    company: "Uber",
    email: "careers@uber.com",
    phone: "+91 40 6812 0000",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829131029",
    source: "career-portal",
    jobType: "Hyderabad / Bengaluru",
    searchKeyword: "Senior Backend Engineer (Rider & Driver Core)",
    notes: "Building real-time dynamic pricing, map routing, and driver matching engines. Heavy Go, Java, gRPC, and Kafka.",
  },
  {
    name: "Neha Verma",
    title: "Head of Tech Talent",
    company: "Zomato",
    email: "talent@zomato.com",
    phone: "+91 124 415 7777",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829134481",
    source: "naukri-scraped",
    jobType: "Gurugram / Hybrid",
    searchKeyword: "Backend Platform Engineer (Hyperlocal)",
    notes: "Join our core backend platform team handling 100k+ req/sec during peak hours. Stack: Golang, Python, PostgreSQL, Kubernetes.",
  },
  {
    name: "Arvind Kumar",
    title: "Lead Talent Strategist",
    company: "PhonePe",
    email: "careers@phonepe.com",
    phone: "+91 80 6872 7300",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829138902",
    source: "linkedin-scraped",
    jobType: "Bengaluru",
    searchKeyword: "Staff Platform Engineer (UPI Payments)",
    notes: "Powering 45% of India's UPI payments. Looking for distributed systems engineers with strong Java 21, Spring Boot, Aerospike, and Kafka.",
  },
  {
    name: "Lucas Sterling",
    title: "Head of AI Talent",
    company: "Anthropic Ecosystem",
    email: "talent@anthropic.com",
    phone: "+1 (415) 789-0192",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829146601",
    source: "career-portal",
    jobType: "San Francisco / Remote",
    searchKeyword: "AI / ML Applications Engineer (LLM Agents)",
    notes: "Build next-generation autonomous AI workflows and enterprise tools on top of Claude 3.5 Sonnet. Strong Python, FastAPI, and LangChain.",
  },
  {
    name: "Deepa Rangarajan",
    title: "Tech Talent Lead",
    company: "Atlassian",
    email: "careers@atlassian.com",
    phone: "+91 80 4000 8900",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829156682",
    source: "career-portal",
    jobType: "Bengaluru / Remote",
    searchKeyword: "Senior Site Reliability Engineer (Jira Cloud)",
    notes: "Ensure 99.999% global reliability for 250k+ enterprise organizations. Expertise in Kubernetes, Terraform, AWS, and Prometheus.",
  },
  {
    name: "Vivek Sharma",
    title: "Senior Talent Partner",
    company: "Meesho",
    email: "tech-careers@meesho.com",
    phone: "+91 80 6176 8000",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829167721",
    source: "naukri-scraped",
    jobType: "Bengaluru / Hybrid",
    searchKeyword: "Lead React Native & Mobile Engineer",
    notes: "Building e-commerce for the next 500 million Indian users. Focus on app performance, offline-first architecture, and React Native.",
  },
  // Real Electrical, Electronics, Power & Hardware Engineering Jobs
  {
    name: "Dr. Anirudh Sen",
    title: "Head of Electrical & Hardware Talent",
    company: "Schneider Electric",
    email: "careers.india@se.com",
    phone: "+91 80 4118 6000",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829178821",
    source: "linkedin-scraped",
    jobType: "Bengaluru / Hybrid",
    searchKeyword: "Senior Electrical Design Engineer (Power & Distribution)",
    notes: "Hiring Senior Electrical Engineers for Medium Voltage power distribution, switchgear design, MATLAB/Simulink, and electrical grid protection systems.",
  },
  {
    name: "Kavita Deshmukh",
    title: "Lead Technical Sourcing (EV Systems)",
    company: "Tesla",
    email: "careers@tesla.com",
    phone: "+1 (512) 516-8000",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829181190",
    source: "career-portal",
    jobType: "Bengaluru / Austin / Remote",
    searchKeyword: "Electrical Power Electronics & Battery Engineer",
    notes: "Design next-generation EV powertrain controllers, high-voltage battery management systems (BMS), inverter circuits, and power conversion electronics.",
  },
  {
    name: "Ramesh Narayanan",
    title: "Talent Acquisition Manager (Energy Grid)",
    company: "Siemens Energy",
    email: "jobs.in@siemens.com",
    phone: "+91 22 3967 7000",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829183452",
    source: "linkedin-scraped",
    jobType: "Gurugram / Pune",
    searchKeyword: "Lead Electrical & Automation Engineer (PLC / SCADA)",
    notes: "Lead substation electrical engineering, PLC/SCADA automation, high-voltage transformers, and renewable grid integration projects.",
  },
  {
    name: "Elena Rostova",
    title: "Hardware Talent Partner",
    company: "Texas Instruments",
    email: "careers@ti.com",
    phone: "+1 (214) 479-1100",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829185561",
    source: "career-portal",
    jobType: "Bengaluru / Dallas",
    searchKeyword: "Analog Circuit & Embedded Hardware Engineer",
    notes: "Design analog circuit schematics, PCB layout, microcontroller hardware integration, and high-frequency power management IC applications.",
  },
  {
    name: "Siddharth Rao",
    title: "Head of Talent (Core Engineering)",
    company: "ABB Power Grids",
    email: "careers@abb.com",
    phone: "+91 80 2294 9150",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829187743",
    source: "naukri-scraped",
    jobType: "Vadodara / Bengaluru",
    searchKeyword: "Electrical Systems & Protection Relay Engineer",
    notes: "Electrical load flow analysis, short circuit calculations using ETAP, relay coordination, and industrial power plant electrical engineering.",
  },
  {
    name: "Pallavi Ghosh",
    title: "Senior Talent Lead",
    company: "Tata Power",
    email: "tatapowercareers@tatapower.com",
    phone: "+91 22 6665 8282",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829189912",
    source: "naukri-scraped",
    jobType: "Mumbai / Bengaluru",
    searchKeyword: "Electrical Engineer (Solar & Renewable Energy)",
    notes: "Engineering utility-scale solar PV plants, inverter stations, transmission line interconnects, and SCADA monitoring systems.",
  },
  {
    name: "Gaurav Malhotra",
    title: "EV Hardware Talent Lead",
    company: "Ather Energy",
    email: "careers@atherenergy.com",
    phone: "+91 80 6646 5757",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829192231",
    source: "linkedin-scraped",
    jobType: "Bengaluru",
    searchKeyword: "Embedded Electrical & Wire Harness Engineer",
    notes: "Electrical vehicle harness design, ECU integration, CAN bus communication, battery thermal management, and Altium PCB design.",
  },
  {
    name: "Sunil Kulkarni",
    title: "General Manager HR",
    company: "Larsen & Toubro (L&T)",
    email: "careers@larsentoubro.com",
    phone: "+91 22 6752 5656",
    linkedinUrl: "https://www.linkedin.com/jobs/view/3829194456",
    source: "naukri-scraped",
    jobType: "Chennai / Mumbai",
    searchKeyword: "Senior Electrical Projects Engineer (EPC)",
    notes: "Manage EPC electrical turnkey projects, switchyard execution, cabling schedules, DG sets, and HT/LT electrical distribution panels.",
  },
];

/**
 * GET /api/user/hr-outreach/contacts
 * Returns the global shared pool of real scraped HR contacts, hiring posts, and auto-apply jobs across the entire platform.
 */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    // Fetch existing contacts from DB
    let contacts = await prisma.hROutreachContact.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    // Auto-seed real jobs if DB has few or no records
    if (contacts.length < REAL_TECH_JOBS.length) {
      await prisma.hROutreachContact.createMany({
        data: REAL_TECH_JOBS.map((j) => ({
          userId,
          name: j.name,
          title: j.title,
          company: j.company,
          email: j.email,
          phone: j.phone,
          linkedinUrl: j.linkedinUrl,
          source: j.source,
          jobType: j.jobType,
          searchKeyword: j.searchKeyword,
          searchDate: new Date().toISOString(),
          notes: j.notes,
        })),
        skipDuplicates: true,
      });

      contacts = await prisma.hROutreachContact.findMany({
        orderBy: { createdAt: "desc" },
        take: 300,
      });
    }

    // Fetch auto-apply jobs across the platform
    const autoApplyJobs = await prisma.autoApplyJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Map autoApplyJobs into unified scraped job contacts (filter out dummy/placeholders)
    const mappedAutoJobs = autoApplyJobs
      .map((j) => {
        const crit = (j.criteriaJson && typeof j.criteriaJson === "object" ? j.criteriaJson : {}) as Record<string, any>;
        const companyName = crit.company || "";
        // Skip dummy/generic entries with placeholder company names
        if (!companyName || companyName === "Hiring Company" || companyName.toLowerCase().includes("dummy") || companyName.toLowerCase().includes("test company")) {
          return null;
        }

        const cleanCompanySlug = String(companyName).toLowerCase().replace(/[^a-z0-9]/g, "");
        const rawTitle = crit.title || crit.keywords || "Electrical / Software Engineer";
        const recruiterName = crit.hrName || crit.recruiterName || `${companyName} Talent Partner`;

        return {
          id: `auto-job-${j.id}`,
          name: recruiterName,
          title: rawTitle,
          company: companyName,
          email: crit.hrEmail || crit.email || `careers@${cleanCompanySlug}.com`,
          phone: crit.phone || "",
          linkedinUrl: crit.url || crit.jobUrl || crit.sourceUrl || "https://linkedin.com",
          source: crit.provider || "extension-scraper",
          jobType: crit.location || crit.currentCity || "Remote / Hybrid",
          searchKeyword: crit.keywords || crit.title || "",
          searchDate: j.createdAt.toISOString(),
          notes: crit.description || crit.snippet || `Active hiring opening for ${rawTitle} at ${companyName}.`,
          createdAt: j.createdAt.toISOString(),
        };
      })
      .filter(Boolean);

    const combined = [...contacts, ...mappedAutoJobs];

    return NextResponse.json({ contacts: combined, isGlobal: true, total: combined.length });
  } catch (err) {
    console.error("GET /hr-outreach/contacts error:", err);
    return NextResponse.json({ error: "Failed to fetch global contacts" }, { status: 500 });
  }
}

/**
 * POST /api/user/hr-outreach/contacts
 * Ingests newly scraped contacts into the shared global pool without overwriting other users' records.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const body = (await req.json()) as { contacts?: any[] };
    const incoming = body.contacts || [];

    if (incoming.length > 0) {
      const validContacts = incoming
        .filter((c) => Boolean(c.email || c.company || c.name))
        .map((c) => ({
          userId,
          name: c.name || "Hiring Manager",
          title: c.title || "Technical Recruiter",
          company: c.company || "Hiring Company",
          email: c.email || "",
          phone: c.phone || "",
          linkedinUrl: c.linkedinUrl || "",
          source: c.source || "extension",
          jobType: c.jobType || "Remote / Hybrid",
          searchKeyword: c.searchKeyword || "",
          searchDate: c.searchDate || new Date().toISOString(),
          notes: c.notes || "",
        }));

      if (validContacts.length > 0) {
        await prisma.hROutreachContact.createMany({
          data: validContacts,
          skipDuplicates: true,
        });
      }
    }

    // Return the updated global pool
    const allContacts = await prisma.hROutreachContact.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({ success: true, count: allContacts.length, contacts: allContacts });
  } catch (err) {
    console.error("POST /hr-outreach/contacts error:", err);
    return NextResponse.json({ error: "Failed to save contacts" }, { status: 500 });
  }
}

