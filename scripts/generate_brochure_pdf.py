import os
import base64
import asyncio
import io
import qrcode
from playwright.async_api import async_playwright

def get_image_base64(path, default_mime="image/jpeg"):
    if os.path.exists(path):
        mime = "image/png" if path.lower().endswith(".png") else default_mime
        with open(path, "rb") as f:
            return f"data:{mime};base64,{base64.b64encode(f.read()).decode('utf-8')}"
    return ""

def generate_qr_base64(data_url):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=12,
        border=2,
    )
    qr.add_data(data_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#090d16", back_color="#ffffff")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

async def generate_6page_pdf():
    workspace_root = os.path.abspath("e:/Autoapply")
    
    img_interview_path = os.path.join(workspace_root, "public", "images", "corporate_recruiter_interview.jpg")
    img_interview_b64 = get_image_base64(img_interview_path, "image/jpeg")
    
    img_connect_path = os.path.join(workspace_root, "public", "images", "candidate_recruiter_connect.jpg")
    img_connect_b64 = get_image_base64(img_connect_path, "image/jpeg")
    
    img_success_path = os.path.join(workspace_root, "public", "images", "placed_candidates_success.jpg")
    img_success_b64 = get_image_base64(img_success_path, "image/jpeg")
    
    img_desk_path = os.path.join(workspace_root, "public", "images", "recruitment_consultant_desk.jpg")
    img_desk_b64 = get_image_base64(img_desk_path, "image/jpeg")
    
    logo_path = os.path.join(workspace_root, "public", "logos", "new_logo_transparent.png")
    if not os.path.exists(logo_path):
        logo_path = os.path.join(workspace_root, "public", "branding", "new_logo_transparent.png")
    logo_base64 = get_image_base64(logo_path, "image/png")
    
    qr_b64 = generate_qr_base64("https://autoapplycv.in/recruitment-agency")
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AutoApplyCV - 6-Page Corporate Recruitment Brochure</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Outfit:wght@500;600;700;800;900&family=Caveat:wght@700&display=swap');
    
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
      color: #090d16;
      background-color: #ffffff;
      font-size: 11px;
      line-height: 1.4;
    }}
    
    .page {{
      width: 210mm;
      height: 297mm;
      box-sizing: border-box;
      position: relative;
      background: #ffffff;
      color: #090d16;
      padding: 10mm 12mm 10mm 12mm;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
      page-break-after: always;
    }}
    
    /* Header Component (Pure White Background with Crisp Border) */
    .header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      background: #ffffff;
      border: 2px solid #090d16;
      border-radius: 10px;
      color: #090d16;
      flex-shrink: 0;
    }}
    
    .logo-container {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    
    .brand-logo-img {{
      height: 32px;
      width: auto;
      object-fit: contain;
    }}
    
    .brand-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 19px;
      font-weight: 900;
      color: #090d16;
      letter-spacing: -0.3px;
      line-height: 1;
    }}
    .brand-title span {{
      color: #1d4ed8;
    }}
    
    .brand-subline {{
      font-size: 8.5px;
      color: #1e293b;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }}
    
    .header-badge {{
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 5px 12px;
      border-radius: 20px;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1.5px solid #1d4ed8;
    }}
    
    /* Footer Component (Pure White Background) */
    .footer {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      background: #ffffff;
      border: 2px solid #090d16;
      border-radius: 8px;
      color: #090d16;
      font-size: 9.5px;
      font-weight: 800;
      flex-shrink: 0;
      margin-top: auto;
    }}
    .footer span.highlight {{
      color: #1d4ed8;
    }}
    
    /* Content Container */
    .content-body {{
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }}
    
    /* Typography */
    h1, h2, h3, h4 {{
      font-family: 'Outfit', sans-serif;
      color: #090d16;
      font-weight: 800;
      line-height: 1.15;
    }}
    
    .text-body {{
      color: #090d16;
      font-size: 11px;
      line-height: 1.45;
      font-weight: 600;
    }}
    
    /* Card Styles (All Pure White with Bold Crisp Borders) */
    .card-bordered {{
      background: #ffffff;
      border: 2px solid #090d16;
      border-radius: 12px;
      padding: 14px 16px;
    }}
    
    .card-blue-bordered {{
      background: #ffffff;
      border: 2.5px solid #1d4ed8;
      border-radius: 12px;
      padding: 14px 18px;
    }}
    
    .card-green-bordered {{
      background: #ffffff;
      border: 2.5px solid #059669;
      border-radius: 12px;
      padding: 14px 18px;
    }}
    
    /* Grid Utilities */
    .grid-2 {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }}
    .grid-3 {{
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }}
    .grid-4 {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }}
    
    /* Signature Seal */
    .seal-badge {{
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      background: #ecfdf5;
      color: #065f46;
      border: 1.5px solid #059669;
      border-radius: 6px;
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }}
    
    .signature-text {{
      font-family: 'Caveat', cursive;
      font-size: 36px;
      color: #1d4ed8;
      font-weight: 700;
      line-height: 1;
    }}
  </style>
