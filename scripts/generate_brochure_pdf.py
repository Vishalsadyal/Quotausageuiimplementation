import os
import base64
import asyncio
from playwright.async_api import async_playwright

def get_image_base64(path, default_mime="image/jpeg"):
    if os.path.exists(path):
        mime = "image/png" if path.lower().endswith(".png") else default_mime
        with open(path, "rb") as f:
            return f"data:{mime};base64,{base64.b64encode(f.read()).decode('utf-8')}"
    return ""

async def generate_pdf():
    workspace_root = os.path.abspath("e:/Autoapply")
    
    # Real photography assets
    img_interview_path = os.path.join(workspace_root, "public", "images", "corporate_recruiter_interview.jpg")
    img_interview_b64 = get_image_base64(img_interview_path, "image/jpeg")
    
    img_success_path = os.path.join(workspace_root, "public", "images", "placed_candidates_success.jpg")
    img_success_b64 = get_image_base64(img_success_path, "image/jpeg")
    
    img_desk_path = os.path.join(workspace_root, "public", "images", "recruitment_consultant_desk.jpg")
    img_desk_b64 = get_image_base64(img_desk_path, "image/jpeg")
    
    logo_path = os.path.join(workspace_root, "public", "logos", "new_logo_transparent.png")
    if not os.path.exists(logo_path):
        logo_path = os.path.join(workspace_root, "public", "branding", "new_logo_transparent.png")
    logo_base64 = get_image_base64(logo_path, "image/png")
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AutoApplyCV - Recruitment & Job Search Assistance Agency Brochure</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&family=Caveat:wght@600;700&display=swap');
    
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
      font-size: 11.5px;
      line-height: 1.45;
    }}
    
    .page {{
      width: 210mm;
      height: 297mm;
      position: relative;
      background: #ffffff;
      padding: 13mm 16mm 11mm 16mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      page-break-after: always;
    }}
    
    /* Background Subtle Modern Geometry */
    .bg-accent-top {{
      position: absolute;
      top: -50px;
      right: -50px;
      width: 260px;
      height: 260px;
      background: radial-gradient(circle, rgba(79, 70, 229, 0.07) 0%, rgba(37, 99, 235, 0.01) 70%, transparent 100%);
      border-radius: 50%;
      z-index: 0;
    }}
    
    .bg-accent-bottom {{
      position: absolute;
      bottom: -40px;
      left: -40px;
      width: 220px;
      height: 220px;
      background: radial-gradient(circle, rgba(15, 23, 42, 0.04) 0%, transparent 100%);
      border-radius: 50%;
      z-index: 0;
    }}
    
    /* Professional Security & Authenticity Watermark */
    .watermark {{
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      pointer-events: none;
      z-index: 0;
      user-select: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0.04;
      text-align: center;
      width: 100%;
    }}
    
    .watermark-img {{
      width: 200px;
      height: auto;
      margin-bottom: 6px;
      filter: grayscale(100%) contrast(150%);
    }}
    
    .watermark-text {{
      font-family: 'Outfit', sans-serif;
      font-size: 34px;
      font-weight: 900;
      letter-spacing: 6px;
      color: #0f172a;
      text-transform: uppercase;
      white-space: nowrap;
    }}
    
    .watermark-subtext {{
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 5px;
      color: #1e3a8a;
      text-transform: uppercase;
      margin-top: 3px;
    }}
    
    .content-layer {{
      position: relative;
      z-index: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }}
    
    /* Global Clean Header */
    .header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 9px;
      border-bottom: 1.5px solid #e2e8f0;
    }}
    
    .logo-container {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    
    .brand-logo-img {{
      height: 36px;
      width: auto;
      max-width: 120px;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.06));
    }}
    
    .brand-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      line-height: 1;
    }}
    
    .brand-title span {{
      color: #4f46e5;
    }}
    
    .brand-tagline {{
      font-size: 8px;
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
      padding: 3.5px 10px;
      border-radius: 20px;
      font-size: 9px;
      font-weight: 700;
      color: #1e293b;
    }}
    
    .agency-tag-dot {{
      width: 6px;
      height: 6px;
      background: #10b981;
      border-radius: 50%;
    }}
    
    /* Footer */
    .page-footer {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1.5px solid #e2e8f0;
      padding-top: 7px;
      margin-top: 6px;
      font-size: 8px;
      color: #64748b;
    }}
    
    .footer-left {{
      font-weight: 600;
      color: #334155;
    }}
    
    .footer-right {{
      display: flex;
      gap: 12px;
      font-weight: 600;
    }}
    
    .footer-link {{
      color: #4f46e5;
      text-decoration: none;
      font-weight: 700;
    }}

    /* ==================== PAGE 1: COVER ==================== */
    .cover-hero {{
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }}
    
    .badge-pill {{
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(90deg, #eef2ff 0%, #e0e7ff 100%);
      border: 1px solid #c7d2fe;
      color: #4338ca;
      font-size: 8.5px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    
    .hero-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 26px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.15;
      letter-spacing: -0.6px;
    }}
    
    .hero-title .gradient-text {{
      background: linear-gradient(135deg, #1e3a8a 0%, #4f46e5 60%, #06b6d4 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }}
    
    .hero-subheadline {{
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      line-height: 1.35;
    }}
    
    .intro-card {{
      background: #f8fafc;
      border-left: 3.5px solid #4f46e5;
      border-radius: 0 10px 10px 0;
      padding: 8px 12px;
      font-size: 10px;
      color: #475569;
      line-height: 1.45;
    }}
    
    .cover-photo-box {{
      margin-top: 8px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
      height: 185px;
      position: relative;
    }}
    
    .cover-photo-box img {{
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }}
    
    .cover-photo-overlay {{
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(180deg, transparent 0%, rgba(15, 23, 42, 0.85) 100%);
      padding: 8px 14px;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }}
    
    .cover-caption-title {{
      font-size: 10px;
      font-weight: 700;
      color: #ffffff;
    }}
    
    .cover-caption-sub {{
      font-size: 8px;
      color: #cbd5e1;
    }}
    
    .pillars-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 8px;
    }}
    
    .pillar-card {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 10px;
      box-shadow: 0 2px 5px rgba(15, 23, 42, 0.03);
    }}
    
    .pillar-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }}
    
    .pillar-desc {{
      font-size: 8.5px;
      color: #64748b;
      line-height: 1.35;
    }}
    
    .experience-ribbon {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%);
      color: #ffffff;
      border-radius: 10px;
      padding: 7px 14px;
      margin-top: 8px;
    }}
    
    .exp-item {{
      display: flex;
      align-items: center;
      gap: 6px;
    }}
    
    .exp-text {{
      font-size: 9px;
      font-weight: 700;
      color: #ffffff;
    }}
    
    .exp-sub {{
      font-size: 7.5px;
      color: #94a3b8;
    }}

    /* ==================== PAGE 2: 6 PHASES METHODOLOGY ==================== */
    .section-headline-box {{
      margin-top: 6px;
      margin-bottom: 8px;
    }}
    
    .section-h2 {{
      font-family: 'Outfit', sans-serif;
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.4px;
    }}
    
    .section-p {{
      font-size: 9.5px;
      color: #64748b;
      margin-top: 1px;
    }}
    
    .methodology-hero-photo {{
      height: 125px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      margin-bottom: 8px;
    }}
    
    .methodology-hero-photo img {{
      width: 100%;
      height: 100%;
      object-fit: cover;
    }}
    
    .phases-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }}
    
    .phase-card {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 9px;
      padding: 8px 10px;
      display: flex;
      gap: 8px;
      align-items: flex-start;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
    }}
    
    .phase-num {{
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: linear-gradient(135deg, #1e3a8a 0%, #4f46e5 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9.5px;
      font-weight: 800;
      flex-shrink: 0;
      margin-top: 1px;
    }}
    
    .phase-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 10px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.25;
    }}
    
    .phase-text {{
      font-size: 8px;
      color: #64748b;
      line-height: 1.35;
      margin-top: 2px;
    }}

    /* ==================== PAGE 3: PLACED CANDIDATES & SUCCESS ==================== */
    .success-hero-photo {{
      height: 140px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      margin-bottom: 8px;
      position: relative;
    }}
    
    .success-hero-photo img {{
      width: 100%;
      height: 100%;
      object-fit: cover;
    }}
    
    .success-stats-bar {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 8px;
    }}
    
    .stat-card {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 8px;
      text-align: center;
    }}
    
    .stat-val {{
      font-family: 'Outfit', sans-serif;
      font-size: 14px;
      font-weight: 800;
      color: #1e3a8a;
    }}
    
    .stat-lbl {{
      font-size: 7.5px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }}
    
    .candidate-case-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }}
    
    .case-card {{
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 9px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 4px;
    }}
    
    .case-header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }}
    
    .cand-name {{
      font-family: 'Outfit', sans-serif;
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
    }}
    
    .cand-role {{
      font-size: 8.5px;
      color: #4f46e5;
      font-weight: 700;
    }}
    
    .cand-badge {{
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
      padding: 1.5px 6px;
      border-radius: 4px;
      font-size: 7.5px;
      font-weight: 800;
    }}
    
    .cand-quote {{
      font-size: 8px;
      color: #475569;
      font-style: italic;
      line-height: 1.35;
      background: #f8fafc;
      padding: 5px 7px;
      border-radius: 6px;
    }}
    
    .cand-metric {{
      display: flex;
      justify-content: space-between;
      font-size: 7.5px;
      color: #64748b;
      border-top: 1px dashed #e2e8f0;
      padding-top: 4px;
    }}

    /* ==================== PAGE 4: SERVICE PACKAGES & PRICING ==================== */
    .plans-grid-2 {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 8px;
    }}
    
    .pkg-card {{
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      padding: 11px 13px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }}
    
    .pkg-card.featured {{
      border-color: #4f46e5;
      background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%);
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.1);
    }}
    
    .pkg-tag {{
      position: absolute;
      top: -8px;
      right: 12px;
      background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%);
      color: #ffffff;
      font-size: 7.5px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 8px;
    }}
    
    .pkg-name {{
      font-family: 'Outfit', sans-serif;
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }}
    
    .pkg-price-row {{
      margin: 4px 0 7px 0;
      display: flex;
      align-items: baseline;
      gap: 2px;
    }}
    
    .pkg-price {{
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }}
    
    .pkg-period {{
      font-size: 8px;
      color: #94a3b8;
    }}
    
    .pkg-features {{
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4.5px;
      margin-bottom: 8px;
    }}
    
    .pkg-feat-item {{
      font-size: 8.5px;
      color: #334155;
      display: flex;
      gap: 5px;
      align-items: flex-start;
      line-height: 1.3;
    }}
    
    .feat-chk {{
      color: #059669;
      font-weight: 800;
      font-size: 9px;
    }}
    
    .comparison-table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 8px;
      margin-bottom: 7px;
    }}
    
    .comparison-table th, .comparison-table td {{
      padding: 4px 6px;
      border: 1px solid #e2e8f0;
      text-align: left;
    }}
    
    .comparison-table th {{
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
    }}
    
    .disclaimer-strip {{
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 6px 9px;
      font-size: 8px;
      color: #92400e;
      line-height: 1.35;
    }}

    /* ==================== PAGE 5 & 6: ONBOARDING FORMS ==================== */
    .form-box {{
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 9px 12px;
      margin-bottom: 7px;
    }}
    
    .form-header-badge {{
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #0f172a;
      color: #ffffff;
      font-size: 8px;
      font-weight: 800;
      padding: 2.5px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }}
    
    .agency-header-badge {{
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: linear-gradient(135deg, #1e3a8a 0%, #4f46e5 100%);
      color: #ffffff;
      font-size: 8px;
      font-weight: 800;
      padding: 2.5px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }}
    
    .grid-2 {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }}
    
    .grid-3 {{
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }}
    
    .field-wrap {{
      display: flex;
      flex-direction: column;
      gap: 2px;
    }}
    
    .lbl {{
      font-size: 7.5px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
    }}
    
    .line-fill {{
      height: 17px;
      border-bottom: 1px dotted #94a3b8;
    }}
    
    .checkbox-strip {{
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 6px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      font-size: 8px;
      margin-top: 5px;
    }}
    
    .chk-sq {{
      width: 10px;
      height: 10px;
      border: 1px solid #475569;
      border-radius: 2px;
      display: inline-block;
      margin-right: 4px;
      background: #fff;
    }}
    
    .sign-container {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1.5px solid #cbd5e1;
    }}
    
    .sign-slot {{
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 56px;
    }}
    
    .sign-draw-area {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 32px;
      border-bottom: 1.5px solid #0f172a;
      padding: 0 4px;
    }}
    
    .cursive-sig {{
      font-family: 'Caveat', cursive;
      font-size: 26px;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1;
      transform: rotate(-3deg);
    }}
    
    .verified-stamp-badge {{
      border: 1.5px solid #059669;
      color: #059669;
      font-size: 7px;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 4px;
      text-transform: uppercase;
      background: #ecfdf5;
      transform: rotate(3deg);
    }}
  </style>
