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
    img_path = os.path.join(workspace_root, "public", "images", "candidate_recruiter_connect.jpg")
    img_base64 = get_image_base64(img_path, "image/jpeg")
    
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
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=Caveat:wght@600;700&display=swap');
    
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
      font-size: 12px;
      line-height: 1.45;
    }}
    
    .page {{
      width: 210mm;
      height: 297mm;
      position: relative;
      background: #ffffff;
      padding: 13mm 17mm 11mm 17mm;
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
    
    /* Elegant Subtle Watermark */
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
      opacity: 0.045;
      text-align: center;
      width: 100%;
    }}
    
    .watermark-img {{
      width: 210px;
      height: auto;
      margin-bottom: 6px;
      filter: grayscale(100%) contrast(150%);
    }}
    
    .watermark-text {{
      font-family: 'Outfit', sans-serif;
      font-size: 36px;
      font-weight: 900;
      letter-spacing: 6px;
      color: #0f172a;
      text-transform: uppercase;
      white-space: nowrap;
    }}
    
    .watermark-subtext {{
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 12px;
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
    
    /* Header */
    .header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 10px;
      border-bottom: 1.5px solid #e2e8f0;
    }}
    
    .logo-container {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    
    .brand-logo-img {{
      height: 38px;
      width: auto;
      max-width: 120px;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.06));
    }}
    
    .logo-badge {{
      width: 36px;
      height: 36px;
      border-radius: 9px;
      background: linear-gradient(135deg, #1e3a8a 0%, #4f46e5 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 16px;
      box-shadow: 0 4px 10px rgba(30, 58, 138, 0.25);
    }}
    
    .brand-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 19px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      line-height: 1;
    }}
    
    .brand-title span {{
      color: #4f46e5;
    }}
    
    .brand-tagline {{
      font-size: 8.5px;
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
      padding: 4px 11px;
      border-radius: 20px;
      font-size: 9.5px;
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
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }}
    
    .badge-pill {{
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(90deg, #eef2ff 0%, #e0e7ff 100%);
      border: 1px solid #c7d2fe;
      color: #4338ca;
      font-size: 9px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 16px;
      letter-spacing: 0.3px;
    }}
    
    .hero-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 25px;
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
      font-size: 12.5px;
      font-weight: 600;
      color: #334155;
      line-height: 1.35;
    }}
    
    .intro-card {{
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-left: 4px solid #4f46e5;
      border-radius: 0 12px 12px 0;
      padding: 9px 13px;
      font-size: 10.5px;
      color: #475569;
      line-height: 1.45;
    }}
    
    .intro-card strong {{
      color: #0f172a;
      font-weight: 700;
    }}
    
    /* 3 Core Pillars */
    .pillars-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 9px;
      margin-top: 8px;
    }}
    
    .pillar-card {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 11px;
      padding: 9px 11px;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }}
    
    .pillar-icon-box {{
      width: 26px;
      height: 26px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    
    .icon-blue {{ background: #eff6ff; color: #2563eb; }}
    .icon-purple {{ background: #eef2ff; color: #4f46e5; }}
    .icon-teal {{ background: #ecfdf5; color: #059669; }}
    
    .pillar-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.25;
    }}
    
    .pillar-desc {{
      font-size: 9px;
      color: #64748b;
      line-height: 1.35;
    }}
    
    /* Illustration Card */
    .illustration-card {{
      margin-top: 8px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
      height: 145px;
      background: #0f172a;
    }}
    
    .illustration-card img {{
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }}
    
    /* 3-Step Process Workflow */
    .workflow-row {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 7px 10px;
    }}
    
    .workflow-step {{
      display: flex;
      align-items: center;
      gap: 7px;
    }}
    
    .workflow-number {{
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #1e3a8a;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9.5px;
      font-weight: 800;
      flex-shrink: 0;
    }}
    
    .workflow-title {{
      font-size: 9.5px;
      font-weight: 700;
      color: #0f172a;
    }}
    
    .workflow-sub {{
      font-size: 8px;
      color: #64748b;
    }}
    
    /* Experience Scope Ribbon */
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
      gap: 7px;
    }}
    
    .exp-icon {{
      font-size: 13px;
    }}
    
    .exp-text {{
      font-size: 9.5px;
      font-weight: 700;
      color: #ffffff;
    }}
    
    .exp-sub {{
      font-size: 8px;
      color: #94a3b8;
    }}
    
    /* Footer */
    .page-footer {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1.5px solid #e2e8f0;
      padding-top: 8px;
      margin-top: 8px;
      font-size: 8.5px;
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
    
    /* ==================== PAGE 2 STYLES ==================== */
    .page2-header {{
      margin-top: 8px;
      margin-bottom: 8px;
      text-align: center;
    }}
    
    .page2-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }}
    
    .page2-subtitle {{
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }}
    
    .plans-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 13px;
      margin-bottom: 9px;
    }}
    
    .plan-card {{
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      padding: 13px 15px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
      position: relative;
    }}
    
    .plan-card.featured {{
      border-color: #4f46e5;
      background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%);
      box-shadow: 0 8px 24px rgba(79, 70, 229, 0.12);
    }}
    
    .featured-badge {{
      position: absolute;
      top: -9px;
      right: 14px;
      background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%);
      color: #ffffff;
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 2.5px 8px;
      border-radius: 10px;
    }}
    
    .plan-header {{
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 9px;
    }}
    
    .plan-name {{
      font-family: 'Outfit', sans-serif;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }}
    
    .plan-desc {{
      font-size: 9px;
      color: #64748b;
      margin-top: 2px;
      line-height: 1.35;
    }}
    
    .plan-price-box {{
      margin-top: 7px;
      display: flex;
      align-items: baseline;
      gap: 3px;
    }}
    
    .price-currency {{
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }}
    
    .price-amount {{
      font-family: 'Outfit', sans-serif;
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }}
    
    .price-period {{
      font-size: 8.5px;
      color: #94a3b8;
      font-weight: 600;
    }}
    
    .plan-features {{
      list-style: none;
      margin: 9px 0 11px 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }}
    
    .plan-feature-item {{
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 9.5px;
      color: #334155;
      line-height: 1.32;
    }}
    
    .feature-icon {{
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #ecfdf5;
      color: #059669;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
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
      padding: 6.5px 0;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 700;
      text-decoration: none;
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
      border-radius: 9px;
      padding: 7px 11px;
      display: flex;
      gap: 7px;
      align-items: flex-start;
      margin-bottom: 8px;
    }}
    
    .disclaimer-icon {{
      color: #d97706;
      font-size: 11px;
      font-weight: 800;
      margin-top: 1px;
      flex-shrink: 0;
    }}
    
    .disclaimer-title {{
      font-size: 9px;
      font-weight: 700;
      color: #92400e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 1px;
    }}
    
    .disclaimer-text {{
      font-size: 8.5px;
      color: #78350f;
      line-height: 1.35;
    }}
    
    /* CTA Banner */
    .cta-banner {{
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #1e3a8a 100%);
      border-radius: 11px;
      padding: 10px 14px;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
    }}
    
    .cta-info {{
      max-width: 60%;
    }}
    
    .cta-heading {{
      font-family: 'Outfit', sans-serif;
      font-size: 13.5px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.2;
    }}
    
    .cta-subtext {{
      font-size: 9px;
      color: #cbd5e1;
      margin-top: 2px;
    }}
    
    .cta-button {{
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #38bdf8;
      color: #0f172a;
      padding: 6.5px 13px;
      border-radius: 7px;
      font-size: 10px;
      font-weight: 800;
      text-decoration: none;
      box-shadow: 0 3px 8px rgba(56, 189, 248, 0.3);
    }}
    
    /* Contact Bar */
    .contact-bar {{
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 9px;
      padding: 7px 12px;
    }}
    
    .contact-item {{
      display: flex;
      align-items: center;
      gap: 7px;
    }}
    
    .contact-icon {{
      font-size: 12px;
    }}
    
    .contact-label {{
      font-size: 7.5px;
      color: #94a3b8;
      text-transform: uppercase;
      font-weight: 700;
    }}
    
    .contact-value {{
      font-size: 9.5px;
      font-weight: 700;
      color: #0f172a;
      text-decoration: none;
    }}
    
    /* ==================== PAGE 3 STYLES (FORM & SIGNATURE) ==================== */
    .page3-header {{
      margin-top: 6px;
      margin-bottom: 6px;
      text-align: center;
    }}
    
    .page3-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.4px;
    }}
    
    .page3-subtitle {{
      font-size: 9.5px;
      color: #64748b;
      margin-top: 1px;
    }}
    
    .form-section {{
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 11px;
      padding: 10px 13px;
      margin-bottom: 7px;
    }}
    
    .agency-section {{
      background: #f8fafc;
      border: 1.5px solid #94a3b8;
      border-radius: 11px;
      padding: 9px 13px;
      margin-bottom: 5px;
    }}
    
    .section-header-pill {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #0f172a;
      color: #ffffff;
      font-size: 8.5px;
      font-weight: 800;
      padding: 2.5px 9px;
      border-radius: 5px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 7px;
    }}
    
    .agency-header-pill {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #1e3a8a 0%, #4f46e5 100%);
      color: #ffffff;
      font-size: 8.5px;
      font-weight: 800;
      padding: 2.5px 9px;
      border-radius: 5px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 7px;
    }}
    
    .form-grid-2 {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }}
    
    .form-grid-3 {{
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
    }}
    
    .form-field {{
      display: flex;
      flex-direction: column;
      gap: 2px;
    }}
    
    .field-label {{
      font-size: 8px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }}
    
    .field-line {{
      height: 18px;
      border-bottom: 1px dotted #94a3b8;
      background: #fdfdfd;
    }}
    
    .plan-checkbox-row {{
      display: flex;
      align-items: center;
      gap: 14px;
      margin-top: 6px;
      padding: 5px 8px;
      background: #f8fafc;
      border-radius: 6px;
      border: 1px dashed #cbd5e1;
    }}
    
    .checkbox-item {{
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 8.5px;
      font-weight: 600;
      color: #1e293b;
    }}
    
    .checkbox-box {{
      width: 11px;
      height: 11px;
      border: 1.5px solid #475569;
      border-radius: 3px;
      background: #ffffff;
    }}
    
    .declaration-text {{
      font-size: 8px;
      color: #64748b;
      line-height: 1.35;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 5px 8px;
      margin-top: 5px;
    }}
    
    .sign-caption {{
      font-size: 8px;
      color: #64748b;
      font-weight: 600;
      margin-top: 2px;
      display: block;
    }}
    
    /* Signature Row */
    .sign-row {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 5px;
      padding-top: 6px;
      border-top: 1.5px solid #cbd5e1;
    }}
    
    .sign-box {{
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 58px;
    }}
    
    .sign-area {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 34px;
      border-bottom: 1.5px solid #0f172a;
      padding: 0 4px;
    }}
    
    .agency-signature-cursive {{
      font-family: 'Caveat', cursive;
      font-size: 26px;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1;
      transform: rotate(-3deg);
    }}
    
    .official-stamp {{
      border: 1.5px solid #059669;
      color: #059669;
      font-size: 7px;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      transform: rotate(3deg);
      background: #ecfdf5;
    }}
  </style>