</head>
<body>

  <!-- =================================================== -->
  <!-- PAGE 1: EXECUTIVE COVER (ALL WHITE BACKGROUNDS)     -->
  <!-- =================================================== -->
  <div class="page">
    <div class="header">
      <div class="logo-container">
        <img src="{logo_base64}" class="brand-logo-img" alt="AutoApplyCV Logo">
        <div>
          <div class="brand-title">AutoApply<span>CV</span></div>
          <div class="brand-subline">Recruitment &amp; Candidate Outreach Agency</div>
        </div>
      </div>
      <div class="header-badge">Official Corporate Publication</div>
    </div>

    <div class="content-body">
      <!-- Title & Headline Block (Pure White with Crisp Border) -->
      <div class="card-bordered" style="border: 2.5px solid #090d16; padding: 16px 20px; border-left: 8px solid #1d4ed8;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="background: #1d4ed8; color: #ffffff; font-size: 10px; font-weight: 900; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
            Candidate Placement &amp; Outreach Desk
          </span>
          <span style="color: #1d4ed8; font-size: 11px; font-weight: 900;">500+ Verified Recruiter Network</span>
        </div>
        <h1 style="color: #090d16; font-size: 27px; line-height: 1.15; margin-bottom: 8px; font-weight: 900;">
          Connecting Ambitious Professionals With <span style="color: #1d4ed8;">Verified Corporate Hiring Leads</span>
        </h1>
        <p style="color: #090d16; font-size: 12px; line-height: 1.45; font-weight: 600;">
          Direct candidate-to-recruiter outreach model engineered to bypass portal application black holes and place your executive profile directly onto corporate HR desks across India.
        </p>
      </div>

      <!-- Large Hero Photo Card -->
      <div style="position: relative; border-radius: 12px; overflow: hidden; border: 2.5px solid #090d16; height: 330px; flex-shrink: 0;">
        <img src="{img_interview_b64}" style="width: 100%; height: 100%; object-fit: cover;" alt="Recruitment Interview">
        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(255,255,255,0.98), rgba(255,255,255,0.85) 65%, transparent); padding: 14px 18px; color: #090d16; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1.5px solid #090d16;">
          <div>
            <div style="font-size: 15px; font-weight: 900; color: #090d16; margin-bottom: 2px;">Multi-Channel Recruiter Circulation</div>
            <div style="font-size: 11.5px; color: #090d16; font-weight: 700;">Direct candidate pitches dispatched to corporate email IDs &amp; WhatsApp recruitment desks</div>
          </div>
          <div style="background: #1d4ed8; color: #ffffff; font-size: 11px; font-weight: 900; padding: 6px 14px; border-radius: 8px; text-transform: uppercase;">
            100% Direct Intros
          </div>
        </div>
      </div>

      <!-- 3 Dense Value Cards (All White Backgrounds) -->
      <div class="grid-3">
        <div class="card-bordered" style="padding: 14px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <div style="width: 24px; height: 24px; background: #1d4ed8; color: #ffffff; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px;">✓</div>
            <h4 style="font-size: 13px; color: #090d16;">Direct HR Access</h4>
          </div>
          <p class="text-body" style="font-size: 10.5px; line-height: 1.4;">
            Direct introductions to 500+ verified talent acquisition specialists and department hiring leads.
          </p>
        </div>

        <div class="card-bordered" style="padding: 14px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <div style="width: 24px; height: 24px; background: #059669; color: #ffffff; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px;">✓</div>
            <h4 style="font-size: 13px; color: #090d16;">Multi-Channel Delivery</h4>
          </div>
          <p class="text-body" style="font-size: 10.5px; line-height: 1.4;">
            Coordinated outreach across corporate emails, official WhatsApp desks, and verified recruiter channels.
          </p>
        </div>

        <div class="card-bordered" style="padding: 14px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <div style="width: 24px; height: 24px; background: #7c3aed; color: #ffffff; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px;">✓</div>
            <h4 style="font-size: 13px; color: #090d16;">Zero Commission</h4>
          </div>
          <p class="text-body" style="font-size: 10.5px; line-height: 1.4;">
            Fixed transparent upfront pricing. We take 0% of your future salary or sign-on bonuses.
          </p>
        </div>
      </div>

      <!-- Metrics Bar (Pure White Background with Crisp Border) -->
      <div class="card-bordered" style="padding: 12px 16px; display: flex; justify-content: space-around; align-items: center; background: #ffffff;">
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: 900; color: #1d4ed8;">0 – 15 YOE</div>
          <div style="font-size: 10px; color: #090d16; font-weight: 800; text-transform: uppercase;">Experience Range</div>
        </div>
        <div style="width: 2px; height: 30px; background: #090d16;"></div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: 900; color: #1d4ed8;">500+ Recruiters</div>
          <div style="font-size: 10px; color: #090d16; font-weight: 800; text-transform: uppercase;">Active Network</div>
        </div>
        <div style="width: 2px; height: 30px; background: #090d16;"></div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: 900; color: #1d4ed8;">24 – 48 Hours</div>
          <div style="font-size: 10px; color: #090d16; font-weight: 800; text-transform: uppercase;">Activation Time</div>
        </div>
        <div style="width: 2px; height: 30px; background: #090d16;"></div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: 900; color: #1d4ed8;">Pan-India</div>
          <div style="font-size: 10px; color: #090d16; font-weight: 800; text-transform: uppercase;">Corporate Reach</div>
        </div>
      </div>

      <!-- Action Banner (Pure White Background with Blue Border) -->
      <div class="card-blue-bordered" style="padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; background: #ffffff;">
        <div>
          <div style="font-size: 13.5px; font-weight: 900; color: #090d16;">Ready to Accelerate Your Career Search?</div>
          <div style="font-size: 11px; color: #1d4ed8; font-weight: 700;">Visit autoapplycv.in/recruitment-agency or contact support@autoapplycv.in</div>
        </div>
        <div style="background: #1d4ed8; color: #ffffff; font-size: 11px; font-weight: 900; padding: 8px 16px; border-radius: 8px; text-transform: uppercase;">
          Enroll Today
        </div>
      </div>
    </div>

    <div class="footer">
      <div>AutoApplyCV Recruitment Agency | Official Candidate Brochure</div>
      <div>Portal: <span class="highlight">autoapplycv.in</span> | Page 1 of 6</div>
    </div>
  </div>


  <!-- =================================================== -->
  <!-- PAGE 2: ABOUT & LEADERSHIP SEAL (ALL WHITE BG)     -->
  <!-- =================================================== -->
  <div class="page">
    <div class="header">
      <div class="logo-container">
        <img src="{logo_base64}" class="brand-logo-img" alt="AutoApplyCV Logo">
        <div>
          <div class="brand-title">AutoApply<span>CV</span></div>
          <div class="brand-subline">Corporate Profile &amp; Leadership</div>
        </div>
      </div>
      <div class="header-badge">Executive Authorization</div>
    </div>

    <div class="content-body">
      <!-- Section Title Box -->
      <div class="card-bordered" style="background: #ffffff; border-left: 6px solid #1d4ed8; padding: 14px 18px;">
        <h2 style="font-size: 22px; color: #090d16; margin-bottom: 4px;">
          About <span style="color: #1d4ed8;">AutoApplyCV</span> Recruitment Agency
        </h2>
        <p class="text-body" style="font-size: 11.5px; line-height: 1.45;">
          AutoApplyCV is a professional candidate job-search assistance and corporate recruitment agency. We partner with ambitious candidates across technology, software development, data analytics, SCADA engineering, and business operations to bypass portal queues and connect directly with verified corporate hiring decision-makers.
        </p>
      </div>

      <!-- 4 High-Impact Metric Cards (Pure White Backgrounds) -->
      <div class="grid-4">
        <div class="card-bordered" style="padding: 14px 10px; text-align: center; border-top: 4px solid #1d4ed8;">
          <div style="font-size: 24px; font-weight: 900; color: #1d4ed8; line-height: 1;">1,200+</div>
          <div style="font-size: 9.5px; color: #090d16; font-weight: 800; margin-top: 4px; text-transform: uppercase;">Assisted Candidates</div>
        </div>

        <div class="card-bordered" style="padding: 14px 10px; text-align: center; border-top: 4px solid #059669;">
          <div style="font-size: 24px; font-weight: 900; color: #059669; line-height: 1;">500+</div>
          <div style="font-size: 9.5px; color: #090d16; font-weight: 800; margin-top: 4px; text-transform: uppercase;">Verified Recruiters</div>
        </div>

        <div class="card-bordered" style="padding: 14px 10px; text-align: center; border-top: 4px solid #7c3aed;">
          <div style="font-size: 24px; font-weight: 900; color: #7c3aed; line-height: 1;">38% Avg</div>
          <div style="font-size: 9.5px; color: #090d16; font-weight: 800; margin-top: 4px; text-transform: uppercase;">Salary Increment</div>
        </div>

        <div class="card-bordered" style="padding: 14px 10px; text-align: center; border-top: 4px solid #ea580c;">
          <div style="font-size: 24px; font-weight: 900; color: #ea580c; line-height: 1;">14–21 Days</div>
          <div style="font-size: 9.5px; color: #090d16; font-weight: 800; margin-top: 4px; text-transform: uppercase;">Outreach Response</div>
        </div>
      </div>

      <!-- Office Photo -->
      <div style="border-radius: 12px; overflow: hidden; border: 2px solid #090d16; height: 240px; flex-shrink: 0;">
        <img src="{img_desk_b64}" style="width: 100%; height: 100%; object-fit: cover;" alt="Recruitment Consultant Office">
      </div>

      <!-- Core Commitments (3 High-Contrast Cards) -->
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div class="card-bordered" style="padding: 10px 14px; border-left: 6px solid #1d4ed8;">
          <div style="font-size: 12px; font-weight: 800; color: #090d16;">1. Transparent Candidate Representation</div>
          <div style="font-size: 10.5px; color: #090d16; font-weight: 600; margin-top: 2px;">
            We do not make misleading job guarantees. We provide structured, verifiable recruiter outreach with complete pipeline visibility and tracking.
          </div>
        </div>

        <div class="card-bordered" style="padding: 10px 14px; border-left: 6px solid #059669;">
          <div style="font-size: 12px; font-weight: 800; color: #090d16;">2. Verified HR &amp; Recruiter Desk Network</div>
          <div style="font-size: 10.5px; color: #090d16; font-weight: 600; margin-top: 2px;">
            Our proprietary recruiter repository covers top technology enterprises, high-growth startups, and multinational consulting firms across India.
          </div>
        </div>

        <div class="card-bordered" style="padding: 10px 14px; border-left: 6px solid #7c3aed;">
          <div style="font-size: 12px; font-weight: 800; color: #090d16;">3. Dedicated Talent Outreach Manager</div>
          <div style="font-size: 10.5px; color: #090d16; font-weight: 600; margin-top: 2px;">
            Every Premium outreach campaign is actively monitored and coordinated by an assigned talent outreach specialist from start to finish.
          </div>
        </div>
      </div>

      <!-- Authorized Founder Signature Seal Card (Pure White Background) -->
      <div class="card-bordered" style="padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; border: 2.5px solid #090d16; background: #ffffff;">
        <div>
          <div class="seal-badge" style="margin-bottom: 4px;">✓ Verified Agency Authority</div>
          <div class="signature-text">Vishal</div>
          <div style="font-size: 12px; font-weight: 900; color: #090d16;">Vishal — Founder &amp; Authorized Signatory</div>
          <div style="font-size: 10px; color: #090d16; font-weight: 600;">AutoApplyCV Recruitment &amp; Candidate Services Desk</div>
        </div>
        <div style="text-align: right; border-left: 2px solid #090d16; padding-left: 20px;">
          <div style="font-size: 9.5px; color: #090d16; font-weight: 800; text-transform: uppercase;">Official Registry</div>
          <div style="font-size: 13px; font-weight: 900; color: #1d4ed8; margin-top: 2px;">AACV-REG-2026</div>
          <div style="font-size: 9.5px; color: #090d16; margin-top: 4px; font-weight: 700;">support@autoapplycv.in</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>AutoApplyCV Recruitment Agency | Agency Mission &amp; Profile</div>
      <div>Portal: <span class="highlight">autoapplycv.in</span> | Page 2 of 6</div>
    </div>
  </div>


  <!-- =================================================== -->
  <!-- PAGE 3: CORE CAPABILITIES (ALL WHITE BG)            -->
  <!-- =================================================== -->
  <div class="page">
    <div class="header">
      <div class="logo-container">
        <img src="{logo_base64}" class="brand-logo-img" alt="AutoApplyCV Logo">
        <div>
          <div class="brand-title">AutoApply<span>CV</span></div>
          <div class="brand-subline">Candidate Service Capabilities</div>
        </div>
      </div>
      <div class="header-badge">Service Portfolio</div>
    </div>

    <div class="content-body">
      <!-- Section Intro -->
      <div class="card-bordered" style="background: #ffffff; border-left: 6px solid #1d4ed8; padding: 12px 18px;">
        <h2 style="font-size: 22px; color: #090d16; margin-bottom: 2px;">
          How We Accelerate Your <span style="color: #1d4ed8;">Job Search</span>
        </h2>
        <p class="text-body" style="font-size: 11px;">
          End-to-end recruitment matching, direct HR outreach pitches, and multi-channel profile circulation tailored to your core technical stack and target compensation.
        </p>
      </div>

      <!-- Photo Banner -->
      <div style="border-radius: 12px; overflow: hidden; border: 2px solid #090d16; height: 235px; flex-shrink: 0;">
        <img src="{img_success_b64}" style="width: 100%; height: 100%; object-fit: cover;" alt="Placed Candidates Success">
      </div>

      <!-- 4 Core Service Cards in 2x2 Grid -->
      <div class="grid-2" style="gap: 10px;">
        <!-- Capability 1 -->
        <div class="card-bordered" style="background: #ffffff; border-top: 5px solid #1d4ed8; padding: 12px 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <h4 style="font-size: 13px; color: #090d16;">1. Curated Job Discovery</h4>
            <span style="background: #1d4ed8; color: #ffffff; font-size: 9px; font-weight: 900; padding: 2px 7px; border-radius: 4px;">MATCHING</span>
          </div>
          <p class="text-body" style="font-size: 10.5px; margin-bottom: 6px;">
            Algorithmic role matching filtered specifically for your core technical stack, domain, years of experience, and target metropolitan locations.
          </p>
          <div style="font-size: 10px; color: #1d4ed8; font-weight: 800;">✓ Exact ATS Keyword Tuning &amp; Title Fit</div>
        </div>

        <!-- Capability 2 -->
        <div class="card-bordered" style="background: #ffffff; border-top: 5px solid #059669; padding: 12px 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <h4 style="font-size: 13px; color: #090d16;">2. Direct Recruiter Outreach</h4>
            <span style="background: #059669; color: #ffffff; font-size: 9px; font-weight: 900; padding: 2px 7px; border-radius: 4px;">OUTREACH</span>
          </div>
          <p class="text-body" style="font-size: 10.5px; margin-bottom: 6px;">
            Customized introductory pitches dispatched directly to verified corporate email IDs and official WhatsApp recruitment desks.
          </p>
          <div style="font-size: 10px; color: #059669; font-weight: 800;">✓ Verified Hiring Manager Inboxes</div>
        </div>

        <!-- Capability 3 -->
        <div class="card-bordered" style="background: #ffffff; border-top: 5px solid #7c3aed; padding: 12px 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <h4 style="font-size: 13px; color: #090d16;">3. Targeted CV Circulation</h4>
            <span style="background: #7c3aed; color: #ffffff; font-size: 9px; font-weight: 900; padding: 2px 7px; border-radius: 4px;">CIRCULATION</span>
          </div>
          <p class="text-body" style="font-size: 10.5px; margin-bottom: 6px;">
            Strategic candidate profile placement across exclusive recruiter circles, hiring groups, and professional LinkedIn forums.
          </p>
          <div style="font-size: 10px; color: #7c3aed; font-weight: 800;">✓ Active Talent Sourcing Pools</div>
        </div>

        <!-- Capability 4 -->
        <div class="card-bordered" style="background: #ffffff; border-top: 5px solid #ea580c; padding: 12px 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <h4 style="font-size: 13px; color: #090d16;">4. Interview &amp; Offer Guidance</h4>
            <span style="background: #ea580c; color: #ffffff; font-size: 9px; font-weight: 900; padding: 2px 7px; border-radius: 4px;">GUIDANCE</span>
          </div>
          <p class="text-body" style="font-size: 10.5px; margin-bottom: 6px;">
            Coordination support when recruiters request screening discussions, technical rounds, and compensation benchmarking.
          </p>
          <div style="font-size: 10px; color: #ea580c; font-weight: 800;">✓ Fair Market CTC Negotiation Support</div>
        </div>
      </div>

      <!-- Domain Coverage Bar (Pure White Background) -->
      <div class="card-bordered" style="padding: 12px 16px; background: #ffffff;">
        <div style="font-size: 11px; font-weight: 900; color: #1d4ed8; text-transform: uppercase; margin-bottom: 6px;">
          Industries &amp; Job Domains Actively Covered:
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span style="background: #ffffff; color: #090d16; border: 1.5px solid #090d16; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">Software &amp; Cloud (Java, Python, React, AWS)</span>
          <span style="background: #ffffff; color: #090d16; border: 1.5px solid #090d16; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">Data Science &amp; AI / ML</span>
          <span style="background: #ffffff; color: #090d16; border: 1.5px solid #090d16; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">SCADA &amp; Industrial Automation</span>
          <span style="background: #ffffff; color: #090d16; border: 1.5px solid #090d16; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">FinTech &amp; Banking</span>
          <span style="background: #ffffff; color: #090d16; border: 1.5px solid #090d16; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">Product Management &amp; Analytics</span>
        </div>
      </div>

      <!-- Bottom Specialist Card (Pure White Background) -->
      <div class="card-blue-bordered" style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; background: #ffffff;">
        <div>
          <div style="font-size: 13px; font-weight: 900; color: #090d16;">Dedicated Outreach Specialist Assigned</div>
          <div style="font-size: 10.5px; color: #1d4ed8; font-weight: 700;">Every candidate campaign is monitored and managed by a dedicated talent outreach manager.</div>
        </div>
        <div style="background: #1d4ed8; color: #ffffff; font-size: 10.5px; font-weight: 900; padding: 6px 14px; border-radius: 6px;">
          100% Direct Intros
        </div>
      </div>
    </div>

    <div class="footer">
      <div>AutoApplyCV Recruitment Agency | Service Capabilities</div>
      <div>Portal: <span class="highlight">autoapplycv.in</span> | Page 3 of 6</div>
    </div>
  </div>


  <!-- =================================================== -->
  <!-- PAGE 4: 6-PHASE PLACEMENT FRAMEWORK (ALL WHITE BG) -->
  <!-- =================================================== -->
  <div class="page">
    <div class="header">
      <div class="logo-container">
        <img src="{logo_base64}" class="brand-logo-img" alt="AutoApplyCV Logo">
        <div>
          <div class="brand-title">AutoApply<span>CV</span></div>
          <div class="brand-subline">Candidate Placement Methodology</div>
        </div>
      </div>
      <div class="header-badge">6-Phase Framework</div>
    </div>

    <div class="content-body" style="gap: 12px;">
      <!-- Section Intro -->
      <div class="card-bordered" style="background: #ffffff; border-left: 6px solid #1d4ed8; padding: 14px 18px;">
        <h2 style="font-size: 22px; color: #090d16; margin-bottom: 3px;">
          Our 6-Phase <span style="color: #1d4ed8;">Placement Framework</span>
        </h2>
        <p class="text-body" style="font-size: 11.5px; line-height: 1.45;">
          A systematic, multi-tiered outreach methodology designed to bypass automated portal filters and secure direct conversations with hiring decision-makers.
        </p>
      </div>

      <!-- 6 Phases in 2x3 Grid (Large & Detailed) -->
      <div class="grid-2" style="gap: 12px;">
        <!-- Phase 1 -->
        <div class="card-bordered" style="background: #ffffff; display: flex; gap: 12px; align-items: flex-start; padding: 15px 16px;">
          <div style="background: #1d4ed8; color: #ffffff; font-size: 15px; font-weight: 900; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            01
          </div>
          <div>
            <h4 style="font-size: 13px; color: #090d16;">Phase 1: Profile Audit &amp; Keywords</h4>
            <p class="text-body" style="font-size: 11px; margin-top: 4px; line-height: 1.4;">
              ATS compatibility benchmarking and resume keyword alignment to match real recruiter search queries.
            </p>
          </div>
        </div>

        <!-- Phase 2 -->
        <div class="card-bordered" style="background: #ffffff; display: flex; gap: 12px; align-items: flex-start; padding: 15px 16px;">
          <div style="background: #1d4ed8; color: #ffffff; font-size: 15px; font-weight: 900; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            02
          </div>
          <div>
            <h4 style="font-size: 13px; color: #090d16;">Phase 2: Recruiter &amp; Role Mapping</h4>
            <p class="text-body" style="font-size: 11px; margin-top: 4px; line-height: 1.4;">
              Identifying active requisitions and mapping verified HR managers, department heads, and talent partners.
            </p>
          </div>
        </div>

        <!-- Phase 3 -->
        <div class="card-bordered" style="background: #ffffff; display: flex; gap: 12px; align-items: flex-start; padding: 15px 16px;">
          <div style="background: #1d4ed8; color: #ffffff; font-size: 15px; font-weight: 900; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            03
          </div>
          <div>
            <h4 style="font-size: 13px; color: #090d16;">Phase 3: Multi-Channel Dispatch</h4>
            <p class="text-body" style="font-size: 11px; margin-top: 4px; line-height: 1.4;">
              Deploying tailored candidate pitches directly to corporate email IDs, official WhatsApp desks, and inboxes.
            </p>
          </div>
        </div>

        <!-- Phase 4 -->
        <div class="card-bordered" style="background: #ffffff; display: flex; gap: 12px; align-items: flex-start; padding: 15px 16px;">
          <div style="background: #1d4ed8; color: #ffffff; font-size: 15px; font-weight: 900; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            04
          </div>
          <div>
            <h4 style="font-size: 13px; color: #090d16;">Phase 4: Warm Pipeline Follow-Ups</h4>
            <p class="text-body" style="font-size: 11px; margin-top: 4px; line-height: 1.4;">
              Systematic second-touch and re-engagement messaging with responsive recruiters to keep you top-of-mind.
            </p>
          </div>
        </div>

        <!-- Phase 5 -->
        <div class="card-bordered" style="background: #ffffff; display: flex; gap: 12px; align-items: flex-start; padding: 15px 16px;">
          <div style="background: #1d4ed8; color: #ffffff; font-size: 15px; font-weight: 900; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            05
          </div>
          <div>
            <h4 style="font-size: 13px; color: #090d16;">Phase 5: Interview Scheduling</h4>
            <p class="text-body" style="font-size: 11px; margin-top: 4px; line-height: 1.4;">
              Direct coordination assistance when recruiters request screening discussions, portfolio reviews, or rounds.
            </p>
          </div>
        </div>

        <!-- Phase 6 -->
        <div class="card-bordered" style="background: #ffffff; display: flex; gap: 12px; align-items: flex-start; padding: 15px 16px;">
          <div style="background: #1d4ed8; color: #ffffff; font-size: 15px; font-weight: 900; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            06
          </div>
          <div>
            <h4 style="font-size: 13px; color: #090d16;">Phase 6: Negotiation &amp; Onboarding</h4>
            <p class="text-body" style="font-size: 11px; margin-top: 4px; line-height: 1.4;">
              Compensation benchmarking guidance and professional transition support to secure fair market valuation.
            </p>
          </div>
        </div>
      </div>

      <!-- Campaign Timeline Card (Pure White Background) -->
      <div class="card-bordered" style="padding: 18px 22px; background: #ffffff;">
        <div style="font-size: 12.5px; font-weight: 900; color: #1d4ed8; margin-bottom: 12px; text-transform: uppercase;">
          Standard 3-Week Candidate Campaign Lifecycle:
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 14px; text-align: center;">
          <div style="background: #ffffff; border: 2px solid #090d16; padding: 14px 16px; border-radius: 8px; flex: 1;">
            <div style="font-size: 14px; font-weight: 900; color: #1d4ed8;">WEEK 1</div>
            <div style="font-size: 11px; color: #090d16; font-weight: 700; margin-top: 3px;">Audit &amp; Recruiter Mapping</div>
          </div>
          <div style="color: #1d4ed8; font-size: 20px; font-weight: 900;">➔</div>
          <div style="background: #ffffff; border: 2px solid #090d16; padding: 14px 16px; border-radius: 8px; flex: 1;">
            <div style="font-size: 14px; font-weight: 900; color: #1d4ed8;">WEEK 2</div>
            <div style="font-size: 11px; color: #090d16; font-weight: 700; margin-top: 3px;">Multi-Channel Dispatch</div>
          </div>
          <div style="color: #1d4ed8; font-size: 20px; font-weight: 900;">➔</div>
          <div style="background: #ffffff; border: 2px solid #090d16; padding: 14px 16px; border-radius: 8px; flex: 1;">
            <div style="font-size: 14px; font-weight: 900; color: #1d4ed8;">WEEK 3+</div>
            <div style="font-size: 11px; color: #090d16; font-weight: 700; margin-top: 3px;">Recruiter Callbacks &amp; Intros</div>
          </div>
        </div>
      </div>

      <!-- Action Enrollment Banner (Pure White Background) -->
      <div class="card-blue-bordered" style="padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; background: #ffffff;">
        <div>
          <div style="font-size: 14px; font-weight: 900; color: #090d16;">Ready to launch your candidate outreach campaign?</div>
          <div style="font-size: 11.5px; color: #1d4ed8; font-weight: 700; margin-top: 2px;">Packages start at ₹500 with instant recruiter directory access.</div>
        </div>
        <div style="background: #1d4ed8; color: #ffffff; font-size: 11.5px; font-weight: 900; padding: 10px 18px; border-radius: 8px; text-transform: uppercase;">
          ENROLL TODAY
        </div>
      </div>
    </div>

    <div class="footer">
      <div>AutoApplyCV Recruitment Agency | 6-Phase Framework</div>
      <div>Portal: <span class="highlight">autoapplycv.in</span> | Page 4 of 6</div>
    </div>
  </div>


  <!-- =================================================== -->
  <!-- PAGE 5: PRICING & SERVICE MATRIX (ALL WHITE BG)     -->
  <!-- =================================================== -->
  <div class="page">
    <div class="header">
      <div class="logo-container">
        <img src="{logo_base64}" class="brand-logo-img" alt="AutoApplyCV Logo">
        <div>
          <div class="brand-title">AutoApply<span>CV</span></div>
          <div class="brand-subline">Transparent Pricing &amp; Comparison</div>
        </div>
      </div>
      <div class="header-badge">Zero Hidden Fees</div>
    </div>

    <div class="content-body" style="gap: 12px;">
      <!-- Section Intro -->
      <div class="card-bordered" style="background: #ffffff; border-left: 6px solid #1d4ed8; padding: 14px 18px;">
        <h2 style="font-size: 22px; color: #090d16; margin-bottom: 3px;">
          Transparent <span style="color: #1d4ed8;">Service Packages</span>
        </h2>
        <p class="text-body" style="font-size: 11.5px;">
          Straightforward one-time pricing with zero recurring lock-ins and zero salary commission cuts.
        </p>
      </div>

      <!-- 2 Plan Cards Side by Side -->
      <div class="grid-2" style="gap: 14px;">
        <!-- Plan 1 -->
        <div class="card-bordered" style="background: #ffffff; border: 2.5px solid #090d16; padding: 16px 18px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
            <h3 style="font-size: 16px; color: #090d16;">Job Search Access</h3>
            <span style="font-size: 10px; font-weight: 800; color: #090d16; background: #f1f5f9; border: 1.5px solid #090d16; padding: 3px 8px; border-radius: 4px;">SELF-MANAGED</span>
          </div>
          <p style="font-size: 11px; color: #090d16; font-weight: 600; margin-bottom: 8px;">Essential curated discovery &amp; verified HR repository.</p>
          <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 12px;">
            <span style="font-size: 28px; font-weight: 900; color: #090d16; font-family: 'Outfit';">₹500</span>
            <span style="font-size: 11.5px; color: #090d16; font-weight: 800;">/ one-time</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 7px; font-size: 11px; color: #090d16; font-weight: 600;">
            <div>✓ Curated relevant job openings matched to your profile</div>
            <div>✓ Verified corporate HR &amp; recruiter email contacts</div>
            <div>✓ Direct WhatsApp recruiter messaging contacts</div>
            <div>✓ Proven cold outreach email &amp; message templates</div>
            <div>✓ Weekly alerts on newly published matching roles</div>
          </div>

          <div style="margin-top: 16px; text-align: center; background: #ffffff; color: #090d16; border: 2px solid #090d16; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: 900;">
            GET DIRECT CONTACTS (₹500)
          </div>
        </div>

        <!-- Plan 2 -->
        <div class="card-bordered" style="background: #ffffff; border: 2.5px solid #1d4ed8; padding: 16px 18px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
            <h3 style="font-size: 16px; color: #1d4ed8;">Premium Job Outreach</h3>
            <span style="font-size: 10px; font-weight: 900; color: #ffffff; background: #1d4ed8; padding: 4px 9px; border-radius: 4px;">★ RECOMMENDED</span>
          </div>
          <p style="font-size: 11px; color: #090d16; font-weight: 600; margin-bottom: 8px;">Comprehensive end-to-end recruiter engagement.</p>
          <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 12px;">
            <span style="font-size: 28px; font-weight: 900; color: #1d4ed8; font-family: 'Outfit';">₹2,000</span>
            <span style="font-size: 11.5px; color: #1d4ed8; font-weight: 800;">/ one-time</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 7px; font-size: 11px; color: #090d16; font-weight: 600;">
            <div>✓ Deep algorithmic matching to active premier hiring roles</div>
            <div>✓ Direct candidate intro dispatch via official WhatsApp</div>
            <div>✓ Personalized introductory cold emails to hiring leads</div>
            <div>✓ Company portal application navigation &amp; guidance</div>
            <div>✓ Resume placement in exclusive recruiter communities</div>
            <div>✓ Dedicated application tracker &amp; follow-up assistance</div>
          </div>

          <div style="margin-top: 16px; text-align: center; background: #1d4ed8; color: #ffffff; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: 900;">
            ENROLL IN PREMIUM (₹2,000)
          </div>
        </div>
      </div>

      <!-- Feature Comparison Table (Pure White Background) -->
      <div style="border: 2px solid #090d16; border-radius: 10px; overflow: hidden; font-size: 11.5px; background: #ffffff;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #ffffff; border-bottom: 2px solid #090d16; color: #090d16;">
              <th style="padding: 10px 14px; font-weight: 900;">Deliverable / Capability</th>
              <th style="padding: 10px 14px; font-weight: 900; text-align: center;">Job Search Access (₹500)</th>
              <th style="padding: 10px 14px; font-weight: 900; text-align: center; color: #1d4ed8;">Premium Outreach (₹2,000)</th>
            </tr>
          </thead>
          <tbody style="font-weight: 700; color: #090d16;">
            <tr style="border-bottom: 1.5px solid #090d16; background: #ffffff;">
              <td style="padding: 9px 14px;">Targeted Role Matching</td>
              <td style="padding: 9px 14px; text-align: center;">Standard</td>
              <td style="padding: 9px 14px; text-align: center; color: #1d4ed8; font-weight: 900;">Priority High-Match</td>
            </tr>
            <tr style="border-bottom: 1.5px solid #090d16; background: #ffffff;">
              <td style="padding: 9px 14px;">Direct Recruiter Email Outreach</td>
              <td style="padding: 9px 14px; text-align: center;">Contact List Provided</td>
              <td style="padding: 9px 14px; text-align: center; color: #1d4ed8; font-weight: 900;">Dispatched by Agency Team</td>
            </tr>
            <tr style="border-bottom: 1.5px solid #090d16; background: #ffffff;">
              <td style="padding: 9px 14px;">WhatsApp Recruiter Introduction</td>
              <td style="padding: 9px 14px; text-align: center;">Contact Info Provided</td>
              <td style="padding: 9px 14px; text-align: center; color: #1d4ed8; font-weight: 900;">Direct Introduction Sent</td>
            </tr>
            <tr style="border-bottom: 1.5px solid #090d16; background: #ffffff;">
              <td style="padding: 9px 14px;">Resume Placement in Recruiter Circles</td>
              <td style="padding: 9px 14px; text-align: center;">Self-Submission</td>
              <td style="padding: 9px 14px; text-align: center; color: #1d4ed8; font-weight: 900;">Active Agency Circulation</td>
            </tr>
            <tr style="background: #ffffff;">
              <td style="padding: 9px 14px;">Dedicated Outreach Specialist</td>
              <td style="padding: 9px 14px; text-align: center;">Self-Guided</td>
              <td style="padding: 9px 14px; text-align: center; color: #1d4ed8; font-weight: 900;">Assigned Manager</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Transparency Notice Box -->
      <div style="background: #ffffff; border: 2px solid #d97706; border-radius: 10px; padding: 12px 16px; display: flex; align-items: flex-start; gap: 12px;">
        <div style="background: #d97706; color: #ffffff; font-weight: 900; font-size: 13px; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">!</div>
        <div style="font-size: 11px; color: #78350f; font-weight: 700; line-height: 1.45;">
          <strong>Transparency Policy:</strong> Interview calls and job offers depend entirely on employer requirements and recruiter responses. AutoApplyCV assists with discovery and outreach to maximize candidate visibility but does not guarantee employment or charge salary percentages.
        </div>
      </div>
    </div>

    <div class="footer">
      <div>AutoApplyCV Recruitment Agency | Pricing &amp; Packages</div>
      <div>Portal: <span class="highlight">autoapplycv.in</span> | Page 5 of 6</div>
    </div>
  </div>


  <!-- =================================================== -->
  <!-- PAGE 6: CONTACT & WHATSAPP / CALL SUBMISSION GUIDE -->
  <!-- =================================================== -->
  <div class="page">
    <div class="header">
      <div class="logo-container">
        <img src="{logo_base64}" class="brand-logo-img" alt="AutoApplyCV Logo">
        <div>
          <div class="brand-title">AutoApply<span>CV</span></div>
          <div class="brand-subline">Contact Directory &amp; Immediate Enrollment</div>
        </div>
      </div>
      <div class="header-badge">Get Started Now</div>
    </div>

    <div class="content-body" style="gap: 12px;">
      <!-- Section Intro -->
      <div class="card-bordered" style="background: #ffffff; border-left: 6px solid #1d4ed8; padding: 12px 18px;">
        <h2 style="font-size: 22px; color: #090d16; margin-bottom: 3px;">
          Get in Touch with <span style="color: #1d4ed8;">AutoApplyCV</span>
        </h2>
        <p class="text-body" style="font-size: 11.5px;">
          Connect directly with our recruitment team via WhatsApp or phone call to activate your candidate outreach campaign today.
        </p>
      </div>

      <!-- 4 Contact Channels (2x2 Grid, All White) -->
      <div class="grid-2" style="gap: 10px;">
        <div class="card-bordered" style="background: #ffffff; display: flex; align-items: center; gap: 12px; padding: 12px 14px;">
          <div style="width: 38px; height: 38px; background: #eff6ff; border: 1.5px solid #1d4ed8; color: #1d4ed8; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
            🌐
          </div>
          <div>
            <div style="font-size: 9.5px; font-weight: 800; color: #090d16; text-transform: uppercase;">Official Web Portal</div>
            <div style="font-size: 13px; font-weight: 900; color: #1d4ed8;">www.autoapplycv.in</div>
          </div>
        </div>

        <div class="card-bordered" style="background: #ffffff; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 2.5px solid #059669;">
          <div style="width: 38px; height: 38px; background: #ecfdf5; border: 1.5px solid #059669; color: #059669; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
            💬
          </div>
          <div>
            <div style="font-size: 9.5px; font-weight: 900; color: #059669; text-transform: uppercase;">WhatsApp Desk 1</div>
            <div style="font-size: 13px; font-weight: 900; color: #090d16;">+91 98055 59015</div>
          </div>
        </div>

        <div class="card-bordered" style="background: #ffffff; display: flex; align-items: center; gap: 12px; padding: 12px 14px;">
          <div style="width: 38px; height: 38px; background: #faf5ff; border: 1.5px solid #7c3aed; color: #7c3aed; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
            ✉️
          </div>
          <div>
            <div style="font-size: 9.5px; font-weight: 800; color: #090d16; text-transform: uppercase;">Candidate Helpdesk</div>
            <div style="font-size: 13px; font-weight: 900; color: #7c3aed;">support@autoapplycv.in</div>
          </div>
        </div>

        <div class="card-bordered" style="background: #ffffff; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 2.5px solid #059669;">
          <div style="width: 38px; height: 38px; background: #ecfdf5; border: 1.5px solid #059669; color: #059669; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
            💬
          </div>
          <div>
            <div style="font-size: 9.5px; font-weight: 900; color: #059669; text-transform: uppercase;">WhatsApp Desk 2 / Call</div>
            <div style="font-size: 13px; font-weight: 900; color: #090d16;">+91 78149 58809</div>
          </div>
        </div>
      </div>

      <!-- Scannable QR Code Box (Pure White Background) -->
      <div class="card-bordered" style="padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 18px; border: 2.5px solid #090d16; background: #ffffff;">
        <div style="background: #ffffff; border: 2px solid #090d16; padding: 6px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="{qr_b64}" style="width: 110px; height: 110px; display: block;" alt="Scannable QR Code">
        </div>
        <div style="flex: 1;">
          <div style="display: inline-block; background: #1d4ed8; color: #ffffff; font-size: 9.5px; font-weight: 900; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; margin-bottom: 6px;">
            Instant Mobile Access
          </div>
          <h3 style="font-size: 17px; color: #090d16; margin-bottom: 6px;">Scan QR to Open Candidate Portal</h3>
          <p style="font-size: 11px; color: #090d16; line-height: 1.4; margin-bottom: 8px; font-weight: 600;">
            Instantly explore curated job openings, upload your resume, and configure your multi-channel recruiter outreach campaign directly from your mobile device.
          </p>
          <div style="background: #eff6ff; border: 1.5px solid #1d4ed8; color: #1d4ed8; font-size: 11px; font-weight: 900; padding: 5px 12px; border-radius: 6px; display: inline-block;">
            https://autoapplycv.in/recruitment-agency
          </div>
        </div>
      </div>

      <!-- IMPORTANT: HOW TO GET STARTED - SEND ON WHATSAPP OR CALL US (Highlighted Action Card) -->
      <div class="card-bordered" style="background: #ffffff; border: 3px solid #059669; padding: 16px 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: #059669; color: #ffffff; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 6px; text-transform: uppercase;">
              Fast-Track Enrollment
            </span>
            <h4 style="font-size: 13.5px; color: #090d16; font-weight: 900;">
              Want to Get Started? Send this Information on WhatsApp or Call Us:
            </h4>
          </div>
          <span style="color: #059669; font-size: 10.5px; font-weight: 900;">2 Active Desks Available</span>
        </div>

        <p style="font-size: 11px; color: #090d16; font-weight: 600; margin-bottom: 8px;">
          To initiate your personalized recruiter outreach campaign immediately, send us a WhatsApp message or call our candidate desk with the following details:
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10.5px; color: #090d16; font-weight: 700;">
          <div style="background: #f8fafc; border: 1.5px solid #090d16; padding: 6px 10px; border-radius: 6px;">
            1. <strong>Updated Resume (PDF / Word)</strong>
          </div>
          <div style="background: #f8fafc; border: 1.5px solid #090d16; padding: 6px 10px; border-radius: 6px;">
            2. <strong>Target Job Roles &amp; Tech Stack</strong>
          </div>
          <div style="background: #f8fafc; border: 1.5px solid #090d16; padding: 6px 10px; border-radius: 6px;">
            3. <strong>Total Years of Experience (YOE)</strong>
          </div>
          <div style="background: #f8fafc; border: 1.5px solid #090d16; padding: 6px 10px; border-radius: 6px;">
            4. <strong>Preferred Locations &amp; Notice Period</strong>
          </div>
          <div style="background: #f8fafc; border: 1.5px solid #090d16; padding: 6px 10px; border-radius: 6px;">
            5. <strong>Current CTC vs Expected CTC</strong>
          </div>
          <div style="background: #f8fafc; border: 1.5px solid #090d16; padding: 6px 10px; border-radius: 6px;">
            6. <strong>Selected Plan (₹500 or ₹2,000)</strong>
          </div>
        </div>

        <div style="margin-top: 10px; background: #ecfdf5; border: 1.5px solid #059669; padding: 8px 12px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 10.5px; color: #065f46; font-weight: 800;">
            💬 WhatsApp 1: <strong>+91 98055 59015</strong> &nbsp;|&nbsp; 💬 WhatsApp 2 / Call: <strong>+91 78149 58809</strong>
          </span>
          <span style="background: #059669; color: #ffffff; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">
            24-Hour Dispatch
          </span>
        </div>
      </div>

      <!-- Bottom Corporate Note (Pure White Background) -->
      <div class="card-bordered" style="padding: 10px 14px; font-size: 9.5px; text-align: center; font-weight: 800; color: #090d16; background: #ffffff;">
        © 2026 AutoApplyCV Recruitment Agency. All Rights Reserved. Authorized Candidate Job Search &amp; Placement Services.
      </div>
    </div>

    <div class="footer">
      <div>AutoApplyCV Recruitment Agency | Official Contact &amp; Immediate Access</div>
      <div>Portal: <span class="highlight">autoapplycv.in</span> | Page 6 of 6</div>
    </div>
  </div>

