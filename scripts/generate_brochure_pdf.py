import os
import base64
import asyncio
from playwright.async_api import async_playwright

def get_image_base64(path):
    if os.path.exists(path):
        with open(path, "rb") as f:
            return f"data:image/jpeg;base64,{base64.b64encode(f.read()).decode('utf-8')}"
    return ""

async def generate_pdf():
    workspace_root = os.path.abspath("e:/Autoapply")
    img_path = os.path.join(workspace_root, "public", "images", "candidate_recruiter_connect.jpg")
    img_base64 = get_image_base64(img_path)
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AutoApplyCV - Recruitment & Job Search Assistance Agency Brochure</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap');
    
    @page {{
      size: A4 portrait;
      margin: 0;
    }}
    
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }}
    
    body {{
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1e293b;
      background-color: #f8fafc;
      font-size: 13px;
      line-height: 1.5;
    }}
    
    .page {{
      width: 210mm;
      height: 297mm;
      position: relative;
      background: #ffffff;
      padding: 15mm 18mm 13mm 18mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      page-break-after: always;
    }}
    
    /* Background Accent Graphics */
    .bg-blob-1 {{
      position: absolute;
      top: -60px;
      right: -60px;
      width: 280px;
      height: 280px;
      background: radial-gradient(circle, rgba(79, 70, 229, 0.08) 0%, rgba(37, 99, 235, 0.02) 70%, transparent 100%);
      border-radius: 50%;
      z-index: 0;
    }}
    
    .bg-blob-2 {{
      position: absolute;
      bottom: -40px;
      left: -40px;
      width: 240px;
      height: 240px;
      background: radial-gradient(circle, rgba(15, 23, 42, 0.04) 0%, rgba(59, 130, 246, 0.02) 70%, transparent 100%);
      border-radius: 50%;
      z-index: 0;
    }}
    
    .content-layer {{
      position: relative;
      z-index: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }}
    
    /* Header */
    .header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 1.5px solid #e2e8f0;
    }}
    
    .logo-container {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    
    .logo-badge {{
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #1e3a8a 0%, #4f46e5 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 18px;
      box-shadow: 0 4px 10px rgba(30, 58, 138, 0.25);
    }}
    
    .brand-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 21px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      line-height: 1;
    }}
    
    .brand-title span {{
      color: #4f46e5;
    }}
    
    .brand-tagline {{
      font-size: 9.5px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 2px;
    }}
    
    .agency-tag {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 10.5px;
      font-weight: 700;
      color: #1e293b;
    }}
    
    .agency-tag-dot {{
      width: 6px;
      height: 6px;
      background: #10b981;
      border-radius: 50%;
    }}
    
    /* Cover Hero Section */
    .hero-section {{
      margin-top: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }}
    
    .badge-pill {{
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(90deg, #eef2ff 0%, #e0e7ff 100%);
      border: 1px solid #c7d2fe;
      color: #4338ca;
      font-size: 10px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 16px;
      letter-spacing: 0.3px;
    }}
    
    .hero-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 27px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.18;
      letter-spacing: -0.6px;
    }}
    
    .hero-title .gradient-text {{
      background: linear-gradient(135deg, #1e3a8a 0%, #4f46e5 60%, #06b6d4 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }}
    
    .hero-subheadline {{
      font-size: 13.5px;
      font-weight: 600;
      color: #334155;
      line-height: 1.4;
    }}
    
    .intro-card {{
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-left: 4px solid #4f46e5;
      border-radius: 0 12px 12px 0;
      padding: 11px 15px;
      font-size: 11.5px;
      color: #475569;
      line-height: 1.5;
    }}
    
    .intro-card strong {{
      color: #0f172a;
      font-weight: 700;
    }}
    
    /* 3 Core Pillars */
    .pillars-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 10px;
    }}
    
    .pillar-card {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 11px 12px;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
      display: flex;
      flex-direction: column;
      gap: 5px;
    }}
    
    .pillar-icon-box {{
      width: 30px;
      height: 30px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    
    .icon-blue {{ background: #eff6ff; color: #2563eb; }}
    .icon-purple {{ background: #eef2ff; color: #4f46e5; }}
    .icon-teal {{ background: #ecfdf5; color: #059669; }}
    
    .pillar-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.25;
    }}
    
    .pillar-desc {{
      font-size: 10px;
      color: #64748b;
      line-height: 1.4;
    }}
    
    /* Illustration Section */
    .illustration-card {{
      margin-top: 10px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
      text-align: center;
    }}
    
    .illustration-card img {{
      width: 100%;
      max-height: 220px;
      object-fit: contain;
      background: #fdfdfd;
      display: block;
    }}
    
    /* How it works 3-step row */
    .workflow-row {{
      margin-top: 10px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 10px 12px;
    }}
    
    .workflow-step {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    
    .workflow-number {{
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #4f46e5;
      color: white;
      font-size: 10.5px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }}
    
    .workflow-title {{
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }}
    
    .workflow-sub {{
      font-size: 9px;
      color: #64748b;
    }}
    
    /* Experience & Scope Row */
    .experience-ribbon {{
      margin-top: 10px;
      background: #0f172a;
      color: #ffffff;
      border-radius: 12px;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}
    
    .exp-item {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    
    .exp-icon {{
      color: #38bdf8;
      font-size: 14px;
    }}
    
    .exp-text {{
      font-size: 11px;
      font-weight: 600;
      color: #f1f5f9;
    }}
    
    .exp-sub {{
      font-size: 9px;
      color: #94a3b8;
      font-weight: 400;
    }}
    
    /* Footer */
    .page-footer {{
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1.5px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
    }}
    
    .footer-left {{
      font-weight: 700;
      color: #334155;
    }}
    
    .footer-right {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}
    
    .footer-link {{
      color: #4f46e5;
      text-decoration: none;
      font-weight: 600;
    }}
    
    /* PAGE 2 STYLES */
    .page2-header {{
      text-align: center;
      margin-top: 6px;
      margin-bottom: 12px;
    }}
    
    .page2-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 23px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.4px;
    }}
    
    .page2-subtitle {{
      font-size: 11.5px;
      color: #64748b;
      margin-top: 2px;
    }}
    
    /* Pricing Plans Grid */
    .plans-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 12px;
    }}
    
    .plan-card {{
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px 16px 14px 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.04);
    }}
    
    .plan-card.featured {{
      border: 2px solid #4f46e5;
      background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%);
      box-shadow: 0 6px 18px rgba(79, 70, 229, 0.12);
    }}
    
    .featured-badge {{
      position: absolute;
      top: -11px;
      right: 16px;
      background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);
    }}
    
    .plan-header {{
      padding-bottom: 10px;
      border-bottom: 1px solid #f1f5f9;
    }}
    
    .plan-name {{
      font-family: 'Outfit', sans-serif;
      font-size: 15.5px;
      font-weight: 800;
      color: #0f172a;
    }}
    
    .plan-desc {{
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }}
    
    .plan-price-box {{
      margin-top: 8px;
      display: flex;
      align-items: baseline;
      gap: 4px;
    }}
    
    .price-currency {{
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }}
    
    .price-amount {{
      font-family: 'Outfit', sans-serif;
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
    }}
    
    .plan-card.featured .price-amount {{
      color: #4f46e5;
    }}
    
    .price-period {{
      font-size: 9.5px;
      color: #94a3b8;
      font-weight: 600;
    }}
    
    .plan-features {{
      list-style: none;
      margin: 12px 0 14px 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }}
    
    .plan-feature-item {{
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 10.5px;
      color: #334155;
      line-height: 1.35;
    }}
    
    .feature-icon {{
      width: 15px;
      height: 15px;
      border-radius: 50%;
      background: #ecfdf5;
      color: #059669;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 800;
      flex-shrink: 0;
      margin-top: 1px;
    }}
    
    .plan-card.featured .feature-icon {{
      background: #eef2ff;
      color: #4f46e5;
    }}
    
    .plan-cta-btn {{
      display: block;
      width: 100%;
      text-align: center;
      padding: 8px 0;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s;
    }}
    
    .btn-secondary {{
      background: #f1f5f9;
      color: #0f172a;
      border: 1px solid #cbd5e1;
    }}
    
    .btn-primary {{
      background: linear-gradient(135deg, #1e3a8a 0%, #4f46e5 100%);
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25);
    }}
    
    /* Disclaimer Box */
    .disclaimer-box {{
      background: #fffbeb;
      border: 1.5px solid #fde68a;
      border-radius: 11px;
      padding: 9px 13px;
      display: flex;
      gap: 9px;
      align-items: flex-start;
      margin-bottom: 11px;
    }}
    
    .disclaimer-icon {{
      color: #d97706;
      font-size: 13px;
      font-weight: 800;
      margin-top: 1px;
      flex-shrink: 0;
    }}
    
    .disclaimer-title {{
      font-size: 10px;
      font-weight: 700;
      color: #92400e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }}
    
    .disclaimer-text {{
      font-size: 9.5px;
      color: #78350f;
      line-height: 1.4;
    }}
    
    /* CTA Banner */
    .cta-banner {{
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #1e3a8a 100%);
      border-radius: 13px;
      padding: 14px 18px;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.15);
    }}
    
    .cta-info {{
      max-width: 60%;
    }}
    
    .cta-heading {{
      font-family: 'Outfit', sans-serif;
      font-size: 15px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.2;
    }}
    
    .cta-subtext {{
      font-size: 10.5px;
      color: #cbd5e1;
      margin-top: 2px;
    }}
    
    .cta-button {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #38bdf8;
      color: #0f172a;
      padding: 8px 16px;
      border-radius: 9px;
      font-size: 11.5px;
      font-weight: 800;
      text-decoration: none;
      box-shadow: 0 4px 10px rgba(56, 189, 248, 0.3);
    }}
    
    /* Contact Bar */
    .contact-bar {{
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 11px;
      padding: 9px 14px;
    }}
    
    .contact-item {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    
    .contact-icon {{
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #4f46e5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
    }}
    
    .contact-label {{
      font-size: 8.5px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
    }}
    
    .contact-value {{
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
      text-decoration: none;
    }}
  </style>
</head>
<body>

  <!-- ==================== PAGE 1 ==================== -->
  <div class="page">
    <div class="bg-blob-1"></div>
    <div class="bg-blob-2"></div>
    
    <div class="content-layer">
      <!-- Top Header -->
      <div class="header">
        <div class="logo-container">
          <div class="logo-badge">AC</div>
          <div>
            <div class="brand-title">AutoApply<span>CV</span></div>
            <div class="brand-tagline">Recruitment &amp; Job Search Assistance</div>
          </div>
        </div>
        <div class="agency-tag">
          <span class="agency-tag-dot"></span>
          <span>Official Corporate Brochure</span>
        </div>
      </div>

      <!-- Hero Section -->
      <div class="hero-section">
        <div class="badge-pill">
          <span>🚀 Fast-Track Your Job Search</span>
        </div>
        
        <h1 class="hero-title">
          Your Next Career Opportunity <br>
          <span class="gradient-text">Starts Here</span>
        </h1>
        
        <div class="hero-subheadline">
          Connect with Relevant Recruiters. Explore Better Opportunities.
        </div>
        
        <div class="intro-card">
          <strong>AutoApplyCV</strong> is a recruitment and job-search assistance agency helping candidates discover relevant job opportunities and connect with recruiters.
        </div>
      </div>

      <!-- Core Service Pillars -->
      <div class="pillars-grid">
        <div class="pillar-card">
          <div class="pillar-icon-box icon-blue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <div class="pillar-title">Personalized Job Search Assistance</div>
          <div class="pillar-desc">Smart matching of available openings tailored to your specific role, skills, experience, and target location.</div>
        </div>
        
        <div class="pillar-card">
          <div class="pillar-icon-box icon-purple">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          </div>
          <div class="pillar-title">Recruiter Outreach</div>
          <div class="pillar-desc">Direct outreach and introduction to verified corporate recruiters, HR managers, and hiring leads across channels.</div>
        </div>
        
        <div class="pillar-card">
          <div class="pillar-icon-box icon-teal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <div class="pillar-title">Resume Circulation</div>
          <div class="pillar-desc">Profile and CV circulation across specialized LinkedIn recruiter circles and hiring communities where permitted.</div>
        </div>
      </div>

      <!-- Illustration Container -->
      <div class="illustration-card">
        <img src="{img_base64}" alt="Candidate Connecting With Recruiters">
      </div>

      <!-- 3-Step Process Workflow -->
      <div class="workflow-row">
        <div class="workflow-step">
          <div class="workflow-number">1</div>
          <div>
            <div class="workflow-title">Profile Onboarding</div>
            <div class="workflow-sub">Align role, location &amp; skills</div>
          </div>
        </div>
        <div class="workflow-step">
          <div class="workflow-number">2</div>
          <div>
            <div class="workflow-title">Recruiter Matching</div>
            <div class="workflow-sub">Targeted discovery &amp; curation</div>
          </div>
        </div>
        <div class="workflow-step">
          <div class="workflow-number">3</div>
          <div>
            <div class="workflow-title">Direct Outreach</div>
            <div class="workflow-sub">Email, WhatsApp &amp; LinkedIn</div>
          </div>
        </div>
      </div>

      <!-- Experience Scope Ribbon -->
      <div class="experience-ribbon">
        <div class="exp-item">
          <div class="exp-icon">🎯</div>
          <div>
            <div class="exp-text">0 – 15 Years Experience</div>
            <div class="exp-sub">Entry, Mid-Level &amp; Senior Leads</div>
          </div>
        </div>
        <div class="exp-item">
          <div class="exp-icon">💼</div>
          <div>
            <div class="exp-text">Multi-Industry Focus</div>
            <div class="exp-sub">Tech, Engineering, Finance, Ops</div>
          </div>
        </div>
        <div class="exp-item">
          <div class="exp-icon">⚡</div>
          <div>
            <div class="exp-text">Accelerated Discovery</div>
            <div class="exp-sub">Direct Recruiter Connections</div>
          </div>
        </div>
      </div>

      <!-- Page 1 Footer -->
      <div class="page-footer">
        <div class="footer-left">AutoApplyCV | Connecting Talent With Opportunities</div>
        <div class="footer-right">
          <span>Website: <a href="https://autoapplycv.in" class="footer-link">autoapplycv.in</a></span>
          <span>Page 1 of 2</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== PAGE 2 ==================== -->
  <div class="page">
    <div class="bg-blob-1"></div>
    <div class="bg-blob-2"></div>
    
    <div class="content-layer">
      <!-- Top Header -->
      <div class="header">
        <div class="logo-container">
          <div class="logo-badge">AC</div>
          <div>
            <div class="brand-title">AutoApply<span>CV</span></div>
            <div class="brand-tagline">Recruitment &amp; Job Search Assistance</div>
          </div>
        </div>
        <div class="agency-tag">
          <span>Service Packages &amp; Pricing</span>
        </div>
      </div>

      <!-- Section Title -->
      <div class="page2-header">
        <h2 class="page2-title">Choose the Support That Fits Your Job Search</h2>
        <p class="page2-subtitle">Transparent, affordable, and high-impact assistance packages tailored to your career goals.</p>
      </div>

      <!-- Service Plans Grid -->
      <div class="plans-grid">
        <!-- PLAN 1 -->
        <div class="plan-card">
          <div class="plan-header">
            <div class="plan-name">Job Search Access</div>
            <div class="plan-desc">Essential job discovery &amp; direct recruiter contact database.</div>
            <div class="plan-price-box">
              <span class="price-currency">₹</span>
              <span class="price-amount">500</span>
              <span class="price-period">/ one-time</span>
            </div>
          </div>
          
          <ul class="plan-features">
            <li class="plan-feature-item">
              <span class="feature-icon">✓</span>
              <span><strong>Access to Available Openings:</strong> Curated relevant job openings matched to your profile.</span>
            </li>
            <li class="plan-feature-item">
              <span class="feature-icon">✓</span>
              <span><strong>HR &amp; Recruiter Contact Details:</strong> Verified contact info &amp; emails where available.</span>
            </li>
            <li class="plan-feature-item">
              <span class="feature-icon">✓</span>
              <span><strong>WhatsApp Contact Information:</strong> Direct recruiter messaging contacts where available.</span>
            </li>
            <li class="plan-feature-item">
              <span class="feature-icon">✓</span>
              <span><strong>Recruiter Outreach Guidance:</strong> Proven templates and best practices for cold outreach.</span>
            </li>
            <li class="plan-feature-item">
              <span class="feature-icon">✓</span>
              <span><strong>Job Opportunity Updates:</strong> Regular alerts on newly published matching roles.</span>
            </li>
          </ul>
          
          <a href="https://autoapplycv.in" class="plan-cta-btn btn-secondary">Get Job Search Access</a>
        </div>

        <!-- PLAN 2 -->
        <div class="plan-card featured">
          <div class="featured-badge">⭐ Recommended</div>
          
          <div class="plan-header">
            <div class="plan-name">Premium Job Outreach</div>
            <div class="plan-desc">Comprehensive end-to-end recruiter engagement &amp; circulation.</div>
            <div class="plan-price-box">
              <span class="price-currency">₹</span>
              <span class="price-amount">2,000</span>
              <span class="price-period">/ one-time</span>
            </div>
          </div>
          
          <ul class="plan-features">
            <li class="plan-feature-item">
              <span class="feature-icon">✓</span>
              <span><strong>Relevant Opportunity Matching:</strong> Deep algorithmic matching to premier hiring requisitions.</span>
            </li>
            <li class="plan-feature-item">
              <span class="feature-icon">✓</span>
              <span><strong>WhatsApp Recruiter Outreach:</strong> Direct candidate intro dispatch where permitted.</span>
            </li>
            <li class="plan-feature-item">
              <span class="feature-icon">✓</span>
              <span><strong>Email Recruiter Outreach:</strong> Personalized introductory emails to relevant recruiters.</span>
            </li>
            <li class="plan-feature-item">
              <span class="feature-icon">✓</span>
              <span><strong>Application Outreach Assistance:</strong> Structured support navigating company job portals.</span>
            </li>
            <li class="plan-feature-item">
              <span class="feature-icon">✓</span>
              <span><strong>LinkedIn Community Circulation:</strong> Resume placement in recruiter communities where permitted.</span>
            </li>
            <li class="plan-feature-item">
              <span class="feature-icon">✓</span>
              <span><strong>Tracking &amp; Follow-up Assistance:</strong> Pipeline dashboard and follow-up guidance.</span>
            </li>
          </ul>
          
          <a href="https://autoapplycv.in" class="plan-cta-btn btn-primary">Get Premium Outreach</a>
        </div>
      </div>

      <!-- Compliance & Integrity Disclaimer -->
      <div class="disclaimer-box">
        <div class="disclaimer-icon">ℹ️</div>
        <div>
          <div class="disclaimer-title">Transparency &amp; Policy Notice</div>
          <div class="disclaimer-text">
            Interview calls and job offers depend on employer requirements and recruiter responses. Our services assist with job discovery and outreach but do not guarantee employment.
          </div>
        </div>
      </div>

      <!-- Primary Call to Action Banner -->
      <div class="cta-banner">
        <div class="cta-info">
          <div class="cta-heading">Ready to Explore Your Next Opportunity?</div>
          <div class="cta-subtext">Submit your resume today and let our outreach team accelerate your recruiter connections.</div>
        </div>
        <a href="https://autoapplycv.in" class="cta-button">
          <span>Submit Resume Now →</span>
        </a>
      </div>

      <!-- Contact Details Bar -->
      <div class="contact-bar">
        <div class="contact-item">
          <div class="contact-icon">🌐</div>
          <div>
            <div class="contact-label">Official Portal</div>
            <a href="https://autoapplycv.in" class="contact-value">https://autoapplycv.in</a>
          </div>
        </div>
        <div class="contact-item">
          <div class="contact-icon">✉️</div>
          <div>
            <div class="contact-label">Official Support Email</div>
            <a href="mailto:support@autoapplycv.in" class="contact-value">support@autoapplycv.in</a>
          </div>
        </div>
        <div class="contact-item">
          <div class="contact-icon">💬</div>
          <div>
            <div class="contact-label">Business WhatsApp</div>
            <a href="https://wa.me/919876543210" class="contact-value">+91 98765 43210</a>
          </div>
        </div>
      </div>

      <!-- Page 2 Footer -->
      <div class="page-footer">
        <div class="footer-left">AutoApplyCV | Connecting Talent With Opportunities</div>
        <div class="footer-right">
          <span>Website: <a href="https://autoapplycv.in" class="footer-link">autoapplycv.in</a></span>
          <span>Page 2 of 2</span>
        </div>
      </div>
    </div>
  </div>

</body>
</html>
"""
    
    html_path = os.path.join(workspace_root, "AutoApplyCV_Brochure.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"HTML saved to: {html_path}")
    
    pdf_out_root = os.path.join(workspace_root, "AutoApplyCV_Recruitment_Brochure.pdf")
    pdf_out_public = os.path.join(workspace_root, "public", "AutoApplyCV_Recruitment_Brochure.pdf")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto(f"file:///{html_path.replace(os.sep, '/')}", wait_until="networkidle")
        await page.pdf(
            path=pdf_out_root,
            format="A4",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            prefer_css_page_size=True
        )
        await page.pdf(
            path=pdf_out_public,
            format="A4",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            prefer_css_page_size=True
        )
        
        # Take updated screenshots for inspection
        pages = await page.query_selector_all('.page')
        if len(pages) >= 1:
            await pages[0].screenshot(path=os.path.join(workspace_root, 'public', 'images', 'brochure_page_1.png'))
        if len(pages) >= 2:
            await pages[1].screenshot(path=os.path.join(workspace_root, 'public', 'images', 'brochure_page_2.png'))
            
        await browser.close()
        
    print(f"PDF successfully generated at: {pdf_out_root}")
    print(f"Public PDF saved at: {pdf_out_public}")

if __name__ == "__main__":
    asyncio.run(generate_pdf())