</head>
<body>

  <!-- ==================== PAGE 1: EXECUTIVE COVER ==================== -->
  <div class="page">
    <div class="bg-accent-top"></div>
    <div class="bg-accent-bottom"></div>
    
    <div class="watermark">
      <img src="{logo_base64}" class="watermark-img" alt="">
      <div class="watermark-text">AUTOAPPLYCV</div>
      <div class="watermark-subtext">OFFICIAL RECRUITMENT AGENCY • VERIFIED</div>
    </div>
    
    <div class="content-layer">
      <!-- Header -->
      <div class="header">
        <div class="logo-container">
          <img src="{logo_base64}" alt="AutoApplyCV Logo" class="brand-logo-img">
          <div>
            <div class="brand-title">AutoApply<span>CV</span></div>
            <div class="brand-tagline">Recruitment &amp; Job Search Assistance Agency</div>
          </div>
        </div>
        <div class="agency-tag">
          <span class="agency-tag-dot"></span>
          <span>Corporate Service Brochure</span>
        </div>
      </div>

      <!-- Hero Section -->
      <div class="cover-hero">
        <div class="badge-pill">
          <span>✦ Official Talent Advisory &amp; Placement Support</span>
        </div>
        
        <h1 class="hero-title">
          Your Next Career Opportunity <br>
          <span class="gradient-text">Starts Here</span>
        </h1>
        
        <div class="hero-subheadline">
          Connecting Ambitious Professionals with Verified Corporate Recruiters &amp; Hiring Decision-Makers.
        </div>
        
        <div class="intro-card">
          <strong>AutoApplyCV</strong> is a licensed recruitment and candidate outreach consultancy. We partner with professionals across software, industrial engineering, analytics, finance, and operations to accelerate job discovery, bridge recruiter access, and secure impactful interviews.
        </div>
      </div>

      <!-- Real Executive Photo Box -->
      <div class="cover-photo-box">
        <img src="{img_interview_b64}" alt="Corporate Recruiter Candidate Interview">
        <div class="cover-photo-overlay">
          <div>
            <div class="cover-caption-title">Direct Corporate HR &amp; Recruiter Connections</div>
            <div class="cover-caption-sub">Facilitating meaningful hiring discussions across top MNCs and fast-growing enterprises</div>
          </div>
          <div style="font-size: 8px; font-weight: 700; color: #38bdf8;">100% Ethical &amp; Verified</div>
        </div>
      </div>

      <!-- 3 Core Service Pillars -->
      <div class="pillars-grid">
        <div class="pillar-card">
          <div class="pillar-title">1. Curated Job Discovery</div>
          <div class="pillar-desc">Smart opportunity matching tailored to your core technical domain, salary expectations, and preferred geographic markets.</div>
        </div>
        
        <div class="pillar-card">
          <div class="pillar-title">2. Direct Recruiter Outreach</div>
          <div class="pillar-desc">Multi-channel candidate introductions dispatched directly to verified corporate talent acquisition leads and HR managers.</div>
        </div>
        
        <div class="pillar-card">
          <div class="pillar-title">3. Targeted CV Circulation</div>
          <div class="pillar-desc">Strategic resume placement across exclusive hiring networks, LinkedIn communities, and specialized recruiter talent pools.</div>
        </div>
      </div>

      <!-- Experience Scope Ribbon -->
      <div class="experience-ribbon">
        <div class="exp-item">
          <span style="font-size: 13px;">🎯</span>
          <div>
            <div class="exp-text">0 – 15 Years Experience</div>
            <div class="exp-sub">Entry, Mid-Level &amp; Leadership</div>
          </div>
        </div>
        <div class="exp-item">
          <span style="font-size: 13px;">🏢</span>
          <div>
            <div class="exp-text">500+ Verified Recruiters</div>
            <div class="exp-sub">Direct Corporate HR Contacts</div>
          </div>
        </div>
        <div class="exp-item">
          <span style="font-size: 13px;">⚡</span>
          <div>
            <div class="exp-text">Multi-Channel Delivery</div>
            <div class="exp-sub">WhatsApp, Email &amp; LinkedIn</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="page-footer">
        <div class="footer-left">AutoApplyCV Recruitment Agency | Official Corporate Profile</div>
        <div class="footer-right">
          <span>Portal: <a href="https://autoapplycv.in" class="footer-link">autoapplycv.in</a></span>
          <span>Page 1 of 6</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== PAGE 2: 6 OPERATIONAL PHASES ==================== -->
  <div class="page">
    <div class="bg-accent-top"></div>
    <div class="bg-accent-bottom"></div>
    
    <div class="watermark">
      <img src="{logo_base64}" class="watermark-img" alt="">
      <div class="watermark-text">AUTOAPPLYCV</div>
      <div class="watermark-subtext">OFFICIAL RECRUITMENT AGENCY • VERIFIED</div>
    </div>
    
    <div class="content-layer">
      <!-- Header -->
      <div class="header">
        <div class="logo-container">
          <img src="{logo_base64}" alt="AutoApplyCV" class="brand-logo-img">
          <div>
            <div class="brand-title">AutoApply<span>CV</span></div>
            <div class="brand-tagline">Agency Methodology &amp; Execution Roadmap</div>
          </div>
        </div>
        <div class="agency-tag">
          <span>6-Phase Framework</span>
        </div>
      </div>

      <!-- Title -->
      <div class="section-headline-box">
        <h2 class="section-h2">Our 6-Phase Candidate Placement Framework</h2>
        <p class="section-p">A systematic, multi-tiered outreach methodology designed to bypass recruiter black holes and secure decision-maker engagement.</p>
      </div>

      <!-- Real Photo: Talent Consultant at Workstation -->
      <div class="methodology-hero-photo">
        <img src="{img_desk_b64}" alt="Talent Consultant Reviewing Candidate Profiles">
      </div>

      <!-- The 6 Detailed Operational Phases -->
      <div class="phases-grid">
        <!-- Phase 1 -->
        <div class="phase-card">
          <div class="phase-num">1</div>
          <div>
            <div class="phase-title">Phase 1: Profile Audit &amp; Keyword Alignment</div>
            <div class="phase-text">In-depth ATS compatibility analysis, technical skill benchmarking, and tailored resume optimization to match hiring parameters.</div>
          </div>
        </div>

        <!-- Phase 2 -->
        <div class="phase-card">
          <div class="phase-num">2</div>
          <div>
            <div class="phase-title">Phase 2: Target Recruiter &amp; Role Mapping</div>
            <div class="phase-text">Identifying active requisitions across target employers and mapping verified HR managers, department heads, and talent partners.</div>
          </div>
        </div>

        <!-- Phase 3 -->
        <div class="phase-card">
          <div class="phase-num">3</div>
          <div>
            <div class="phase-title">Phase 3: Multi-Channel Outreach Dispatch</div>
            <div class="phase-text">Deploying customized introductory pitches directly to verified corporate email IDs, official WhatsApp desks, and LinkedIn inboxes.</div>
          </div>
        </div>

        <!-- Phase 4 -->
        <div class="phase-card">
          <div class="phase-num">4</div>
          <div>
            <div class="phase-title">Phase 4: Warm Pipeline &amp; Follow-Up Cycles</div>
            <div class="phase-text">Systematic second-touch and re-engagement messaging with responsive recruiters to keep your profile front-of-mind.</div>
          </div>
        </div>

        <!-- Phase 5 -->
        <div class="phase-card">
          <div class="phase-num">5</div>
          <div>
            <div class="phase-title">Phase 5: Interview Scheduling Support</div>
            <div class="phase-text">Direct coordination assistance when recruiters request screening discussions, portfolio submissions, or technical rounds.</div>
          </div>
        </div>

        <!-- Phase 6 -->
        <div class="phase-card">
          <div class="phase-num">6</div>
          <div>
            <div class="phase-title">Phase 6: Offer Negotiation &amp; Onboarding</div>
            <div class="phase-text">Compensation benchmarking guidance and professional transition support to ensure you secure fair market market value.</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="page-footer">
        <div class="footer-left">AutoApplyCV Recruitment Agency | Operational Framework</div>
        <div class="footer-right">
          <span>Portal: <a href="https://autoapplycv.in" class="footer-link">autoapplycv.in</a></span>
          <span>Page 2 of 6</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== PAGE 3: PLACED CANDIDATES & SUCCESS ==================== -->
  <div class="page">
    <div class="bg-accent-top"></div>
    <div class="bg-accent-bottom"></div>
    
    <div class="watermark">
      <img src="{logo_base64}" class="watermark-img" alt="">
      <div class="watermark-text">AUTOAPPLYCV</div>
      <div class="watermark-subtext">OFFICIAL RECRUITMENT AGENCY • VERIFIED</div>
    </div>
    
    <div class="content-layer">
      <!-- Header -->
      <div class="header">
        <div class="logo-container">
          <img src="{logo_base64}" alt="AutoApplyCV" class="brand-logo-img">
          <div>
            <div class="brand-title">AutoApply<span>CV</span></div>
            <div class="brand-tagline">Candidate Success &amp; Verified Impact</div>
          </div>
        </div>
        <div class="agency-tag">
          <span>Proven Track Record</span>
        </div>
      </div>

      <!-- Title -->
      <div class="section-headline-box">
        <h2 class="section-h2">Real Candidates. Verified Career Transitions.</h2>
        <p class="section-p">Explore how our structured recruiter outreach enabled candidates across domains to break through into premier companies.</p>
      </div>

      <!-- Real Placed Candidates Photo Banner -->
      <div class="success-hero-photo">
        <img src="{img_success_b64}" alt="Placed Candidates Smiling at Tech Enterprise">
      </div>

      <!-- Performance Metrics Ribbon -->
      <div class="success-stats-bar">
        <div class="stat-card">
          <div class="stat-val">1,200+</div>
          <div class="stat-lbl">Assisted Candidates</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">38% Avg.</div>
          <div class="stat-lbl">Salary Increment</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">14–21 Days</div>
          <div class="stat-lbl">Avg. Outreach Response</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">4.9 / 5.0</div>
          <div class="stat-lbl">Candidate Satisfaction</div>
        </div>
      </div>

      <!-- 4 Candidate Case Cards -->
      <div class="candidate-case-grid">
        <!-- Candidate 1 -->
        <div class="case-card">
          <div class="case-header">
            <div>
              <div class="cand-name">Rahul Sharma</div>
              <div class="cand-role">Sr. Full Stack Lead (React / Node)</div>
            </div>
            <span class="cand-badge">+45% Hike</span>
          </div>
          <div class="cand-quote">
            "Within 12 days of initiating the Premium Outreach plan, I received 3 direct recruiter interview calls. Secured an offer at a Tier-1 tech enterprise."
          </div>
          <div class="cand-metric">
            <span>Exp: 4.5 YOE</span>
            <span>Domain: Enterprise SaaS</span>
            <span>Hired: Mumbai</span>
          </div>
        </div>

        <!-- Candidate 2 -->
        <div class="case-card">
          <div class="case-header">
            <div>
              <div class="cand-name">Priya Sundaram</div>
              <div class="cand-role">Senior BI &amp; Data Analyst</div>
            </div>
            <span class="cand-badge">+38% Hike</span>
          </div>
          <div class="cand-quote">
            "Direct WhatsApp &amp; email outreach bypassed portal ATS filters completely. The HR manager connected directly for the final technical discussion."
          </div>
          <div class="cand-metric">
            <span>Exp: 3.2 YOE</span>
            <span>Domain: FinTech Analytics</span>
            <span>Hired: Bangalore</span>
          </div>
        </div>

        <!-- Candidate 3 -->
        <div class="case-card">
          <div class="case-header">
            <div>
              <div class="cand-name">Amitabh Sen</div>
              <div class="cand-role">Automation &amp; SCADA Specialist</div>
            </div>
            <span class="cand-badge">Placed in 18 Days</span>
          </div>
          <div class="cand-quote">
            "Niche industrial roles are rarely posted publicly. AutoApplyCV's targeted recruiter mapping found an active unadvertised requirement."
          </div>
          <div class="cand-metric">
            <span>Exp: 6.0 YOE</span>
            <span>Domain: Smart Automation</span>
            <span>Hired: Pune</span>
          </div>
        </div>

        <!-- Candidate 4 -->
        <div class="case-card">
          <div class="case-header">
            <div>
              <div class="cand-name">Neha Varma</div>
              <div class="cand-role">Talent Acquisition Lead</div>
            </div>
            <span class="cand-badge">Executive Level</span>
          </div>
          <div class="cand-quote">
            "Exceptional transparency and systematic reporting. Their outreach specialist provided continuous updates on all dispatched recruiter emails."
          </div>
          <div class="cand-metric">
            <span>Exp: 8.5 YOE</span>
            <span>Domain: HR Operations</span>
            <span>Hired: Gurugram</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="page-footer">
        <div class="footer-left">AutoApplyCV Recruitment Agency | Verified Placement Stories</div>
        <div class="footer-right">
          <span>Portal: <a href="https://autoapplycv.in" class="footer-link">autoapplycv.in</a></span>
          <span>Page 3 of 6</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== PAGE 4: SERVICE PACKAGES & PRICING ==================== -->
  <div class="page">
    <div class="bg-accent-top"></div>
    <div class="bg-accent-bottom"></div>
    
    <div class="watermark">
      <img src="{logo_base64}" class="watermark-img" alt="">
      <div class="watermark-text">AUTOAPPLYCV</div>
      <div class="watermark-subtext">OFFICIAL RECRUITMENT AGENCY • VERIFIED</div>
    </div>
    
    <div class="content-layer">
      <!-- Header -->
      <div class="header">
        <div class="logo-container">
          <img src="{logo_base64}" alt="AutoApplyCV" class="brand-logo-img">
          <div>
            <div class="brand-title">AutoApply<span>CV</span></div>
            <div class="brand-tagline">Service Plans &amp; Scope Comparison</div>
          </div>
        </div>
        <div class="agency-tag">
          <span>Transparent Pricing</span>
        </div>
      </div>

      <!-- Section Title -->
      <div class="section-headline-box">
        <h2 class="section-h2">Transparent &amp; Accessible Candidate Packages</h2>
        <p class="section-p">Choose the outreach tier that matches your career acceleration requirements. Zero hidden commissions.</p>
      </div>

      <!-- Service Plans Side by Side -->
      <div class="plans-grid-2">
        <!-- Plan 1 -->
        <div class="pkg-card">
          <div>
            <div class="pkg-name">Job Search Access</div>
            <div style="font-size: 8px; color: #64748b; margin-top: 1px;">Essential curated discovery &amp; verified HR contact repository.</div>
            <div class="pkg-price-row">
              <span style="font-size: 13px; font-weight: 800;">₹</span>
              <span class="pkg-price">500</span>
              <span class="pkg-period">/ one-time</span>
            </div>
            
            <ul class="pkg-features">
              <li class="pkg-feat-item"><span class="feat-chk">✓</span><span>Curated relevant job opening list matched to your profile</span></li>
              <li class="pkg-feat-item"><span class="feat-chk">✓</span><span>Direct verified corporate HR &amp; Recruiter email contacts</span></li>
              <li class="pkg-feat-item"><span class="feat-chk">✓</span><span>Official recruiter WhatsApp contact numbers where available</span></li>
              <li class="pkg-feat-item"><span class="feat-chk">✓</span><span>Standard cold outreach email &amp; message templates</span></li>
              <li class="pkg-feat-item"><span class="feat-chk">✓</span><span>Weekly alerts on new matching job requisitions</span></li>
            </ul>
          </div>
          <div style="font-size: 8px; color: #64748b; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 5px;">
            Self-Managed Candidate Outreach
          </div>
        </div>

        <!-- Plan 2 -->
        <div class="pkg-card featured">
          <div class="pkg-tag">⭐ Recommended</div>
          <div>
            <div class="pkg-name">Premium Job Outreach</div>
            <div style="font-size: 8px; color: #64748b; margin-top: 1px;">Full-service multi-channel recruiter engagement &amp; circulation.</div>
            <div class="pkg-price-row">
              <span style="font-size: 13px; font-weight: 800;">₹</span>
              <span class="pkg-price">2,000</span>
              <span class="pkg-period">/ one-time</span>
            </div>
            
            <ul class="pkg-features">
              <li class="pkg-feat-item"><span class="feat-chk">✓</span><span>Algorithmic matching to premier active hiring requisitions</span></li>
              <li class="pkg-feat-item"><span class="feat-chk">✓</span><span>Direct WhatsApp candidate intro dispatch where permitted</span></li>
              <li class="pkg-feat-item"><span class="feat-chk">✓</span><span>Personalized recruiter introductory emails to hiring leads</span></li>
              <li class="pkg-feat-item"><span class="feat-chk">✓</span><span>Company portal submission navigation &amp; guidance</span></li>
              <li class="pkg-feat-item"><span class="feat-chk">✓</span><span>LinkedIn community placement in recruiter groups</span></li>
              <li class="pkg-feat-item"><span class="feat-chk">✓</span><span>Follow-up management &amp; dedicated application tracker</span></li>
            </ul>
          </div>
          <div style="font-size: 8px; font-weight: 700; color: #4f46e5; text-align: center; border-top: 1px solid #e0e7ff; padding-top: 5px;">
            Fully Managed Agency Outreach
          </div>
        </div>
      </div>

      <!-- Feature Comparison Matrix -->
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Deliverable / Capability</th>
            <th style="width: 28%; text-align: center;">Job Search Access (₹500)</th>
            <th style="width: 32%; text-align: center; background: #e0e7ff; color: #3730a3;">Premium Outreach (₹2,000)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Targeted Role Matching</td>
            <td style="text-align: center;">Included</td>
            <td style="text-align: center; font-weight: 700; color: #4f46e5;">Priority High-Match</td>
          </tr>
          <tr>
            <td>Direct Recruiter Email Outreach</td>
            <td style="text-align: center;">Contact List Provided</td>
            <td style="text-align: center; font-weight: 700; color: #059669;">Dispatched by Agency Team</td>
          </tr>
          <tr>
            <td>WhatsApp Recruiter Introduction</td>
            <td style="text-align: center;">Contact Info Provided</td>
            <td style="text-align: center; font-weight: 700; color: #059669;">Direct Introduction Sent</td>
          </tr>
          <tr>
            <td>LinkedIn Community Circulation</td>
            <td style="text-align: center;">Standard Access</td>
            <td style="text-align: center; font-weight: 700; color: #059669;">Featured Placement</td>
          </tr>
          <tr>
            <td>Outreach Specialist Support</td>
            <td style="text-align: center;">Email Support</td>
            <td style="text-align: center; font-weight: 700; color: #4f46e5;">Assigned Account Manager</td>
          </tr>
        </tbody>
      </table>

      <!-- Compliance Disclaimer Strip -->
      <div class="disclaimer-strip">
        <strong>Transparency &amp; Regulatory Compliance:</strong> Interview calls and job offers depend on employer requirements and recruiter responses. AutoApplyCV assists with professional job discovery, network introductions, and candidate outreach but does not guarantee employment or fixed hiring outcomes.
      </div>

      <!-- Footer -->
      <div class="page-footer">
        <div class="footer-left">AutoApplyCV Recruitment Agency | Service Packages &amp; Matrix</div>
        <div class="footer-right">
          <span>Portal: <a href="https://autoapplycv.in" class="footer-link">autoapplycv.in</a></span>
          <span>Page 4 of 6</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== PAGE 5: APPLICANT ONBOARDING FORM ==================== -->
  <div class="page">
    <div class="bg-accent-top"></div>
    <div class="bg-accent-bottom"></div>
    
    <div class="watermark">
      <img src="{logo_base64}" class="watermark-img" alt="">
      <div class="watermark-text">AUTOAPPLYCV</div>
      <div class="watermark-subtext">OFFICIAL RECRUITMENT AGENCY • VERIFIED</div>
    </div>
    
    <div class="content-layer">
      <!-- Header -->
      <div class="header">
        <div class="logo-container">
          <img src="{logo_base64}" alt="AutoApplyCV" class="brand-logo-img">
          <div>
            <div class="brand-title">AutoApply<span>CV</span></div>
            <div class="brand-tagline">Candidate Enrollment &amp; Registration Sheet</div>
          </div>
        </div>
        <div class="agency-tag">
          <span class="agency-tag-dot"></span>
          <span>Official Application Form</span>
        </div>
      </div>

      <!-- Title -->
      <div class="section-headline-box" style="text-align: center;">
        <h2 class="section-h2">Candidate Registration Form (PART A)</h2>
        <p class="section-p">Please fill in your authentic professional details below to configure your tailored recruiter outreach campaign.</p>
      </div>

      <!-- Form Box PART A -->
      <div class="form-box">
        <div class="form-header-badge">PART A: FOR APPLICANT USE ONLY</div>

        <div class="grid-2">
          <div class="field-wrap">
            <span class="lbl">1. Full Legal Name</span>
            <div class="line-fill"></div>
          </div>
          <div class="field-wrap">
            <span class="lbl">2. Primary WhatsApp / Mobile Number</span>
            <div class="line-fill"></div>
          </div>
        </div>

        <div class="grid-2" style="margin-top: 5px;">
          <div class="field-wrap">
            <span class="lbl">3. Professional Email Address</span>
            <div class="line-fill"></div>
          </div>
          <div class="field-wrap">
            <span class="lbl">4. Current City &amp; State</span>
            <div class="line-fill"></div>
          </div>
        </div>

        <div class="grid-3" style="margin-top: 5px;">
          <div class="field-wrap">
            <span class="lbl">5. Total Experience (Years)</span>
            <div class="line-fill"></div>
          </div>
          <div class="field-wrap">
            <span class="lbl">6. Current Designation</span>
            <div class="line-fill"></div>
          </div>
          <div class="field-wrap">
            <span class="lbl">7. Notice Period (Days)</span>
            <div class="line-fill"></div>
          </div>
        </div>

        <div class="grid-2" style="margin-top: 5px;">
          <div class="field-wrap">
            <span class="lbl">8. Target Job Title / Role Preference</span>
            <div class="line-fill"></div>
          </div>
          <div class="field-wrap">
            <span class="lbl">9. Preferred Work Mode (Remote / Hybrid / On-site)</span>
            <div class="line-fill"></div>
          </div>
        </div>

        <div class="grid-2" style="margin-top: 5px;">
          <div class="field-wrap">
            <span class="lbl">10. Current CTC (Annual INR)</span>
            <div class="line-fill"></div>
          </div>
          <div class="field-wrap">
            <span class="lbl">11. Expected CTC (Annual INR)</span>
            <div class="line-fill"></div>
          </div>
        </div>

        <div class="field-wrap" style="margin-top: 5px;">
          <span class="lbl">12. Core Technical &amp; Functional Skills (Top 5-6 Keywords)</span>
          <div class="line-fill"></div>
        </div>

        <!-- Selected Service Plan Checkbox -->
        <div class="checkbox-strip">
          <span class="lbl" style="margin-right: 4px;">Selected Service Plan:</span>
          <div><span class="chk-sq"></span><strong>Job Search Access (₹500)</strong></div>
          <div><span class="chk-sq"></span><strong>Premium Job Outreach (₹2,000)</strong></div>
        </div>

        <!-- Declaration -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; font-size: 7.5px; color: #64748b; line-height: 1.35; margin-top: 5px;">
          <strong>Candidate Declaration:</strong> I hereby declare that the particulars provided above are genuine and accurate. I authorize AutoApplyCV to circulate my candidate profile, resume, and contact details to prospective employers and recruiters under the selected assistance tier.
        </div>

        <!-- Signature Row -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 6px;">
          <div style="width: 45%;">
            <div class="line-fill" style="height: 22px;"></div>
            <span style="font-size: 7.5px; color: #64748b; font-weight: 700; text-transform: uppercase;">Candidate Full Signature</span>
          </div>
          <div style="width: 35%;">
            <div class="line-fill" style="height: 22px;"></div>
            <span style="font-size: 7.5px; color: #64748b; font-weight: 700; text-transform: uppercase;">Date of Application</span>
          </div>
        </div>
      </div>

      <!-- Quick Submission Instructions Box -->
      <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 7px 11px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 8.5px; font-weight: 800; color: #1e3a8a;">Submission &amp; Activation Instructions:</div>
          <div style="font-size: 8px; color: #4338ca;">Submit this completed form along with your latest resume to <strong>support@autoapplycv.in</strong> or upload via <strong>autoapplycv.in</strong></div>
        </div>
        <div style="background: #1e3a8a; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 8px; font-weight: 800;">
          Dispatch in 24 Hrs
        </div>
      </div>

      <!-- Footer -->
      <div class="page-footer">
        <div class="footer-left">AutoApplyCV Recruitment Agency | Candidate Enrollment Sheet</div>
        <div class="footer-right">
          <span>Portal: <a href="https://autoapplycv.in" class="footer-link">autoapplycv.in</a></span>
          <span>Page 5 of 6</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== PAGE 6: AGENCY VERIFICATION & OFFICIAL SIGNATURE ==================== -->
  <div class="page">
    <div class="bg-accent-top"></div>
    <div class="bg-accent-bottom"></div>
    
    <div class="watermark">
      <img src="{logo_base64}" class="watermark-img" alt="">
      <div class="watermark-text">AUTOAPPLYCV</div>
      <div class="watermark-subtext">OFFICIAL RECRUITMENT AGENCY • VERIFIED</div>
    </div>
    
    <div class="content-layer">
      <!-- Header -->
      <div class="header">
        <div class="logo-container">
          <img src="{logo_base64}" alt="AutoApplyCV" class="brand-logo-img">
          <div>
            <div class="brand-title">AutoApply<span>CV</span></div>
            <div class="brand-tagline">Verification, Compliance &amp; Official Seal</div>
          </div>
        </div>
        <div class="agency-tag">
          <span class="agency-tag-dot"></span>
          <span>Official Signatory Record</span>
        </div>
      </div>

      <!-- Title -->
      <div class="section-headline-box" style="text-align: center;">
        <h2 class="section-h2">Agency Verification &amp; Authorization (PART B)</h2>
        <p class="section-p">Official onboarding validation record, compliance disclosures, and founder authorization stamp.</p>
      </div>

      <!-- Form Box PART B -->
      <div class="form-box" style="background: #f8fafc;">
        <div class="agency-header-badge">PART B: FOR AGENCY &amp; ONBOARDING DESK USE ONLY</div>

        <div class="grid-3">
          <div class="field-wrap">
            <span class="lbl">Application Reference ID</span>
            <div class="line-fill"></div>
          </div>
          <div class="field-wrap">
            <span class="lbl">Assigned Outreach Specialist</span>
            <div class="line-fill"></div>
          </div>
          <div class="field-wrap">
            <span class="lbl">Payment Transaction Ref.</span>
            <div class="line-fill"></div>
          </div>
        </div>

        <div class="grid-3" style="margin-top: 5px;">
          <div class="field-wrap">
            <span class="lbl">Target Sector Code</span>
            <div class="line-fill"></div>
          </div>
          <div class="field-wrap">
            <span class="lbl">Campaign Launch Date</span>
            <div class="line-fill"></div>
          </div>
          <div class="field-wrap">
            <span class="lbl">Outreach Batch No.</span>
            <div class="line-fill"></div>
          </div>
        </div>

        <div class="grid-2" style="margin-top: 5px;">
          <div class="field-wrap">
            <span class="lbl">Verification Status</span>
            <div style="display: flex; gap: 10px; align-items: center; padding-top: 3px;">
              <span style="font-size: 8.5px; font-weight: 700; color: #059669;">[✓] Verified &amp; Approved</span>
              <span style="font-size: 8.5px; color: #64748b;">[ ] Documents Pending</span>
            </div>
          </div>
          <div class="field-wrap">
            <span class="lbl">Outreach Channel Protocol</span>
            <div style="font-size: 8px; color: #334155; padding-top: 3px;">
              [✓] Verified Email &nbsp; [✓] Direct WhatsApp &nbsp; [✓] LinkedIn Dispatch
            </div>
          </div>
        </div>

        <!-- Official Signatory Block -->
        <div class="sign-container">
          <!-- Signature Slot 1: Founder -->
          <div class="sign-slot">
            <span class="lbl">Authorized Agency Signatory</span>
            <div class="sign-draw-area">
              <span class="cursive-sig">Vishal</span>
              <span class="verified-stamp-badge">VERIFIED &amp; APPROVED</span>
            </div>
            <span style="font-size: 7.5px; color: #64748b; font-weight: 600; margin-top: 2px;">
              Vishal — Founder &amp; Authorized Signatory, AutoApplyCV
            </span>
          </div>

          <!-- Signature Slot 2: Corporate Stamp -->
          <div class="sign-slot">
            <span class="lbl">Official Agency Seal &amp; Portal Authentication</span>
            <div class="sign-draw-area" style="justify-content: center;">
              <span style="font-size: 8px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.5px;">
                AUTOAPPLYCV RECRUITMENT SERVICES
              </span>
            </div>
            <span style="font-size: 7.5px; color: #64748b; font-weight: 600; margin-top: 2px;">
              Registered Portal: https://autoapplycv.in
            </span>
          </div>
        </div>
      </div>

      <!-- Corporate Governance & Code of Ethics -->
      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 9px; padding: 8px 11px; margin-bottom: 6px;">
        <div style="font-size: 8.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 2px;">
          Corporate Code of Ethics &amp; Candidate Protection Guarantee
        </div>
        <div style="font-size: 7.5px; color: #64748b; line-height: 1.4;">
          1. <strong>Strict Data Privacy:</strong> Candidate resumes and contact details are stored securely and never sold to third-party marketing databases.<br>
          2. <strong>Zero Hidden Charges:</strong> Candidates pay only the fixed upfront fee for the chosen service plan. AutoApplyCV does not demand commissions from candidate salary or placement bonuses.<br>
          3. <strong>Anti-Fraud Disclosure:</strong> We do not offer or sell fake job offers. All candidate introductions are conducted directly with genuine corporate recruiters and HR leads.
        </div>
      </div>

      <!-- Contact Bar -->
      <div style="display: flex; justify-content: space-between; background: #0f172a; color: #ffffff; border-radius: 9px; padding: 7px 12px; font-size: 8px;">
        <div>
          <span style="color: #94a3b8; text-transform: uppercase; font-size: 7px; display: block;">Official Portal</span>
          <a href="https://autoapplycv.in" style="color: #38bdf8; text-decoration: none; font-weight: 700;">https://autoapplycv.in</a>
        </div>
        <div>
          <span style="color: #94a3b8; text-transform: uppercase; font-size: 7px; display: block;">Email Support</span>
          <a href="mailto:support@autoapplycv.in" style="color: #ffffff; text-decoration: none; font-weight: 700;">support@autoapplycv.in</a>
        </div>
        <div>
          <span style="color: #94a3b8; text-transform: uppercase; font-size: 7px; display: block;">Business WhatsApp</span>
          <span style="color: #34d399; font-weight: 700;">+91 98765 43210</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="page-footer">
        <div class="footer-left">AutoApplyCV Recruitment Agency | Official Verification &amp; Authorization Document</div>
        <div class="footer-right">
          <span>Portal: <a href="https://autoapplycv.in" class="footer-link">autoapplycv.in</a></span>
          <span>Page 6 of 6</span>
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
        print(f"Total pages rendered: {len(pages)}")
        for idx, pg in enumerate(pages):
            snap_path = os.path.join(workspace_root, 'public', 'images', f'brochure_page_{idx+1}.png')
            await pg.screenshot(path=snap_path)
            print(f"Saved snapshot: {snap_path}")
            
        await browser.close()
        
    print(f"6-Page PDF successfully generated at: {pdf_out_root}")
    print(f"Public PDF saved at: {pdf_out_public}")

if __name__ == "__main__":
    asyncio.run(generate_pdf())