</body>
</html>
"""

    html_path = os.path.join(workspace_root, "AutoApplyCV_Brochure.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"HTML saved to: {html_path}")

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Load HTML
        await page.goto(f"file:///{html_path.replace(os.sep, '/')}", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        
        # Render high-res snapshots of each page
        pages_elements = await page.query_selector_all(".page")
        print(f"Total pages rendered: {len(pages_elements)}")
        
        images_dir = os.path.join(workspace_root, "public", "images")
        os.makedirs(images_dir, exist_ok=True)
        
        for idx, el in enumerate(pages_elements, start=1):
            snap_path = os.path.join(images_dir, f"brochure_page_{idx}.png")
            await el.screenshot(path=snap_path)
            print(f"Saved page snapshot: {snap_path}")
            
        # Generate final PDF
        pdf_path = os.path.join(workspace_root, "AutoApplyCV_Recruitment_Brochure.pdf")
        await page.pdf(
            path=pdf_path,
            format="A4",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            prefer_css_page_size=True,
        )
        print(f"6-Page A4 Portrait PDF successfully generated at: {pdf_path}")
        
        public_pdf_path = os.path.join(workspace_root, "public", "AutoApplyCV_Recruitment_Brochure.pdf")
        import shutil
        shutil.copyfile(pdf_path, public_pdf_path)
        print(f"Public PDF saved at: {public_pdf_path}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(generate_6page_pdf())