</head>
<body>

  <!-- ==================== PAGE 1 ==================== -->
  <div class="page">
    <div class="bg-blob-1"></div>
    <div class="bg-blob-2"></div>
    
    <!-- Watermark Layer -->
    <div class="watermark">
      <img src="{logo_base64}" class="watermark-img" alt="">
      <div class="watermark-text">AUTOAPPLYCV</div>
      <div class="watermark-subtext">OFFICIAL RECRUITMENT AGENCY • VERIFIED</div>
    </div>
    
    <div class="content-layer">
      <!-- Top Header -->
      <div class="header">
        <div class="logo-container">
          <img src="{logo_base64}" alt="AutoApplyCV" class="brand-logo-img">
          <div>
            <div class="brand-title">AutoApply<span>CV</span></div>
            <div class="brand-tagline">Recruitment &amp; Job Search Assistance Agency</div>
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <div class="pillar-title">Personalized Job Search Assistance</div>
          <div class="pillar-desc">Smart matching of available openings tailored to your role, skills, experience, and target location.</div>
        </div>
        
        <div class="pillar-card">
          <div class="pillar-icon-box icon-purple">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          </div>
          <div class="pillar-title">Recruiter Outreach</div>
          <div class="pillar-desc">Direct outreach and introduction to verified corporate recruiters, HR managers, and hiring leads across channels.</div>
        </div>
        
        <div class="pillar-card">
          <div class="pillar-icon-box icon-teal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
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
          <span>Page 1 of 3</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== PAGE 2 ==================== -->
  <div class="page">
    <div class="bg-blob-1"></div>
    <div class="bg-blob-2"></div>
    
    <!-- Watermark Layer -->
    <div class="watermark">
      <img src="{logo_base64}" class="watermark-img" alt="">
      <div class="watermark-text">AUTOAPPLYCV</div>
      <div class="watermark-subtext">OFFICIAL RECRUITMENT AGENCY • VERIFIED</div>
    </div>
    
    <div class="content-layer">
      <!-- Top Header -->
      <div class="header">
        <div class="logo-container">
          <img src="{logo_base64}" alt="AutoApplyCV" class="brand-logo-img">
          <div>
            <div class="brand-title">AutoApply<span>CV</span></div>
            <div class="brand-tagline">Recruitment &amp; Job Search Assistance Agency</div>
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
          <span>Page 2 of 3</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== PAGE 3 (ONBOARDING & VERIFICATION) ==================== -->
  <div class="page">
    <div class="bg-blob-1"></div>
    <div class="bg-blob-2"></div>
    
    <!-- Watermark Layer -->
    <div class="watermark">
      <img src="{logo_base64}" class="watermark-img" alt="">
      <div class="watermark-text">AUTOAPPLYCV</div>
      <div class="watermark-subtext">OFFICIAL RECRUITMENT AGENCY • VERIFIED</div>
    </div>
    
    <div class="content-layer">
      <!-- Top Header -->
      <div class="header">
        <div class="logo-container">
          <img src="{logo_base64}" alt="AutoApplyCV" class="brand-logo-img">
          <div>
            <div class="brand-title">AutoApply<span>CV</span></div>
            <div class="brand-tagline">Candidate Enrollment &amp; Verification Sheet</div>
          </div>
        </div>
        <div class="agency-tag">
          <span class="agency-tag-dot"></span>
          <span>Official Onboarding Form</span>
        </div>
      </div>

      <!-- Page 3 Header -->
      <div class="page3-header">
        <h2 class="page3-title">Candidate Registration &amp; Agency Verification</h2>
        <p class="page3-subtitle">Please complete the applicant details below to initiate your structured recruiter outreach process.</p>
      </div>

      <!-- PART A: APPLICANT USE ONLY -->
      <div class="form-section">
        <div class="section-header-pill">
          <span>PART A: FOR APPLICANT USE</span>
        </div>

        <div class="form-grid-2">
          <div class="form-field">
            <span class="field-label">1. Full Legal Name</span>
            <div class="field-line"></div>
          </div>
          <div class="form-field">
            <span class="field-label">2. Contact / WhatsApp Number</span>
            <div class="field-line"></div>
          </div>
        </div>

        <div class="form-grid-2" style="margin-top: 5px;">
          <div class="form-field">
            <span class="field-label">3. Email Address</span>
            <div class="field-line"></div>
          </div>
          <div class="form-field">
            <span class="field-label">4. Current City / Location</span>
            <div class="field-line"></div>
          </div>
        </div>

        <div class="form-grid-3" style="margin-top: 5px;">
          <div class="form-field">
            <span class="field-label">5. Total Experience (Years)</span>
            <div class="field-line"></div>
          </div>
          <div class="form-field">
            <span class="field-label">6. Target Job Title / Role</span>
            <div class="field-line"></div>
          </div>
          <div class="form-field">
            <span class="field-label">7. Preferred Work Mode / City</span>
            <div class="field-line"></div>
          </div>
        </div>

        <!-- Selected Service Plan Checkbox -->
        <div class="plan-checkbox-row">
          <span class="field-label" style="margin-right: 4px;">Selected Service Plan:</span>
          <div class="checkbox-item">
            <div class="checkbox-box"></div>
            <span>Job Search Access (₹500)</span>
          </div>
          <div class="checkbox-item">
            <div class="checkbox-box"></div>
            <span>Premium Job Outreach (₹2,000)</span>
          </div>
        </div>

        <!-- Candidate Declaration -->
        <div class="declaration-text">
          <strong>Candidate Declaration:</strong> I hereby confirm that the information submitted above is accurate and authorize AutoApplyCV to circulate my resume and initiate recruiter communications on my behalf in accordance with the selected service plan.
        </div>

        <!-- Applicant Signature Line -->
        <div style="margin-top: 5px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div style="width: 45%;">
            <div class="field-line" style="height: 20px;"></div>
            <span class="sign-caption">Applicant Signature</span>
          </div>
          <div style="width: 35%;">
            <div class="field-line" style="height: 20px;"></div>
            <span class="sign-caption">Date (DD / MM / YYYY)</span>
          </div>
        </div>
      </div>

      <!-- PART B: FOR AGENCY USE ONLY -->
      <div class="agency-section">
        <div class="agency-header-pill">
          <span>PART B: FOR AGENCY &amp; VERIFICATION USE ONLY</span>
        </div>

        <div class="form-grid-3">
          <div class="form-field">
            <span class="field-label">Candidate Reference ID</span>
            <div class="field-line"></div>
          </div>
          <div class="form-field">
            <span class="field-label">Assigned Outreach Specialist</span>
            <div class="field-line"></div>
          </div>
          <div class="form-field">
            <span class="field-label">Payment Receipt / Ref No.</span>
            <div class="field-line"></div>
          </div>
        </div>

        <div class="form-grid-2" style="margin-top: 5px;">
          <div class="form-field">
            <span class="field-label">Verification Status</span>
            <div style="display: flex; gap: 12px; align-items: center; padding-top: 3px;">
              <span style="font-size: 9px; font-weight: 700; color: #059669;">[✓] Verified &amp; Approved</span>
              <span style="font-size: 9px; color: #64748b;">[ ] Under Review</span>
            </div>
          </div>
          <div class="form-field">
            <span class="field-label">Service Commencement Date</span>
            <div class="field-line"></div>
          </div>
        </div>

        <!-- Authorized Signature Block with "Vishal" Signature -->
        <div class="sign-row">
          <div class="sign-box">
            <span class="field-label">Authorized Agency Signatory</span>
            <div class="sign-area">
              <span class="agency-signature-cursive">Vishal</span>
              <span class="official-stamp">VERIFIED &amp; APPROVED</span>
            </div>
            <span class="sign-caption">Vishal — Founder / Authorized Signatory, AutoApplyCV</span>
          </div>

          <div class="sign-box">
            <span class="field-label">Official Agency Seal &amp; Portal Auth</span>
            <div class="sign-area" style="justify-content: center;">
              <span style="font-size: 8.5px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.5px;">
                AUTOAPPLYCV RECRUITMENT SERVICES
              </span>
            </div>
            <span class="sign-caption">Official Portal: https://autoapplycv.in</span>
          </div>
        </div>
      </div>

      <!-- Page 3 Footer -->
      <div class="page-footer">
        <div class="footer-left">AutoApplyCV | Candidate Enrollment &amp; Verification Sheet</div>
        <div class="footer-right">
          <span>Website: <a href="https://autoapplycv.in" class="footer-link">autoapplycv.in</a></span>
          <span>Page 3 of 3</span>
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
        
    print(f"3-Page PDF successfully generated at: {pdf_out_root}")
    print(f"Public PDF saved at: {pdf_out_public}")

if __name__ == "__main__":
    asyncio.run(generate_pdf())
